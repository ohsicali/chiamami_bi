-- ============================================================
-- Drop esaurito coi giorni contati: resta in vista finché un posto
-- può ancora liberarsi (12/10)
-- ============================================================
-- Dal 12/10 (#342) un drop esaurito sparisce dal Bi Club appena esce un drop
-- nuovo. Per i drop coi giorni contati il proprietario l'ha voluto diverso:
-- finché qualcuno che l'ha preso ha ancora giorni per usarlo, il posto può
-- tornare libero e passare a chi è in lista — quindi il drop resta, col
-- "sold out" e «Mettiti in lista».
--
-- Il browser non può saperlo da solo (i riscatti degli altri non si leggono):
-- `discounts.claims_open_until` è la scadenza più lontana fra i riscatti
-- ancora da usare (status 'generated' con `expires_at`), NULL se non ce ne
-- sono. La tiene aggiornata il DB a ogni riscatto nuovo, usato, scaduto o
-- cancellato (trigger `tr_claims_open_until`), solo per i drop coi giorni
-- contati. L'app la legge in `filterShownDrops` (src/lib/discounts.js).
--
-- Le funzioni trigger non si possono chiamare fuori da un trigger: niente
-- REVOKE da fare.
--
-- Idempotente. Eseguito il 12/10 col connettore.
-- ============================================================

ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS claims_open_until timestamptz;

COMMENT ON COLUMN public.discounts.claims_open_until IS
  'Drop coi giorni contati: la scadenza più lontana fra i riscatti ancora da usare (NULL = nessuno). Finché è nel futuro un posto può liberarsi e il drop esaurito resta in vista. La scrive il trigger tr_claims_open_until.';

GRANT SELECT (claims_open_until) ON public.discounts TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_claims_open_until()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.discount_id ELSE NEW.discount_id END;
  v_until timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM discounts WHERE id = v_id AND claim_window_days IS NOT NULL) THEN
    RETURN NULL;
  END IF;
  SELECT max(expires_at) INTO v_until
    FROM discount_redemptions
   WHERE discount_id = v_id
     AND status = 'generated'
     AND expires_at IS NOT NULL;
  UPDATE discounts
     SET claims_open_until = v_until
   WHERE id = v_id
     AND claims_open_until IS DISTINCT FROM v_until;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE TRIGGER tr_claims_open_until
  AFTER INSERT OR DELETE OR UPDATE OF status, expires_at ON public.discount_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_claims_open_until();

-- I drop coi giorni contati già usciti (Piadora).
DO $$
BEGIN
  UPDATE public.discounts d
     SET claims_open_until = (
       SELECT max(r.expires_at)
         FROM public.discount_redemptions r
        WHERE r.discount_id = d.id
          AND r.status = 'generated'
          AND r.expires_at IS NOT NULL)
   WHERE d.claim_window_days IS NOT NULL;
END $$;

NOTIFY pgrst, 'reload schema';
