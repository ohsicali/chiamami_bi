-- Aggiunge colonne per recovery email e OTP alla tabella profiles
-- Esegui nel SQL Editor di Supabase

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_otp text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_otp_expires timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_otp_action text;
