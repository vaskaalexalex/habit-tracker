grant usage on schema public to anon, authenticated;

grant select on table public.exercises to anon;

grant select, insert, update, delete on table public.habit_completions to authenticated;
grant select, insert, update, delete on table public.exercises to authenticated;
grant select, insert, update, delete on table public.workout_sets to authenticated;
grant select, insert, update, delete on table public.cardio_workouts to authenticated;
grant select, insert, update, delete on table public.journal_entries to authenticated;
