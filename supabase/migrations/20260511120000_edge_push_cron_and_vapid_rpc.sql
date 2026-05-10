-- RPC for Edge (service_role only): VAPID + cron Bearer from Vault (env on Edge overrides when set).
create or replace function public.get_edge_push_config()
returns jsonb
language sql
security definer
set search_path = vault
as $$
  select jsonb_build_object(
    'vapid_public',
    (select decrypted_secret from vault.decrypted_secrets where name = 'edge_vapid_public_key' limit 1),
    'vapid_private',
    (select decrypted_secret from vault.decrypted_secrets where name = 'edge_vapid_private_key' limit 1),
    'cron_secret',
    (select decrypted_secret from vault.decrypted_secrets where name = 'edge_invoke_send_habit_reminders_cron' limit 1)
  );
$$;

revoke all on function public.get_edge_push_config() from public;
grant execute on function public.get_edge_push_config() to service_role;

-- pg_cron → pg_net: invoke Edge every 10 min (Bearer from Vault secret edge_invoke_send_habit_reminders_cron).
create or replace function public.invoke_send_habit_reminders_edge()
returns void
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  bearer text;
begin
  select ds.decrypted_secret
    into bearer
  from vault.decrypted_secrets as ds
  where ds.name = 'edge_invoke_send_habit_reminders_cron'
  limit 1;

  if bearer is null then
    raise exception 'missing vault secret edge_invoke_send_habit_reminders_cron';
  end if;

  perform
    net.http_post(
      url := 'https://ixhwlkjmkkjwuntsmwkm.supabase.co/functions/v1/send-habit-reminders',
      headers :=
        jsonb_build_object(
          'content-type',
          'application/json',
          'authorization',
          'Bearer ' || bearer
        ),
      body := '{}'::jsonb
    );
end;
$$;

revoke all on function public.invoke_send_habit_reminders_edge() from public;
grant execute on function public.invoke_send_habit_reminders_edge() to postgres;

-- Replace job if re-run.
select cron.unschedule(j.jobid)
from cron.job j
where j.jobname = 'invoke-send-habit-reminders';

select
  cron.schedule(
    'invoke-send-habit-reminders',
    '*/10 * * * *',
    'select public.invoke_send_habit_reminders_edge();'
  );
