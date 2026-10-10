-- ════════════════════════════════════════════════════════════════════════════
-- Phoenix Habits — RENACER
--
-- Reinicia todos los datos del usuario como si empezase ahora mismo:
--   * Borra registros de hábitos, entrenamientos realizados, pesos y fotos.
--   * Conserva rutinas, ejercicios (plantillas de entrenamiento) y la definición de los hábitos.
--   * La fecha de inicio de los hábitos pasa a ser este momento: rachas y % empiezan de cero.
-- security invoker + filtro por auth.uid(): solo afecta a los datos de quien lo llama.
-- Los archivos de fotos en Storage los borra la app antes de llamar a esta función.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.user_settings add column if not exists reborn_at timestamptz;

create or replace function public.rebirth()
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ts timestamptz := clock_timestamp();
begin
  if uid is null then
    raise exception 'No autenticado';
  end if;

  delete from public.habit_logs where user_id = uid;
  delete from public.workout_sessions where user_id = uid;  -- en cascada: ejercicios y series de cada sesión
  delete from public.body_weight_logs where user_id = uid;
  delete from public.progress_photos where user_id = uid;

  update public.habits set created_at = ts, updated_at = ts where user_id = uid;

  insert into public.user_settings (user_id, reborn_at, updated_at)
  values (uid, ts, ts)
  on conflict (user_id) do update set reborn_at = excluded.reborn_at, updated_at = excluded.updated_at;

  return ts;
end;
$$;

revoke execute on function public.rebirth() from anon, public;
grant execute on function public.rebirth() to authenticated;
