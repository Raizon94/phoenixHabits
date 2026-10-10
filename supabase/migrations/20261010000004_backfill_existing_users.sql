-- ════════════════════════════════════════════════════════════════════════════
-- Inicializa usuarios creados ANTES de aplicar el esquema (el trigger de alta no
-- existía): perfil, ajustes y los 5 hábitos iniciales. Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.profiles (id)
select u.id from auth.users u
on conflict do nothing;

insert into public.user_settings (user_id)
select u.id from auth.users u
on conflict do nothing;

insert into public.habits (user_id, name, icon, color, type, target_value, unit, sort_order, system_key)
select u.id, h.name, h.icon, h.color, h.type, h.target_value, h.unit, h.sort_order, h.system_key
from auth.users u
cross join (values
  ('Dieta',               'salad',      '#22c55e', 'binary',  null::numeric, null,    0, null),
  ('Lectura de la Biblia', 'book-open', '#a78bfa', 'binary',  null,          null,    1, null),
  ('Rezo',                'hand-heart', '#60a5fa', 'binary',  null,          null,    2, null),
  ('10.000 pasos',        'footprints', '#f59e0b', 'numeric', 10000,         'pasos', 3, null),
  ('Gimnasio',            'dumbbell',   '#f97316', 'binary',  null,          null,    4, 'gym')
) as h(name, icon, color, type, target_value, unit, sort_order, system_key)
where not exists (select 1 from public.habits x where x.user_id = u.id);
