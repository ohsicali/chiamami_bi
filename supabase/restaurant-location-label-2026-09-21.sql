-- Nome per la sede principale — 2026-09-21
-- Le sedi EXTRA (restaurant_locations) hanno già una `label` opzionale
-- impostabile dall'admin ("Sede Lingotto" ecc.). La sede principale
-- (address/latitude/longitude su `restaurants`) non aveva un campo
-- equivalente: senza nome, la scheda mostrava "Sede 1" — un segnaposto,
-- non un nome. Questa colonna la rende nominabile quanto le altre.
--
-- Additiva, nullable, nessuna riga esistente toccata.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS location_label text;
