-- ============================================================================
-- Admin Analytics — numeri calcolati nel DB (23/09)
-- ============================================================================
-- Prima la pagina /admin/analytics scaricava le righe di page_views nel
-- browser e le contava lì. PostgREST però ne restituisce al massimo 1000 per
-- richiesta: il 22/09 le visite erano 10.656 e la pagina ne vedeva ~1000, e
-- "visitatori unici", grafico, paesi e città erano calcolati su quel pezzo.
-- Qui si conta tutto in Postgres e al browser arriva un solo JSON.
--
-- Contiene:
--   1. page_views.visitor_id — id anonimo e casuale salvato nel browser
--      (localStorage). Il session_id cambia dopo 30 minuti di inattività e a
--      ogni scheda nuova: contato da solo diceva "visite", non "persone".
--   2. analytics_section(path) / analytics_source(referrer) — come si
--      raggruppano pagine e provenienze. Un solo posto, usato da tutto.
--   3. admin_analytics(...)       — tutti i numeri di un periodo + il
--      periodo precedente per il confronto.
--   4. admin_analytics_live()     — chi c'è sul sito adesso (5 minuti).
--
-- Le funzioni esposte sono SECURITY DEFINER (page_views è leggibile solo
-- dagli admin via RLS, profiles pure) e controllano is_admin() per prime.
-- Idempotente: si può rilanciare.
-- ============================================================================

-- 1) Visitatore anonimo ------------------------------------------------------
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS visitor_id TEXT;
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_id
  ON page_views(visitor_id) WHERE visitor_id IS NOT NULL;

