-- ============================================================================
-- Sconti/drop senza data di fine.
--
-- `discounts.valid_until` era NOT NULL fin dallo schema originale
-- (`phase2-discounts.sql`): non si poteva creare uno sconto — o un drop,
-- che riusa la stessa colonna quando `drop_ends_at` non è compilato —
-- senza dirgli quando finisce. Il backend che decide se uno sconto è
-- valido ADESSO (`verify_redeem_qr`, in `verify-redeem-short-code-2026-09-18.sql`)
-- già gestiva `valid_until IS NULL` come "nessuna scadenza": la colonna
-- NOT NULL era l'unico punto che lo impediva davvero.
--
-- 1) Tolto il vincolo NOT NULL. `valid_from` resta obbligatoria (uno sconto
--    ha sempre un inizio), `valid_until` no.
-- 2) La policy RLS di lettura pubblica su `discount_products`
--    (discount-products-2026-09-18.sql) guardava `d.valid_until > now()`:
--    con `valid_until` nullo quel confronto è sempre NULL/false in SQL, e
--    le foto prodotto di uno sconto senza scadenza sarebbero rimaste
--    invisibili a chiunque. Riscritta per trattare NULL come "mai scade".
-- ============================================================================

ALTER TABLE discounts ALTER COLUMN valid_until DROP NOT NULL;

DROP POLICY IF EXISTS "Public read products of active discounts" ON discount_products;
CREATE POLICY "Public read products of active discounts" ON discount_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM discounts d
      WHERE d.id = discount_products.discount_id
        AND d.is_active = true
        AND (d.valid_until IS NULL OR d.valid_until > now())
    )
  );
