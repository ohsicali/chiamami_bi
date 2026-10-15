-- ============================================================================
-- Sconto a fasce — "30% in settimana, 15% dal venerdì alla domenica" (15/10)
-- ============================================================================
--
-- Richiesta del proprietario: un locale vuole uno sconto che vale di più in
-- settimana e meno nel weekend. Uno sconto solo (una card, un «Sblocca», un
-- QR), che si usa una volta: in settimana prendi il 30, nel weekend il 15.
-- Regole e parole lato app in src/lib/dayTiers.js (test in
-- tests/day-tiers.test.mjs, che controlla anche questo file).
--
-- 1. `discounts.day_tiers` (jsonb, NULL = sconto normale):
--      [{"days":[1,2,3,4],"value":"30"},{"days":[5,6,7],"value":"15"}]
--    1 = lunedì … 7 = domenica, come `valid_days`. Il tipo (percentuale o
--    euro) è quello dello sconto. Il trigger qui sotto lo controlla e tiene
--    `valid_days` = l'unione dei giorni e `discount_value` = la prima fascia:
--    così tutto quello che non conosce le fasce (validità, conteggi, vecchie
--    letture) resta giusto. Solo convenzioni, solo percentuale ed euro.
--
-- 2. `discount_redemptions.applied_value` (text): il valore applicato alla
--    cassa, scritto da `verify_redeem_qr` col giorno di Roma — per tutti gli
--    sconti, così lo storico non cambia se lo sconto viene modificato dopo.
--    Il browser non lo scrive mai (`guard_redemption_insert` lo azzera).
--
-- 3. Chi mostra uno sconto già usato legge `applied_value`: la convalida in
--    /verify, la festa e le stelle (`feedback_get`), lo storico del locale
--    (`verify_activity_list`), l'avviso su Telegram.
--
-- Si può rieseguire: tutto è IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS day_tiers jsonb;
ALTER TABLE public.discount_redemptions ADD COLUMN IF NOT EXISTS applied_value text;

COMMENT ON COLUMN public.discounts.day_tiers IS
  'Sconto a fasce: [{"days":[1..7],"value":"30"},…]. NULL = sconto normale. valid_days e discount_value li tiene il trigger tr_discount_day_tiers.';
COMMENT ON COLUMN public.discount_redemptions.applied_value IS
  'Il valore applicato alla cassa (verify_redeem_qr, giorno di Roma). Mai dal browser.';

-- ── 1. Controllo e forma delle fasce ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.normalize_discount_day_tiers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier  jsonb;
  v_day   jsonb;
  v_num   numeric;
  v_days  int[];
  v_seen  int[] := ARRAY[]::int[];
  v_value text;
  v_out   jsonb := '[]'::jsonb;
