alter table public.cardio_workouts alter column type type text;
drop type public.cardio_type;
create type public.cardio_type as enum ('warmup', 'run', 'swim', 'basketball', 'walk');
alter table public.cardio_workouts alter column type type public.cardio_type using type::public.cardio_type;
