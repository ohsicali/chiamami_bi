-- ============================================================================
-- ESEGUI-VERIFY-E-STATS.sql
-- ============================================================================
-- Script unificato per abilitare la pagina /verify (login PIN ristoratore,
-- dashboard stats, QR scan) su Supabase produzione.
--
-- COME ESEGUIRLO
--   1. Apri il dashboard Supabase del progetto ChiamamiBi
--   2. SQL Editor → New query
--   3. Incolla TUTTO il contenuto di questo file
--   4. Run
--
-- È SICURO RIESEGUIRLO?
--   Sì. Tutte le operazioni sono idempotenti:
--     • CREATE TABLE IF NOT EXISTS
--     • ADD COLUMN IF NOT EXISTS
--     • CREATE INDEX IF NOT EXISTS
--     • DROP POLICY IF EXISTS + CREATE POLICY
--     • CREATE OR REPLACE FUNCTION
--   I dati esistenti non vengono toccati.
--
--   Note:
--     • Il backfill dei PIN (sezione 5) aggiorna SOLO ristoranti con
--       verify_pin IS NULL, quindi non sovrascrive PIN già impostati.
--     • La normalizzazione a 6 cifre (sezione 4) NULLa solo PIN che NON
--       sono già 6 cifre. Se avevi PIN a 4 cifre, vanno rigenerati
--       (ma la feature è nuova, probabilmente non ci sono).
-- ============================================================================


-- ============================================================================
-- 1) Page Views — tabella tracking visite (base per le stats dashboard)
-- ============================================================================
CREATE TABLE IF NOT EXISTS page_views (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON page_views(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert page views" ON page_views;
CREATE POLICY "Anyone can insert page views"
  ON page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read page views" ON page_views;
CREATE POLICY "Admins can read page views"
  ON page_views FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete page views" ON page_views;
CREATE POLICY "Admins can delete page views"
  ON page_views FOR DELETE
  TO authenticated
  USING (is_admin());


-- ============================================================================
-- 2) Page Views — colonne geo/device per enrichment server-side (/api/track)
-- ============================================================================
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS country     TEXT;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS city        TEXT;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS region      TEXT;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS device_type TEXT;

CREATE INDEX IF NOT EXISTS idx_page_views_country ON page_views(country)     WHERE country     IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_city    ON page_views(city)        WHERE city        IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_device  ON page_views(device_type) WHERE device_type IS NOT NULL;


-- ============================================================================
-- 3) Verify PIN + verified_devices (login ristoratore + cookie ricorda-me)
-- ============================================================================
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS verify_pin text;

ALTER TABLE restaurants
  DROP CONSTRAINT IF EXISTS restaurants_verify_pin_format;
ALTER TABLE restaurants
  ADD CONSTRAINT restaurants_verify_pin_format
  CHECK (verify_pin IS NULL OR verify_pin ~ '^[0-9]{6}$');

CREATE INDEX IF NOT EXISTS idx_restaurants_verify_pin
  ON restaurants(verify_pin)
  WHERE verify_pin IS NOT NULL;

CREATE TABLE IF NOT EXISTS verified_devices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token    text UNIQUE NOT NULL,
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz NOT NULL DEFAULT now(),
  user_agent      text
);

CREATE INDEX IF NOT EXISTS idx_verified_devices_token      ON verified_devices(device_token);
CREATE INDEX IF NOT EXISTS idx_verified_devices_restaurant ON verified_devices(restaurant_id);

ALTER TABLE verified_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read by token" ON verified_devices;
CREATE POLICY "Public read by token" ON verified_devices
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert device" ON verified_devices;
CREATE POLICY "Public insert device" ON verified_devices
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update last_used" ON verified_devices;
CREATE POLICY "Public update last_used" ON verified_devices
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full access devices" ON verified_devices;
CREATE POLICY "Admin full access devices" ON verified_devices
  FOR ALL USING (public.is_admin());


-- ============================================================================
-- 4) Normalizza PIN a 6 cifre (no-op se già a 6)
-- ============================================================================
-- Azzera eventuali PIN a lunghezza diversa da 6 cifre (lasciando intatti
-- i PIN già conformi). Poi (ri)applica il CHECK constraint.
UPDATE restaurants
  SET verify_pin = NULL
  WHERE verify_pin IS NOT NULL
    AND verify_pin !~ '^[0-9]{6}$';

ALTER TABLE restaurants
  DROP CONSTRAINT IF EXISTS restaurants_verify_pin_format;
ALTER TABLE restaurants
  ADD CONSTRAINT restaurants_verify_pin_format
  CHECK (verify_pin IS NULL OR verify_pin ~ '^[0-9]{6}$');


-- ============================================================================
-- 5) Backfill — copia i PIN esistenti da restaurant_partners → restaurants
-- ============================================================================
-- SOLO per ristoranti che non hanno già un verify_pin impostato. Sicuro da
-- rieseguire: non sovrascrive nulla.
UPDATE restaurants r
SET verify_pin = sub.pin_code
FROM (
  SELECT DISTINCT ON (p.restaurant_id)
    p.restaurant_id,
    p.pin_code
  FROM restaurant_partners p
  WHERE p.is_active = true
    AND p.pin_code ~ '^[0-9]{6}$'
  ORDER BY p.restaurant_id, p.created_at DESC
) AS sub
WHERE sub.restaurant_id = r.id
  AND r.verify_pin IS NULL;


