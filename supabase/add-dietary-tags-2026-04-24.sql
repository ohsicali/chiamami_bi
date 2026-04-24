-- add-dietary-tags-2026-04-24.sql
-- Migration PR19 (Esplora redesign) — abilita il filtro "Dieta e stile" nel FilterSheet.
--
-- Aggiunge la colonna `tags_dietary` (array di slug) alla tabella `restaurants`.
-- Valori canonici riconosciuti dal FilterSheet (src/components/Esplora/FilterSheet.jsx):
--   'vegan'         → 🥦 Vegano
--   'vegetarian'    → 🫑 Vegetariano
--   'healthy'       → 🥗 Salutare
--   'gluten-free'   → 🌾 Senza glutine
--
-- Senza questa colonna il filtro Dieta è UI-only (nessun ristorante matcha).
-- L'hook applyEsploraFilters (src/lib/hooks/useEsploraFilters.js) filtra client-side:
--   il locale appare se contiene TUTTI gli slug selezionati dall'utente.

-- 1. Aggiungi la colonna se non esiste (safe re-run)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS tags_dietary text[] NOT NULL DEFAULT '{}';

-- 2. Index GIN per eventuali query server-side future (`... WHERE tags_dietary @> ARRAY['vegan']`)
CREATE INDEX IF NOT EXISTS idx_restaurants_tags_dietary
  ON restaurants USING GIN (tags_dietary);

-- 3. (Opzionale) CHECK constraint per evitare slug liberi.
--    Commentato di default: Augusto può preferire gestire i valori via admin senza
--    vincoli DB. Se vuoi lo schema rigido, de-commenta.
-- ALTER TABLE restaurants
--   ADD CONSTRAINT restaurants_tags_dietary_check
--   CHECK (tags_dietary <@ ARRAY['vegan','vegetarian','healthy','gluten-free']::text[]);

-- 4. Esempio di popolamento manuale (da adattare alle tue righe reali):
-- UPDATE restaurants SET tags_dietary = ARRAY['vegetarian','healthy'] WHERE slug = 'nome-ristorante-slug';
-- UPDATE restaurants SET tags_dietary = ARRAY['vegan','gluten-free']  WHERE name ILIKE '%Veggie%';

-- 5. Verifica (read-only, sicuro da eseguire)
-- SELECT name, tags_dietary FROM restaurants WHERE array_length(tags_dietary, 1) > 0 ORDER BY name;
