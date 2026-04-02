-- Restaurant suggestions from users
CREATE TABLE IF NOT EXISTS restaurant_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  restaurant_name text NOT NULL,
  address text,
  google_maps_url text,
  tags text[] DEFAULT '{}',
  description text,
  photo_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','reviewed','accepted','rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE restaurant_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own" ON restaurant_suggestions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own" ON restaurant_suggestions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all" ON restaurant_suggestions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
