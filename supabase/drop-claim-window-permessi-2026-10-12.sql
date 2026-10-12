-- ============================================================
-- Drop coi giorni contati — permessi e my_claim_rank (12/10)
-- ============================================================
-- Il resto di drop-claim-window-2026-10-12.sql è stato eseguito il 12/10
-- dal connettore Supabase. Queste righe no: il connettore chiede una
-- conferma per REVOKE e DROP, e la conferma non è arrivata. Si incollano
-- nel SQL Editor di Supabase (Dashboard → SQL Editor → New query → Run).
--
-- Cosa fanno:
--   - la lista d'attesa si scrive solo dalle RPC (oggi la RLS lo impedisce
--     già: niente policy di scrittura; questo toglie anche i grant);
--   - `drop_claims_tick()` la può chiamare solo il server (oggi la può
--     chiamare chiunque: fa solo il giro normale, ma non deve);
--   - le RPC della lista solo a chi deve (join/leave: chi ha un account);
--   - `my_claim_rank` restituisce anche la scadenza (la festa del drop la
--     sa già dallo sconto: senza, la barra parte comunque).
--
-- Idempotente: si può rilanciare.
-- ============================================================

REVOKE ALL ON public.drop_waitlist FROM anon, authenticated;
GRANT SELECT ON public.drop_waitlist TO authenticated;

REVOKE EXECUTE ON FUNCTION public.tg_redeemed_count_on_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_waitlist_on_claim() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.new_redemption_qr_code() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.drop_waitlist_status(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.drop_waitlist_status(uuid[]) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.drop_waitlist_join(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drop_waitlist_join(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.drop_waitlist_leave(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drop_waitlist_leave(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.drop_claims_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drop_claims_tick() TO service_role;

DROP FUNCTION IF EXISTS public.my_claim_rank(uuid);

CREATE FUNCTION public.my_claim_rank(p_redemption_id uuid)
RETURNS TABLE (claim_rank int, total int, is_drop boolean, restaurant_name text, expires_at timestamptz, claim_window_days int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT count(*)::int
       FROM discount_redemptions o
      WHERE o.discount_id = r.discount_id
        AND (o.generated_at, o.id) <= (r.generated_at, r.id)),
    COALESCE(NULLIF(d.max_quantity, 0), NULLIF(d.max_redemptions, 0))::int,
    COALESCE(d.is_drop, false),
    rs.name,
    r.expires_at,
    d.claim_window_days
  FROM discount_redemptions r
  JOIN discounts d ON d.id = r.discount_id
  LEFT JOIN restaurants rs ON rs.id = d.restaurant_id
  WHERE r.id = p_redemption_id
    AND r.user_id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.my_claim_rank(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_claim_rank(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
