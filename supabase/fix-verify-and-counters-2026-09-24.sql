-- =====================================================================
-- 24/09 — dashboard ristoratori che non salvava, e sconti contati due volte
-- =====================================================================
-- Idempotente: si può rieseguire.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Impostazioni del locale e cambio PIN: non funzionavano per nessuno
-- ---------------------------------------------------------------------
-- verify_update_restaurant_meta e verify_change_pin prendevano il
-- device_token come `uuid`. Ma verify_login i token li crea da 64
-- caratteri esadecimali (due uuid attaccati senza trattini): tutti i 48
-- dispositivi attivi hanno quel formato, e Postgres rifiuta la chiamata
-- prima ancora di entrare nella funzione ("invalid input syntax for type
-- uuid"). Risultato: nessun ristoratore ha mai potuto salvare orari o
-- email, né cambiare il PIN (opening_hours è vuoto su tutti i locali).
--
-- In più verify_update_restaurant_meta scriveva in `restaurants.email`,
-- una colonna che non esiste: l'email del ristoratore è `partner_email`.
-- E la pagina leggeva quei dati con una select diretta su restaurants,
-- che per `email` rispondeva 400 — e che per `partner_email` non potrebbe
-- comunque funzionare, perché la colonna non è leggibile dal browser
-- (audit del 23/09). Ora li legge verify_get_restaurant_meta.
--
-- Le versioni `uuid` vanno eliminate, non affiancate: con due funzioni
-- dello stesso nome e degli stessi parametri PostgREST non sa quale
-- chiamare. La versione `text` accetta anche i vecchi token da 36.

DROP FUNCTION IF EXISTS public.verify_update_restaurant_meta(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.verify_change_pin(uuid, text, text);
DROP FUNCTION IF EXISTS public.verify_resolve_restaurant(uuid);

CREATE OR REPLACE FUNCTION public.verify_resolve_restaurant(p_device_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_restaurant_id uuid;
BEGIN
  IF p_device_token IS NULL OR length(p_device_token) < 16 THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT restaurant_id INTO v_restaurant_id
    FROM verified_devices
   WHERE device_token = p_device_token;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
  END IF;

  UPDATE verified_devices SET last_used_at = now() WHERE device_token = p_device_token;
  RETURN v_restaurant_id;
END;
$function$;

-- Solo per uso interno delle altre funzioni verify_*.
REVOKE EXECUTE ON FUNCTION public.verify_resolve_restaurant(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_get_restaurant_meta(p_device_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_restaurant_id uuid;
  v_out jsonb;
BEGIN
  BEGIN
    v_restaurant_id := verify_resolve_restaurant(p_device_token);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END;

  SELECT jsonb_build_object(
           'email',                partner_email,
           'opening_hours',        opening_hours,
           'hours_cache',          hours_cache,
           'place_id_verified_at', place_id_verified_at
         )
    INTO v_out
    FROM restaurants
   WHERE id = v_restaurant_id;

  RETURN v_out;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_get_restaurant_meta(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_get_restaurant_meta(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_update_restaurant_meta(
  p_device_token text,
  p_email text DEFAULT NULL,
  p_opening_hours jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_restaurant_id uuid;
BEGIN
  BEGIN
    v_restaurant_id := verify_resolve_restaurant(p_device_token);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END;

  IF p_email IS NOT NULL AND p_email <> ''
     AND (length(p_email) > 254 OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RETURN jsonb_build_object('error', 'Email non valida');
  END IF;

  -- NULL = non modificare
  UPDATE restaurants
     SET partner_email = COALESCE(NULLIF(trim(p_email), ''), partner_email),
         opening_hours = COALESCE(p_opening_hours, opening_hours),
         updated_at    = now()
   WHERE id = v_restaurant_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_update_restaurant_meta(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_update_restaurant_meta(text, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_change_pin(p_device_token text, p_current_pin text, p_new_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_restaurant_id uuid;
  v_existing_pin text;
BEGIN
  BEGIN
    v_restaurant_id := verify_resolve_restaurant(p_device_token);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END;

  IF p_new_pin IS NULL OR p_new_pin !~ '^\d{6}$' THEN
    RETURN jsonb_build_object('error', 'invalid_pin');
  END IF;

  SELECT verify_pin INTO v_existing_pin FROM restaurants WHERE id = v_restaurant_id;

  IF v_existing_pin IS NULL OR v_existing_pin <> p_current_pin THEN
    RETURN jsonb_build_object('error', 'wrong_pin');
  END IF;

  IF p_new_pin = v_existing_pin THEN
    RETURN jsonb_build_object('error', 'same_pin');
  END IF;

  -- Il gettone magico dell'email di benvenuto si apre col PIN vecchio:
  -- cambiato il PIN, lo si butta.
  UPDATE restaurants
     SET verify_pin = p_new_pin,
         last_pin_rotation_at = now(),
         magic_token = NULL,
         magic_token_expires_at = NULL,
         updated_at = now()
   WHERE id = v_restaurant_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_change_pin(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_change_pin(text, text, text) TO anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Sconti contati due volte
-- ---------------------------------------------------------------------
-- `discounts.total_redeemed` saliva di 1 quando l'utente prendeva lo
-- sconto (trigger tr_redeemed_count_on_insert) e di nuovo quando il locale
-- lo scansionava (verify_redeem_qr). Il sito ne ricava i posti rimasti
-- (isSoldOut in src/lib/discounts.js): un drop da 10 risultava esaurito
-- dopo 5 persone che l'avevano usato. In più l'RPC
-- increment_discount_redeemed, chiamata dal browser dopo ogni presa, per un
-- admin aggiungeva un terzo +1.
--
-- Da qui in avanti total_redeemed = quanti l'hanno preso: lo alza solo il
-- trigger all'INSERT. Quanti l'hanno usato si conta dai riscatti con
-- status = 'redeemed'.

-- 2a. verify_redeem_qr senza il secondo +1. Si toglie solo quel blocco
--     dalla definizione in uso, così il resto della funzione (lunga, e
--     cambiata più volte) resta esattamente com'è.
DO $do$
DECLARE
  v_def text;
  v_block constant text := E'  BEGIN\n    UPDATE discounts\n      SET total_redeemed = COALESCE(total_redeemed, 0) + 1\n      WHERE id = v_discount.id;\n  EXCEPTION WHEN others THEN\n    NULL;\n  END;\n';
BEGIN
  v_def := pg_get_functiondef('public.verify_redeem_qr(text, text)'::regprocedure);
  IF position('total_redeemed' IN v_def) = 0 THEN
    RETURN; -- già sistemata
  END IF;
  IF position(v_block IN v_def) = 0 THEN
    RAISE EXCEPTION 'verify_redeem_qr: blocco del contatore non trovato, sistemare a mano';
  END IF;
  EXECUTE replace(v_def, v_block, '');
END
$do$;

-- 2b. increment_discount_redeemed non fa più niente, per nessuno. Resta
--     per le schede aperte con la versione vecchia del sito, che la
--     chiamano ancora.
CREATE OR REPLACE FUNCTION public.increment_discount_redeemed(discount_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Il contatore lo tiene il trigger tr_redeemed_count_on_insert.
  RETURN;
END;
$function$;

-- 2c. I contatori già gonfiati tornano al numero vero di prese.
UPDATE public.discounts d
   SET total_redeemed = sub.n
  FROM (
    SELECT d2.id, count(r.id)::int AS n
      FROM public.discounts d2
      LEFT JOIN public.discount_redemptions r ON r.discount_id = d2.id
     GROUP BY d2.id
  ) sub
 WHERE sub.id = d.id
   AND COALESCE(d.total_redeemed, 0) <> sub.n;