BEGIN
  IF NEW.day_tiers IS NULL OR jsonb_typeof(NEW.day_tiers) = 'null' THEN
    NEW.day_tiers := NULL;
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.day_tiers) <> 'array'
     OR jsonb_array_length(NEW.day_tiers) < 2
     OR jsonb_array_length(NEW.day_tiers) > 7 THEN
    RAISE EXCEPTION 'day_tiers_invalid' USING ERRCODE = '22023', DETAIL = 'Servono da 2 a 7 fasce.';
  END IF;
  -- Un drop ha i suoi posti e il suo countdown: le fasce sono per le convenzioni.
  IF COALESCE(NEW.is_drop, false) THEN
    RAISE EXCEPTION 'day_tiers_drop' USING ERRCODE = '22023', DETAIL = 'Le fasce sono solo per le convenzioni.';
  END IF;
  IF NEW.discount_type IS NULL OR NEW.discount_type NOT IN ('percentage', 'fixed') THEN
    RAISE EXCEPTION 'day_tiers_type' USING ERRCODE = '22023', DETAIL = 'Le fasce valgono per percentuale o euro.';
  END IF;

  FOR v_tier IN SELECT value FROM jsonb_array_elements(NEW.day_tiers) LOOP
    IF jsonb_typeof(v_tier) <> 'object' OR jsonb_typeof(v_tier -> 'days') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'day_tiers_invalid' USING ERRCODE = '22023', DETAIL = 'Ogni fascia ha giorni e valore.';
    END IF;

    v_days := ARRAY[]::int[];
    FOR v_day IN SELECT value FROM jsonb_array_elements(v_tier -> 'days') LOOP
      IF jsonb_typeof(v_day) <> 'number' THEN
        RAISE EXCEPTION 'day_tiers_invalid' USING ERRCODE = '22023', DETAIL = 'I giorni sono numeri da 1 a 7.';
      END IF;
      v_num := (v_day #>> '{}')::numeric;
      IF v_num <> trunc(v_num) OR v_num < 1 OR v_num > 7 THEN
        RAISE EXCEPTION 'day_tiers_invalid' USING ERRCODE = '22023', DETAIL = 'I giorni sono numeri da 1 a 7.';
      END IF;
      IF v_num::int = ANY (v_seen) THEN
        RAISE EXCEPTION 'day_tiers_overlap' USING ERRCODE = '22023', DETAIL = 'Un giorno sta in una fascia sola.';
      END IF;
      v_seen := v_seen || v_num::int;
      v_days := v_days || v_num::int;
    END LOOP;
    IF cardinality(v_days) = 0 THEN
      RAISE EXCEPTION 'day_tiers_invalid' USING ERRCODE = '22023', DETAIL = 'Ogni fascia ha almeno un giorno.';
    END IF;

    -- Come cleanNumeric() in discountFormat.js: via unità e spazi, poi il meno.
    v_value := regexp_replace(
                 regexp_replace(COALESCE(v_tier ->> 'value', ''), '[%€[:space:]]', '', 'g'),
                 '^[-−]', '');
    IF v_value !~ '^[0-9]+([.,][0-9]+)?$' THEN
      RAISE EXCEPTION 'day_tiers_value' USING ERRCODE = '22023', DETAIL = 'Il valore di una fascia è un numero.';
    END IF;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'days',  (SELECT to_jsonb(array_agg(x ORDER BY x)) FROM unnest(v_days) x),
      'value', v_value));
  END LOOP;

  -- In ordine di giorno: la settimana prima del weekend.
  SELECT jsonb_agg(t ORDER BY (t -> 'days' ->> 0)::int) INTO NEW.day_tiers
    FROM jsonb_array_elements(v_out) t;
  NEW.valid_days     := (SELECT array_agg(x ORDER BY x) FROM unnest(v_seen) x);
  NEW.discount_value := NEW.day_tiers -> 0 ->> 'value';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_discount_day_tiers ON public.discounts;
CREATE TRIGGER tr_discount_day_tiers
  BEFORE INSERT OR UPDATE OF day_tiers, is_drop, discount_type, valid_days, discount_value
  ON public.discounts
  FOR EACH ROW EXECUTE FUNCTION public.normalize_discount_day_tiers();

-- ── 2. Il browser non scrive il valore applicato ──────────────────────────
-- Stessa funzione di supabase/drop-claim-window-2026-10-12.sql, più una riga
-- (`NEW.applied_value := NULL`).

