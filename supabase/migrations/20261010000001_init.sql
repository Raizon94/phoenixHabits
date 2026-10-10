-- ════════════════════════════════════════════════════════════════════════════
-- Phoenix Habits — esquema inicial
--
-- Principios:
--  * Todas las tablas usan UUID y llevan user_id → RLS simple: user_id = auth.uid().
--  * Las relaciones padre-hijo usan claves foráneas compuestas (id, user_id): es
--    imposible enlazar una fila propia con datos de otro usuario aunque se conozca su id.
--  * Los entrenamientos nunca se sobrescriben: cada sesión crea filas nuevas.
--  * updated_at lo fija el cliente; un trigger descarta escrituras más antiguas que la
--    versión guardada (evita pisar datos más recientes de otro dispositivo).
--  * Las fechas de registros diarios son `date` (día local del usuario), no timestamps.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────── Funciones comunes ───────────────

create or replace function public.guard_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at is null or new.updated_at = old.updated_at then
    -- Actualización sin marca de tiempo propia: se avanza el reloj.
    new.updated_at := greatest(now(), old.updated_at + interval '1 millisecond');
  elsif new.updated_at < old.updated_at then
    -- Escritura más antigua que la guardada (p. ej. cambios offline de otro dispositivo
    -- que llegan tarde): se ignora para no sobrescribir datos más recientes.
    return null;
  end if;
  return new;
end;
$$;

-- ─────────────── Perfil y ajustes ───────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  target_weight_kg numeric(5, 2) check (target_weight_kg is null or target_weight_kg between 20 and 400),
  timezone text not null default 'Europe/Madrid' check (char_length(timezone) between 1 and 64),
  locale text not null default 'es' check (char_length(locale) between 2 and 10),
  updated_at timestamptz not null default now()
);

-- ─────────────── Hábitos ───────────────

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon text not null default 'check' check (char_length(icon) <= 40),
  color text not null default '#f97316' check (color ~ '^#[0-9a-fA-F]{6}$'),
  type text not null default 'binary' check (type in ('binary', 'numeric')),
  target_value numeric(12, 2) check (target_value is null or target_value > 0),
  unit text check (unit is null or char_length(unit) <= 20),
  schedule_days smallint[] not null default '{1,2,3,4,5,6,7}'
    check (schedule_days <@ '{1,2,3,4,5,6,7}'::smallint[]),
  sort_order integer not null default 0,
  system_key text check (system_key is null or system_key in ('gym')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (type = 'binary' or target_value is not null)
);
create index habits_user_order_idx on public.habits (user_id, sort_order);
create unique index habits_user_system_key_idx on public.habits (user_id, system_key) where system_key is not null;

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  habit_id uuid not null,
  log_date date not null,
  completed boolean not null default false,
  value numeric(12, 2) check (value is null or value >= 0),
  updated_at timestamptz not null default now(),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade,
  -- Un único registro por hábito y día: evita duplicados entre dispositivos.
  unique (habit_id, log_date)
);
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

-- ─────────────── Ejercicios y rutinas ───────────────

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  muscle_group text not null default 'other' check (muscle_group in (
    'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'quadriceps',
    'hamstrings', 'glutes', 'calves', 'abs', 'full_body', 'cardio', 'other')),
  exercise_type text not null default 'weight_reps'
    check (exercise_type in ('weight_reps', 'bodyweight', 'assisted', 'duration')),
  notes text check (notes is null or char_length(notes) <= 2000),
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index exercises_user_name_idx on public.exercises (user_id, lower(name));

create table public.workout_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (description is null or char_length(description) <= 500),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index workout_routines_user_order_idx on public.workout_routines (user_id, sort_order);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  routine_id uuid not null,
  exercise_id uuid not null,
  position integer not null check (position >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (routine_id, user_id) references public.workout_routines (id, user_id) on delete cascade,
  foreign key (exercise_id, user_id) references public.exercises (id, user_id) on delete cascade
);
create index routine_exercises_routine_idx on public.routine_exercises (routine_id, position);
create index routine_exercises_exercise_idx on public.routine_exercises (exercise_id);

-- Series plantilla: solo se usan cuando el ejercicio aún no tiene historial.
create table public.routine_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  routine_exercise_id uuid not null,
  position integer not null check (position >= 0),
  set_type text not null default 'normal' check (set_type in ('normal', 'warmup', 'approach', 'failure')),
  target_weight numeric(7, 2) check (target_weight is null or target_weight >= 0),
  target_reps integer check (target_reps is null or target_reps between 0 and 1000),
  updated_at timestamptz not null default now(),
  foreign key (routine_exercise_id, user_id) references public.routine_exercises (id, user_id) on delete cascade
);
create index routine_sets_re_idx on public.routine_sets (routine_exercise_id, position);

-- ─────────────── Sesiones de entrenamiento (historial inmutable por sesión) ───────────────

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid,
  -- Copia del nombre: el historial sigue siendo legible si la rutina se renombra o elimina.
  routine_name text not null check (char_length(routine_name) between 1 and 60),
  session_date date not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled')),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (routine_id, user_id) references public.workout_routines (id, user_id) on delete set null (routine_id),
  check (status <> 'completed' or ended_at is not null),
  check (ended_at is null or ended_at >= started_at)
);
create index workout_sessions_user_date_idx on public.workout_sessions (user_id, session_date desc);
create index workout_sessions_user_status_idx on public.workout_sessions (user_id, status, ended_at desc);
-- Solo puede haber un entrenamiento en curso por usuario (evita sesiones duplicadas).
create unique index workout_sessions_one_active_idx on public.workout_sessions (user_id) where status = 'in_progress';

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  session_id uuid not null,
  exercise_id uuid not null,
  position integer not null check (position >= 0),
  notes text check (notes is null or char_length(notes) <= 1000),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade,
  -- restrict: un ejercicio con historial no puede borrarse (se archiva) para no perder datos.
  foreign key (exercise_id, user_id) references public.exercises (id, user_id) on delete restrict
);
create index workout_exercises_session_idx on public.workout_exercises (session_id, position);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  workout_exercise_id uuid not null,
  position integer not null check (position >= 0),
  set_type text not null default 'normal' check (set_type in ('normal', 'warmup', 'approach', 'failure')),
  weight numeric(7, 2) check (weight is null or weight >= 0),
  reps integer check (reps is null or reps between 0 and 1000),
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (workout_exercise_id, user_id) references public.workout_exercises (id, user_id) on delete cascade
);
create index workout_sets_we_idx on public.workout_sets (workout_exercise_id, position);

