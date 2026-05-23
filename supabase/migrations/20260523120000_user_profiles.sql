create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy user_profiles_owner on public.user_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

grant select, insert, update, delete on table public.user_profiles to authenticated;

create trigger user_profiles_touch_updated_at
before update on public.user_profiles
for each row execute function public.touch_updated_at();
