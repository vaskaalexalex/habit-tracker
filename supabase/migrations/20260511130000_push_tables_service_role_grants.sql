-- Edge Functions use PostgREST with service_role JWT; explicit grants required for these tables.
grant select, insert, update, delete on table public.user_push_reminders to service_role;
grant select, insert, update, delete on table public.push_subscriptions to service_role;
grant select on table public.journal_entries to service_role;