CREATE OR REPLACE FUNCTION public.guard_redemption_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_discount discounts%ROWTYPE;
  v_max      int;
  v_free     int;
  v_ahead    int;
  v_my_at    timestamptz;
  v_my_id    uuid;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    IF NEW.expires_at IS NULL THEN
      SELECT COALESCE(NEW.generated_at, now()) + make_interval(days => d.claim_window_days)
        INTO NEW.expires_at
        FROM discounts d
       WHERE d.id = NEW.discount_id AND d.claim_window_days IS NOT NULL;
    END IF;
    RETURN NEW;
  END IF;
  NEW.status := 'generated'; NEW.redeemed_at := NULL; NEW.redeemed_by_restaurant := false; NEW.generated_at := now();
  NEW.user_name := LEFT(NEW.user_name, 120);
  NEW.expires_at := NULL;
  NEW.applied_value := NULL;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text || ':' || NEW.discount_id::text, 0));
  IF EXISTS (SELECT 1 FROM discount_redemptions WHERE user_id = NEW.user_id AND discount_id = NEW.discount_id) THEN
    RAISE EXCEPTION 'already_claimed' USING ERRCODE = '23505';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('discount:' || NEW.discount_id::text, 0));
  NEW.generated_at := clock_timestamp();
  SELECT * INTO v_discount FROM discounts WHERE id = NEW.discount_id;
  IF NOT FOUND OR NOT COALESCE(v_discount.is_active, false) THEN RAISE EXCEPTION 'discount_not_available' USING ERRCODE = 'P0001'; END IF;
  IF v_discount.is_test AND NOT public.is_discount_tester(v_discount.id) THEN
    RAISE EXCEPTION 'discount_not_available' USING ERRCODE = 'P0001';
  END IF;
  IF v_discount.valid_until IS NOT NULL AND v_discount.valid_until < now() THEN RAISE EXCEPTION 'discount_expired' USING ERRCODE = 'P0001'; END IF;
  v_max := COALESCE(NULLIF(v_discount.max_quantity, 0), NULLIF(v_discount.max_redemptions, 0));
  v_free := v_max - GREATEST(COALESCE(v_discount.claimed_count, 0), COALESCE(v_discount.total_redeemed, 0));
  IF v_max IS NOT NULL AND v_free <= 0 THEN
    RAISE EXCEPTION 'sold_out' USING ERRCODE = 'P0001';
  END IF;
  IF v_discount.claim_window_days IS NOT NULL THEN
    IF v_max IS NOT NULL THEN
      SELECT w.joined_at, w.id INTO v_my_at, v_my_id
        FROM drop_waitlist w
       WHERE w.discount_id = NEW.discount_id AND w.user_id = NEW.user_id AND w.status = 'waiting';
      SELECT count(*) INTO v_ahead
        FROM drop_waitlist w
       WHERE w.discount_id = NEW.discount_id
         AND w.status = 'waiting'
         AND w.user_id <> NEW.user_id
         AND (v_my_at IS NULL OR (w.joined_at, w.id) < (v_my_at, v_my_id));
      IF v_free <= v_ahead THEN
        RAISE EXCEPTION 'sold_out' USING ERRCODE = 'P0001';
      END IF;
    END IF;
    NEW.expires_at := NEW.generated_at + make_interval(days => v_discount.claim_window_days);
  END IF;
  RETURN NEW;
END;
$function$;

-- ── 3. La cassa sceglie la fascia del giorno ──────────────────────────────
-- Stessa funzione di prima (drop-claim-window-2026-10-12.sql) con il valore
-- del giorno: `v_value` al posto di `discount_value` nelle risposte, scritto
-- in `applied_value` alla convalida. Il giorno e l'ora si calcolano subito
-- dopo aver letto lo sconto, perché servono già a "già usato" e "scaduto".

