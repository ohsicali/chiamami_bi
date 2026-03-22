-- ChiamamiBi — Schema Supabase
-- Esegui questo SQL nel SQL Editor di Supabase per creare le tabelle

-- Tabella ristoranti
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
  category text[] DEFAULT '{}',
  cuisine_type text,
  price_range int2 DEFAULT 2,
  our_rating float4 DEFAULT 4.0,
  our_review text,
  our_tip text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabella foto ristoranti
CREATE TABLE IF NOT EXISTS restaurant_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  photo_type text DEFAULT 'external_link',
  caption text,
  sort_order int2 DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Tabella categorie (opzionale)
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  color text
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_published ON restaurants(is_published);
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);
CREATE INDEX IF NOT EXISTS idx_photos_restaurant ON restaurant_photos(restaurant_id);

-- Row Level Security
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Visitatori: solo lettura dei ristoranti pubblicati
CREATE POLICY "Public read published" ON restaurants
  FOR SELECT USING (is_published = true);

-- Admin: accesso completo
CREATE POLICY "Admin full access" ON restaurants
  FOR ALL USING (auth.role() = 'authenticated');

-- Foto: lettura pubblica solo per ristoranti pubblicati
CREATE POLICY "Public read photos" ON restaurant_photos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM restaurants WHERE id = restaurant_id AND is_published = true)
  );

-- Admin: accesso completo alle foto
CREATE POLICY "Admin full access photos" ON restaurant_photos
  FOR ALL USING (auth.role() = 'authenticated');

-- Categorie: lettura pubblica
CREATE POLICY "Public read categories" ON categories
  FOR SELECT TO anon USING (true);

-- Admin: gestione categorie
CREATE POLICY "Admin manage categories" ON categories
  FOR ALL USING (auth.role() = 'authenticated');
