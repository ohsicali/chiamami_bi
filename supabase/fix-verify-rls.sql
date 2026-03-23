-- ============================================
-- FIX: Allow QR code verification to work properly
-- Issues: joins on profiles/discounts/restaurants blocked by RLS for anon users
-- ============================================

-- 1. Ensure profiles are publicly readable (needed for user name in verify)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Public read basic profile info" ON profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON profiles;
CREATE POLICY "Public read basic profile info" ON profiles
  FOR SELECT USING (true);

-- 2. Allow reading ALL discounts (not just active ones) - needed for QR verify of expired/inactive
DROP POLICY IF EXISTS "Public read active discounts" ON discounts;
DROP POLICY IF EXISTS "Public read all discounts" ON discounts;
CREATE POLICY "Public read all discounts" ON discounts
  FOR SELECT USING (true);

-- 3. Ensure restaurants are publicly readable (not just published ones, for verify joins)
DROP POLICY IF EXISTS "Public read published" ON restaurants;
DROP POLICY IF EXISTS "Public read all restaurants" ON restaurants;
CREATE POLICY "Public read all restaurants" ON restaurants
  FOR SELECT USING (true);

-- 4. Ensure redemptions are publicly readable (for QR verification)
DROP POLICY IF EXISTS "Users read own redemptions" ON discount_redemptions;
DROP POLICY IF EXISTS "Anyone can read redemptions by qr_code" ON discount_redemptions;
CREATE POLICY "Anyone can read redemptions by qr_code" ON discount_redemptions
  FOR SELECT USING (true);

-- 5. Allow users to delete their own redemptions (swipe-to-delete in profile)
DROP POLICY IF EXISTS "Users delete own redemptions" ON discount_redemptions;
CREATE POLICY "Users delete own redemptions" ON discount_redemptions
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Allow admin to delete any redemption
DROP POLICY IF EXISTS "Admin delete redemptions" ON discount_redemptions;
CREATE POLICY "Admin delete redemptions" ON discount_redemptions
  FOR DELETE USING (public.is_admin());
