create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://your-project-ref.supabase.co', 'app_url');
select vault.create_secret('YOUR_CRON_SECRET', 'cron_secret');

select cron.schedule(
  'hourly-scoring-dispatch',
  '0 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/scoring',
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  $$
);
