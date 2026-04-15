-- ============================================================================
-- HOTFIX CRITICO 2026-04-15 (sera): regressioni introdotte dal refactor RLS
-- ============================================================================
-- Dopo la consolidazione delle policy per risolvere i warning
-- `multiple_permissive_policies`, due tabelle sono rimaste esposte:
--
--  BUG 1 — verified_devices.SELECT  USING (true OR is_admin())
--    equivale a USING (true): qualsiasi anon può leggere TUTTI i device_token
--    e usarli per chiamare verify_redeem_qr() validando QR arbitrari.
--
--  BUG 2 — profiles.SELECT  USING (true) + GRANT SELECT pieno
--    (ripristinato stamattina dall'hotfix-rollback-column-grants per non
--    rompere select('*')). Conseguenza: chiunque può leggere recovery_otp
--    in chiaro via REST:
--        GET /rest/v1/profiles?select=recovery_otp&email=eq.VICTIM
--    → lo usa su /api/verify-recovery-otp per fare takeover dell'account.
--
-- STRATEGIA DEI FIX:
--  1. verified_devices: DROP della SELECT policy pubblica. Le RPC
--     (verify_login, verify_touch_device, verify_redeem_qr,
--      verify_activity_list, verify_dashboard_stats) sono SECURITY DEFINER
--     e bypassano RLS → continuano a funzionare.
--  2. profiles: sposto recovery_otp/_expires/_action in una tabella
--     separata `auth_recovery_tokens` SENZA alcuna policy pubblica
--     (solo service_role vi accede, e bypassa RLS). Poi DROP delle 3
--     colonne da profiles. Questo permette di lasciare
--     `profiles.SELECT USING (true)` + GRANT pieno (non rompe select('*'))
--     senza esporre i segreti.
--
-- Dopo aver applicato questo SQL, fare deploy delle modifiche API in
-- api/recovery-otp.js e api/verify-recovery-otp.js (già preparate).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- BUG 1 — verified_devices: chiudi SELECT pubblico
-- ----------------------------------------------------------------------------

-- Drop qualsiasi policy SELECT pubblica ancora presente.
-- (Usiamo nomi osservati + nomi legacy a scopo idempotenza)
DROP POLICY IF EXISTS "Public read by token"          ON public.verified_devices;
DROP POLICY IF EXISTS "Public select verified_devices" ON public.verified_devices;
DROP POLICY IF EXISTS "Anyone can read verified devices" ON public.verified_devices;
DROP POLICY IF EXISTS "Public read device"            ON public.verified_devices;

-- Solo admin può fare SELECT dal client; tutte le operazioni runtime
-- passano dalle RPC SECURITY DEFINER che bypassano RLS.
DROP POLICY IF EXISTS "Admin select verified_devices" ON public.verified_devices;
CREATE POLICY "Admin select verified_devices"
  ON public.verified_devices
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Revoca anche i GRANT sulla tabella ad anon (già rimossi dall'hardening
-- originale, ma rendiamo esplicito).
REVOKE SELECT ON public.verified_devices FROM anon;


-- ----------------------------------------------------------------------------
-- BUG 2 — profiles: sposta recovery_otp in tabella dedicata
-- ----------------------------------------------------------------------------

-- 1) Crea la nuova tabella (solo service_role la userà; nessuna policy
--    pubblica → RLS la blocca a tutti tranne service_role/postgres).
CREATE TABLE IF NOT EXISTS public.auth_recovery_tokens (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  otp          text NOT NULL,
  expires_at   timestamptz NOT NULL,
  action       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_recovery_tokens ENABLE ROW LEVEL SECURITY;

-- Nessuna policy = nessun accesso per anon/authenticated.
-- service_role bypassa RLS nativamente.

-- Indice per cleanup degli scaduti
CREATE INDEX IF NOT EXISTS auth_recovery_tokens_expires_at_idx
  ON public.auth_recovery_tokens (expires_at);

-- Revoca qualsiasi GRANT implicito (Supabase talvolta dà SELECT a anon di default)
REVOKE ALL ON public.auth_recovery_tokens FROM anon, authenticated;


-- 2) Migra eventuali OTP ancora attivi da profiles (probabilmente nessuno).
--    Uso blocco condizionale perché le colonne potrebbero già non esistere
--    se questo hotfix viene ri-eseguito.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'recovery_otp'
  ) THEN
    INSERT INTO public.auth_recovery_tokens (user_id, otp, expires_at, action)
    SELECT id, recovery_otp, recovery_otp_expires,
           COALESCE(recovery_otp_action, 'verify_recovery')
      FROM public.profiles
     WHERE recovery_otp IS NOT NULL
       AND recovery_otp_expires IS NOT NULL
       AND recovery_otp_expires > now()
    ON CONFLICT (user_id) DO UPDATE
      SET otp        = EXCLUDED.otp,
          expires_at = EXCLUDED.expires_at,
          action     = EXCLUDED.action;
  END IF;
END $$;


-- 3) Drop definitivo delle colonne sensibili da profiles.
--    Ora profiles.SELECT USING (true) + GRANT SELECT pieno è sicuro perché
--    non c'è più nulla di sensibile leggibile.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS recovery_otp;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS recovery_otp_expires;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS recovery_otp_action;


-- ----------------------------------------------------------------------------
-- VERIFICA
-- ----------------------------------------------------------------------------

-- Dopo l'esecuzione dovresti vedere:
--   1) Nessuna policy "Public read by token" su verified_devices
--   2) profiles SENZA le 3 colonne recovery_otp*
--   3) auth_recovery_tokens ESISTE con RLS ON e 0 policy

SELECT 'Hotfix RLS critici applicato. Deploy API (recovery-otp, verify-recovery-otp).' AS status;
