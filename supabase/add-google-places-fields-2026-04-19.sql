-- =============================================================================
-- Track C1 — Google Places: orari automatici
-- Data: 19 aprile 2026
-- Branch: v4/track-c1-google-places-hours
-- =============================================================================
--
-- COSA FA:
--   - Aggiunge colonne a `restaurants` per supportare integrazione Google Places:
--     * place_id             — ID Google Places (TEXT, unico per locale)
--     * place_id_confidence  — score 0-1 del match automatico backfill
--     * place_id_verified_at — timestamp approvazione admin (null = candidato non verificato)
--     * hours_cache          — cache JSON dell'ultimo fetch Places Details
--     * hours_cache_updated_at — timestamp del cache, per TTL 24h
--   - Crea indice su place_id per lookup veloce
--
-- COSA NON FA:
--   - NON popola i valori: sarà lo script di backfill + admin review
--   - NON cambia RLS: le colonne ereditano policy esistenti
--   - NON cancella nulla
--
-- IDEMPOTENTE: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS
--
-- ESEGUZIONE: branch Supabase PRIMA, prod DOPO OK smoke test
-- =============================================================================

BEGIN;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS place_id_confidence real,
  ADD COLUMN IF NOT EXISTS place_id_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS hours_cache jsonb,
  ADD COLUMN IF NOT EXISTS hours_cache_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_restaurants_place_id
  ON restaurants(place_id)
  WHERE place_id IS NOT NULL;

COMMENT ON COLUMN restaurants.place_id IS
  'Google Places ID (formato "ChIJ..."). Null = non ancora associato.';
COMMENT ON COLUMN restaurants.place_id_confidence IS
  'Score 0-1 del match automatico fatto dallo script backfill. Null per match manuale.';
COMMENT ON COLUMN restaurants.place_id_verified_at IS
  'Timestamp approvazione admin. Null = candidato non ancora verificato. Se not null, il place_id è affidabile.';
COMMENT ON COLUMN restaurants.hours_cache IS
  'Ultimo fetch Places Details (currentOpeningHours + regularOpeningHours + utcOffsetMinutes). TTL 24h.';
COMMENT ON COLUMN restaurants.hours_cache_updated_at IS
  'Timestamp ultimo fetch. Se now - questo > 24h → refetch.';

COMMIT;

-- =============================================================================
-- ROLLBACK (se serve tornare indietro):
-- =============================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_restaurants_place_id;
-- ALTER TABLE restaurants
--   DROP COLUMN IF EXISTS place_id,
--   DROP COLUMN IF EXISTS place_id_confidence,
--   DROP COLUMN IF EXISTS place_id_verified_at,
--   DROP COLUMN IF EXISTS hours_cache,
--   DROP COLUMN IF EXISTS hours_cache_updated_at;
-- COMMIT;
-- =============================================================================
