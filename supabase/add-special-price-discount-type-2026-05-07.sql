-- Add 'special_price' as a valid discount_type.
--
-- "Set price" deals (e.g., "Tramezzino a 5€" instead of the regular 6€)
-- don't fit the existing 'percentage' / 'fixed' / 'freebie' types:
--   percentage = % off the bill
--   fixed      = euro amount off the bill ("-5€")
--   freebie    = something free (uses title as label)
--   special_price = item sold at a fixed price (label rendered as "{value}€"
--                   with context "offerta" instead of "sconto")
--
-- Run this in the Supabase SQL editor.

ALTER TABLE public.discounts
  DROP CONSTRAINT IF EXISTS discounts_discount_type_check;

ALTER TABLE public.discounts
  ADD CONSTRAINT discounts_discount_type_check
  CHECK (discount_type IN ('percentage', 'fixed', 'freebie', 'special_price'));
