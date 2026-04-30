-- ============================================================
-- Restaurant form redesign 2026-04-30
--
-- 1. Categories: aggiunge `group_key` (cucina | atmosfera | occasione |
--    servizi | dieta) per organizzare in gruppi.
-- 2. Restaurants: aggiunge campi opzionali (menu_url, reservation_url,
--    instagram_url, services jsonb).
-- 3. Seed delle nuove categorie per i gruppi non-cucina.
-- ============================================================

-- 1. CATEGORIES — gruppo
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS group_key text NOT NULL DEFAULT 'cucina';

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_group_key_check;
ALTER TABLE categories
  ADD CONSTRAINT categories_group_key_check
  CHECK (group_key IN ('cucina', 'atmosfera', 'occasione', 'servizi', 'dieta'));

CREATE INDEX IF NOT EXISTS idx_categories_group ON categories(group_key);

-- Vincolo UNIQUE sul nome (necessario per gli upsert che seguono)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_unique'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_name_unique UNIQUE (name);
  END IF;
END $$;

-- Riclassifica categorie esistenti che appartengono a gruppi diversi da "cucina"
UPDATE categories SET group_key = 'occasione' WHERE name = 'Aperitivo';
UPDATE categories SET group_key = 'dieta'     WHERE name IN ('Vegano', 'Vegetariano');

-- 2. RESTAURANTS — campi opzionali aggiuntivi
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS menu_url text,
  ADD COLUMN IF NOT EXISTS reservation_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '{}'::jsonb;

-- 3. Seed nuove categorie per i gruppi non-cucina
INSERT INTO categories (name, icon, color, group_key, sort_order) VALUES
  ('Romantico',       '💕', '#EC4899', 'atmosfera', 200),
  ('Vista panoramica','🌄', '#0284C7', 'atmosfera', 201),
  ('Intimo',          '🕯️', '#9333EA', 'atmosfera', 202),
  ('Casual',          '😌', '#0EA5E9', 'atmosfera', 203),
  ('Famiglia',        '👨‍👩‍👧', '#F59E0B', 'occasione', 210),
  ('Pranzo lavoro',   '💼', '#6366F1', 'occasione', 211),
  ('Brunch',          '🥞', '#EAB308', 'occasione', 212),
  ('Cena romantica',  '🌹', '#E11D48', 'occasione', 213),
  ('Dehors',          '🌿', '#16A34A', 'servizi',   220),
  ('Wi-Fi',           '📶', '#0EA5E9', 'servizi',   221),
  ('Pet friendly',    '🐶', '#8B5CF6', 'servizi',   222),
  ('Parcheggio',      '🅿️', '#78716C', 'servizi',   223),
  ('Asporto',         '🥡', '#0891B2', 'servizi',   224),
  ('Delivery',        '🛵', '#0F766E', 'servizi',   225),
  ('Senza glutine',   '🌾', '#CA8A04', 'dieta',     230),
  ('Halal',           '🕌', '#059669', 'dieta',     231),
  ('Kosher',          '✡️', '#1D4ED8', 'dieta',     232)
ON CONFLICT (name) DO NOTHING;
