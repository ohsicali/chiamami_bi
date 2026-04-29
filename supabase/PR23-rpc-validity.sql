-- ============================================================================
-- PR23 — Estensione verify_redeem_qr con validation giorno + fascia oraria.
--
-- Eseguire su Supabase SQL editor DOPO aver applicato PR23-validity.sql
-- (le colonne valid_days/valid_meal_slots/valid_time_from/to su discounts
-- devono esistere).
--
-- Nuovi return status:
--   'invalid_now'  → sconto valido in altri giorni/fasce, restituisce
--                    array valid_days (1..7) e valid_meal_slots per UI
--                    ristoratore (day strip + meta line).
--
-- Tutti gli altri stati esistenti restano identici (success / already_redeemed /
-- expired / wrong_restaurant / not_found / unauthorized).
-- ============================================================================

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
  v_today_dow     int;     -- 1=Mon ... 7=Sun (Italy timezone)
  v_now_min       int;     -- minutes since midnight (Italy)
  v_in_range      boolean := false;
  v_has_today     boolean;
  v_meal          text;
  v_slot_from     int;
  v_slot_to       int;
BEGIN
  -- 1) Valida device_token
  SELECT restaurant_id INTO v_restaurant_id
    FROM verified_devices
    WHERE device_token = p_device_token;

  IF v_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  UPDATE verified_devices SET last_used_at = now() WHERE device_token = p_device_token;

  -- 2) Trova redemption
  SELECT * INTO v_redemption FROM discount_redemptions WHERE qr_code = p_qr_code LIMIT 1;
  IF v_redemption.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT * INTO v_discount FROM discounts WHERE id = v_redemption.discount_id;

  IF v_discount.restaurant_id IS DISTINCT FROM v_restaurant_id THEN
    RETURN jsonb_build_object('status', 'wrong_restaurant');
  END IF;

  SELECT full_name INTO v_user_name FROM profiles WHERE id = v_redemption.user_id;

  -- 3) Già usato?
  IF v_redemption.status = 'redeemed' THEN
    RETURN jsonb_build_object(
      'status', 'already_redeemed',
      'data',   to_jsonb(v_redemption) || jsonb_build_object(
        'user_name',      COALESCE(v_user_name, 'Utente'),
        'discount_title', v_discount.title,
        'discount_value', v_discount.discount_value,
        'discount_type',  v_discount.discount_type
      )
    );
  END IF;

  -- 4) Scaduto?
  IF v_redemption.status = 'expired' OR
     (v_discount.valid_until IS NOT NULL AND v_discount.valid_until < now()) THEN
    RETURN jsonb_build_object(
      'status', 'expired',
      'data',   to_jsonb(v_redemption) || jsonb_build_object(
        'discount_title', v_discount.title,
        'discount_value', v_discount.discount_value,
        'discount_type',  v_discount.discount_type
      )
    );
  END IF;

  -- 5) Day-of-week + minute-of-day in fuso Europe/Rome (gestisce DST automaticamente)
  v_today_dow := EXTRACT(ISODOW FROM (now() AT TIME ZONE 'Europe/Rome'))::int;
  v_now_min   := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Rome'))::int * 60
              + EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Europe/Rome'))::int;

  -- 6) Validità GIORNO della settimana (NULL/empty = tutti i giorni)
  v_has_today := COALESCE(v_discount.valid_days IS NULL OR array_length(v_discount.valid_days, 1) IS NULL,
                          true)
              OR (v_today_dow = ANY(v_discount.valid_days));

  IF NOT v_has_today THEN
    RETURN jsonb_build_object(
      'status', 'invalid_now',
      'reason', 'valid_other_day',
      'data',   jsonb_build_object(
        'discount_title',    v_discount.title,
        'discount_value',    v_discount.discount_value,
        'discount_type',     v_discount.discount_type,
        'valid_days',        COALESCE(v_discount.valid_days, ARRAY[]::int[]),
        'valid_meal_slots',  COALESCE(v_discount.valid_meal_slots, ARRAY[]::text[]),
        'valid_time_from',   v_discount.valid_time_from,
        'valid_time_to',     v_discount.valid_time_to,
        'today_dow',         v_today_dow,
        'user_name',         COALESCE(v_user_name, 'Utente')
      )
    );
  END IF;

  -- 7) Validità FASCIA oraria
  -- Se è specificato un range custom valid_time_from/to → quello prevale.
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
    -- Default fasce orarie (allineate a MEAL_SLOTS in lib/validity.js)
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
    -- Nessun vincolo orario → sempre OK
    v_in_range := true;
  END IF;

  IF NOT v_in_range THEN
    RETURN jsonb_build_object(
      'status', 'invalid_now',
      'reason', 'valid_today_later',
      'data',   jsonb_build_object(
        'discount_title',    v_discount.title,
        'discount_value',    v_discount.discount_value,
        'discount_type',     v_discount.discount_type,
        'valid_days',        COALESCE(v_discount.valid_days, ARRAY[]::int[]),
        'valid_meal_slots',  COALESCE(v_discount.valid_meal_slots, ARRAY[]::text[]),
        'valid_time_from',   v_discount.valid_time_from,
        'valid_time_to',     v_discount.valid_time_to,
        'today_dow',         v_today_dow,
        'user_name',         COALESCE(v_user_name, 'Utente')
      )
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
    NULL;
  END;

  RETURN jsonb_build_object(
    'status', 'success',
    'data',   jsonb_build_object(
      'redemption_id',   v_redemption.id,
      'user_name',       COALESCE(v_user_name, 'Utente'),
      'discount_title',  v_discount.title,
      'discount_value',  v_discount.discount_value,
      'discount_type',   v_discount.discount_type,
      'restaurant_name', (SELECT name FROM restaurants WHERE id = v_restaurant_id)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_redeem_qr(text, text) TO anon, authenticated;
