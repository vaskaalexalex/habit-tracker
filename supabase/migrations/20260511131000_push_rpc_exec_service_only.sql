-- get_edge_push_config exposes Vault-backed secrets — only service_role (Edge) may call it.
revoke all on function public.get_edge_push_config() from public, anon, authenticated;
grant execute on function public.get_edge_push_config() to service_role;

-- Cron entrypoint: only postgres (pg_cron) runs this.
revoke all on function public.invoke_send_habit_reminders_edge() from public, anon, authenticated;
grant execute on function public.invoke_send_habit_reminders_edge() to postgres;
