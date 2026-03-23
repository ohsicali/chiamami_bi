-- Phase 2: Discount System Tables
-- Run this in your Supabase SQL Editor

-- Discounts table
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

-- Discount redemptions (QR codes)
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

-- Restaurant partners (PIN for QR verification)
CREATE TABLE IF NOT EXISTS restaurant_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  pin_code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discounts_restaurant ON discounts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts(is_active, valid_until);
CREATE INDEX IF NOT EXISTS idx_redemptions_discount ON discount_redemptions(discount_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON discount_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_qr ON discount_redemptions(qr_code);
CREATE INDEX IF NOT EXISTS idx_partners_restaurant ON restaurant_partners(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_partners_pin ON restaurant_partners(pin_code);

-- RLS Policies

ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_partners ENABLE ROW LEVEL SECURITY;

-- Discounts: everyone reads active ones, admin manages all
CREATE POLICY "Public read active discounts" ON discounts
  FOR SELECT USING (is_active = true AND valid_until > now());

CREATE POLICY "Admin full access discounts" ON discounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Redemptions: user sees/creates own
CREATE POLICY "Users read own redemptions" ON discount_redemptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users create redemptions" ON discount_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin can read all redemptions
CREATE POLICY "Admin read all redemptions" ON discount_redemptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin can update redemptions (for verify flow)
CREATE POLICY "Admin update redemptions" ON discount_redemptions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Partners: public can read active (needed for verify page), admin manages
CREATE POLICY "Public read active partners" ON restaurant_partners
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admin full access partners" ON restaurant_partners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Allow anonymous/public to update redemption status via verify flow
-- (The verify page doesn't require login - just the PIN)
CREATE POLICY "Anyone can update redemption with valid data" ON discount_redemptions
  FOR UPDATE USING (true) WITH CHECK (true);
