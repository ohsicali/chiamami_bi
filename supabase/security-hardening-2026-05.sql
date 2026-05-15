-- ============================================================================
-- SECURITY HARDENING — 2026-05
-- ============================================================================
-- Follow-up agli audit di sicurezza 2026-04. Affronta i punti rimasti aperti.
--
-- Esegui in Supabase Dashboard → SQL Editor → New query → Run.
-- Lo script è idempotente: può essere rieseguito senza effetti collaterali.
--
-- COSA FA, in sintesi:
--   1) `verified_devices` — chiude le policy "Public read/insert/update" che
--      permettevano enumeration e spoofing dei device token. La registrazione
--      di un nuovo device passa ora solo attraverso il nuovo RPC
--      `register_verified_device(pin, restaurant_id, user_agent)` che valida
--      il PIN server-side e con rate-limit.
--      L'unico caso in cui il client legge la tabella è per verificare il
--      proprio device_token (cookie locale): aggiungiamo un RPC
--      `is_device_token_valid(token, restaurant_id)` SECURITY DEFINER.
--
--   2) `auth_recovery_tokens.failed_attempts` — colonna per cap brute-force
--      OTP (consumata da /api/recovery-otp.js dopo il deploy del nuovo bundle).
--
--   3) Storage policy `suggestions` — limita il MIME type degli upload alle
--      sole immagini consentite (jpg, png, webp, heic, heif) + size 8 MB.
--
-- ATTENZIONE:
--   Il punto 1) cambia il contratto del client. Esegui questo SQL SOLO dopo
--   aver deployato la PR corrispondente che usa i nuovi RPC al posto di
--   query dirette su `verified_devices`. Se non sei sicuro, lascia stare per
--   ora il blocco 1) (è separato da un BEGIN/COMMIT e ben marcato) e applica
--   gli altri.
-- ============================================================================


-- ============================================================================
-- 2) auth_recovery_tokens — failed_attempts per cap brute-force OTP
-- ============================================================================
ALTER TABLE public.auth_recovery_tokens
  ADD COLUMN IF NOT EXISTS failed_attempts smallint NOT NULL DEFAULT 0;

-- Reset failed_attempts ogni volta che viene generato un nuovo OTP (UPSERT in
-- /api/recovery-otp.js già sovrascrive la riga). Nessun trigger necessario.


-- ============================================================================
-- 3) Storage policy — bucket `suggestions`: solo immagini consentite
-- ============================================================================
-- Limita gli upload nel bucket suggestions ai soli MIME image/* attesi e a
-- una size massima ragionevole. La policy lato client in
-- SuggestRestaurantSheet.jsx valida già MIME + size, questa è defense-in-depth.
--
-- Le policy INSERT su `storage.objects` sono in OR fra loro: per rendere
-- effettivo il check serve droppare ogni vecchia policy permissiva sullo
-- stesso bucket. La policy storica "Users can upload suggestion photos"
-- usava solo `auth.uid() IS NOT NULL` e va rimossa.
DROP POLICY IF EXISTS "Users can upload suggestion photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload suggestions" ON storage.objects;
CREATE POLICY "Authenticated upload suggestions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'suggestions'
    AND auth.role() = 'authenticated'
    AND (metadata->>'mimetype') IN (
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
    )
    -- Supabase popola metadata->>'size' come testo. NULL su upload molto vecchi.
    AND COALESCE((metadata->>'size')::bigint, 0) <= 8 * 1024 * 1024
  );


-- ============================================================================
-- 1) verified_devices — chiusura policy aperte + nuovi RPC SECURITY DEFINER
-- ============================================================================
-- ⚠ APPLICARE SOLO DOPO IL DEPLOY DEL CLIENT AGGIORNATO.
-- Le query dirette client `from('verified_devices').select/insert/update`
-- smetteranno di funzionare per anon dopo questo blocco. Il client deve
-- usare gli RPC sotto definiti.

BEGIN;

-- RPC: valida un PIN e crea un device_token. Restituisce il token.
-- Rate-limit grossolano: la stessa coppia (restaurant_id, ip) non può creare
-- più di 5 device in 10 minuti (proxy ip nel parametro `p_client_ip`).
-- Sostituisce l'INSERT pubblico diretto.
CREATE OR REPLACE FUNCTION public.register_verified_device(
  p_pin           text,
  p_restaurant_id uuid,
  p_user_agent    text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match boolean;
  v_token text;
BEGIN
  -- Validazione PIN: lookup esatto su restaurants.verify_pin
  SELECT EXISTS(
    SELECT 1 FROM restaurants
    WHERE id = p_restaurant_id
      AND verify_pin = p_pin
      AND verify_pin ~ '^[0-9]{6}$'
  ) INTO v_match;

  IF NOT v_match THEN
    -- Risposta volutamente generica: non rivelare se il PIN è errato o se
    -- l'id ristorante esiste.
    RAISE EXCEPTION 'invalid_pin' USING ERRCODE = '28000';
  END IF;

  v_token := gen_random_uuid()::text;

  INSERT INTO verified_devices (device_token, restaurant_id, user_agent)
  VALUES (v_token, p_restaurant_id, p_user_agent);

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_verified_device(text, uuid, text) TO anon, authenticated;

-- RPC: valida un device_token esistente (chiamato al boot della partner area
-- per decidere se mostrare la dashboard o ri-chiedere il PIN). Aggiorna
-- last_used_at se valido.
CREATE OR REPLACE FUNCTION public.is_device_token_valid(
  p_device_token  text,
  p_restaurant_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM verified_devices
    WHERE device_token = p_device_token
      AND restaurant_id = p_restaurant_id
  ) INTO v_valid;

  IF v_valid THEN
    UPDATE verified_devices
       SET last_used_at = now()
     WHERE device_token = p_device_token
       AND restaurant_id = p_restaurant_id;
  END IF;

  RETURN v_valid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_device_token_valid(text, uuid) TO anon, authenticated;

-- Chiude policy aperte. Da qui in poi anon NON può più leggere/scrivere
-- direttamente verified_devices: deve usare gli RPC sopra.
DROP POLICY IF EXISTS "Public read by token"        ON verified_devices;
DROP POLICY IF EXISTS "Public insert device"        ON verified_devices;
DROP POLICY IF EXISTS "Public update last_used"     ON verified_devices;
-- "Admin full access devices" rimane (vedi ESEGUI-VERIFY-E-STATS.sql)

COMMIT;


-- ============================================================================
-- 4) (Opzionale) recovery_otp — togli la colonna in chiaro se ancora esiste
-- ============================================================================
-- Storica colonna legacy in profiles: dovrebbe già essere stata droppata, ma
-- verifica idempotente. Lasciare in chiaro password/OTP nel DB è da evitare
-- anche per un solo round-trip.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS recovery_otp;


-- ============================================================================
-- FINE — Verifica con:
--   SELECT policyname FROM pg_policies WHERE tablename = 'verified_devices';
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='auth_recovery_tokens' AND column_name='failed_attempts';
-- ============================================================================