CREATE OR REPLACE FUNCTION public.verify_redeem_qr(p_device_token text, p_qr_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c_max_failed  constant int      := 10;
  c_fail_window constant interval := interval '15 minutes';

  v_device        verified_devices%ROWTYPE;
  v_restaurant_id uuid;
  v_redemption    discount_redemptions%ROWTYPE;
  v_discount      discounts%ROWTYPE;
  v_user_name     text;
  v_normalized    text;
  v_is_typed      boolean;
  v_today_dow     int;
  v_now_min       int;
  v_in_range      boolean := false;
  v_has_today     boolean;
  v_meal          text;
  v_slot_from     int;
  v_slot_to       int;
  v_value         text;
BEGIN
  SELECT * INTO v_device FROM verified_devices WHERE device_token = p_device_token;

  IF v_device.id IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;
  v_restaurant_id := v_device.restaurant_id;

  UPDATE verified_devices SET last_used_at = now() WHERE id = v_device.id;

  v_normalized := upper(regexp_replace(COALESCE(p_qr_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_is_typed   := v_normalized ~ '^[A-HJ-NP-Z][0-9]{5}$';

  IF v_is_typed
     AND v_device.failed_since IS NOT NULL
     AND v_device.failed_since > now() - c_fail_window
     AND v_device.failed_attempts >= c_max_failed THEN
    RETURN jsonb_build_object(
      'status', 'too_many_attempts',
      'data', jsonb_build_object(
        'retry_after_sec',
          GREATEST(0, EXTRACT(EPOCH FROM (v_device.failed_since + c_fail_window - now()))::int)
      )
    );
  END IF;

  IF v_device.failed_since IS NOT NULL
     AND v_device.failed_since <= now() - c_fail_window THEN
    UPDATE verified_devices SET failed_attempts = 0, failed_since = NULL WHERE id = v_device.id;
    v_device.failed_attempts := 0;
    v_device.failed_since := NULL;
  END IF;

  SELECT * INTO v_redemption FROM discount_redemptions WHERE qr_code = p_qr_code LIMIT 1;

  IF v_redemption.id IS NULL AND v_is_typed THEN
    SELECT * INTO v_redemption FROM discount_redemptions WHERE short_code = v_normalized LIMIT 1;
  END IF;

  IF v_redemption.id IS NULL THEN
    IF v_is_typed THEN
      UPDATE verified_devices
        SET failed_attempts = failed_attempts + 1,
            failed_since    = COALESCE(failed_since, now())
        WHERE id = v_device.id;
    END IF;
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_discount FROM discounts WHERE id = v_redemption.discount_id;

  IF v_discount.restaurant_id IS DISTINCT FROM v_restaurant_id THEN
    IF v_is_typed THEN
      UPDATE verified_devices
        SET failed_attempts = failed_attempts + 1,
            failed_since    = COALESCE(failed_since, now())
        WHERE id = v_device.id;
    END IF;
    RETURN jsonb_build_object('status', 'wrong_restaurant');
  END IF;

  IF v_device.failed_attempts > 0 THEN
    UPDATE verified_devices SET failed_attempts = 0, failed_since = NULL WHERE id = v_device.id;
  END IF;

  SELECT full_name INTO v_user_name FROM profiles WHERE id = v_redemption.user_id;

  v_today_dow := EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Europe/Rome'))::int;
  v_now_min   := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Rome'))::int * 60
              + EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Europe/Rome'))::int;

  -- Sconto a fasce: la fascia di oggi. Se oggi non ce n'è (locale chiuso)
  -- resta `discount_value`, e più sotto il giorno viene rifiutato.
  v_value := v_discount.discount_value;
  IF jsonb_typeof(v_discount.day_tiers) = 'array' THEN
    SELECT COALESCE(
             (SELECT t ->> 'value'
                FROM jsonb_array_elements(v_discount.day_tiers) t
               WHERE (t -> 'days') @> to_jsonb(v_today_dow)
               LIMIT 1),
             v_discount.discount_value)
      INTO v_value;
  END IF;

  IF v_redemption.status = 'redeemed' THEN
    RETURN jsonb_build_object(
      'status', 'already_redeemed',
      'data',   to_jsonb(v_redemption) || jsonb_build_object(
        'user_name',      COALESCE(v_user_name, 'Utente'),
        'discount_title', v_discount.title,
        'discount_value', COALESCE(v_redemption.applied_value, v_discount.discount_value),
        'discount_type',  v_discount.discount_type
      )
    );
  END IF;

  IF v_redemption.status = 'expired' OR
     (v_redemption.expires_at IS NOT NULL AND v_redemption.expires_at <= now()) OR
     (v_discount.valid_until IS NOT NULL AND v_discount.valid_until < now()) THEN
    RETURN jsonb_build_object(
      'status', 'expired',
      'reason', CASE WHEN v_redemption.expires_at IS NOT NULL AND v_redemption.expires_at <= now()
                     THEN 'claim_window' ELSE 'discount_expired' END,
      'data',   to_jsonb(v_redemption) || jsonb_build_object(
        'discount_title', v_discount.title,
        'discount_value', v_value,
        'discount_type',  v_discount.discount_type
      )
    );
  END IF;

  v_has_today := COALESCE(v_discount.valid_days IS NULL OR array_length(v_discount.valid_days, 1) IS NULL,
                          true)
              OR (v_today_dow = ANY(v_discount.valid_days));

  IF NOT v_has_today THEN
    RETURN jsonb_build_object(
      'status', 'invalid_now',
      'reason', 'valid_other_day',
      'data',   jsonb_build_object(
        'discount_title',    v_discount.title,
        'discount_value',    v_value,
        'discount_type',     v_discount.discount_type,
        'day_tiers',         v_discount.day_tiers,
        'valid_days',        COALESCE(v_discount.valid_days, ARRAY[]::int[]),
        'valid_meal_slots',  COALESCE(v_discount.valid_meal_slots, ARRAY[]::text[]),
        'valid_time_from',   v_discount.valid_time_from,
        'valid_time_to',     v_discount.valid_time_to,
        'today_dow',         v_today_dow,
        'user_name',         COALESCE(v_user_name, 'Utente')
      )
    );
  END IF;

  IF v_discount.valid_time_from IS NOT NULL AND v_discount.valid_time_to IS NOT NULL THEN
    DECLARE
      v_from int := EXTRACT(HOUR FROM v_discount.valid_time_from)::int * 60
                  + EXTRACT(MINUTE FROM v_discount.valid_time_from)::int;
      v_to   int := EXTRACT(HOUR FROM v_discount.valid_time_to)::int * 60
                  + EXTRACT(MINUTE FROM v_discount.valid_time_to)::int;
    BEGIN
      v_in_range := (v_now_min BETWEEN v_from AND v_to);
    END;
  ELSIF v_discount.valid_meal_slots IS NOT NULL
        AND array_length(v_discount.valid_meal_slots, 1) IS NOT NULL THEN
    FOREACH v_meal IN ARRAY v_discount.valid_meal_slots LOOP
      v_slot_from := CASE v_meal
        WHEN 'colazione' THEN 7*60
        WHEN 'pranzo'    THEN 12*60
        WHEN 'aperitivo' THEN 17*60+30
        WHEN 'cena'      THEN 19*60
        WHEN 'brunch'    THEN 10*60
        ELSE NULL END;
      v_slot_to := CASE v_meal
        WHEN 'colazione' THEN 11*60
        WHEN 'pranzo'    THEN 15*60
        WHEN 'aperitivo' THEN 20*60
        WHEN 'cena'      THEN 23*60+30
        WHEN 'brunch'    THEN 14*60
        ELSE NULL END;
      IF v_slot_from IS NOT NULL
         AND v_now_min BETWEEN v_slot_from AND v_slot_to THEN
        v_in_range := true;
        EXIT;
      END IF;
    END LOOP;
  ELSE
    v_in_range := true;
  END IF;

  IF NOT v_in_range THEN
    RETURN jsonb_build_object(
      'status', 'invalid_now',
      'reason', 'valid_today_later',
      'data',   jsonb_build_object(
        'discount_title',    v_discount.title,
        'discount_value',    v_value,
        'discount_type',     v_discount.discount_type,
        'day_tiers',         v_discount.day_tiers,
        'valid_days',        COALESCE(v_discount.valid_days, ARRAY[]::int[]),
        'valid_meal_slots',  COALESCE(v_discount.valid_meal_slots, ARRAY[]::text[]),
        'valid_time_from',   v_discount.valid_time_from,
        'valid_time_to',     v_discount.valid_time_to,
        'today_dow',         v_today_dow,
        'user_name',         COALESCE(v_user_name, 'Utente')
      )
    );
  END IF;

  UPDATE discount_redemptions
    SET status = 'redeemed',
        redeemed_at = now(),
        redeemed_by_restaurant = true,
        user_name = COALESCE(user_name, v_user_name),
        applied_value = v_value
    WHERE id = v_redemption.id;

  RETURN jsonb_build_object(
    'status', 'success',
    'data',   jsonb_build_object(
      'redemption_id',   v_redemption.id,
      'qr_code',         v_redemption.qr_code,
      'short_code',      v_redemption.short_code,
      'user_name',       COALESCE(v_user_name, 'Utente'),
      'discount_title',  v_discount.title,
      'discount_value',  v_value,
      'discount_type',   v_discount.discount_type,
      'day_tiers',       v_discount.day_tiers,
      'restaurant_name', (SELECT name FROM restaurants WHERE id = v_restaurant_id)
    )
  );
END;
$function$;

-- ── 4. Dopo la convalida si legge il valore usato ─────────────────────────

-- La festa, le stelle e la pagina /feedback (redemption-feedback-2026-09-29.sql).
CREATE OR REPLACE FUNCTION public.feedback_get(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row  redemption_feedback%ROWTYPE;
  v_out  jsonb;
BEGIN
  SELECT * INTO v_row FROM redemption_feedback WHERE token = p_token;
  IF v_row.redemption_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_row.redeemed_at < now() - interval '30 days' THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT jsonb_build_object(
           'redemption_id', v_row.redemption_id,
           'redeemed_at',   v_row.redeemed_at,
           'rating',        v_row.rating,
           'answers',       v_row.answers,
           'comment',       v_row.comment,
           'completed',     v_row.completed_at IS NOT NULL,
           'first_name',    NULLIF(split_part(trim(COALESCE(p.full_name, '')), ' ', 1), ''),
           'restaurant',    jsonb_build_object(
                              'name',  r.name,
                              'slug',  r.slug,
                              'photo', (SELECT COALESCE(rp.thumb_url, rp.photo_url)
                                          FROM restaurant_photos rp
                                         WHERE rp.restaurant_id = r.id
                                         ORDER BY rp.sort_order NULLS LAST
                                         LIMIT 1)),
           'discount',      jsonb_build_object(
                              'title',          d.title,
                              'discount_type',  d.discount_type,
                              'discount_value', COALESCE(dr.applied_value, d.discount_value),
                              'is_drop',        COALESCE(d.is_drop, false))
         )
    INTO v_out
    FROM (SELECT 1) one
    LEFT JOIN restaurants          r  ON r.id  = v_row.restaurant_id
    LEFT JOIN discounts            d  ON d.id  = v_row.discount_id
    LEFT JOIN discount_redemptions dr ON dr.id = v_row.redemption_id
    LEFT JOIN profiles             p  ON p.id  = v_row.user_id;

  RETURN v_out;
END;
$function$;

-- Lo storico delle convalide in /verify: col valore applicato ("Marco · 15%").
CREATE OR REPLACE FUNCTION public.verify_activity_list(p_restaurant_id uuid, p_device_token text, p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valid boolean;
  v_rows  jsonb;
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM verified_devices
    WHERE device_token = p_device_token
      AND restaurant_id = p_restaurant_id
  ) INTO v_valid;

  IF NOT v_valid THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  WITH picked AS (
    (SELECT dr.id
       FROM discount_redemptions dr
       JOIN discounts d ON d.id = dr.discount_id
      WHERE d.restaurant_id = p_restaurant_id
        AND dr.status = 'redeemed'
      ORDER BY dr.redeemed_at DESC NULLS LAST
      LIMIT v_limit)
    UNION
    (SELECT dr.id
       FROM discount_redemptions dr
       JOIN discounts d ON d.id = dr.discount_id
      WHERE d.restaurant_id = p_restaurant_id
        AND dr.status <> 'redeemed'
      ORDER BY dr.generated_at DESC
      LIMIT v_limit)
  )
  SELECT COALESCE(
           jsonb_agg(row_to_jsonb(x) ORDER BY COALESCE(x.redeemed_at, x.generated_at) DESC),
           '[]'::jsonb)
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
             'id',             d.id,
             'title',          d.title,
             'discount_type',  d.discount_type,
             'discount_value', COALESCE(dr.applied_value, d.discount_value),
             -- Non ancora usato: le fasce, così il locale legge la cifra di oggi.
             'day_tiers',      CASE WHEN dr.applied_value IS NULL THEN d.day_tiers END
           ) AS discount
    FROM picked
    JOIN discount_redemptions dr ON dr.id = picked.id
    JOIN discounts d ON d.id = dr.discount_id
    LEFT JOIN profiles p ON p.id = dr.user_id
  ) x;

  RETURN jsonb_build_object('items', v_rows);
END;
$function$;

-- L'avviso su Telegram (admin-telegram-2026-09-30.sql): per uno sconto a
-- fasce dice anche quale cifra è stata applicata ("· −15% oggi").
CREATE OR REPLACE FUNCTION private.tg_notify_redeemed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_d      record;
  v_used   integer;
  v_today  integer;
  v_kind   text;
  v_text   text;
  v_tier   text;
BEGIN
  IF NOT (NEW.status = 'redeemed' AND OLD.status IS DISTINCT FROM 'redeemed') THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT d.title, d.is_drop, d.is_test, d.max_redemptions, d.day_tiers, d.discount_type, r.name AS restaurant
      INTO v_d
      FROM discounts d
      LEFT JOIN restaurants r ON r.id = d.restaurant_id
     WHERE d.id = NEW.discount_id;

    SELECT count(*) INTO v_used
      FROM discount_redemptions
     WHERE discount_id = NEW.discount_id AND status = 'redeemed';

    SELECT count(*) INTO v_today
      FROM discount_redemptions
     WHERE status = 'redeemed'
       AND redeemed_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Rome') AT TIME ZONE 'Europe/Rome');

    v_kind := CASE
      WHEN COALESCE(v_d.is_drop, false) AND v_d.max_redemptions IS NOT NULL
        THEN 'Drop · usati ' || v_used || ' su ' || v_d.max_redemptions
      WHEN COALESCE(v_d.is_drop, false)
        THEN 'Drop · ' || v_used || '° uso'
      ELSE 'Convenzione · ' || v_used || '° uso'
    END;

    v_tier := CASE
      WHEN v_d.day_tiers IS NOT NULL AND NEW.applied_value IS NOT NULL
        THEN ' · ' || private.tg_html('−' || NEW.applied_value || CASE WHEN v_d.discount_type = 'fixed' THEN '€' ELSE '%' END || ' oggi', 40)
      ELSE ''
    END;

    v_text :=
      CASE WHEN COALESCE(v_d.is_test, false) THEN '🧪 <b>PROVA</b> · ' ELSE '' END
      || '✅ <b>Sconto usato</b> — ' || private.tg_html(COALESCE(v_d.restaurant, 'Locale'), 120) || E'\n'
      || private.tg_html(COALESCE(v_d.title, 'Sconto'), 160) || v_tier || ' · ' || v_kind || E'\n'
      || '👤 ' || private.tg_html(private.tg_first_name(NEW.user_id, NEW.user_name), 60)
      || ' · ' || to_char(COALESCE(NEW.redeemed_at, now()) AT TIME ZONE 'Europe/Rome', 'HH24:MI') || E'\n'
      || '📊 Oggi: ' || v_today || CASE WHEN v_today = 1 THEN ' sconto usato' ELSE ' sconti usati' END;

    PERFORM private.telegram_admin_send(v_text);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'telegram (redeemed): %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;
