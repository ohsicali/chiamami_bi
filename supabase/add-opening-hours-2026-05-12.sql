-- ====================================================================
-- restaurants.opening_hours — override manuale orari dal pannello /verify
-- ====================================================================
-- L'RPC verify_update_restaurant_meta (vedi v4-verify-impostazioni.sql)
-- scrive su restaurants.opening_hours, ma la colonna non era mai stata
-- creata. Senza, useRestaurants fallisce lo SELECT e la home risulta
-- vuota; il pannello /verify Impostazioni non riesce a salvare orari.
--
-- Aggiungiamo la colonna come jsonb nullable. Struttura attesa:
--   { regularOpeningHours: { periods: [{
--       open:  { day, hour, minute },
--       close: { day, hour, minute }
--     }] } }
-- Quando popolata vince sugli orari Google in hours_cache (useOrariStatus).
-- ====================================================================

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS opening_hours jsonb;

COMMENT ON COLUMN restaurants.opening_hours IS
  'Override manuale degli orari impostato dal ristoratore via pannello /verify. Struttura: { regularOpeningHours: { periods: [{open:{day,hour,minute}, close:{day,hour,minute}}] } }. Quando popolato vince sugli orari Google in hours_cache.';

-- Rollback:
-- ALTER TABLE restaurants DROP COLUMN IF EXISTS opening_hours;
