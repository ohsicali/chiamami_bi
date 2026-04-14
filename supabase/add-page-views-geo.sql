-- ============================================================================
-- Page Views — add geo / device columns for server-enriched tracking
-- Populated by /api/track.js using Vercel edge headers
-- (x-vercel-ip-country, x-vercel-ip-city, x-vercel-ip-country-region) and
-- User-Agent sniffing for device_type (mobile/tablet/desktop).
-- ============================================================================

ALTER TABLE page_views ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS device_type TEXT;

-- Analytics indexes for grouping
CREATE INDEX IF NOT EXISTS idx_page_views_country    ON page_views(country)    WHERE country    IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_city       ON page_views(city)       WHERE city       IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_page_views_device     ON page_views(device_type) WHERE device_type IS NOT NULL;
