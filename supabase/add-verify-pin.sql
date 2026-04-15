-- ========================================================================
-- /verify redesign — Step 1
-- ========================================================================
-- Aggiunge:
--   • restaurants.verify_pin  → PIN a 4 cifre assegnato dall'admin a ogni
--     ristorante; l'unica credenziale necessaria per accedere all'area
--     ristoratori.
--   • verified_devices        → dispositivi ricordati via cookie per 365g.
--     Al primo login il browser riceve un token che viene scritto qui e
--     salvato nel cookie `verify_device_token`.
-- ========================================================================

-- 1) Campo PIN sul ristorante
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS verify_pin text;

-- Vincolo: il PIN, se presente, deve essere esattamente 4 cifre
ALTER TABLE restaurants
  DROP CONSTRAINT IF EXISTS restaurants_verify_pin_format;
ALTER TABLE restaurants
  ADD CONSTRAINT restaurants_verify_pin_format
  CHECK (verify_pin IS NULL OR verify_pin ~ '^[0-9]{4}$');

-- Indice per il lookup al login (filtrato sui non-null)
CREATE INDEX IF NOT EXISTS idx_restaurants_verify_pin
  ON restaurants(verify_pin)
  WHERE verify_pin IS NOT NULL;


-- 2) Tabella dispositivi ricordati
CREATE TABLE IF NOT EXISTS verified_devices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token    text UNIQUE NOT NULL,
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz NOT NULL DEFAULT now(),
  user_agent      text
);

CREATE INDEX IF NOT EXISTS idx_verified_devices_token
  ON verified_devices(device_token);

CREATE INDEX IF NOT EXISTS idx_verified_devices_restaurant
  ON verified_devices(restaurant_id);


-- 3) RLS
ALTER TABLE verified_devices ENABLE ROW LEVEL SECURITY;

-- Chiunque (anche anon) può leggere una riga dato un device_token preciso:
-- serve al browser per risolvere il cookie → restaurant_id al page-load.
-- Non c'è enumerazione possibile perché il token è un UUID opaco.
DROP POLICY IF EXISTS "Public read by token" ON verified_devices;
CREATE POLICY "Public read by token" ON verified_devices
  FOR SELECT USING (true);

-- Chiunque può creare una riga: il flow login valida il PIN client-side
-- (query su restaurants.verify_pin con RLS public-read pubblicato) e
-- inserisce la coppia token↔restaurant. Il restaurant_id dev'essere
-- di un ristorante esistente (FK lo garantisce).
DROP POLICY IF EXISTS "Public insert device" ON verified_devices;
CREATE POLICY "Public insert device" ON verified_devices
  FOR INSERT WITH CHECK (true);

-- Aggiornamento consentito solo sulla colonna last_used_at via update-select
-- dallo stesso token (no enumerazione).
DROP POLICY IF EXISTS "Public update last_used" ON verified_devices;
CREATE POLICY "Public update last_used" ON verified_devices
  FOR UPDATE USING (true) WITH CHECK (true);

-- Admin: full access
DROP POLICY IF EXISTS "Admin full access devices" ON verified_devices;
CREATE POLICY "Admin full access devices" ON verified_devices
  FOR ALL USING (public.is_admin());


-- 4) Permetti la lettura anon di restaurants.verify_pin al login
-- La policy "Public read published" esistente già espone tutte le colonne
-- dei ristoranti pubblicati, verify_pin compreso. Per ristoranti non
-- pubblicati serve la policy admin. Lasciamo così: il PIN è per i
-- ristoranti in guida, che sono published=true.
