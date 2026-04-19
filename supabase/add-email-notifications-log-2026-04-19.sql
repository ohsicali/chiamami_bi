-- ============================================================
-- Email notifications log — prevents duplicate sends
-- Created: 2026-04-19 (Track C2)
-- ============================================================
-- Tracks when an admin broadcasts a notification for a given
-- (type, item_id) pair so the "Invia notifica" button can be
-- disabled after the first successful send and the admin can
-- see history.
-- ============================================================

CREATE TABLE IF NOT EXISTS email_notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('restaurant', 'discount', 'drop')),
  item_id uuid NOT NULL,
  sent_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  sent_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_email_notif_log_type_item
  ON email_notifications_log(type, item_id);

ALTER TABLE email_notifications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read notifications log" ON email_notifications_log;
CREATE POLICY "Admin read notifications log" ON email_notifications_log
  FOR SELECT USING (public.is_admin());

-- Writes are performed server-side with the service role, which
-- bypasses RLS. No INSERT/UPDATE policy is defined for clients.
