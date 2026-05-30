-- Task tracker: lists, tasks, subtasks
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high');

create table public.task_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) <= 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  list_id uuid references public.task_lists (id) on delete set null,
  title text not null check (char_length(title) <= 200),
  notes text not null default '',
  status public.task_status not null default 'in_progress',
  priority public.task_priority not null default 'medium',
  due_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index task_lists_user_idx on public.task_lists (user_id, sort_order);
create index tasks_user_idx on public.tasks (user_id, status);
create index tasks_user_list_idx on public.tasks (user_id, list_id);
create index task_subtasks_task_idx on public.task_subtasks (task_id, sort_order);
create index task_subtasks_user_idx on public.task_subtasks (user_id);

alter table public.task_lists enable row level security;
alter table public.tasks enable row level security;
alter table public.task_subtasks enable row level security;

create policy task_lists_owner on public.task_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy tasks_owner on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy task_subtasks_owner on public.task_subtasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.task_lists to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.task_subtasks to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_touch_updated_at
before update on public.tasks
for each row execute function public.touch_updated_at();
