-- ════════════════════════════════════════════════════════════════════════════
-- Resolución de conflictos: SIEMPRE se conserva lo último.
--
-- updated_at es el momento real en que se hizo cada cambio (reloj del cliente
-- corregido con la hora del servidor). Reglas:
--   * Actualizar: se ignora si es más antiguo que lo guardado (guard_updated_at).
--   * Borrar: solo si el dato no se modificó después del borrado (sync_delete), y
--     queda una "lápida" con la hora del borrado.
--   * Insertar: se ignora si existe una lápida más reciente (no resucita lo borrado)
--     o si es anterior al último RENACER del usuario.
-- ════════════════════════════════════════════════════════════════════════════

create table public.sync_tombstones (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  table_name text not null,
  row_key text not null,
  deleted_at timestamptz not null,
  primary key (user_id, table_name, row_key)
);

alter table public.sync_tombstones enable row level security;
create policy sync_tombstones_all on public.sync_tombstones for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.sync_tombstones from anon;

/** Clave de fila usada en las lápidas: log_date para el peso (único por día), id para el resto. */
create or replace function public.sync_row_key(p_table text, p_row jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_table = 'body_weight_logs' then p_row ->> 'log_date' else p_row ->> 'id' end;
$$;

-- Antes de insertar: no resucitar filas borradas después y no recrear datos anteriores a RENACER.
create or replace function public.guard_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  d timestamptz;
  reborn timestamptz;
begin
  if tg_table_name in ('habit_logs', 'workout_sessions', 'workout_exercises', 'workout_sets', 'body_weight_logs', 'progress_photos') then
    select s.reborn_at into reborn from public.user_settings s where s.user_id = new.user_id;
    if reborn is not null and new.updated_at < reborn then
      return null;
    end if;
  end if;

  select t.deleted_at into d
  from public.sync_tombstones t
  where t.user_id = new.user_id
    and t.table_name = tg_table_name
    and t.row_key = public.sync_row_key(tg_table_name, to_jsonb(new));
  if d is not null then
    if new.updated_at <= d then
      return null;  -- borrado más reciente que este cambio: se mantiene borrado
    end if;
    delete from public.sync_tombstones t
    where t.user_id = new.user_id and t.table_name = tg_table_name
      and t.row_key = public.sync_row_key(tg_table_name, to_jsonb(new));
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'habits', 'habit_logs', 'exercises', 'workout_routines', 'routine_exercises', 'routine_sets',
    'workout_sessions', 'workout_exercises', 'workout_sets', 'body_weight_logs', 'progress_photos'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_guard_insert', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.guard_insert()', t || '_guard_insert', t);
  end loop;
end;
$$;

/**
 * Borrado con resolución de conflictos. Registra la lápida y borra la fila solo si
 * no se modificó después del momento del borrado. Devuelve true si se borró.
 */
create or replace function public.sync_delete(p_table text, p_key text, p_deleted_at timestamptz)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  n integer;
begin
  if uid is null then
    raise exception 'No autenticado';
  end if;
  if p_table not in ('habits', 'exercises', 'workout_routines', 'routine_exercises', 'routine_sets',
                     'workout_sessions', 'workout_exercises', 'workout_sets', 'body_weight_logs', 'progress_photos') then
    raise exception 'Tabla no permitida: %', p_table;
  end if;

  insert into public.sync_tombstones (user_id, table_name, row_key, deleted_at)
  values (uid, p_table, p_key, p_deleted_at)
  on conflict (user_id, table_name, row_key)
  do update set deleted_at = greatest(public.sync_tombstones.deleted_at, excluded.deleted_at);

  if p_table = 'body_weight_logs' then
    delete from public.body_weight_logs where user_id = uid and log_date = p_key::date and updated_at <= p_deleted_at;
  else
    execute format('delete from public.%I where user_id = $1 and id = $2::uuid and updated_at <= $3', p_table)
      using uid, p_key, p_deleted_at;
  end if;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke execute on function public.sync_delete(text, text, timestamptz) from anon, public;
grant execute on function public.sync_delete(text, text, timestamptz) to authenticated;

-- Hora del servidor, para corregir relojes de dispositivos desajustados.
create or replace function public.server_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now(); $$;

revoke execute on function public.server_now() from anon, public;
grant execute on function public.server_now() to authenticated;
