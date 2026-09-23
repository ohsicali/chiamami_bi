-- =====================================================================
-- AUDIT SICUREZZA 23/09 — parte A (si applica subito, non rompe niente)
-- =====================================================================
-- Il resoconto completo, con gli attacchi provati sul DB live, sta in
-- docs/security-audit-2026-09-23.md. Qui solo le correzioni.
--
-- La parte B (togliere il PIN dei ristoratori dalla lettura degli utenti
-- loggati) sta in `security-audit-2026-09-23-part-b.sql` e va eseguita
-- DOPO il deploy del frontend di questa PR: prima il pannello admin e le
-- pagine "Salvati" chiedevano `select=*` su restaurants, che con i grant di
-- colonna fallisce.
--
-- Idempotente: si può rieseguire.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PROFILES — email e nomi di tutti gli utenti leggibili da chiunque
-- ---------------------------------------------------------------------
-- La policy SELECT era `USING (true)` e anon aveva il grant su `email`:
-- con la sola chiave pubblica (nel bundle JS) si scaricava la lista di
-- tutti gli iscritti, email e nome. Un utente loggato leggeva anche la
-- `recovery_email` degli altri. Nessuna pagina pubblica legge il profilo
-- di un altro: il nome che vede il ristoratore arriva dagli RPC verify_*
-- (SECURITY DEFINER) o da `discount_redemptions.user_name`.
DROP POLICY IF EXISTS "Public read basic profile info" ON public.profiles;
DROP POLICY IF EXISTS "Read own profile or admin" ON public.profiles;
CREATE POLICY "Read own profile or admin" ON public.profiles
  FOR SELECT USING ((SELECT auth.uid()) = id OR public.is_admin());

-- anon non ha un profilo suo da leggere né da scrivere.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM anon;

-- Il trigger anti-escalation copriva solo l'UPDATE: un INSERT del proprio
-- profilo con is_admin = true (possibile se la riga non c'è ancora)
-- passava. Ora copre anche l'INSERT. Chi crea il profilo alla
-- registrazione (handle_new_user) non ha un auth.uid() e non chiede mai
-- is_admin = true, quindi non è toccato.
CREATE OR REPLACE FUNCTION public.prevent_self_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_admin, false) AND auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Permission denied: only admins can change is_admin'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

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
$function$;

DROP TRIGGER IF EXISTS prevent_self_admin_escalation ON public.profiles;
CREATE TRIGGER prevent_self_admin_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_admin_escalation();