-- 2) Raggruppamenti ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_section(p_path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_path IS NULL OR p_path IN ('', '/')            THEN 'Home'
    WHEN p_path = '/esplora'                              THEN 'Mappa'
    WHEN p_path LIKE '/restaurant/%'                      THEN 'Schede dei locali'
    WHEN p_path IN ('/deals', '/sconti')                  THEN 'Bi Club (sconti)'
    WHEN p_path = '/login' OR p_path LIKE '/auth%'        THEN 'Login e registrazione'
    WHEN p_path LIKE '/chiedi%'                           THEN 'Chiedi a Bi'
    WHEN p_path LIKE '/profile%'                          THEN 'Profilo'
    WHEN p_path = '/saved'                                THEN 'Salvati'
    WHEN p_path = '/list'                                 THEN 'Elenco locali'
    WHEN p_path LIKE '/verify%'                           THEN 'Area ristoratori'
    WHEN p_path = '/partner'                              THEN 'Diventa partner'
    WHEN p_path = '/about'                                THEN 'Chi siamo'
    WHEN p_path IN ('/privacy', '/terms')                 THEN 'Privacy e termini'
    WHEN p_path IN ('/settings', '/preferenze-email')     THEN 'Impostazioni'
    ELSE 'Altre pagine'
  END
$$;

-- Da dove arriva una visita: il referrer della PRIMA pagina della sessione.
-- accounts.google.com è il ritorno dal login con Google, chiamamibi.com una
-- sessione riaperta sul sito: nessuno dei due è una fonte di traffico.
CREATE OR REPLACE FUNCTION public.analytics_source(p_referrer text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH h AS (
    SELECT lower(coalesce(substring(p_referrer from '^[a-zA-Z]+://([^/:?#]+)'), '')) AS host
  )
  SELECT CASE
    WHEN host = ''                                           THEN 'Diretto o link'
    WHEN host LIKE '%chiamamibi.com' OR host LIKE '%.vercel.app'
      OR host LIKE 'localhost%' OR host = 'accounts.google.com' THEN 'Diretto o link'
    WHEN host LIKE '%instagram.com'                          THEN 'Instagram'
    WHEN host LIKE '%facebook.com' OR host = 'fb.me' OR host LIKE '%.fb.com' THEN 'Facebook'
    WHEN host LIKE '%tiktok.com'                             THEN 'TikTok'
    WHEN host LIKE '%whatsapp.%' OR host = 'wa.me'           THEN 'WhatsApp'
    WHEN host ~ '(^|\.)google\.[a-z.]+$'                     THEN 'Google'
    WHEN host LIKE '%bing.com' OR host LIKE '%duckduckgo.com'
      OR host LIKE '%ecosia.org' OR host LIKE '%yahoo.%'     THEN 'Altri motori di ricerca'
    WHEN host = 't.co' OR host LIKE '%twitter.com' OR host = 'x.com' OR host LIKE '%.x.com' THEN 'X / Twitter'
    WHEN host LIKE '%linkedin.com' OR host = 'lnkd.in'       THEN 'LinkedIn'
    ELSE regexp_replace(host, '^www\.', '')
  END
  FROM h
$$;

-- 3) Riepilogo di un intervallo (interno) ------------------------------------
CREATE OR REPLACE FUNCTION public.admin_analytics_summary(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pv AS (
    SELECT session_id, coalesce(visitor_id, session_id) AS visitor, user_id
      FROM page_views
     WHERE created_at >= p_from AND created_at < p_to
  ),
  s AS (SELECT session_id, count(*) AS n FROM pv GROUP BY session_id)
  SELECT jsonb_build_object(
    'pageviews',       (SELECT count(*) FROM pv),
    'visits',          (SELECT count(*) FROM s),
    'visitors',        (SELECT count(DISTINCT visitor) FROM pv),
    'logged_users',    (SELECT count(DISTINCT user_id) FROM pv),
    'single_page',     (SELECT count(*) FROM s WHERE n = 1),
    'signups',         (SELECT count(*) FROM profiles WHERE created_at >= p_from AND created_at < p_to),
    'saves',           (SELECT count(*) FROM saved_restaurants WHERE created_at >= p_from AND created_at < p_to),
    'discounts_taken', (SELECT count(*) FROM discount_redemptions WHERE generated_at >= p_from AND generated_at < p_to),
    'discounts_used',  (SELECT count(*) FROM discount_redemptions
                         WHERE status = 'redeemed' AND redeemed_at >= p_from AND redeemed_at < p_to)
  )
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_summary(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

-- 4) Tutti i numeri di un periodo ----------------------------------------------
-- p_bucket: 'hour' o 'day'. I secchi del grafico sono in ora italiana e
-- arrivano già tutti, anche quelli a zero, così il grafico non salta i buchi.
CREATE OR REPLACE FUNCTION public.admin_analytics(
  p_from      timestamptz,
  p_to        timestamptz,
  p_prev_from timestamptz,
  p_prev_to   timestamptz,
  p_bucket    text DEFAULT 'day'
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket text := CASE WHEN p_bucket = 'hour' THEN 'hour' ELSE 'day' END;
  v_step   interval := CASE WHEN p_bucket = 'hour' THEN interval '1 hour' ELSE interval '1 day' END;
  v_tz     text := 'Europe/Rome';
  v_result jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Solo gli admin possono leggere le statistiche';
  END IF;

  WITH pv AS (
    SELECT created_at, path, session_id, coalesce(visitor_id, session_id) AS visitor,
           referrer, country, city, device_type
      FROM page_views
     WHERE created_at >= p_from AND created_at < p_to
  ),
  first_view AS (
    SELECT DISTINCT ON (session_id) session_id, referrer
      FROM pv
     ORDER BY session_id, created_at
  ),
  series AS (
    SELECT gs AS bucket
      FROM generate_series(
        date_trunc(v_bucket, p_from AT TIME ZONE v_tz),
        date_trunc(v_bucket, (p_to - interval '1 microsecond') AT TIME ZONE v_tz),
        v_step
      ) AS gs
  ),
  pv_b AS (
    SELECT date_trunc(v_bucket, created_at AT TIME ZONE v_tz) AS bucket,
           count(*) AS pageviews, count(DISTINCT visitor) AS visitors
      FROM pv GROUP BY 1
  ),
  su_b AS (
    SELECT date_trunc(v_bucket, created_at AT TIME ZONE v_tz) AS bucket, count(*) AS signups
      FROM profiles
     WHERE created_at >= p_from AND created_at < p_to
     GROUP BY 1
  ),
  rest AS (
    SELECT split_part(path, '/', 3) AS slug, count(*) AS views, count(DISTINCT visitor) AS visitors
      FROM pv
     WHERE path LIKE '/restaurant/%'
     GROUP BY 1
  ),
  saves AS (
    SELECT restaurant_id, count(*) AS saves
      FROM saved_restaurants
     WHERE created_at >= p_from AND created_at < p_to
     GROUP BY 1
  )
  SELECT jsonb_build_object(
    'current',  admin_analytics_summary(p_from, p_to),
    'previous', admin_analytics_summary(p_prev_from, p_prev_to),
    'users_total', (SELECT count(*) FROM profiles),

    'series', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               't',         to_char(s.bucket, 'YYYY-MM-DD"T"HH24:MI'),
               'visitors',  coalesce(p.visitors, 0),
               'pageviews', coalesce(p.pageviews, 0),
               'signups',   coalesce(u.signups, 0)
             ) ORDER BY s.bucket)
        FROM series s
        LEFT JOIN pv_b p ON p.bucket = s.bucket
        LEFT JOIN su_b u ON u.bucket = s.bucket
    ), '[]'::jsonb),

    'sections', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'visitors')::int DESC, (x->>'pageviews')::int DESC)
        FROM (
          SELECT jsonb_build_object(
                   'label', analytics_section(path),
                   'visitors', count(DISTINCT visitor),
                   'pageviews', count(*)) AS x
            FROM pv GROUP BY analytics_section(path)
        ) t
    ), '[]'::jsonb),

    'sources', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'visits')::int DESC)
        FROM (
          SELECT jsonb_build_object('label', analytics_source(referrer), 'visits', count(*)) AS x
            FROM first_view GROUP BY analytics_source(referrer)
        ) t
    ), '[]'::jsonb),

    'restaurants', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'views')::int DESC)
        FROM (
          SELECT jsonb_build_object(
                   'id', r.id, 'slug', rest.slug, 'name', coalesce(r.name, rest.slug),
                   'views', rest.views, 'visitors', rest.visitors,
                   'saves', coalesce(sv.saves, 0)) AS x
            FROM rest
            LEFT JOIN restaurants r ON r.slug = rest.slug
            LEFT JOIN saves sv ON sv.restaurant_id = r.id
           ORDER BY rest.views DESC
           LIMIT 10
        ) t
    ), '[]'::jsonb),

    'countries', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'visitors')::int DESC)
        FROM (
          SELECT jsonb_build_object('label', country, 'visitors', count(DISTINCT visitor)) AS x
            FROM pv WHERE country IS NOT NULL
           GROUP BY country ORDER BY count(DISTINCT visitor) DESC LIMIT 8
        ) t
    ), '[]'::jsonb),

    'cities', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'visitors')::int DESC)
        FROM (
          SELECT jsonb_build_object('label', city, 'visitors', count(DISTINCT visitor)) AS x
            FROM pv WHERE city IS NOT NULL
           GROUP BY city ORDER BY count(DISTINCT visitor) DESC LIMIT 8
        ) t
    ), '[]'::jsonb),

    'devices', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'visitors')::int DESC)
        FROM (
          SELECT jsonb_build_object('label', coalesce(device_type, 'unknown'), 'visitors', count(DISTINCT visitor)) AS x
            FROM pv GROUP BY coalesce(device_type, 'unknown')
        ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics(timestamptz, timestamptz, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics(timestamptz, timestamptz, timestamptz, timestamptz, text) TO authenticated;

-- 5) Adesso sul sito -------------------------------------------------------------
-- Persone con almeno una pagina negli ultimi 5 minuti, e dove si trovano
-- (l'ultima pagina vista da ciascuna).
CREATE OR REPLACE FUNCTION public.admin_analytics_live()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Solo gli admin possono leggere le statistiche';
  END IF;

  WITH last_view AS (
    SELECT DISTINCT ON (coalesce(visitor_id, session_id)) path
      FROM page_views
     WHERE created_at >= now() - interval '5 minutes'
     ORDER BY coalesce(visitor_id, session_id), created_at DESC
  )
  SELECT jsonb_build_object(
    'visitors', (SELECT count(*) FROM last_view),
    'sections', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'visitors')::int DESC)
        FROM (
          SELECT jsonb_build_object('label', analytics_section(path), 'visitors', count(*)) AS x
            FROM last_view GROUP BY analytics_section(path)
        ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_live() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics_live() TO authenticated;
