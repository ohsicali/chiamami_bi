-- ============================================================
-- Il giro delle email di feedback, ogni 10 minuti — 2026-09-29
-- ============================================================
-- Da eseguire DOPO il deploy del codice (prima l'endpoint non conosce
-- ancora `job=feedback-asks` e risponderebbe 405 ogni dieci minuti).
--
-- Perché qui e non in vercel.json: sul piano Hobby i cron di Vercel
-- partono al massimo una volta al giorno, e la prima email deve arrivare
-- circa mezz'ora dopo la convalida. pg_cron chiama l'endpoint con pg_net.
--
-- Il token lo genera il DB e lo tiene nel Vault: l'endpoint lo verifica con
-- cron_token_ok() (redemption-feedback-2026-09-29.sql), quindi non c'è
-- nessun segreto da copiare a mano su Vercel.
--
-- Idempotente. Per spegnere: SELECT cron.unschedule('chiamamibi-feedback-asks');

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'chiamamibi_cron_token') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'chiamamibi_cron_token',
      'Token con cui pg_cron chiama /api/notify-subscribers?job=feedback-asks');
  END IF;
END $$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'chiamamibi-feedback-asks';

SELECT cron.schedule(
  'chiamamibi-feedback-asks',
  '*/10 * * * *',
  $cron$
  SELECT net.http_get(
    url     := 'https://chiamamibi.com/api/notify-subscribers?job=feedback-asks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'chiamamibi_cron_token')
    ),
    timeout_milliseconds := 55000
  );
  $cron$
);
