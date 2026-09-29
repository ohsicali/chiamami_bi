-- ============================================================
-- Uscita programmata di locali e sconti — 2026-09-29
-- ============================================================
-- Richiesta del proprietario: preparare un locale (o uno sconto) e dire
-- "esce lunedì alle 18". Fino a quel momento resta nascosto; all'ora
-- indicata va online da solo e partono le email agli utenti (e al locale
-- il suo PIN, come alla prima pubblicazione fatta a mano).
--
-- Come:
--   - `publish_at` non nullo = "programmato e non ancora uscito". La riga
--     resta `is_published = false` (locali) / `is_active = false` (sconti),
--     quindi tutte le letture pubbliche che già filtrano su quelle colonne
--     continuano a nasconderla senza toccarle.
--   - `notify_on_publish` = all'uscita parte l'annuncio a tutti gli utenti.
--   - Il giro lo fa `/api/notify-subscribers?job=scheduled-publish`
--     (api/_scheduled-publish.js), chiamato ogni 5 minuti da pg_cron:
--     vedi scheduled-publish-cron-2026-09-29.sql, da eseguire DOPO il deploy.
--     All'uscita `publish_at` torna NULL.
--
-- Idempotente.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_on_publish boolean NOT NULL DEFAULT true;

ALTER TABLE public.discounts
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_on_publish boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.restaurants.publish_at IS
  'Uscita programmata: il locale resta in bozza e va online da solo a quest''ora (poi torna NULL).';
COMMENT ON COLUMN public.restaurants.notify_on_publish IS
  'All''uscita programmata manda l''email "nuovo in guida" a tutti gli utenti.';
COMMENT ON COLUMN public.discounts.publish_at IS
  'Uscita programmata: lo sconto resta spento e si accende da solo a quest''ora (poi torna NULL).';
COMMENT ON COLUMN public.discounts.notify_on_publish IS
  'All''uscita programmata manda l''annuncio dello sconto a tutti gli utenti.';

-- `restaurants` ha solo grant di colonna in lettura (security-audit part B):
-- una colonna nuova senza GRANT fa fallire chi la chiede.
GRANT SELECT (publish_at, notify_on_publish) ON public.restaurants TO anon, authenticated;

-- Il giro cerca solo le righe programmate: poche, e con l'indice parziale
-- la ricerca ogni 5 minuti non tocca il resto della tabella.
CREATE INDEX IF NOT EXISTS restaurants_publish_at_idx
  ON public.restaurants (publish_at) WHERE publish_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS discounts_publish_at_idx
  ON public.discounts (publish_at) WHERE publish_at IS NOT NULL;
