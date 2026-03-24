-- ============================================================
-- ChiamamiBi — MIGRAZIONE COMPLETA
-- Copia TUTTO questo file nel SQL Editor di Supabase e clicca Run
-- ============================================================

-- ============================================================
-- 1. TABELLA PROFILES (necessaria per auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Trigger per creare profilo automaticamente alla registrazione
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. FUNZIONE is_admin() — SECURITY DEFINER (evita ricorsione RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ============================================================
-- 3. POLICY PROFILES (senza ricorsione)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
DROP POLICY IF EXISTS "Public read profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON profiles;
DROP POLICY IF EXISTS "Enable update for users" ON profiles;
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Public read basic profile info" ON profiles;

CREATE POLICY "Public read basic profile info" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- 4. TABELLA RISTORANTI
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  city text NOT NULL DEFAULT 'Torino',
  country text NOT NULL DEFAULT 'Italia',
  address text NOT NULL,
  latitude float8,
  longitude float8,
  phone text,
  google_maps_url text,
  website text,
  instagram_reel text,
  tiktok_url text,
  category text[] DEFAULT '{}',
  cuisine_type text,
  price_range int2 DEFAULT 2,
  our_rating float4 DEFAULT 4.0,
  our_review text,
  our_tip text,
  recommended_for text[] DEFAULT '{}',
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  thumb_url text,
  photo_type text DEFAULT 'external_link',
  caption text,
  sort_order int2 DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  color text
);

CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_published ON restaurants(is_published);
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);
CREATE INDEX IF NOT EXISTS idx_photos_restaurant ON restaurant_photos(restaurant_id);

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Restaurants policies
DROP POLICY IF EXISTS "Public read published" ON restaurants;
CREATE POLICY "Public read published" ON restaurants
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Admin full access" ON restaurants;
CREATE POLICY "Admin full access" ON restaurants
  FOR ALL USING (public.is_admin());

-- Photos policies
DROP POLICY IF EXISTS "Public read photos" ON restaurant_photos;
CREATE POLICY "Public read photos" ON restaurant_photos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM restaurants WHERE id = restaurant_id AND is_published = true)
  );

DROP POLICY IF EXISTS "Admin full access photos" ON restaurant_photos;
CREATE POLICY "Admin full access photos" ON restaurant_photos
  FOR ALL USING (public.is_admin());

-- Categories policies
DROP POLICY IF EXISTS "Public read categories" ON categories;
CREATE POLICY "Public read categories" ON categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage categories" ON categories;
CREATE POLICY "Admin manage categories" ON categories
  FOR ALL USING (public.is_admin());

-- ============================================================
-- 5. STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read storage photos" ON storage.objects;
CREATE POLICY "Public read storage photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

DROP POLICY IF EXISTS "Auth users upload photos" ON storage.objects;
CREATE POLICY "Auth users upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth users update photos" ON storage.objects;
CREATE POLICY "Auth users update photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth users delete photos" ON storage.objects;
CREATE POLICY "Auth users delete photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'photos' AND auth.role() = 'authenticated');

-- ============================================================
-- 6. TABELLE SCONTI
-- ============================================================
CREATE TABLE IF NOT EXISTS discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'freebie')),
  discount_value text NOT NULL,
  conditions text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  max_redemptions int,
  total_redeemed int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discount_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id uuid NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  qr_code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'redeemed', 'expired')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  redeemed_by_restaurant boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS restaurant_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  pin_code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discounts_restaurant ON discounts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts(is_active, valid_until);
