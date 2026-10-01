update public.workout_sets
set exercise_id = '11111111-1111-4111-8111-111111010044'::uuid
where date = '2026-09-23'::date
  and exercise_id = '11111111-1111-4111-8111-111111010002'::uuid;
