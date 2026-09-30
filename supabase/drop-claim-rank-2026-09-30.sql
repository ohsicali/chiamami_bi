-- ============================================================
-- Drop: "sei il numero X su 20" + posti che non sforano (30/09)
-- ============================================================
--
-- Richiesta del proprietario per il drop delle 19 (Gelateria Borghese,
-- cannolo gratis, 20 posti): chi lo prende vede "Ce l'hai fatta, sei il
-- numero 7 su 20". Servono due cose dal DB.
--
-- 1. Posti che non sforano. `guard_redemption_insert` controlla i posti
--    rimasti, ma il lucchetto che prendeva era per utente+sconto: due
--    persone diverse che premono nello stesso istante sull'ultimo posto
--    leggevano entrambe "19 presi" e passavano entrambe (il contatore lo
--    alza il trigger AFTER, nella stessa transazione). Con un drop annunciato
--    per email a un'ora precisa è il caso normale, non quello raro. Ora si
--    prende anche un lucchetto per sconto: i riscatti dello stesso sconto
--    passano uno alla volta (qualche millisecondo ciascuno) e il secondo
--    legge il contatore già alzato dal primo. L'ordine dei lucchetti è
--    sempre lo stesso (utente+sconto, poi sconto): niente stalli.
--    `generated_at` diventa l'ora vera dopo il lucchetto (clock_timestamp,
--    non now() che è l'inizio della transazione): è l'ordine d'arrivo.
--
-- 2. `my_claim_rank(redemption_id)`: il posto in fila del PROPRIO riscatto
--    (quanti riscatti dello stesso sconto sono arrivati prima, lui compreso)
--    e il totale dei posti, più se è un drop e il nome del locale (così
--    chi lo chiama non deve saperlo già). Solo per il proprio riscatto (auth.uid()); il
--    browser non può contare i riscatti degli altri (RLS), e non deve.
--    Quanti sono stati presi è già pubblico (barra sulla card): il numero
--    non rivela niente di più.
--
-- Idempotente: si può rilanciare.
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_redemption_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_discount discounts%ROWTYPE; v_max int;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;
  NEW.status := 'generated'; NEW.redeemed_at := NULL; NEW.redeemed_by_restaurant := false; NEW.generated_at := now();
  NEW.user_name := LEFT(NEW.user_name, 120);
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text || ':' || NEW.discount_id::text, 0));
  IF EXISTS (SELECT 1 FROM discount_redemptions WHERE user_id = NEW.user_id AND discount_id = NEW.discount_id) THEN
    RAISE EXCEPTION 'already_claimed' USING ERRCODE = '23505';
  END IF;
  -- Un riscatto alla volta per sconto (vedi punto 1 in testa).
  PERFORM pg_advisory_xact_lock(hashtextextended('discount:' || NEW.discount_id::text, 0));
  NEW.generated_at := clock_timestamp();
  SELECT * INTO v_discount FROM discounts WHERE id = NEW.discount_id;
  IF NOT FOUND OR NOT COALESCE(v_discount.is_active, false) THEN RAISE EXCEPTION 'discount_not_available' USING ERRCODE = 'P0001'; END IF;
  IF v_discount.is_test AND NOT public.is_discount_tester(v_discount.id) THEN
    RAISE EXCEPTION 'discount_not_available' USING ERRCODE = 'P0001';
  END IF;
  IF v_discount.valid_until IS NOT NULL AND v_discount.valid_until < now() THEN RAISE EXCEPTION 'discount_expired' USING ERRCODE = 'P0001'; END IF;
  v_max := COALESCE(NULLIF(v_discount.max_quantity, 0), NULLIF(v_discount.max_redemptions, 0));
  IF v_max IS NOT NULL AND GREATEST(COALESCE(v_discount.claimed_count, 0), COALESCE(v_discount.total_redeemed, 0)) >= v_max THEN
    RAISE EXCEPTION 'sold_out' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

-- Prima versione (30/09, mezz'ora prima) restituiva solo posto e totale:
-- cambiando le colonne serve il DROP.
DROP FUNCTION IF EXISTS public.my_claim_rank(uuid);

CREATE FUNCTION public.my_claim_rank(p_redemption_id uuid)
RETURNS TABLE (claim_rank int, total int, is_drop boolean, restaurant_name text)
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
    rs.name
  FROM discount_redemptions r
  JOIN discounts d ON d.id = r.discount_id
  LEFT JOIN restaurants rs ON rs.id = d.restaurant_id
  WHERE r.id = p_redemption_id
    AND r.user_id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.my_claim_rank(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_claim_rank(uuid) TO authenticated;
