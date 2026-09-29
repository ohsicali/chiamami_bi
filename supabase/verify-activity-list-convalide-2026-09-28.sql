-- ============================================================
-- verify_activity_list: le convalide non spariscono più — 2026-09-28
-- ============================================================
-- Prima: le ultime LEAST(p_limit, 50) righe ordinate per generated_at.
-- Shoro il 28/09 aveva 185 sconti presi e 8 utilizzati; i QR scansionati
-- in serata (Torino e Poirino) erano sotto decine di sconti presi dopo,
-- e uno preso il 22/09 e usato il 28 finiva in fondo — il ristoratore
-- non li trovava nello storico di /verify.
--
-- Ora: fino a LEAST(p_limit, 50) convalide (per redeemed_at) PIÙ fino a
-- LEAST(p_limit, 50) sconti in attesa (per generated_at), il tutto ordinato
-- per la data che conta (redeemed_at se usato, generated_at se no).
-- Stessa firma, stessa forma della risposta ({ items: [...] }): i client
-- vecchi continuano a funzionare.
--
-- Idempotente. Per tornare indietro: rieseguire la definizione in
-- supabase/security-hardening-2026-04.sql.

CREATE OR REPLACE FUNCTION public.verify_activity_list(
  p_restaurant_id uuid,
  p_device_token text,
  p_limit integer DEFAULT 10
)
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
             'id',    d.id,
             'title', d.title
           ) AS discount
    FROM picked
    JOIN discount_redemptions dr ON dr.id = picked.id
    JOIN discounts d ON d.id = dr.discount_id
    LEFT JOIN profiles p ON p.id = dr.user_id
  ) x;

  RETURN jsonb_build_object('items', v_rows);
END;
$function$;
