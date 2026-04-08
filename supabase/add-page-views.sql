-- ============================================================================
-- Page Views tracking table
-- Tracks visits across the site for analytics (live visitors, total visits,
-- page breakdown, time series charts).
-- ============================================================================

CREATE TABLE IF NOT EXISTS page_views (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON page_views(user_id) WHERE user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can insert their own page view
DROP POLICY IF EXISTS "Anyone can insert page views" ON page_views;
CREATE POLICY "Anyone can insert page views"
  ON page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read page views
DROP POLICY IF EXISTS "Admins can read page views" ON page_views;
CREATE POLICY "Admins can read page views"
  ON page_views FOR SELECT
  TO authenticated
  USING (is_admin());

-- Only admins can delete (for cleanup/maintenance)
DROP POLICY IF EXISTS "Admins can delete page views" ON page_views;
CREATE POLICY "Admins can delete page views"
  ON page_views FOR DELETE
  TO authenticated
  USING (is_admin());
