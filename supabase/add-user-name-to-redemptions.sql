-- Add user_name column to discount_redemptions
-- This stores the user's name at generation time so the verify page
-- can display it without needing RLS access to the profiles table.
ALTER TABLE discount_redemptions ADD COLUMN IF NOT EXISTS user_name TEXT;

-- Backfill existing redemptions with user names from profiles
UPDATE discount_redemptions dr
SET user_name = p.full_name
FROM profiles p
WHERE dr.user_id = p.id
  AND dr.user_name IS NULL;
