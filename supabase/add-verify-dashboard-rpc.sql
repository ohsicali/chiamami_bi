-- ========================================================================
-- /verify redesign — Step 5
-- ========================================================================
-- RPC SECURITY DEFINER che espone le statistiche della dashboard al
-- ristoratore autenticato via cookie device_token.
--
-- Perché serve una function:
--   • page_views ha RLS "only admins can read"
--   • saved_restaurants ha RLS "users read own / admin read all"
-- Un restaurateur autenticato via cookie è anon da Supabase's POV — non
-- può leggere queste tabelle direttamente. La function valida il token
-- contro verified_devices e ritorna i contatori aggregati.
-- ========================================================================

CREATE OR REPLACE FUNCTION public.verify_dashboard_stats(
  p_restaurant_id uuid,
  p_device_token  text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug                    text;
  v_path                    text;
  v_valid                   boolean;
  v_views_30d               int;
  v_views_7d                int;
  v_views_today             int;
  v_saves_total             int;
  v_saves_30d               int;
  v_redemptions_total       int;
  v_redemptions_generated_30d int;
  v_redemptions_used_30d    int;
  v_redemptions_used_total  int;
BEGIN
  -- 1) Verifica che il token appartenga al ristorante richiesto
  SELECT EXISTS(
    SELECT 1 FROM verified_devices
    WHERE device_token = p_device_token
      AND restaurant_id = p_restaurant_id
  ) INTO v_valid;

  IF NOT v_valid THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- 2) last_used_at refresh (best-effort)
  UPDATE verified_devices
    SET last_used_at = now()
    WHERE device_token = p_device_token;

  -- 3) Slug per filtrare page_views
  SELECT slug INTO v_slug FROM restaurants WHERE id = p_restaurant_id;
  v_path := '/restaurant/' || v_slug;

  -- 4) page_views
  SELECT COUNT(*) INTO v_views_30d
    FROM page_views
    WHERE path = v_path
      AND created_at > now() - interval '30 days';

  SELECT COUNT(*) INTO v_views_7d
    FROM page_views
    WHERE path = v_path
      AND created_at > now() - interval '7 days';

  SELECT COUNT(*) INTO v_views_today
    FROM page_views
    WHERE path = v_path
      AND created_at > now() - interval '24 hours';

  -- 5) saved_restaurants
  SELECT COUNT(*) INTO v_saves_total
    FROM saved_restaurants
    WHERE restaurant_id = p_restaurant_id;

  SELECT COUNT(*) INTO v_saves_30d
    FROM saved_restaurants
    WHERE restaurant_id = p_restaurant_id
      AND created_at > now() - interval '30 days';

  -- 6) discount_redemptions
  SELECT COUNT(*) INTO v_redemptions_total
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    WHERE d.restaurant_id = p_restaurant_id;

  SELECT COUNT(*) INTO v_redemptions_generated_30d
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    WHERE d.restaurant_id = p_restaurant_id
      AND dr.generated_at > now() - interval '30 days';

  SELECT COUNT(*) INTO v_redemptions_used_30d
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    WHERE d.restaurant_id = p_restaurant_id
      AND dr.status = 'redeemed'
      AND dr.redeemed_at > now() - interval '30 days';

  SELECT COUNT(*) INTO v_redemptions_used_total
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    WHERE d.restaurant_id = p_restaurant_id
      AND dr.status = 'redeemed';

  RETURN jsonb_build_object(
    'views_30d',               v_views_30d,
    'views_7d',                v_views_7d,
    'views_today',             v_views_today,
    'saves_total',             v_saves_total,
    'saves_30d',               v_saves_30d,
    'redemptions_total',       v_redemptions_total,
    'redemptions_generated_30d', v_redemptions_generated_30d,
    'redemptions_used_30d',    v_redemptions_used_30d,
    'redemptions_used_total',  v_redemptions_used_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_dashboard_stats(uuid, text) TO anon, authenticated;
