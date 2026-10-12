-- ============================================================
-- Il giro dei drop coi giorni contati, ogni 10 minuti — 2026-10-12
-- ============================================================
-- Da eseguire DOPO drop-claim-window-2026-10-12.sql e DOPO il deploy del
-- codice (prima l'endpoint non conosce `job=drop-claims` e risponderebbe
-- 405 ogni dieci minuti).
--
-- Ogni 10 minuti:
--   1. `drop_claims_tick()` nel DB: i riscatti oltre i loro giorni scadono,
--      i posti liberati vanno ai primi della lista d'attesa;
--   2. l'endpoint `job=drop-claims` manda le email: "hai 7 giorni" (a chi
--      ha avuto il posto dalla lista, e a chi non ha già la ricevuta), "ti
--      restano 4 giorni", "2 giorni", "ultime 24 ore", "l'hai perso".
-- Il giro nel DB sta qui e non solo nell'endpoint: se Vercel non risponde,
-- i posti passano lo stesso a chi aspetta (l'endpoint lo rilancia comunque,
-- è innocuo farlo due volte).
--
-- Il token è lo stesso degli altri giri (`chiamamibi_cron_token` nel Vault,
-- creato da redemption-feedback-cron-2026-09-29.sql).
--
-- Idempotente. Per spegnere: SELECT cron.unschedule('chiamamibi-drop-claims');

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'chiamamibi_cron_token') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'chiamamibi_cron_token',
      'Token con cui pg_cron chiama /api/notify-subscribers');
  END IF;
END $$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'chiamamibi-drop-claims';

SELECT cron.schedule(
  'chiamamibi-drop-claims',
  '*/10 * * * *',
  $cron$
  SELECT public.drop_claims_tick();
  SELECT net.http_get(
    url     := 'https://chiamamibi.com/api/notify-subscribers?job=drop-claims',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'chiamamibi_cron_token')
    ),
    timeout_milliseconds := 55000
  );
  $cron$
);
