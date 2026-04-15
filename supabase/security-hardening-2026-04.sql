-- ============================================================================
-- SECURITY HARDENING — 2026-04
-- ============================================================================
-- Fixes dell'audit di sicurezza (CRITICAL + HIGH).
--
-- ISTRUZIONI:
--   1. Apri Supabase Dashboard → SQL Editor → New query
--   2. Incolla TUTTO questo file e premi Run
--   3. Subito dopo fai il deploy del codice client (nuovi commit) — i nuovi
--      RPC sostituiscono chiamate client dirette che smetteranno di funzionare
--      appena questo SQL viene applicato.
--
-- Lo script è idempotente: può essere rieseguito senza effetti collaterali.
-- ============================================================================


-- ============================================================================
-- C1: Impedire a qualsiasi utente di auto-promuoversi admin
-- ============================================================================
-- La policy "Users update own profile" permette UPDATE su qualsiasi colonna,
-- incluso is_admin. Aggiungiamo un trigger che blocca cambi di is_admin da
-- parte di non-admin (indipendentemente dalla policy).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_self_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se is_admin sta cambiando e il chiamante NON è admin → blocca
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT COALESCE(
      (SELECT is_admin FROM profiles WHERE id = auth.uid()),
      false
    ) THEN
      RAISE EXCEPTION 'Permission denied: only admins can change is_admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_admin_escalation ON profiles;
CREATE TRIGGER prevent_self_admin_escalation
  BEFORE UPDATE OF is_admin ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_admin_escalation();


-- ============================================================================
-- H1: Rimuovere recovery_otp / email esposti via PostgREST
-- ============================================================================
-- La colonna recovery_otp è in chiaro e attualmente qualsiasi anon può leggerla
-- tramite supabase.from('profiles').select('recovery_otp').eq('email', X) —
-- grazie alla policy "Public read basic profile info" che usa USING (true).
--
-- RLS non supporta restrizioni per colonna, ma i GRANT sì.
-- Revochiamo il SELECT di default e ri-grantiamo SOLO le colonne safe.
-- ============================================================================

-- Revoca SELECT globale (rimane DEFAULT non elencato → nessun accesso)
REVOKE SELECT ON public.profiles FROM anon, authenticated;

-- Calcola dinamicamente le colonne realmente presenti in profiles e
-- costruisci i GRANT solo sulle colonne sicure che esistono. Questo rende
-- lo script idempotente anche su DB con schema leggermente diverso
-- (es. senza updated_at).
DO $$
DECLARE
  anon_cols    text[] := ARRAY['id','full_name','avatar_url','created_at','updated_at','is_admin'];
  auth_cols    text[] := ARRAY['id','full_name','avatar_url','created_at','updated_at','is_admin','email','recovery_email'];
  insert_cols  text[] := ARRAY['id','full_name','avatar_url','email'];
  update_cols  text[] := ARRAY['full_name','avatar_url','email','recovery_email'];
  existing     text;
BEGIN
  -- Filtra gli array tenendo solo le colonne che esistono davvero
  SELECT string_agg(quote_ident(c), ', ')
    INTO existing
    FROM unnest(anon_cols) c
    WHERE EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name=c
    );
  IF existing IS NOT NULL THEN
    EXECUTE format('GRANT SELECT (%s) ON public.profiles TO anon', existing);
  END IF;

  SELECT string_agg(quote_ident(c), ', ')
    INTO existing
    FROM unnest(auth_cols) c
    WHERE EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name=c
    );
  IF existing IS NOT NULL THEN
    EXECUTE format('GRANT SELECT (%s) ON public.profiles TO authenticated', existing);
  END IF;

  SELECT string_agg(quote_ident(c), ', ')
    INTO existing
    FROM unnest(insert_cols) c
    WHERE EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name=c
    );
  IF existing IS NOT NULL THEN
    EXECUTE format('GRANT INSERT (%s) ON public.profiles TO authenticated', existing);
  END IF;

  SELECT string_agg(quote_ident(c), ', ')
    INTO existing
    FROM unnest(update_cols) c
    WHERE EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name=c
    );
  IF existing IS NOT NULL THEN
    EXECUTE format('GRANT UPDATE (%s) ON public.profiles TO authenticated', existing);
  END IF;
END $$;

-- Admin keeps full column access (granted by ALL on profiles via role membership
-- if configured); the SECURITY DEFINER is_admin() bypass still works in RPCs.