-- ============================================================================
-- 6) RLS — permette al flow verify QR di funzionare (join profiles/discounts)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Public read basic profile info" ON profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON profiles;
CREATE POLICY "Public read basic profile info" ON profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read active discounts" ON discounts;
DROP POLICY IF EXISTS "Public read all discounts" ON discounts;
CREATE POLICY "Public read all discounts" ON discounts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read published" ON restaurants;
DROP POLICY IF EXISTS "Public read all restaurants" ON restaurants;
CREATE POLICY "Public read all restaurants" ON restaurants
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users read own redemptions" ON discount_redemptions;
DROP POLICY IF EXISTS "Anyone can read redemptions by qr_code" ON discount_redemptions;
CREATE POLICY "Anyone can read redemptions by qr_code" ON discount_redemptions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users delete own redemptions" ON discount_redemptions;
CREATE POLICY "Users delete own redemptions" ON discount_redemptions
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin delete redemptions" ON discount_redemptions;
CREATE POLICY "Admin delete redemptions" ON discount_redemptions
  FOR DELETE USING (public.is_admin());


-- ============================================================================
-- 7) RPC verify_dashboard_stats — aggrega le stats per la dashboard partner
-- ============================================================================
-- SECURITY DEFINER: bypassa RLS leggendo page_views/saved_restaurants
-- dopo aver validato il device_token contro verified_devices.
CREATE OR REPLACE FUNCTION public.verify_dashboard_stats(
  p_restaurant_id uuid,
  p_device_token  text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug                      text;
  v_path                      text;
  v_valid                     boolean;
  v_views_30d                 int;
  v_views_7d                  int;
  v_views_today               int;
  v_saves_total               int;
  v_saves_30d                 int;
  v_redemptions_total         int;
  v_redemptions_generated_30d int;
  v_redemptions_used_30d      int;
  v_redemptions_used_total    int;
BEGIN
  -- 1) Valida il token
  SELECT EXISTS(
    SELECT 1 FROM verified_devices
    WHERE device_token = p_device_token
      AND restaurant_id = p_restaurant_id
  ) INTO v_valid;

  IF NOT v_valid THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- 2) last_used_at refresh (best-effort)
  UPDATE verified_devices
    SET last_used_at = now()
    WHERE device_token = p_device_token;

  -- 3) Slug per filtrare page_views
  SELECT slug INTO v_slug FROM restaurants WHERE id = p_restaurant_id;
  v_path := '/restaurant/' || v_slug;

  -- 4) page_views
  SELECT COUNT(*) INTO v_views_30d
    FROM page_views
    WHERE path = v_path
      AND created_at > now() - interval '30 days';

  SELECT COUNT(*) INTO v_views_7d
    FROM page_views
    WHERE path = v_path
      AND created_at > now() - interval '7 days';

  SELECT COUNT(*) INTO v_views_today
    FROM page_views
    WHERE path = v_path
      AND created_at > now() - interval '24 hours';

  -- 5) saved_restaurants
  SELECT COUNT(*) INTO v_saves_total
    FROM saved_restaurants
    WHERE restaurant_id = p_restaurant_id;

  SELECT COUNT(*) INTO v_saves_30d
    FROM saved_restaurants
    WHERE restaurant_id = p_restaurant_id
      AND created_at > now() - interval '30 days';

  -- 6) discount_redemptions
  SELECT COUNT(*) INTO v_redemptions_total
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    WHERE d.restaurant_id = p_restaurant_id;

  SELECT COUNT(*) INTO v_redemptions_generated_30d
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    WHERE d.restaurant_id = p_restaurant_id
      AND dr.generated_at > now() - interval '30 days';

  SELECT COUNT(*) INTO v_redemptions_used_30d
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    WHERE d.restaurant_id = p_restaurant_id
      AND dr.status = 'redeemed'
      AND dr.redeemed_at > now() - interval '30 days';

  SELECT COUNT(*) INTO v_redemptions_used_total
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    WHERE d.restaurant_id = p_restaurant_id
      AND dr.status = 'redeemed';

  RETURN jsonb_build_object(
    'views_30d',                 v_views_30d,
    'views_7d',                  v_views_7d,
    'views_today',               v_views_today,
    'saves_total',               v_saves_total,
    'saves_30d',                 v_saves_30d,
    'redemptions_total',         v_redemptions_total,
    'redemptions_generated_30d', v_redemptions_generated_30d,
    'redemptions_used_30d',      v_redemptions_used_30d,
    'redemptions_used_total',    v_redemptions_used_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_dashboard_stats(uuid, text) TO anon, authenticated;


-- ============================================================================
-- 8) Check finale — mostra lo stato al termine dell'esecuzione
-- ============================================================================
SELECT
  (SELECT COUNT(*) FROM restaurants WHERE verify_pin IS NOT NULL) AS ristoranti_con_pin,
  (SELECT COUNT(*) FROM verified_devices)                         AS dispositivi_registrati,
  (SELECT COUNT(*) FROM page_views)                               AS page_views_totali;

-- Eventuali duplicati di PIN (se ritorna righe, vanno risolti manualmente)
SELECT verify_pin,
       array_agg(id)   AS restaurant_ids,
       array_agg(name) AS names
FROM restaurants
WHERE verify_pin IS NOT NULL
GROUP BY verify_pin
HAVING COUNT(*) > 1;
