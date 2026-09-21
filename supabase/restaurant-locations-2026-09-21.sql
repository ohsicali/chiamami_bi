-- ============================================================
-- Sedi multiple per lo stesso ristorante — 2026-09-21
-- ============================================================
-- Un ristorante con due locali (stesso nome, stessa scheda, stesso
-- sconto) resta UNA riga in `restaurants` (indirizzo/lat/lng =
-- "sede principale", come sempre). Questa tabella aggiunge SOLO le
-- sedi extra: 0 righe = ristorante normale (nessun comportamento
-- diverso), 1+ righe = "ha anche un'altra sede".
--
-- Lo sconto resta legato a `restaurant_id` (discounts, discount_redemptions,
-- verified_devices, verify_redeem_qr) — nessuna modifica lì: è già
-- valido per il ristorante indipendentemente da quale sede lo riscatta.
--
-- Additiva e idempotente: nessuna tabella/colonna esistente toccata.

CREATE TABLE IF NOT EXISTS restaurant_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label text,
  address text NOT NULL,
  latitude float8 NOT NULL,
  longitude float8 NOT NULL,
  sort_order int2 DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_locations_restaurant ON restaurant_locations(restaurant_id);

ALTER TABLE restaurant_locations ENABLE ROW LEVEL SECURITY;

-- Stesso pattern di restaurant_photos: leggibile da chiunque se il
-- ristorante è pubblicato, scrivibile solo dall'admin.
DROP POLICY IF EXISTS "Public read locations" ON restaurant_locations;
CREATE POLICY "Public read locations" ON restaurant_locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM restaurants WHERE id = restaurant_id AND is_published = true)
  );

DROP POLICY IF EXISTS "Admin full access locations" ON restaurant_locations;
CREATE POLICY "Admin full access locations" ON restaurant_locations
  FOR ALL USING (public.is_admin());
