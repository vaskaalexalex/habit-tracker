-- Последняя тренировка «Болгарские выпады» (preset id): оставить ровно 2 строки в workout_sets.
-- Учитывает дубликаты set_number: отбор по row_number, а не только set_number > 2.

with latest as (
  select distinct on (user_id)
    user_id,
    date as session_date
  from public.workout_sets
  where exercise_id = '11111111-1111-4111-8111-111111010021'::uuid
  order by user_id, date desc
),
ranked as (
  select ws.id,
    row_number() over (
      partition by ws.user_id, ws.date
      order by ws.set_number asc, ws.created_at asc, ws.id asc
    ) as rn
  from public.workout_sets ws
  inner join latest l on l.user_id = ws.user_id and l.session_date = ws.date
  where ws.exercise_id = '11111111-1111-4111-8111-111111010021'::uuid
)
delete from public.workout_sets ws
where ws.id in (select id from ranked where rn > 2);
