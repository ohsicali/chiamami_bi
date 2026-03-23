-- ============================================
-- Add missing tables: saved_restaurants and translations
-- Also add source column to newsletter_subscribers
-- ============================================

-- 1. Saved restaurants
CREATE TABLE IF NOT EXISTS saved_restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_restaurant ON saved_restaurants(restaurant_id);

ALTER TABLE saved_restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saves" ON saved_restaurants;
CREATE POLICY "Users manage own saves" ON saved_restaurants
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin read all saves" ON saved_restaurants;
CREATE POLICY "Admin read all saves" ON saved_restaurants
  FOR SELECT USING (public.is_admin());

-- 2. Translations cache
CREATE TABLE IF NOT EXISTS translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  source_field text NOT NULL,
  language text NOT NULL,
  translated_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_table, source_id, source_field, language)
);

CREATE INDEX IF NOT EXISTS idx_translations_lookup ON translations(source_table, source_id, source_field, language);

ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read translations" ON translations;
CREATE POLICY "Public read translations" ON translations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage translations" ON translations;
CREATE POLICY "Admin manage translations" ON translations
  FOR ALL USING (public.is_admin());

-- 3. Add source column to newsletter_subscribers
ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS source text DEFAULT 'website';
