-- ============================================================================
-- PR23 — Validity columns on discounts table
-- Run on Supabase SQL editor.
-- ============================================================================

ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_days int[] DEFAULT NULL;
-- es. {1,2,3,4,5} per Lun-Ven · NULL = tutti i giorni (dayOfWeek: 1=Mon..7=Sun)

ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_meal_slots text[] DEFAULT NULL;
-- enum values: 'pranzo' | 'cena' | 'aperitivo' | 'brunch' | 'colazione'
-- NULL = qualsiasi fascia

ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_time_from time DEFAULT NULL;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_time_to   time DEFAULT NULL;
-- range orario opzionale specifico, prevale su valid_meal_slots