-- ---------------------------------------------------------------------
-- 2. LOGIN RISTORATORI — PIN a 6 cifre indovinabile a raffica
-- ---------------------------------------------------------------------
-- `verify_login(p_pin)` cerca il PIN fra TUTTI i ristoranti, senza alcun
-- limite lato server (il blocco dopo 5 tentativi stava solo nel
-- localStorage del browser). Con ~27 PIN validi su 900.000 possibili, a
-- chiamate dirette a PostgREST ne bastano in media ~33.000: pochi minuti
-- per entrare nella dashboard di un locale, riscattare QR e cambiarne il
-- PIN. Ora ogni tentativo fallito viene contato:
--   • per IP: 8 errori in 15 minuti, poi stop;
--   • globale: 40 errori in un'ora da tutti gli IP insieme, poi stop per
--     tutti — chi ruota gli IP (o falsifica X-Forwarded-For) resta così a
--     meno di mille tentativi al giorno. I ristoratori già entrati non se ne
--     accorgono: il loro device_token non passa di qui.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.verify_login_failures (
  id        bigserial PRIMARY KEY,
  ip        text        NOT NULL,
  failed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verify_login_failures_ip_idx
  ON private.verify_login_failures (ip, failed_at DESC);
CREATE INDEX IF NOT EXISTS verify_login_failures_at_idx
  ON private.verify_login_failures (failed_at DESC);

-- L'IP del chiamante come lo vede PostgREST. cf-connecting-ip lo scrive
-- Cloudflare e il client non lo può falsificare; x-forwarded-for sì, ed è
-- solo l'ultima spiaggia (per questo esiste anche il tetto globale).
CREATE OR REPLACE FUNCTION private.request_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_headers json;
BEGIN
  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;
  RETURN COALESCE(
    NULLIF(trim(v_headers->>'cf-connecting-ip'), ''),
    NULLIF(trim(v_headers->>'x-real-ip'), ''),
    NULLIF(trim(split_part(v_headers->>'x-forwarded-for', ',', 1)), ''),
    'unknown'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_login(p_pin text, p_user_agent text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c_ip_max      constant int      := 8;
  c_ip_window   constant interval := interval '15 minutes';
  c_all_max     constant int      := 40;
  c_all_window  constant interval := interval '1 hour';

  v_ip            text;
  v_restaurant_id uuid;
  v_token         text;
  v_restaurant    jsonb;
BEGIN
  -- Validazione input
  IF p_pin IS NULL OR NOT (p_pin ~ '^[0-9]{6}$') THEN
    RETURN jsonb_build_object('error', 'invalid_pin');
  END IF;

  -- Freno ai tentativi (vedi sopra). Si controlla PRIMA di guardare il PIN:
  -- da bloccati non si deve poter sapere se il PIN era giusto.
  v_ip := private.request_ip();
  IF (SELECT count(*) FROM private.verify_login_failures
       WHERE ip = v_ip AND failed_at > now() - c_ip_window) >= c_ip_max
     OR (SELECT count(*) FROM private.verify_login_failures
       WHERE failed_at > now() - c_all_window) >= c_all_max THEN
    RETURN jsonb_build_object('error', 'too_many_attempts');
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
    INSERT INTO private.verify_login_failures (ip) VALUES (v_ip);
    -- Pulizia: le righe servono solo per l'ultima ora.
    DELETE FROM private.verify_login_failures WHERE failed_at < now() - interval '1 day';
    RETURN jsonb_build_object('error', 'invalid_pin');
  END IF;

  -- Genera token opaco
  v_token := replace(gen_random_uuid()::text, '-', '') ||
             replace(gen_random_uuid()::text, '-', '');

  -- Registra device (server-side, bypassa RLS di verified_devices)
  INSERT INTO verified_devices (device_token, restaurant_id, user_agent)
  VALUES (v_token, v_restaurant_id, LEFT(COALESCE(p_user_agent, ''), 500));

  -- Ritorna i dati del ristorante + token, senza i segreti: il PIN e il
  -- gettone magico (che insieme al PIN apre la dashboard da un link).
  SELECT to_jsonb(r) INTO v_restaurant
    FROM restaurants r
    WHERE r.id = v_restaurant_id;

  v_restaurant := v_restaurant - 'verify_pin' - 'magic_token' - 'magic_token_expires_at';

  RETURN jsonb_build_object(
    'device_token', v_token,
    'restaurant',   v_restaurant
  );
END;
$function$;

-- register_verified_device(p_pin, p_restaurant_id) è il vecchio login per
-- singolo locale: nessuno lo chiama più e non ha nessun freno, quindi
-- permetterebbe di provare tutti i PIN di un locale scelto. Chiuso, come
-- is_device_token_valid (vecchio, non usato: gli RPC verify_* fanno da sé).
REVOKE EXECUTE ON FUNCTION public.register_verified_device(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_device_token_valid(text, uuid) FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. SCONTI — un utente poteva esaurire i posti di qualunque drop
-- ---------------------------------------------------------------------
-- Ogni INSERT in discount_redemptions fa +1 a discounts.total_redeemed
-- (trigger tr_redeemed_count_on_insert), e "esaurito" si calcola da lì.
-- Un utente loggato poteva inserire e cancellare il proprio riscatto in
-- ciclo (la DELETE gli era concessa), o inserirne quanti voleva: in pochi
-- secondi qualunque drop risultava "posti finiti". Poteva anche inserire
-- un riscatto già 'redeemed' o per uno sconto spento/scaduto/esaurito.
--
-- L'app già riusa sempre il riscatto esistente (uno per utente e sconto),
-- quindi il vincolo non cambia niente per chi usa il sito normalmente.
DROP POLICY IF EXISTS "Delete redemptions" ON public.discount_redemptions;
CREATE POLICY "Delete redemptions" ON public.discount_redemptions
  FOR DELETE USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.guard_redemption_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_discount discounts%ROWTYPE;
  v_max      int;
BEGIN
  -- Service role, SQL editor e admin: nessun vincolo (niente auth.uid()
  -- vuol dire che non arriva da un browser).
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Un riscatto nasce "da usare": lo segna usato solo il locale, dagli RPC.
  NEW.status := 'generated';
  NEW.redeemed_at := NULL;
  NEW.redeemed_by_restaurant := false;
  NEW.generated_at := now();
  NEW.user_name := LEFT(NEW.user_name, 120);

  -- Due richieste in parallelo non devono passare entrambe il controllo.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text || ':' || NEW.discount_id::text, 0));

  IF EXISTS (SELECT 1 FROM discount_redemptions
              WHERE user_id = NEW.user_id AND discount_id = NEW.discount_id) THEN
    RAISE EXCEPTION 'already_claimed' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_discount FROM discounts WHERE id = NEW.discount_id;
  IF NOT FOUND OR NOT COALESCE(v_discount.is_active, false) THEN
    RAISE EXCEPTION 'discount_not_available' USING ERRCODE = 'P0001';
  END IF;
  IF v_discount.valid_until IS NOT NULL AND v_discount.valid_until < now() THEN
    RAISE EXCEPTION 'discount_expired' USING ERRCODE = 'P0001';
  END IF;

  -- Stessa regola di isSoldOut() in src/lib/discounts.js.
  v_max := COALESCE(NULLIF(v_discount.max_quantity, 0), NULLIF(v_discount.max_redemptions, 0));
  IF v_max IS NOT NULL
     AND GREATEST(COALESCE(v_discount.claimed_count, 0), COALESCE(v_discount.total_redeemed, 0)) >= v_max THEN
    RAISE EXCEPTION 'sold_out' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_redemption_insert ON public.discount_redemptions;
CREATE TRIGGER trg_guard_redemption_insert
  BEFORE INSERT ON public.discount_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_redemption_insert();


-- ---------------------------------------------------------------------
-- 4. STORAGE — qualunque utente registrato poteva cancellare o
--    sostituire tutte le foto del sito
-- ---------------------------------------------------------------------
-- Le policy del bucket `photos` chiedevano solo `auth.role() =
-- 'authenticated'`: con un account qualsiasi si potevano sovrascrivere o
-- cancellare le foto di ogni locale, o caricare un file HTML/SVG che poi
-- /api/img serviva dal dominio chiamamibi.com. Tutti i caricamenti in
-- `photos` li fa il pannello admin.
DROP POLICY IF EXISTS "Auth users upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users update photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin update photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete photos" ON storage.objects;

CREATE POLICY "Admin upload photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND public.is_admin());
CREATE POLICY "Admin update photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'photos' AND public.is_admin())
  WITH CHECK (bucket_id = 'photos' AND public.is_admin());
CREATE POLICY "Admin delete photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND public.is_admin());

-- Solo immagini, anche per l'admin (un account admin rubato non deve poter
-- ospitare pagine HTML sul nostro storage).
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
       file_size_limit = 20 * 1024 * 1024
 WHERE id = 'photos';
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
       file_size_limit = 8 * 1024 * 1024
 WHERE id = 'suggestions';


-- ---------------------------------------------------------------------
-- 5. Candidature partner scrivibili direttamente, saltando il captcha
-- ---------------------------------------------------------------------
-- /api/partner-application scrive con la service role dopo Turnstile e
-- rate limit; la policy "Anyone can apply" permetteva lo stesso INSERT
-- direttamente con la chiave pubblica, senza nessuno dei due.
DROP POLICY IF EXISTS "Anyone can apply" ON public.partner_applications;


-- ---------------------------------------------------------------------
-- 6. PIN dei ristoratori per il pannello admin (prepara la parte B)
-- ---------------------------------------------------------------------
-- Il pannello admin legge PIN ed email del partner da qui, non più dalla
-- tabella: così la parte B può togliere quelle colonne agli utenti loggati.
CREATE OR REPLACE FUNCTION public.admin_restaurant_secrets(p_restaurant_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  verify_pin text,
  partner_email text,
  onboarding_email_sent_at timestamptz,
  magic_token_expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo gli admin possono leggere le credenziali dei locali'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT r.id, r.verify_pin, r.partner_email, r.onboarding_email_sent_at, r.magic_token_expires_at
      FROM restaurants r
     WHERE p_restaurant_ids IS NULL OR r.id = ANY (p_restaurant_ids);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_restaurant_secrets(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_restaurant_secrets(uuid[]) TO authenticated;


-- ---------------------------------------------------------------------
-- 7. Pulizia segnalata dal linter di Supabase
-- ---------------------------------------------------------------------
-- Le funzioni-trigger non vanno chiamate via /rest/v1/rpc: il trigger le
-- esegue comunque (il permesso EXECUTE si controlla solo alla creazione
-- del trigger).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_email_prefs() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_admin_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_redemption_short_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_increment_redeemed_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_redemption_insert() FROM PUBLIC, anon, authenticated;

-- search_path fisso (evita che un oggetto con lo stesso nome in un altro
-- schema venga risolto al posto di quello giusto).
ALTER FUNCTION public.set_sponsored_placements_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_ai_user_preferences() SET search_path = public;
ALTER FUNCTION public.analytics_section(text) SET search_path = public;
ALTER FUNCTION public.analytics_source(text) SET search_path = public;
