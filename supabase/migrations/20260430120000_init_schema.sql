create extension if not exists "pgcrypto";

create type public.habit_type as enum ('sport', 'coding', 'reading', 'journal');
create type public.cardio_type as enum ('run', 'walk', 'bike', 'swim', 'yoga', 'other');

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_type public.habit_type not null,
  date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, habit_type, date)
);
create index habit_completions_user_date_idx on public.habit_completions (user_id, date desc);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text,
  is_preset boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index exercises_user_idx on public.exercises (user_id);
create unique index exercises_unique_name_per_user on public.exercises (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  weight numeric(6,2) not null check (weight >= 0),
  reps smallint not null check (reps > 0 and reps < 1000),
  set_number smallint not null check (set_number > 0),
  note text,
  created_at timestamptz not null default now()
);
create index workout_sets_user_date_idx on public.workout_sets (user_id, date desc);
create index workout_sets_user_exercise_idx on public.workout_sets (user_id, exercise_id, date desc);

create table public.cardio_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type public.cardio_type not null,
  duration_min smallint not null check (duration_min > 0),
  distance_km numeric(6,2),
  note text,
  created_at timestamptz not null default now()
);
create index cardio_user_date_idx on public.cardio_workouts (user_id, date desc);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  content text not null default '',
  mood smallint check (mood between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
create index journal_user_date_idx on public.journal_entries (user_id, date desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger journal_entries_touch_updated_at
before update on public.journal_entries
for each row execute function public.touch_updated_at();
