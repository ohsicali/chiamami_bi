-- Metriche banner: impression, click, CTR
-- Data: 2026-09-07
--
-- Da eseguire DOPO supabase/ads-network-2026-09-07.sql.
--
-- Cosa registra:
--   impression → il banner è stato visto davvero (almeno metà della sua
--                altezza a schermo per un secondo), non semplicemente
--                caricato. Un banner mai arrivato sotto gli occhi di
--                nessuno non è stato visto, e contarlo gonfierebbe i numeri
--                che poi mostri al cliente.
--   click      → il tap sul banner, prima della navigazione.
--
-- Stessa impronta leggera di `page_views`: id di sessione, tipo, timestamp.
-- Nessun cookie di profilazione, nessun dato personale, niente da aggiungere
-- all'informativa oltre a quello che il sito già dichiara.
--
-- Idempotente: eseguibile più volte senza side-effect.

-- =============================================================================
-- 1) Tabella eventi
-- =============================================================================
CREATE TABLE IF NOT EXISTS ad_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES sponsored_placements(id) ON DELETE CASCADE,
  slot         text NOT NULL,
  event_type   text NOT NULL CHECK (event_type IN ('impression', 'click')),
  session_id   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- L'aggregazione interroga sempre "questa campagna, ultimi N giorni".
CREATE INDEX IF NOT EXISTS idx_ad_events_placement
  ON ad_events(placement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_events_recent
  ON ad_events(created_at DESC);

COMMENT ON TABLE ad_events IS
  'Impression e click sui banner pubblicitari. Impression = banner visibile per metà altezza per almeno un secondo.';

-- =============================================================================
-- 2) RLS: nessuna scrittura dal browser, lettura solo agli admin
-- =============================================================================
-- Stessa impostazione di `page_views`: le righe le scrive `api/track.js`
-- (ramo `kind: 'ad_event'`) con il service role, che salta le RLS. Nessuna
-- policy di INSERT, quindi la chiave pubblica non può scrivere.
--
-- Non è pignoleria: su impression e click si fattura, e un contatore che
-- chiunque può gonfiare dal browser rende il report al cliente carta straccia.
ALTER TABLE ad_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone logs ad events" ON ad_events;

DROP POLICY IF EXISTS "Admins read ad events" ON ad_events;
CREATE POLICY "Admins read ad events" ON ad_events
  FOR SELECT TO authenticated
  USING (is_admin());

-- =============================================================================
-- 3) Aggregazione per l'admin
-- =============================================================================
-- Contare lato client vorrebbe dire scaricare tutte le righe grezze solo per
-- sommarle. Questa funzione restituisce già i totali per campagna.
CREATE OR REPLACE FUNCTION ad_stats(days int DEFAULT 30)
RETURNS TABLE (placement_id uuid, impressions bigint, clicks bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Solo gli admin possono leggere le metriche degli annunci';
  END IF;

  RETURN QUERY
    SELECT e.placement_id,
           count(*) FILTER (WHERE e.event_type = 'impression') AS impressions,
           count(*) FILTER (WHERE e.event_type = 'click')      AS clicks
      FROM ad_events e
     WHERE e.created_at > now() - make_interval(days => days)
     GROUP BY e.placement_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION ad_stats(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION ad_stats(int) TO authenticated;

COMMENT ON FUNCTION ad_stats(int) IS
  'Impression e click per campagna negli ultimi N giorni. Solo admin.';
