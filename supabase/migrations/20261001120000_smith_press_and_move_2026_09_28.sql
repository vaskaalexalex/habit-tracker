insert into public.exercises (id, user_id, name, muscle_group, is_preset, hidden, sort_order)
values
  ('11111111-1111-4111-8111-111111010044'::uuid, null, 'Жим в Смите', 'chest', true, false, 0)
on conflict (id) do update set
  name = excluded.name,
  muscle_group = excluded.muscle_group,
  is_preset = excluded.is_preset,
  hidden = excluded.hidden,
  sort_order = excluded.sort_order;

delete from public.workout_sets
where date = '2026-09-29'::date
  and exercise_id = '11111111-1111-4111-8111-111111010001'::uuid;

update public.workout_sets
set date = '2026-09-29'::date
where date = '2026-09-28'::date;

update public.workout_sets
set exercise_id = '11111111-1111-4111-8111-111111010044'::uuid
where date = '2026-09-29'::date
  and exercise_id = '11111111-1111-4111-8111-111111010002'::uuid;