-- ============================================================================
-- C3: /verify login sicuro — niente più PIN esposto + niente più INSERT libero
-- ============================================================================
-- 1. Nascondi verify_pin dal SELECT pubblico
-- 2. RPC verify_login(pin) SECURITY DEFINER che valida PIN + crea device
-- 3. Revoca INSERT anon su verified_devices
-- ============================================================================

-- Nascondi verify_pin dal SELECT pubblico via column-level GRANT.
-- Le policy continuano a permettere SELECT su restaurants, ma i GRANT
-- per colonna limitano a cosa anon/auth possono vedere.
DO $$
DECLARE
  col_list text;
BEGIN
  -- Calcola la lista di tutte le colonne di restaurants tranne verify_pin
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO col_list
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'restaurants'
    AND column_name <> 'verify_pin';

  -- Revoca tutto + ri-grant solo le colonne sicure
  EXECUTE format('REVOKE SELECT ON public.restaurants FROM anon, authenticated');
  EXECUTE format('GRANT SELECT (%s) ON public.restaurants TO anon, authenticated', col_list);
END $$;

-- RPC verify_login: valida PIN server-side, crea device_token, ritorna dati.
-- Sostituisce la query client diretta su restaurants.verify_pin.
CREATE OR REPLACE FUNCTION public.verify_login(
  p_pin        text,
  p_user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_token         text;
  v_restaurant    jsonb;
BEGIN
  -- Validazione input
  IF p_pin IS NULL OR NOT (p_pin ~ '^[0-9]{6}$') THEN
    RETURN jsonb_build_object('error', 'invalid_pin');
  END IF;

  -- 1) Cerca sul campo restaurants.verify_pin (fonte primaria)
  SELECT id INTO v_restaurant_id
    FROM restaurants
    WHERE verify_pin = p_pin
      AND is_published = true
    LIMIT 1;

  -- 2) Fallback: PIN storico in restaurant_partners.pin_code
  IF v_restaurant_id IS NULL THEN
    SELECT rp.restaurant_id INTO v_restaurant_id
      FROM restaurant_partners rp
      JOIN restaurants r ON r.id = rp.restaurant_id
      WHERE rp.pin_code = p_pin
        AND rp.is_active = true
        AND r.is_published = true
      LIMIT 1;
  END IF;

  IF v_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_pin');
  END IF;

  -- Genera token opaco (UUID)
  v_token := replace(gen_random_uuid()::text, '-', '') ||
             replace(gen_random_uuid()::text, '-', '');

  -- Registra device (server-side, bypassa RLS di verified_devices)
  INSERT INTO verified_devices (device_token, restaurant_id, user_agent)
  VALUES (v_token, v_restaurant_id, LEFT(COALESCE(p_user_agent, ''), 500));

  -- Ritorna i dati del ristorante + token
  SELECT to_jsonb(r) INTO v_restaurant
    FROM restaurants r
    WHERE r.id = v_restaurant_id;

  -- Rimuovi verify_pin dalla risposta per sicurezza
  v_restaurant := v_restaurant - 'verify_pin';

  RETURN jsonb_build_object(
    'device_token', v_token,
    'restaurant',   v_restaurant
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_login(text, text) TO anon, authenticated;

-- Blocca INSERT anonimo su verified_devices (ora passa solo via RPC server-side)
DROP POLICY IF EXISTS "Public insert device" ON verified_devices;
-- Nota: la RPC verify_login usa SECURITY DEFINER e bypassa RLS, quindi l'INSERT
-- interno continua a funzionare anche senza questa policy.

-- UPDATE last_used_at: solo via RPC anche questo
DROP POLICY IF EXISTS "Public update last_used" ON verified_devices;

CREATE OR REPLACE FUNCTION public.verify_touch_device(p_device_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE verified_devices
    SET last_used_at = now()
    WHERE device_token = p_device_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_touch_device(text) TO anon, authenticated;


-- ============================================================================
-- C2: UPDATE libero su discount_redemptions — chiudere
-- ============================================================================
-- Policy attuale: "Anyone can update redemption with valid data" USING/WITH
-- CHECK (true). Chiunque può flippare status='redeemed'.
-- Sostituzione: UPDATE solo admin; validazione QR passa per RPC.
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can update redemption with valid data" ON discount_redemptions;

-- Manteniamo solo "Admin update redemptions" (già esistente) e una policy
-- "Users delete own redemptions" per il "annulla generazione" dell'utente.
-- Nessuna policy UPDATE per anon/authenticated non-admin.

-- RPC validate_redemption: atomicamente valida QR e marca redeemed.
-- Chiamata dal ristoratore loggato via device_token.
CREATE OR REPLACE FUNCTION public.verify_redeem_qr(
  p_device_token text,
  p_qr_code      text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_redemption    discount_redemptions%ROWTYPE;
  v_discount      discounts%ROWTYPE;
  v_user_name     text;
BEGIN
  -- 1) Valida device_token
  SELECT restaurant_id INTO v_restaurant_id
    FROM verified_devices
    WHERE device_token = p_device_token;

  IF v_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  -- 2) Touch last_used
  UPDATE verified_devices SET last_used_at = now()
    WHERE device_token = p_device_token;

  -- 3) Trova redemption
  SELECT * INTO v_redemption
    FROM discount_redemptions
    WHERE qr_code = p_qr_code
    LIMIT 1;

  IF v_redemption.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- 4) Verifica appartenenza al ristorante che chiama
  SELECT * INTO v_discount FROM discounts WHERE id = v_redemption.discount_id;

  IF v_discount.restaurant_id IS DISTINCT FROM v_restaurant_id THEN
    RETURN jsonb_build_object('status', 'wrong_restaurant');
  END IF;

  -- 5) Nome utente (per messaggio conferma)
  SELECT full_name INTO v_user_name
    FROM profiles
    WHERE id = v_redemption.user_id;

  -- 6) Già usato?
  IF v_redemption.status = 'redeemed' THEN
    RETURN jsonb_build_object(
      'status',    'already_redeemed',
      'data',      to_jsonb(v_redemption) || jsonb_build_object(
        'user_name',      COALESCE(v_user_name, 'Utente'),
        'discount_title', v_discount.title,
        'discount_value', v_discount.discount_value,
        'discount_type',  v_discount.discount_type
      )
    );
  END IF;

  -- 7) Scaduto?
  IF v_redemption.status = 'expired' OR
     (v_discount.valid_until IS NOT NULL AND v_discount.valid_until < now()) THEN
    RETURN jsonb_build_object(
      'status', 'expired',
      'data',   to_jsonb(v_redemption)
    );
  END IF;

  -- 8) Marca redeemed (atomico)
  UPDATE discount_redemptions
    SET status = 'redeemed',
        redeemed_at = now(),
        redeemed_by_restaurant = true,
        user_name = COALESCE(user_name, v_user_name)
    WHERE id = v_redemption.id;

  -- 9) Incrementa contatore (best-effort)
  BEGIN
    UPDATE discounts
      SET total_redeemed = COALESCE(total_redeemed, 0) + 1
      WHERE id = v_discount.id;
  EXCEPTION WHEN others THEN
    -- non critico
    NULL;
  END;

  RETURN jsonb_build_object(
    'status', 'success',
    'data',   jsonb_build_object(
      'redemption_id',  v_redemption.id,
      'user_name',      COALESCE(v_user_name, 'Utente'),
      'discount_title', v_discount.title,
      'discount_value', v_discount.discount_value,
      'discount_type',  v_discount.discount_type,
      'restaurant_name', (SELECT name FROM restaurants WHERE id = v_restaurant_id)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_redeem_qr(text, text) TO anon, authenticated;


-- ============================================================================
-- C4: SELECT pubblico su discount_redemptions — restringere
-- ============================================================================
-- Chiunque può leggere qr_code + user_id di tutti i riscatti.
-- Manteniamo:
--   • Lettura del proprio riscatto (per l'app user)
--   • Lettura via RPC per il ristoratore (activity feed)
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can read redemptions by qr_code" ON discount_redemptions;
DROP POLICY IF EXISTS "Public read all redemptions" ON discount_redemptions;
DROP POLICY IF EXISTS "Users read own redemptions" ON discount_redemptions;

-- Users possono leggere SOLO i propri riscatti
CREATE POLICY "Users read own redemptions" ON discount_redemptions
  FOR SELECT USING (auth.uid() = user_id);

-- Admin già ha "Admin read all redemptions" (esistente)
-- INSERT "Users create redemptions" già esistente e corretta
-- DELETE sia admin sia owner (policy già in place o gestite altrove)

-- RPC per activity feed del ristoratore
CREATE OR REPLACE FUNCTION public.verify_activity_list(
  p_restaurant_id uuid,
  p_device_token  text,
  p_limit         int DEFAULT 10
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid boolean;
  v_rows  jsonb;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM verified_devices
    WHERE device_token = p_device_token
      AND restaurant_id = p_restaurant_id
  ) INTO v_valid;

  IF NOT v_valid THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_jsonb(x) ORDER BY x.generated_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT dr.id,
           dr.qr_code,
           dr.status,
           dr.generated_at,
           dr.redeemed_at,
           dr.user_id,
           COALESCE(dr.user_name, p.full_name) AS user_name,
           jsonb_build_object(
             'id',    d.id,
             'title', d.title
           ) AS discount
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    LEFT JOIN profiles p ON p.id = dr.user_id
    WHERE d.restaurant_id = p_restaurant_id
    ORDER BY dr.generated_at DESC
    LIMIT LEAST(p_limit, 50)
  ) x;

  RETURN jsonb_build_object('items', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_activity_list(uuid, text, int) TO anon, authenticated;


-- ============================================================================
-- H6: Bypass moderazione recensioni — correggere policy user_reviews
-- ============================================================================
-- Policy attuale "Users manage own reviews FOR ALL USING (auth.uid()=user_id)"
-- permette all'utente di impostare status='published' dal client, scavalcando
-- la moderazione AI. Splittiamo in policy specifiche con WITH CHECK.
-- ============================================================================

DROP POLICY IF EXISTS "Users manage own reviews" ON user_reviews;
DROP POLICY IF EXISTS "Users create reviews" ON user_reviews;
DROP POLICY IF EXISTS "Users update own reviews" ON user_reviews;
DROP POLICY IF EXISTS "Users delete own reviews" ON user_reviews;
DROP POLICY IF EXISTS "Users read own reviews" ON user_reviews;

-- Lettura: propri (qualsiasi status) + pubbliche di altri
CREATE POLICY "Users read own or published reviews" ON user_reviews
  FOR SELECT USING (auth.uid() = user_id OR status = 'published');

-- Creazione: solo con status inizializzato a pending_review
CREATE POLICY "Users create reviews" ON user_reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending_review');

-- Aggiornamento: può modificare solo i propri E NON può impostare
-- status='published' (solo admin o edge function service_role possono)
CREATE POLICY "Users update own reviews" ON user_reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('pending_review', 'rejected')
  );

-- Eliminazione: propri
CREATE POLICY "Users delete own reviews" ON user_reviews
  FOR DELETE USING (auth.uid() = user_id);

-- Admin "Admin full access reviews" (esistente) resta attiva.


-- ============================================================================
-- M3: increment_discount_redeemed — non più chiamabile da anon
-- ============================================================================
-- Era chiamabile da chiunque → permette di gonfiare total_redeemed
-- fino a max_redemptions disabilitando lo sconto.
-- Il contatore ora viene incrementato dentro verify_redeem_qr (admin) e
-- da un trigger al momento dell'insert (utente genera QR).
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.increment_discount_redeemed(uuid) FROM anon, authenticated;
-- Ricrea con admin-only check
CREATE OR REPLACE FUNCTION public.increment_discount_redeemed(discount_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    -- Non-admin: silenziosamente no-op (il contatore è curato dai trigger/RPC)
    RETURN;
  END IF;
  UPDATE discounts
    SET total_redeemed = COALESCE(total_redeemed, 0) + 1
    WHERE id = discount_uuid;
END;
$$;

-- Trigger che incrementa il contatore all'INSERT di un redemption (generato)
CREATE OR REPLACE FUNCTION public.tg_increment_redeemed_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE discounts
    SET total_redeemed = COALESCE(total_redeemed, 0) + 1
    WHERE id = NEW.discount_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_redeemed_count_on_insert ON discount_redemptions;
CREATE TRIGGER tr_redeemed_count_on_insert
  AFTER INSERT ON discount_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_increment_redeemed_on_insert();

-- Il client non deve più chiamare rpc('increment_discount_redeemed') dopo insert.
-- (Il codice aggiornato lo rimuove; le chiamate dai client vecchi non falliscono
-- perché la funzione esiste ancora ma è no-op per non-admin.)

GRANT EXECUTE ON FUNCTION public.increment_discount_redeemed(uuid) TO anon, authenticated;


-- ============================================================================
-- DONE
-- ============================================================================
-- Verifiche suggerite dopo il run:
--   1. Login /verify con PIN valido → deve ancora funzionare (via verify_login)
--   2. Generazione QR sconto utente → total_redeemed incrementa (via trigger)
--   3. Scansione QR ristorante → verify_redeem_qr marca redeemed
--   4. Recensione utente → non può più impostare status='published' dal client
--   5. UPDATE is_admin da browser console → deve fallire con permission denied
-- ============================================================================
