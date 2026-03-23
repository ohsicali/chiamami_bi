-- Phase 4: Translations Cache Table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  source_field text NOT NULL,
  language text NOT NULL,
  translated_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_table, source_id, source_field, language)
);

CREATE INDEX IF NOT EXISTS idx_translations_lookup
  ON translations(source_table, source_id, source_field, language);

ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- Everyone can read translations
CREATE POLICY "Public read translations" ON translations
  FOR SELECT USING (true);

-- Admin can manage translations
CREATE POLICY "Admin full access translations" ON translations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
