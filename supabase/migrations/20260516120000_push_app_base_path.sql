-- Store SvelteKit base path for correct notification click URLs (e.g. /habit-tracker on GitHub Pages).

alter table public.user_push_reminders
  add column if not exists app_base_path text not null default '';
