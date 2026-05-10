-- Push subscriptions (Web Push) + reminder prefs / dedup per local calendar day.

create table public.user_push_reminders (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reminders_enabled boolean not null default false,
  user_timezone text not null default 'UTC',
  last_reminder_for_user_date date,
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.user_push_reminders enable row level security;
alter table public.push_subscriptions enable row level security;

create policy user_push_reminders_owner on public.user_push_reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy push_subscriptions_owner on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.user_push_reminders to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
