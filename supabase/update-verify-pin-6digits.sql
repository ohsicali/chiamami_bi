-- ========================================================================
-- /verify redesign — aggiornamento: PIN da 4 a 6 cifre
-- ========================================================================
-- Esegui questo se hai già applicato `add-verify-pin.sql` con il CHECK a 4.
-- Se stai partendo da zero, `add-verify-pin.sql` ora contiene già {6}.
--
-- NOTA: se ci sono PIN già salvati a 4 cifre, questo script li AZZERA.
-- Si considera sicuro perché la feature /verify è nuova e non ancora in
-- uso reale.
-- ========================================================================

-- 1) Svuota eventuali PIN esistenti (qualsiasi lunghezza != 6 cifre)
UPDATE restaurants
  SET verify_pin = NULL
  WHERE verify_pin IS NOT NULL
    AND verify_pin !~ '^[0-9]{6}$';

-- 2) Aggiorna il CHECK constraint
ALTER TABLE restaurants
  DROP CONSTRAINT IF EXISTS restaurants_verify_pin_format;
ALTER TABLE restaurants
  ADD CONSTRAINT restaurants_verify_pin_format
  CHECK (verify_pin IS NULL OR verify_pin ~ '^[0-9]{6}$');