-- ─────────────── Cuerpo ───────────────

create table public.body_weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un registro por día y usuario (modificable).
  unique (user_id, log_date)
);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  photo_date date not null,
  storage_path text not null unique,
  notes text check (notes is null or char_length(notes) <= 500),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  size_bytes integer check (size_bytes is null or size_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- La ruta del archivo siempre está dentro de la carpeta del propio usuario.
  check (storage_path like user_id::text || '/%')
);
create index progress_photos_user_date_idx on public.progress_photos (user_id, photo_date desc);

-- ─────────────── Triggers updated_at ───────────────

do $$
declare t text;
begin
  foreach t in array array[
    'user_settings', 'habits', 'habit_logs', 'exercises', 'workout_routines', 'routine_exercises',
    'routine_sets', 'workout_sessions', 'workout_exercises', 'workout_sets', 'body_weight_logs', 'progress_photos'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.guard_updated_at()',
      t || '_guard_updated_at', t);
  end loop;
end;
$$;

-- ─────────────── Row Level Security ───────────────
-- Cada usuario solo puede leer, crear, modificar y borrar sus propias filas.

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare t text;
begin
  foreach t in array array[
    'user_settings', 'habits', 'habit_logs', 'exercises', 'workout_routines', 'routine_exercises',
    'routine_sets', 'workout_sessions', 'workout_exercises', 'workout_sets', 'body_weight_logs', 'progress_photos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete', t);
    -- Los usuarios anónimos no tienen ningún acceso.
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;
revoke all on public.profiles from anon;

-- ─────────────── Alta de usuario: perfil, ajustes y hábitos iniciales ───────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  insert into public.habits (user_id, name, icon, color, type, target_value, unit, sort_order, system_key) values
    (new.id, 'Dieta',              'salad',      '#22c55e', 'binary',  null,  null,    0, null),
    (new.id, 'Lectura de la Biblia','book-open', '#a78bfa', 'binary',  null,  null,    1, null),
    (new.id, 'Rezo',               'hand-heart', '#60a5fa', 'binary',  null,  null,    2, null),
    (new.id, '10.000 pasos',       'footprints', '#f59e0b', 'numeric', 10000, 'pasos', 3, null),
    (new.id, 'Gimnasio',           'dumbbell',   '#f97316', 'binary',  null,  null,    4, 'gym');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────── Sobrecarga progresiva ───────────────
-- Series de la última sesión COMPLETADA de cada ejercicio, sea cual sea la rutina.
-- security invoker: se aplican las políticas RLS del usuario que llama.

create or replace function public.last_completed_sets(p_exercise_ids uuid[])
returns table (
  exercise_id uuid,
  session_id uuid,
  ended_at timestamptz,
  "position" integer,
  set_type text,
  weight numeric,
  reps integer,
  completed boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with last_we as (
    select distinct on (we.exercise_id)
      we.id, we.exercise_id, s.id as session_id, s.ended_at
    from public.workout_exercises we
    join public.workout_sessions s on s.id = we.session_id
    where s.status = 'completed'
      and s.user_id = (select auth.uid())
      and we.exercise_id = any (p_exercise_ids)
    order by we.exercise_id, s.ended_at desc, we.position
  )
  select lw.exercise_id, lw.session_id, lw.ended_at, ws.position, ws.set_type, ws.weight, ws.reps, ws.completed
  from last_we lw
  join public.workout_sets ws on ws.workout_exercise_id = lw.id
  order by lw.exercise_id, ws.position;
$$;

revoke execute on function public.last_completed_sets(uuid[]) from anon, public;
grant execute on function public.last_completed_sets(uuid[]) to authenticated;

-- ─────────────── Vistas de resumen (respetan RLS gracias a security_invoker) ───────────────

create view public.workout_session_summaries
with (security_invoker = true)
as
select
  s.id as session_id,
  s.user_id,
  s.routine_id,
  s.routine_name,
  s.session_date,
  s.started_at,
  s.ended_at,
  s.status,
  extract(epoch from (coalesce(s.ended_at, s.started_at) - s.started_at))::integer as duration_seconds,
  count(distinct we.id)::integer as exercise_count,
  count(ws.id) filter (where ws.completed)::integer as completed_sets,
  coalesce(sum(
    case when ws.completed and ws.set_type <> 'warmup'
      then coalesce(ws.weight, 0) * coalesce(ws.reps, 0)
        * case when e.weight_unit = 'lb' then 0.45359237 else 1 end
      else 0 end
  ), 0)::numeric(14, 2) as volume_kg
from public.workout_sessions s
left join public.workout_exercises we on we.session_id = s.id
left join public.exercises e on e.id = we.exercise_id
left join public.workout_sets ws on ws.workout_exercise_id = we.id
group by s.id;

revoke all on public.workout_session_summaries from anon;
grant select on public.workout_session_summaries to authenticated;