CREATE INDEX IF NOT EXISTS idx_redemptions_discount ON discount_redemptions(discount_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON discount_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_qr ON discount_redemptions(qr_code);
CREATE INDEX IF NOT EXISTS idx_partners_restaurant ON restaurant_partners(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_partners_pin ON restaurant_partners(pin_code);

ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_partners ENABLE ROW LEVEL SECURITY;

-- Discounts policies
DROP POLICY IF EXISTS "Public read active discounts" ON discounts;
CREATE POLICY "Public read active discounts" ON discounts
  FOR SELECT USING (is_active = true AND valid_until > now());

DROP POLICY IF EXISTS "Admin full access discounts" ON discounts;
CREATE POLICY "Admin full access discounts" ON discounts
  FOR ALL USING (public.is_admin());

-- Redemptions policies
DROP POLICY IF EXISTS "Users read own redemptions" ON discount_redemptions;
DROP POLICY IF EXISTS "Anyone can read redemptions by qr_code" ON discount_redemptions;
CREATE POLICY "Anyone can read redemptions by qr_code" ON discount_redemptions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users create redemptions" ON discount_redemptions;
CREATE POLICY "Users create redemptions" ON discount_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin read all redemptions" ON discount_redemptions;
CREATE POLICY "Admin read all redemptions" ON discount_redemptions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admin update redemptions" ON discount_redemptions;
CREATE POLICY "Admin update redemptions" ON discount_redemptions
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can update redemption with valid data" ON discount_redemptions;
CREATE POLICY "Anyone can update redemption with valid data" ON discount_redemptions
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users delete own redemptions" ON discount_redemptions;
CREATE POLICY "Users delete own redemptions" ON discount_redemptions
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin delete redemptions" ON discount_redemptions;
CREATE POLICY "Admin delete redemptions" ON discount_redemptions
  FOR DELETE USING (public.is_admin());

-- Partners policies
DROP POLICY IF EXISTS "Public read active partners" ON restaurant_partners;
CREATE POLICY "Public read active partners" ON restaurant_partners
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admin full access partners" ON restaurant_partners;
CREATE POLICY "Admin full access partners" ON restaurant_partners
  FOR ALL USING (public.is_admin());

-- ============================================================
-- 7. TABELLE RECENSIONI
-- ============================================================
CREATE TABLE IF NOT EXISTS user_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating int2 CHECK (rating >= 1 AND rating <= 5),
  comment text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'pending_review', 'rejected')),
  ai_sentiment text,
  ai_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES user_reviews(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  sort_order int2 DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON user_reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON user_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON user_reviews(status);
CREATE INDEX IF NOT EXISTS idx_review_photos_review ON user_review_photos(review_id);

ALTER TABLE user_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_review_photos ENABLE ROW LEVEL SECURITY;

-- Reviews policies
DROP POLICY IF EXISTS "Public read published reviews" ON user_reviews;
CREATE POLICY "Public read published reviews" ON user_reviews
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Users manage own reviews" ON user_reviews;
CREATE POLICY "Users manage own reviews" ON user_reviews
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin full access reviews" ON user_reviews;
CREATE POLICY "Admin full access reviews" ON user_reviews
  FOR ALL USING (public.is_admin());

-- Review photos policies
DROP POLICY IF EXISTS "Public read review photos" ON user_review_photos;
CREATE POLICY "Public read review photos" ON user_review_photos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_reviews WHERE id = review_id AND status = 'published')
  );

DROP POLICY IF EXISTS "Users manage own review photos" ON user_review_photos;
CREATE POLICY "Users manage own review photos" ON user_review_photos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_reviews WHERE id = review_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admin full access review photos" ON user_review_photos;
CREATE POLICY "Admin full access review photos" ON user_review_photos
  FOR ALL USING (public.is_admin());

-- ============================================================
-- 8. RISTORANTI SALVATI
-- ============================================================
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

-- ============================================================
-- 9. TRADUZIONI (cache per traduzioni AI)
-- ============================================================
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

-- ============================================================
-- 10. TABELLE NEWSLETTER E CANDIDATURE
-- ============================================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  source text DEFAULT 'website',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  city text DEFAULT 'Torino',
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(endpoint)
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Newsletter: anyone can subscribe, admin reads all
DROP POLICY IF EXISTS "Anyone can subscribe" ON newsletter_subscribers;
CREATE POLICY "Anyone can subscribe" ON newsletter_subscribers
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admin read subscribers" ON newsletter_subscribers;
CREATE POLICY "Admin read subscribers" ON newsletter_subscribers
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admin delete subscribers" ON newsletter_subscribers;
CREATE POLICY "Admin delete subscribers" ON newsletter_subscribers
  FOR DELETE USING (public.is_admin());

-- Applications: anyone can apply, admin manages
DROP POLICY IF EXISTS "Anyone can apply" ON partner_applications;
CREATE POLICY "Anyone can apply" ON partner_applications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admin manage applications" ON partner_applications;
CREATE POLICY "Admin manage applications" ON partner_applications
  FOR ALL USING (public.is_admin());

-- Push subscriptions
DROP POLICY IF EXISTS "Users manage own push" ON push_subscriptions;
CREATE POLICY "Users manage own push" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 11. FUNZIONE RPC: incremento sconti riscattati
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_discount_redeemed(discount_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE discounts
  SET total_redeemed = total_redeemed + 1
  WHERE id = discount_uuid;
END;
$$;

-- ============================================================
-- 12. RENDI IL TUO UTENTE ADMIN
-- Sostituisci con la tua email se diversa
-- ============================================================
UPDATE profiles SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'ale.cali@icloud.com' LIMIT 1);

-- ============================================================
-- FATTO! Tutte le tabelle e policy sono configurate.
-- ============================================================
