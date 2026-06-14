/*
  # Setup Daily Cron for Compliance Alerts

  ## Changes
  1. Enable `pg_net` extension for making HTTP requests.
  2. Create a cron job to trigger the `recurring-pmi-alerts` Edge Function daily at midnight.

  Note: This assumes the `pg_cron` and `pg_net` extensions are available in the Supabase environment.
  The URL for the Edge Function needs to be replaced with the actual project URL or use a relative path if supported.
*/

-- Enable the required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cron job to run daily at 00:00 UTC
-- We use net.http_post to trigger the Edge Function
-- Note: Replace 'YOUR_PROJECT_REF' and 'YOUR_ANON_KEY' with actual values or environment variables in a real deployment
-- Since migrations are usually static, we often set this up via the Supabase Dashboard or CLI,
-- but providing the SQL template here.

SELECT cron.schedule(
  'recurring-pmi-alerts-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.functions.supabase.co/recurring-pmi-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pmi-alerts-cron-token', 'CONFIGURE_IN_EDGE_FUNCTION_ENV'
    ),
    body := '{}'::jsonb
  )
  $$
);
