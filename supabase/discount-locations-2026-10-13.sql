-- ============================================================
-- In quali sedi vale uno sconto — 2026-10-13
-- ============================================================
-- Per i locali con più sedi (restaurant_locations) lo sconto può valere
-- in tutte o solo in alcune. Prima la scheda del locale diceva sempre
-- "lo sconto vale in entrambe", anche su un locale senza sconti.
--
--   valid_location_ids NULL (o vuoto) = vale in tutte le sedi (il caso
--   di sempre: nessuna riga esistente cambia significato);
--   altrimenti la lista delle sedi in cui vale: 'primary' per la sede
--   principale (indirizzo su `restaurants`), l'id della riga di
--   `restaurant_locations` per le altre. text[] e non uuid[] proprio per
--   'primary'.
--
-- Gli id delle sedi devono restare fermi: dal 13/10 il pannello
-- (EditRestaurant) aggiorna le sedi al loro posto invece di cancellarle e
-- reinserirle a ogni salvataggio.
--
-- Additiva e idempotente.

ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS valid_location_ids text[];

COMMENT ON COLUMN public.discounts.valid_location_ids IS
  'Sedi in cui vale lo sconto: NULL = tutte; ''primary'' = sede principale, altrimenti restaurant_locations.id';

-- `discounts` ha il SELECT su tutta la tabella per anon/authenticated, ma
-- se un giorno passa ai grant di colonna questa non deve restare fuori
-- (un select('*') fallirebbe intero).
GRANT SELECT (valid_location_ids) ON public.discounts TO anon, authenticated;
