-- PR12 · Email benvenuto ristoratore
-- Aggiunge due colonne a restaurants:
--   • partner_email          → indirizzo email del ristoratore (dove mandare la mail di benvenuto)
--   • onboarding_email_sent_at → timestamp primo invio mail benvenuto (idempotenza: non reinviare)
--
-- ESEGUI in Supabase SQL Editor → Run
-- Sicuro da rieseguire: usa IF NOT EXISTS / IF NOT EXISTS pattern.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS partner_email text,
  ADD COLUMN IF NOT EXISTS onboarding_email_sent_at timestamptz;

-- Commento opzionale per documentazione schema
COMMENT ON COLUMN restaurants.partner_email IS 'Email del ristoratore — destinatario mail di benvenuto';
COMMENT ON COLUMN restaurants.onboarding_email_sent_at IS 'Timestamp primo invio mail benvenuto-ristoratore (idempotenza)';
