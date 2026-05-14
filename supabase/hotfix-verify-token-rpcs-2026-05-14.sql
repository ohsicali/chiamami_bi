-- ============================================================================
-- HOTFIX 2026-05-14b — verify_get_restaurant_by_token + verify_logout_device
-- ============================================================================
-- L'hardening 2026-05 ha chiuso la policy "Public read by token" su
-- verified_devices, rompendo l'auto-login da cookie di VerifyPage.jsx
-- (SELECT diretta dal client). Questo file aggiunge due RPC SECURITY DEFINER:
--
--   • verify_get_restaurant_by_token(p_device_token) — usato all'init di
--     /verify per recuperare il ristorante associato al cookie.
--   • verify_logout_device(p_device_token) — usato al logout per cancellare
--     il device (la policy DELETE pubblica non è mai esistita per anon, il
--     logout prima falliva silenziosamente).
--
-- Esegui in Supabase Dashboard → SQL Editor → Run. Idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_get_restaurant_by_token(
  p_device_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_restaurant    jsonb;
  v_photos        jsonb;
BEGIN
  IF p_device_token IS NULL OR length(p_device_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT restaurant_id INTO v_restaurant_id
    FROM verified_devices
    WHERE device_token = p_device_token
    LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Touch last_used_at (best-effort).
  UPDATE verified_devices
     SET last_used_at = now()
   WHERE device_token = p_device_token;

  -- Build restaurant payload with the same shape consumed by VerifyPage.jsx
  -- (id, name, slug, address, city, category, cuisine_type, restaurant_photos[]).
  SELECT to_jsonb(r) - 'verify_pin' INTO v_restaurant
    FROM (
      SELECT id, name, slug, address, city, category, cuisine_type
        FROM restaurants
        WHERE id = v_restaurant_id
    ) r;

  IF v_restaurant IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(p ORDER BY sort_order NULLS LAST), '[]'::jsonb) INTO v_photos
    FROM (
      SELECT photo_url, thumb_url, sort_order
        FROM restaurant_photos
        WHERE restaurant_id = v_restaurant_id
    ) p;

  RETURN v_restaurant || jsonb_build_object('restaurant_photos', v_photos);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_get_restaurant_by_token(text)
  TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.verify_logout_device(
  p_device_token text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_device_token IS NULL OR length(p_device_token) < 16 THEN
    RETURN;
  END IF;
  DELETE FROM verified_devices WHERE device_token = p_device_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_logout_device(text)
  TO anon, authenticated;
