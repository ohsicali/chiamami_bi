-- Add drop and featured fields to discounts table
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS is_drop boolean DEFAULT false;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS drop_starts_at timestamptz;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS drop_ends_at timestamptz;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS max_quantity integer;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS claimed_count integer DEFAULT 0;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Note: 'conditions' column already exists as text type.
-- The frontend will handle splitting by newlines for display as a list.
