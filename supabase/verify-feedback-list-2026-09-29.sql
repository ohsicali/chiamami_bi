-- ============================================================
-- Le recensioni del locale nell'area ristoratori (/verify) — 2026-09-29
-- ============================================================
-- Il ristoratore vede le stelle, le risposte e i messaggi lasciati dopo gli
-- sconti convalidati da lui (redemption_feedback, vedi
-- redemption-feedback-2026-09-29.sql). Si autentica col device token come
-- tutte le altre verify_* e vede solo le righe del proprio locale.
--
-- Chi lascia il feedback lo sa: la schermata delle stelle dice che lo legge
-- anche il locale. Del cliente passa solo il nome di battesimo.
--
-- Restituisce:
--   { summary: { count, avg, dist: {"1":n,…,"5":n}, comments,
--                liked_good: {cibo: n, …}, liked_bad: {…},
--                sconto: {liscio: n, intoppo: n, problema: n},
--                tornare: {si: n, forse: n, no: n} },
--     items: [ { rating, answers, comment, redeemed_at, first_name, discount_title } ] }
-- `liked_good` conta le voci scelte con 3+ stelle ("cosa ti è piaciuto"),
-- `liked_bad` quelle con 1–2 stelle ("cosa non è andato").
--
-- Idempotente.

CREATE OR REPLACE FUNCTION public.verify_feedback_list(
  p_restaurant_id uuid,
  p_device_token text,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_summary jsonb;
  v_items jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM verified_devices
     WHERE device_token = p_device_token
       AND restaurant_id = p_restaurant_id
  ) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  WITH rated AS (
    SELECT * FROM redemption_feedback
     WHERE restaurant_id = p_restaurant_id
       AND rating IS NOT NULL
  )
  SELECT jsonb_build_object(
    'count',    (SELECT count(*) FROM rated),
    'avg',      (SELECT round(avg(rating)::numeric, 2) FROM rated),
    'comments', (SELECT count(*) FROM rated WHERE comment IS NOT NULL),
    'dist',     (SELECT jsonb_object_agg(s::text, (SELECT count(*) FROM rated WHERE rating = s))
                   FROM generate_series(1, 5) s),
    'liked_good', COALESCE((SELECT jsonb_object_agg(k, n) FROM (
                    SELECT k, count(*) n FROM rated, jsonb_array_elements_text(COALESCE(answers->'liked', '[]'::jsonb)) k
                     WHERE rating >= 3 GROUP BY k) x), '{}'::jsonb),
    'liked_bad',  COALESCE((SELECT jsonb_object_agg(k, n) FROM (
                    SELECT k, count(*) n FROM rated, jsonb_array_elements_text(COALESCE(answers->'liked', '[]'::jsonb)) k
                     WHERE rating <= 2 GROUP BY k) x), '{}'::jsonb),
    'sconto',   COALESCE((SELECT jsonb_object_agg(k, n) FROM (
                    SELECT answers->>'sconto' k, count(*) n FROM rated WHERE answers ? 'sconto' GROUP BY 1) x), '{}'::jsonb),
    'tornare',  COALESCE((SELECT jsonb_object_agg(k, n) FROM (
                    SELECT answers->>'tornare' k, count(*) n FROM rated WHERE answers ? 'tornare' GROUP BY 1) x), '{}'::jsonb)
  ) INTO v_summary;

  SELECT COALESCE(jsonb_agg(row_to_jsonb(x) ORDER BY x.redeemed_at DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT rf.rating,
             rf.answers,
             rf.comment,
             rf.redeemed_at,
             NULLIF(split_part(trim(COALESCE(p.full_name, dr.user_name, '')), ' ', 1), '') AS first_name,
             d.title AS discount_title
        FROM redemption_feedback rf
        LEFT JOIN profiles p ON p.id = rf.user_id
        LEFT JOIN discount_redemptions dr ON dr.id = rf.redemption_id
        LEFT JOIN discounts d ON d.id = rf.discount_id
       WHERE rf.restaurant_id = p_restaurant_id
         AND rf.rating IS NOT NULL
       ORDER BY rf.redeemed_at DESC
       LIMIT v_limit
    ) x;

  RETURN jsonb_build_object('summary', v_summary, 'items', v_items);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_feedback_list(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_feedback_list(uuid, text, integer) TO anon, authenticated;
