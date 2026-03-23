-- ============================================
-- FIX: Allow QR code verification by anyone
-- and allow users to delete their own redemptions
-- ============================================

-- 1. Allow anyone to read redemptions (needed for QR verification by restaurant staff)
DROP POLICY IF EXISTS "Anyone can read redemptions by qr_code" ON discount_redemptions;
CREATE POLICY "Anyone can read redemptions by qr_code" ON discount_redemptions
  FOR SELECT USING (true);

-- 2. Allow users to delete their own redemptions (for swipe-to-delete in profile)
DROP POLICY IF EXISTS "Users delete own redemptions" ON discount_redemptions;
CREATE POLICY "Users delete own redemptions" ON discount_redemptions
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Allow admin to delete any redemption
DROP POLICY IF EXISTS "Admin delete redemptions" ON discount_redemptions;
CREATE POLICY "Admin delete redemptions" ON discount_redemptions
  FOR DELETE USING (public.is_admin());
