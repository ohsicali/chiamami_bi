-- ============================================================================
-- La cassa convalida fino alla fine del pasto (29/10)
-- ============================================================================
--
-- Giovedì 29/10, 23:33, Locanda Bellezia: sconto "solo a cena, mer e gio",
-- cliente al tavolo, e /verify rispondeva "Non valido". La cena finiva alle
-- 23:30 esatte, il pranzo alle 15:00: il conto si paga alla fine del pasto,
-- e chi paga dopo l'ultima ora scritta restava senza sconto. Dopo
-- mezzanotte, poi, era già "venerdì" e lo sconto del giovedì non valeva più.
--
-- Da qui:
-- 1. `private.redeem_windows(fasce, dalle, alle)` — quando il locale può
--    convalidare, in minuti dalla mezzanotte del giorno dello sconto (oltre
--    1440 = la notte dopo). Le fasce sono quelle che si leggono, allargate:
--      colazione 06:30–12:30 · brunch 09:30–16:00 · pranzo 11:30–17:00
--      aperitivo 17:00–22:00 · cena 18:30–02:30 (della notte dopo)
--    Orario scritto a mano: mezz'ora prima, un'ora dopo (e può passare la
--    mezzanotte). Senza fascia: tutto il giorno e fino alle 3 di notte.
--    Le stesse in MEAL_SLOTS / redeemRanges di src/lib/validity.js:
--    tests/validity.test.mjs controlla che non divergano.
-- 2. `private.redeem_service_dow(giorni, fasce, dalle, alle, quando)` — il
--    giorno (1..7) a cui appartiene quel momento, o NULL se adesso non vale.
--    Alle 00:30 di venerdì la cena di giovedì è ancora giovedì: valgono i
--    giorni di giovedì e la fascia di giovedì sullo sconto a fasce.
-- 3. `verify_redeem_qr` usa questi due. Il resto è com'era (PIN, tentativi,
--    codice a 6 caratteri, drop coi giorni contati, `applied_value`).
--
-- Si può rieseguire: tutto è CREATE OR REPLACE. Le grant di
-- verify_redeem_qr restano quelle di prima.
-- ============================================================================

CREATE OR REPLACE FUNCTION private.redeem_windows(
  p_slots text[], p_time_from time, p_time_to time
) RETURNS TABLE (from_min int, to_min int)
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_from int;
  v_to   int;
  v_slot text;
  v_any  boolean := false;
BEGIN
  IF p_time_from IS NOT NULL AND p_time_to IS NOT NULL THEN
    v_from := EXTRACT(HOUR FROM p_time_from)::int * 60 + EXTRACT(MINUTE FROM p_time_from)::int;
    v_to   := EXTRACT(HOUR FROM p_time_to)::int * 60 + EXTRACT(MINUTE FROM p_time_to)::int;
    IF v_to <= v_from THEN v_to := v_to + 1440; END IF;
    from_min := v_from - 30;
    to_min   := v_to + 60;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_slots IS NOT NULL THEN
    FOREACH v_slot IN ARRAY p_slots LOOP
      from_min := CASE v_slot
        WHEN 'colazione' THEN 6*60+30
        WHEN 'brunch'    THEN 9*60+30
        WHEN 'pranzo'    THEN 11*60+30
        WHEN 'aperitivo' THEN 17*60
        WHEN 'cena'      THEN 18*60+30
        ELSE NULL END;
      to_min := CASE v_slot
        WHEN 'colazione' THEN 12*60+30
        WHEN 'brunch'    THEN 16*60
        WHEN 'pranzo'    THEN 17*60
        WHEN 'aperitivo' THEN 22*60
        WHEN 'cena'      THEN 26*60+30
        ELSE NULL END;
      IF from_min IS NOT NULL THEN
        v_any := true;
        RETURN NEXT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_any THEN
    from_min := 0;
    to_min   := 27*60;
    RETURN NEXT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.redeem_service_dow(
  p_days int[], p_slots text[], p_time_from time, p_time_to time, p_at timestamptz
) RETURNS int
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_local timestamp := p_at AT TIME ZONE 'Europe/Rome';
  v_dow   int := EXTRACT(ISODOW FROM v_local)::int;
  v_yday  int;
  v_min   int := EXTRACT(HOUR FROM v_local)::int * 60 + EXTRACT(MINUTE FROM v_local)::int;
  v_all   boolean := p_days IS NULL OR array_length(p_days, 1) IS NULL;
BEGIN
  v_yday := CASE WHEN v_dow = 1 THEN 7 ELSE v_dow - 1 END;

  IF (v_all OR v_dow = ANY(p_days)) AND EXISTS (
       SELECT 1 FROM private.redeem_windows(p_slots, p_time_from, p_time_to) w
        WHERE v_min BETWEEN w.from_min AND w.to_min) THEN
    RETURN v_dow;
  END IF;

  IF (v_all OR v_yday = ANY(p_days)) AND EXISTS (
       SELECT 1 FROM private.redeem_windows(p_slots, p_time_from, p_time_to) w
        WHERE v_min + 1440 BETWEEN w.from_min AND w.to_min) THEN
    RETURN v_yday;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.redeem_windows(text[], time, time) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.redeem_service_dow(int[], text[], time, time, timestamptz) FROM PUBLIC;

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
  v_service_dow   int;
  v_now_min       int;
  v_has_today     boolean;
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

  -- Il giorno dello sconto: dopo mezzanotte può essere ancora ieri.
  v_service_dow := private.redeem_service_dow(
    v_discount.valid_days, v_discount.valid_meal_slots,
    v_discount.valid_time_from, v_discount.valid_time_to, now());

  v_value := v_discount.discount_value;
  IF jsonb_typeof(v_discount.day_tiers) = 'array' THEN
    SELECT COALESCE(
             (SELECT t ->> 'value'
                FROM jsonb_array_elements(v_discount.day_tiers) t
               WHERE (t -> 'days') @> to_jsonb(COALESCE(v_service_dow, v_today_dow))
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

  IF v_service_dow IS NULL THEN
    v_has_today := COALESCE(v_discount.valid_days IS NULL OR array_length(v_discount.valid_days, 1) IS NULL,
                            true)
                OR (v_today_dow = ANY(v_discount.valid_days));
    RETURN jsonb_build_object(
      'status', 'invalid_now',
      -- "Più tardi" solo se oggi c'è ancora una finestra che deve aprirsi;
      -- a pranzo finito (o alle 4 di notte) è "non oggi", non "non ancora".
      'reason', CASE WHEN v_has_today AND EXISTS (
                       SELECT 1 FROM private.redeem_windows(
                         v_discount.valid_meal_slots, v_discount.valid_time_from, v_discount.valid_time_to) w
                        WHERE w.from_min > v_now_min)
                     THEN 'valid_today_later' ELSE 'valid_other_day' END,
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
