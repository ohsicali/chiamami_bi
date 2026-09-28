-- ============================================================
-- total_redeemed scende quando un riscatto viene cancellato — 2026-09-28
-- ============================================================
-- Dal 24/09 (fix-verify-and-counters-2026-09-24.sql) total_redeemed =
-- quanti hanno preso lo sconto, e lo alza solo il trigger all'INSERT
-- (tr_redeemed_count_on_insert). Ma niente lo abbassava: "Elimina account"
-- (api/delete-account.js) cancella i riscatti dell'utente e il contatore
-- restava com'era. Il 28/09: 10 righe cancellate, 10 prese in più sparse
-- su 8 sconti (Shoro +2, DAPPER +2, gli altri +1).
--
-- Una riga cancellata libera anche il posto di un drop: il QR non
-- esiste più, non si può usare.
--
-- Idempotente.

CREATE OR REPLACE FUNCTION public.tg_decrement_redeemed_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE discounts
     SET total_redeemed = GREATEST(COALESCE(total_redeemed, 0) - 1, 0)
   WHERE id = OLD.discount_id;
  RETURN OLD;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.tg_decrement_redeemed_on_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_redeemed_count_on_delete ON public.discount_redemptions;
CREATE TRIGGER tr_redeemed_count_on_delete
  AFTER DELETE ON public.discount_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_decrement_redeemed_on_delete();

-- I contatori già sfasati tornano al numero vero di prese.
UPDATE public.discounts d
   SET total_redeemed = sub.n
  FROM (
    SELECT d2.id, count(r.id)::int AS n
      FROM public.discounts d2
      LEFT JOIN public.discount_redemptions r ON r.discount_id = d2.id
     GROUP BY d2.id
  ) sub
 WHERE sub.id = d.id
   AND COALESCE(d.total_redeemed, 0) <> sub.n;
