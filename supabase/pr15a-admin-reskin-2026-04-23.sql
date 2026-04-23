-- PR15a · Admin reskin foundation — DB migrations
-- Date: 2026-04-23
-- Scope:
--   1. restaurant_dishes table (piatti specifici, 0-N opzionali per ristorante)
--   2. SEO fields su restaurants (seo_title, seo_description, og_*, noindex)
--   3. PIN management minimal: is_disabled + last_pin_rotation_at
--
-- Note:
--   - `our_tip` su restaurants resta come campo "nota generale del consiglio"
--     (a volte Augusto non ricorda i piatti specifici → scrive solo a grandi linee).
--   - restaurant_dishes è ADDITIVA: zero righe = solo nota, 1+ righe = lista piatti.
--   - is_admin() function è già definita in ESEGUI-TUTTO.sql.

-- ══════════════════════════════════════════════════════════════════
-- 1. restaurant_dishes
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS restaurant_dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_dishes_restaurant
  ON restaurant_dishes(restaurant_id, sort_order);

ALTER TABLE restaurant_dishes ENABLE ROW LEVEL SECURITY;

-- Public read: solo per ristoranti pubblicati
DROP POLICY IF EXISTS "Dishes readable for published restaurants" ON restaurant_dishes;
CREATE POLICY "Dishes readable for published restaurants"
  ON restaurant_dishes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = restaurant_dishes.restaurant_id
        AND r.is_published = true
    )
  );

-- Admin: full access
DROP POLICY IF EXISTS "Admins manage dishes" ON restaurant_dishes;
CREATE POLICY "Admins manage dishes"
  ON restaurant_dishes FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ══════════════════════════════════════════════════════════════════
-- 2. SEO fields su restaurants
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS og_title text,
  ADD COLUMN IF NOT EXISTS og_description text,
  ADD COLUMN IF NOT EXISTS og_image text,
  ADD COLUMN IF NOT EXISTS noindex boolean NOT NULL DEFAULT false;

-- ══════════════════════════════════════════════════════════════════
-- 3. PIN management minimal (scelta utente Q4=b)
-- ══════════════════════════════════════════════════════════════════
--
-- Niente tabella sessions device-bound. Quando l'admin clicca:
--   - Ri-genera PIN  → scrive nuovo verify_pin + last_pin_rotation_at=now()
--   - Blocca accesso → is_disabled=true (lato /verify logica controlla il flag)

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_pin_rotation_at timestamptz;

-- Backfill: ristoranti con verify_pin già impostato e created_at recente
-- useranno created_at come "ultima rotazione" (best guess).
UPDATE restaurants
SET last_pin_rotation_at = COALESCE(last_pin_rotation_at, updated_at, created_at)
WHERE verify_pin IS NOT NULL
  AND last_pin_rotation_at IS NULL;
