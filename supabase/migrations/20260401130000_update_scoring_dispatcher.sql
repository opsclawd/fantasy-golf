select cron.unschedule('hourly-scoring-dispatch');

select cron.schedule(
  'four-hour-scoring-dispatch',
  '0 */4 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/scoring',
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  $$
);
