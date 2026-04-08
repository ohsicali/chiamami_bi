-- Add new fields to partner_applications for the redesigned /partner page
-- Adds: address (required), instagram (optional), motivation (optional)
-- Keeps: city and message for backwards compatibility with existing admin UI

ALTER TABLE partner_applications
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS motivation text;

-- Note: existing rows will have NULL for these columns.
-- The new form writes both `motivation` and `message` so the legacy
-- admin UI (ApplicationManager) keeps rendering motivation via a.message.
