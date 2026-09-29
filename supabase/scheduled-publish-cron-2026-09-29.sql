-- ============================================================
-- Uscite programmate, ogni 5 minuti — 2026-09-29
-- ============================================================
-- Da eseguire DOPO il deploy del codice (prima l'endpoint non conosce
-- ancora `job=scheduled-publish` e risponderebbe 405 ogni cinque minuti)
-- e dopo scheduled-publish-2026-09-29.sql.
--
-- Stesso schema del giro feedback (redemption-feedback-cron-2026-09-29.sql):
-- sul piano Hobby i cron di Vercel partono una volta al giorno, qui serve
-- che un locale programmato per le 18:00 esca entro le 18:05. Il token è
-- lo stesso del Vault (`chiamamibi_cron_token`), verificato dall'endpoint
-- con cron_token_ok().
--
-- Idempotente. Per spegnere: SELECT cron.unschedule('chiamamibi-scheduled-publish');

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'chiamamibi_cron_token') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'chiamamibi_cron_token',
      'Token con cui pg_cron chiama /api/notify-subscribers');
  END IF;
END $$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'chiamamibi-scheduled-publish';

SELECT cron.schedule(
  'chiamamibi-scheduled-publish',
  '*/5 * * * *',
  $cron$
  SELECT net.http_get(
    url     := 'https://chiamamibi.com/api/notify-subscribers?job=scheduled-publish',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'chiamamibi_cron_token')
    ),
    timeout_milliseconds := 55000
  );
  $cron$
);
