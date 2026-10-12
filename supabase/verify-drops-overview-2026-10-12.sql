-- ============================================================
-- I drop del locale nell'area ristoratori (/verify) — 2026-10-12
-- ============================================================
-- Il ristoratore vede, per ogni suo drop, quante persone l'hanno preso e
-- quante sono in lista d'attesa (richiesta del proprietario, 12/10). Dal
-- browser non li può contare: i riscatti degli altri e la lista d'attesa
-- non sono leggibili con la chiave anon. Si autentica col device token come
-- tutte le altre verify_* e vede solo i drop del proprio locale, solo numeri
-- (nessun nome).
--
-- Restituisce { items: [ {
--   id, title, discount_type, discount_value,
--   total          posti del drop (NULL = senza limite),
--   claims         riscatti di sempre (anche quelli scaduti),
--   used           convalidati alla cassa,
--   to_use         presi e ancora validi (nei loro giorni),
--   lost           scaduti senza essere usati (posto ripassato alla lista),
--   taken          posti occupati adesso = used + to_use,
--   waiting        in lista d'attesa adesso,
--   from_waitlist  posti passati a chi era in lista,
--   next_expiry    la prima scadenza fra chi deve ancora usarlo,
--   claim_window_days, starts_at, drop_ends_at
-- } ] }
-- Al massimo 4 drop: i più recenti, attivi, non di prova.
--
-- Idempotente (CREATE OR REPLACE). Eseguito il 12/10 col connettore.
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_drops_overview(
  p_restaurant_id uuid,
  p_device_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_items jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM verified_devices
     WHERE device_token = p_device_token
       AND restaurant_id = p_restaurant_id
  ) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.starts_at DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT d.id,
             d.title,
             d.discount_type,
             d.discount_value,
             COALESCE(NULLIF(d.max_quantity, 0), NULLIF(d.max_redemptions, 0)) AS total,
             d.claim_window_days,
             COALESCE(d.drop_starts_at, d.created_at) AS starts_at,
             d.drop_ends_at,
             s.claims, s.used, s.to_use, s.lost,
             s.used + s.to_use AS taken,
             s.next_expiry,
             (SELECT count(*) FROM drop_waitlist w
               WHERE w.discount_id = d.id AND w.status = 'waiting')::int AS waiting,
             (SELECT count(*) FROM drop_waitlist w
               WHERE w.discount_id = d.id AND w.status = 'promoted')::int AS from_waitlist
        FROM discounts d
        CROSS JOIN LATERAL (
          SELECT count(r.id)::int AS claims,
                 count(r.id) FILTER (WHERE r.status = 'redeemed')::int AS used,
                 count(r.id) FILTER (WHERE r.status = 'generated'
                                       AND (r.expires_at IS NULL OR r.expires_at > now()))::int AS to_use,
                 count(r.id) FILTER (WHERE r.status = 'expired'
                                        OR (r.status = 'generated' AND r.expires_at <= now()))::int AS lost,
                 min(r.expires_at) FILTER (WHERE r.status = 'generated' AND r.expires_at > now()) AS next_expiry
            FROM discount_redemptions r
           WHERE r.discount_id = d.id
        ) s
       WHERE d.restaurant_id = p_restaurant_id
         AND d.is_drop
         AND d.is_active
         AND NOT COALESCE(d.is_test, false)
         AND (d.drop_ends_at IS NULL OR d.drop_ends_at > now() - interval '14 days')
       ORDER BY COALESCE(d.drop_starts_at, d.created_at) DESC
       LIMIT 4
    ) x;

  RETURN jsonb_build_object('items', v_items);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.verify_drops_overview(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
