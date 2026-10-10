-- ════════════════════════════════════════════════════════════════════════════
-- Borrado de cuenta: workout_exercises → exercises es ON DELETE RESTRICT (protege el
-- historial al borrar un ejercicio), lo que bloquearía la cascada al borrar el usuario.
-- Antes de borrar el usuario se eliminan sus sesiones (y en cascada sus series).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.handle_user_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.workout_sessions where user_id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleting on auth.users;
create trigger on_auth_user_deleting
  before delete on auth.users
  for each row execute function public.handle_user_delete();
