-- Phase 3: User Reviews Tables
-- Run this in your Supabase SQL Editor

-- User reviews
CREATE TABLE IF NOT EXISTS user_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  comment text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'pending_review', 'rejected')),
  ai_sentiment text,
  ai_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

-- User review photos
CREATE TABLE IF NOT EXISTS user_review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES user_reviews(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  sort_order int2 NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON user_reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON user_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON user_reviews(status);
CREATE INDEX IF NOT EXISTS idx_review_photos_review ON user_review_photos(review_id);

-- RLS Policies
ALTER TABLE user_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_review_photos ENABLE ROW LEVEL SECURITY;

-- Reviews: everyone reads published, user manages own, admin manages all
CREATE POLICY "Public read published reviews" ON user_reviews
  FOR SELECT USING (status = 'published');

CREATE POLICY "Users read own reviews" ON user_reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users create reviews" ON user_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reviews" ON user_reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admin full access reviews" ON user_reviews
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Review photos: public if review is published, user manages own
CREATE POLICY "Public read review photos" ON user_review_photos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_reviews WHERE id = review_id AND status = 'published')
  );

CREATE POLICY "Users manage own review photos" ON user_review_photos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_reviews WHERE id = review_id AND user_id = auth.uid())
  );

CREATE POLICY "Admin full access review photos" ON user_review_photos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
