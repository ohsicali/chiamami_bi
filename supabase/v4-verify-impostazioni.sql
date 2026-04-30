-- ====================================================================
-- v4 verify — RPC per pannello Impostazioni del ristoratore
-- ====================================================================
-- Questo file aggiunge due RPC SECURITY DEFINER:
--   1. verify_update_restaurant_meta — aggiorna email + opening_hours
--   2. verify_change_pin             — cambia il PIN di accesso (verifica PIN attuale)
--
-- Entrambe richiedono un device_token valido (l'app /verify lo conserva nel
-- cookie verify_device_token dopo il login PIN). Il device_token viene
-- validato cercandolo in verified_devices e risalendo al restaurant_id.
--
-- Esegui questo file una volta nel SQL editor di Supabase.
-- ====================================================================

-- Helper: risolvi restaurant_id dal device_token o solleva 'unauthorized'
CREATE OR REPLACE FUNCTION verify_resolve_restaurant(p_device_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  IF p_device_token IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT restaurant_id INTO v_restaurant_id
  FROM verified_devices
  WHERE device_token = p_device_token;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_restaurant_id;
END;
$$;

REVOKE ALL ON FUNCTION verify_resolve_restaurant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_resolve_restaurant(uuid) TO anon, authenticated;

-- --------------------------------------------------------------------
-- 1. verify_update_restaurant_meta
-- --------------------------------------------------------------------
-- Aggiorna email e/o opening_hours del ristorante associato al device_token.
-- Entrambi i parametri sono opzionali (NULL = non modificare).
--
-- Ritorna { ok: true } in caso di successo, oppure { error: '...' }.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_update_restaurant_meta(
  p_device_token uuid,
  p_email text DEFAULT NULL,
  p_opening_hours text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  -- Auth
  BEGIN
    v_restaurant_id := verify_resolve_restaurant(p_device_token);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END;

  -- Validazione email basilare
  IF p_email IS NOT NULL AND p_email <> '' AND p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('error', 'Email non valida');
  END IF;

  UPDATE restaurants
     SET email = COALESCE(NULLIF(trim(p_email), ''), email),
         opening_hours = COALESCE(NULLIF(trim(p_opening_hours), ''), opening_hours),
         updated_at = now()
   WHERE id = v_restaurant_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION verify_update_restaurant_meta(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_update_restaurant_meta(uuid, text, text) TO anon, authenticated;

-- --------------------------------------------------------------------
-- 2. verify_change_pin
-- --------------------------------------------------------------------
-- Cambia il PIN del ristorante. Richiede di re-inserire il PIN attuale
-- come verifica. Il nuovo PIN deve essere di 6 cifre e diverso dall'attuale.
--
-- Ritorna { ok: true } su successo, oppure:
--   { error: 'unauthorized' }  — device_token non valido
--   { error: 'wrong_pin' }     — PIN attuale errato
--   { error: 'invalid_pin' }   — formato nuovo PIN non valido
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_change_pin(
  p_device_token uuid,
  p_current_pin text,
  p_new_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_existing_pin text;
BEGIN
  -- Auth
  BEGIN
    v_restaurant_id := verify_resolve_restaurant(p_device_token);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END;

  -- Validazione formato nuovo PIN
  IF p_new_pin IS NULL OR p_new_pin !~ '^\d{6}$' THEN
    RETURN jsonb_build_object('error', 'invalid_pin');
  END IF;

  -- Verifica PIN attuale
  SELECT verify_pin INTO v_existing_pin
    FROM restaurants
   WHERE id = v_restaurant_id;

  IF v_existing_pin IS NULL OR v_existing_pin <> p_current_pin THEN
    RETURN jsonb_build_object('error', 'wrong_pin');
  END IF;

  IF p_new_pin = v_existing_pin THEN
    RETURN jsonb_build_object('error', 'same_pin');
  END IF;

  -- Aggiorna PIN
  UPDATE restaurants
     SET verify_pin = p_new_pin,
         updated_at = now()
   WHERE id = v_restaurant_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION verify_change_pin(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_change_pin(uuid, text, text) TO anon, authenticated;

-- ====================================================================
-- FINE
-- ====================================================================
-- Dopo aver eseguito questo file:
-- - Il pannello Impostazioni del ristoratore può salvare email + orari.
-- - Il ristoratore può cambiare autonomamente il PIN dall'app.
-- ====================================================================
