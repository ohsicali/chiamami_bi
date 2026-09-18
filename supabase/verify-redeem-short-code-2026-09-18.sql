-- ============================================================================
-- verify_redeem_qr — accetta anche il codice a 6 caratteri digitato a mano.
--
-- Da eseguire DOPO short-code-redemptions-2026-09-18.sql.
--
-- Rispetto alla versione PR23 cambiano tre cose, il resto è identico:
--
--   1. la ricerca del riscatto prova prima il `qr_code` esatto (il QR e i
--      PDF già stampati continuano a funzionare) e poi, se l'input ha la
--      forma di uno short code, il `short_code`;
--   2. i tentativi a vuoto vengono contati sul dispositivo del locale, e
--      dopo dieci in un quarto d'ora la verifica risponde 'too_many_attempts'
--      — un codice di sei caratteri, a differenza del QR, si può tirare a
--      indovinare. Il contatore guarda solo gli input a forma di short code:
--      una scansione QR non lo incrementa e non viene mai bloccata, così il
--      locale che ha appena sbagliato a digitare dieci volte può comunque
--      passare alla fotocamera e lavorare;
--   3. la risposta 'success' porta anche `qr_code` e `short_code`, così il
--      client sa sempre qual è il codice canonico del riscatto appena
--      validato (serve a /api/send-email, che cerca per qr_code).
--
-- Nuovo status: 'too_many_attempts' con `retry_after_sec`.
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
  c_max_failed  constant int      := 10;
  c_fail_window constant interval := interval '15 minutes';

  v_device        verified_devices%ROWTYPE;
  v_restaurant_id uuid;
  v_redemption    discount_redemptions%ROWTYPE;
  v_discount      discounts%ROWTYPE;
  v_user_name     text;
  v_normalized    text;
  v_is_typed      boolean;
  v_today_dow     int;     -- 1=Mon ... 7=Sun (Italy timezone)
  v_now_min       int;     -- minutes since midnight (Italy)
  v_in_range      boolean := false;
  v_has_today     boolean;
  v_meal          text;
  v_slot_from     int;
  v_slot_to       int;
BEGIN
  -- 1) Valida device_token
  SELECT * INTO v_device FROM verified_devices WHERE device_token = p_device_token;

  IF v_device.id IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;
  v_restaurant_id := v_device.restaurant_id;

  UPDATE verified_devices SET last_used_at = now() WHERE id = v_device.id;

  -- Un QR codifica un URL (`…/verify?code=BiSc-…`), uno short code sono sei
  -- caratteri e basta: la forma dell'input dice da sola se qualcuno sta
  -- digitando o scansionando, e solo il primo caso può essere un tentativo
  -- a indovinare.
  v_normalized := upper(regexp_replace(COALESCE(p_qr_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_is_typed   := v_normalized ~ '^[A-HJ-NP-Z][0-9]{5}$';

  -- 1b) Troppi codici digitati a vuoto di fila da questo dispositivo?
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

  -- La finestra è scaduta → si riparte da zero.
  IF v_device.failed_since IS NOT NULL
     AND v_device.failed_since <= now() - c_fail_window THEN
    UPDATE verified_devices SET failed_attempts = 0, failed_since = NULL WHERE id = v_device.id;
    v_device.failed_attempts := 0;
    v_device.failed_since := NULL;
  END IF;

  -- 2) Trova redemption — prima il QR, poi il codice digitato.
  -- Il qr_code è case sensitive (`BiSc-aB3d…`), quindi va confrontato nudo;
  -- lo short code invece si normalizza, perché chi lo digita può metterci
  -- spazi, trattini o minuscole.
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

  -- Codice esistente e di questo locale: il dispositivo sta lavorando, non
  -- tirando a indovinare. Contatore azzerato anche se poi lo sconto risulta
  -- già usato o fuori orario.
  IF v_device.failed_attempts > 0 THEN
    UPDATE verified_devices SET failed_attempts = 0, failed_since = NULL WHERE id = v_device.id;
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
      'qr_code',         v_redemption.qr_code,
      'short_code',      v_redemption.short_code,
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
