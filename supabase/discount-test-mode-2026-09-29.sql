-- ============================================================
-- Sconti di prova — visibili solo a chi è invitato (29/09)
-- ============================================================
--
-- Richiesta del proprietario: provare uno sconto col locale (primo caso:
-- Gelateria Borghese, account beatrice.rigato@gmail.com) senza che vada
-- online. Lo sconto esiste davvero — si sblocca, dà QR e codice, il locale
-- lo convalida in /verify, partono festa e stelle — ma il pubblico non lo
-- vede da nessuna parte.
--
-- Come:
--   - `discounts.is_test`: true = sconto di prova;
--   - `discount_testers`: le email che lo vedono (una riga per email);
--   - la policy di lettura di `discounts` nasconde gli sconti di prova a
--     tutti tranne admin e invitati. È il DB a nasconderli, non l'app: la
--     copia in cache CDN (`api/public.js`, chiave anon) non li riceve mai,
--     e con loro spariscono anche le foto prodotto (la policy di
--     `discount_products` legge `discounts` con la stessa RLS);
--   - `guard_redemption_insert` rifiuta il riscatto a chi non è invitato,
--     anche se conosce l'id dello sconto.
--
-- "Pubblica per tutti" (dal pannello) = `is_test = false`: da lì è uno
-- sconto come gli altri.
--
-- Idempotente: si può rilanciare.
-- ============================================================

ALTER TABLE public.discounts
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.discounts.is_test IS
  'Sconto di prova: lo vedono solo gli admin e le email in discount_testers.';

CREATE TABLE IF NOT EXISTS public.discount_testers (
  discount_id uuid NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(btrim(email)) AND position('@' IN email) > 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (discount_id, email)
);

CREATE INDEX IF NOT EXISTS discount_testers_email_idx ON public.discount_testers (email);

ALTER TABLE public.discount_testers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.discount_testers FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.discount_testers TO authenticated;

DROP POLICY IF EXISTS "Admin manages discount testers" ON public.discount_testers;
CREATE POLICY "Admin manages discount testers" ON public.discount_testers
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- L'invitato legge solo le proprie righe: serve all'app per chiedere
-- "gli sconti di prova a cui sono invitato" (useDiscounts.js).
DROP POLICY IF EXISTS "Tester reads own rows" ON public.discount_testers;
CREATE POLICY "Tester reads own rows" ON public.discount_testers
  FOR SELECT TO authenticated
  USING (email = lower(coalesce((SELECT auth.jwt() ->> 'email'), '')));

-- Chi sta chiedendo è invitato a questo sconto? SECURITY DEFINER così la
-- policy di `discounts` non dipende dai permessi del chiamante su
-- `discount_testers` (anon non ne ha). Dice solo sì/no sulla propria email.
CREATE OR REPLACE FUNCTION public.is_discount_tester(p_discount_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.discount_testers t
    WHERE t.discount_id = p_discount_id
      AND t.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

REVOKE ALL ON FUNCTION public.is_discount_tester(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_discount_tester(uuid) TO anon, authenticated;

-- Lettura di `discounts`: prima era `true` per tutti.
DROP POLICY IF EXISTS "Public read all discounts" ON public.discounts;
DROP POLICY IF EXISTS "Public read discounts (no tests)" ON public.discounts;
CREATE POLICY "Public read discounts (no tests)" ON public.discounts
  FOR SELECT
  USING (
    NOT is_test
    OR (SELECT public.is_admin())
    OR public.is_discount_tester(id)
  );

-- Riscatto: stessa guardia di prima (fix-verify-and-counters-2026-09-24.sql)
-- più il controllo sugli sconti di prova.
CREATE OR REPLACE FUNCTION public.guard_redemption_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_discount discounts%ROWTYPE; v_max int;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;
  NEW.status := 'generated'; NEW.redeemed_at := NULL; NEW.redeemed_by_restaurant := false; NEW.generated_at := now();
  NEW.user_name := LEFT(NEW.user_name, 120);
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text || ':' || NEW.discount_id::text, 0));
  IF EXISTS (SELECT 1 FROM discount_redemptions WHERE user_id = NEW.user_id AND discount_id = NEW.discount_id) THEN
    RAISE EXCEPTION 'already_claimed' USING ERRCODE = '23505';
  END IF;
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
$$;
