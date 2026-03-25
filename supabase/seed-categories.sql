-- Add sort_order column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order int2 DEFAULT 0;

-- Seed categories from the hardcoded CUISINE_CATEGORIES (only if table is empty)
INSERT INTO categories (name, icon, color, sort_order)
SELECT name, icon, color, sort_order FROM (VALUES
  ('Piemontese', '🍷', '#8B5CF6', 0),
  ('Italiana', '🍝', '#FF5757', 1),
  ('Giapponese', '🍣', '#F59E0B', 2),
  ('Fine Dining', '✨', '#6366F1', 3),
  ('Gelateria', '🍦', '#EC4899', 4),
  ('Aperitivo', '🥂', '#F97316', 5),
  ('Tapas', '🫒', '#84CC16', 6),
  ('Spagnolo', '🥘', '#DC2626', 7),
  ('Asiatico', '🥡', '#0EA5E9', 8),
  ('Mediterraneo', '🫓', '#14B8A6', 9),
  ('Greco', '🥙', '#3B82F6', 10),
  ('Indiano', '🍛', '#D97706', 11),
  ('Thailandese', '🍜', '#10B981', 12),
  ('Poke', '🥗', '#06B6D4', 13),
  ('Barbecue', '🍖', '#B91C1C', 14),
  ('Pesce', '🐟', '#2563EB', 15),
  ('Vegano', '🥬', '#16A34A', 16),
  ('Vegetariano', '🥕', '#65A30D', 17),
  ('Kebab', '🌯', '#CA8A04', 18),
  ('Americano', '🌭', '#EF4444', 19),
  ('Sudamericano', '🫔', '#F59E0B', 20),
  ('Pasta', '🍝', '#EA580C', 21),
  ('Insalate', '🥗', '#22C55E', 22),
  ('Internazionale', '🌍', '#6366F1', 23),
  ('Cocktail', '🍸', '#A855F7', 24),
  ('Bar', '🍸', '#78716C', 25),
  ('Tramezzini', '🥪', '#D97706', 26)
) AS t(name, icon, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM categories LIMIT 1);
