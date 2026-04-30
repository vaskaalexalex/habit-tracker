alter table public.habit_completions enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.cardio_workouts enable row level security;
alter table public.journal_entries enable row level security;

create policy habit_completions_owner on public.habit_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy exercises_select on public.exercises
  for select using (is_preset = true or auth.uid() = user_id);
create policy exercises_insert on public.exercises
  for insert with check (auth.uid() = user_id);
create policy exercises_update on public.exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy exercises_delete on public.exercises
  for delete using (auth.uid() = user_id);

create policy workout_sets_owner on public.workout_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy cardio_workouts_owner on public.cardio_workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy journal_entries_owner on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
