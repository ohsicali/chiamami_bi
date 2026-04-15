-- ========================================================================
-- /verify dashboard — range stats RPC
-- ========================================================================
-- Accepts an arbitrary [p_from, p_to] window and returns counts for that
-- window + all-time totals. Replaces the fixed 7d/30d RPC when the
-- dashboard needs to honor a user-selected range (7g / 30g / 365g / custom).
--
-- SECURITY DEFINER: bypass RLS on page_views (admin-only) and
-- saved_restaurants (user-own). Validates the caller via device_token.
-- ========================================================================

CREATE OR REPLACE FUNCTION public.verify_dashboard_stats_range(
  p_restaurant_id uuid,
  p_device_token  text,
  p_from          timestamptz,
  p_to            timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug                   text;
  v_path                   text;
  v_valid                  boolean;
  v_views                  int;
  v_saves                  int;
  v_redemptions_generated  int;
  v_redemptions_used       int;
  v_views_total            int;
  v_saves_total            int;
  v_redemptions_total      int;
  v_redemptions_used_total int;
BEGIN
  -- 1) Validate device token
  SELECT EXISTS(
    SELECT 1 FROM verified_devices
    WHERE device_token = p_device_token
      AND restaurant_id = p_restaurant_id
  ) INTO v_valid;

  IF NOT v_valid THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  UPDATE verified_devices
    SET last_used_at = now()
    WHERE device_token = p_device_token;

  -- 2) Path for page_views filtering
  SELECT slug INTO v_slug FROM restaurants WHERE id = p_restaurant_id;
  v_path := '/restaurant/' || v_slug;

  -- 3) Range counts (inclusive on both bounds)
  SELECT COUNT(*) INTO v_views
    FROM page_views
    WHERE path = v_path
      AND created_at >= p_from
      AND created_at <= p_to;

  SELECT COUNT(*) INTO v_saves
    FROM saved_restaurants
    WHERE restaurant_id = p_restaurant_id
      AND created_at >= p_from
      AND created_at <= p_to;

  SELECT COUNT(*) INTO v_redemptions_generated
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    WHERE d.restaurant_id = p_restaurant_id
      AND dr.generated_at >= p_from
      AND dr.generated_at <= p_to;

  SELECT COUNT(*) INTO v_redemptions_used
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    WHERE d.restaurant_id = p_restaurant_id
      AND dr.status = 'redeemed'
      AND dr.redeemed_at >= p_from
      AND dr.redeemed_at <= p_to;

  -- 4) All-time totals (shown alongside the range figure)
  SELECT COUNT(*) INTO v_views_total
    FROM page_views
    WHERE path = v_path;

  SELECT COUNT(*) INTO v_saves_total
    FROM saved_restaurants
    WHERE restaurant_id = p_restaurant_id;

  SELECT COUNT(*) INTO v_redemptions_total
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    WHERE d.restaurant_id = p_restaurant_id;

  SELECT COUNT(*) INTO v_redemptions_used_total
    FROM discount_redemptions dr
    JOIN discounts d ON d.id = dr.discount_id
    WHERE d.restaurant_id = p_restaurant_id
      AND dr.status = 'redeemed';

  RETURN jsonb_build_object(
    'views',                    v_views,
    'saves',                    v_saves,
    'redemptions_generated',    v_redemptions_generated,
    'redemptions_used',         v_redemptions_used,
    'views_total',              v_views_total,
    'saves_total',              v_saves_total,
    'redemptions_total',        v_redemptions_total,
    'redemptions_used_total',   v_redemptions_used_total,
    'from',                     p_from,
    'to',                       p_to
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_dashboard_stats_range(uuid, text, timestamptz, timestamptz) TO anon, authenticated;
