-- =============================================================================
-- Follow-up A1 — cleanup policy permissive residue su user_reviews + user_review_photos
-- Data: 19 aprile 2026
-- =============================================================================
--
-- CONTESTO:
--   Il file `disable-user-reviews-2026-04-19.sql` cercava di droppare policy con
--   nomi "Users create reviews", "Users update own reviews", ecc. ma i nomi reali
--   sul DB erano "Insert reviews", "Update reviews", "Delete reviews", ecc.
--   Quindi le permissive sono rimaste come zombie.
--
--   NON è un problema funzionale: le policy RESTRICTIVE aggiunte bloccano comunque
--   le scritture (AND logic in Postgres). Ma per pulizia e per evitare confusione
--   futura, le rimuoviamo ora.
--
-- IDEMPOTENTE: DROP POLICY IF EXISTS
--
-- ESEGUZIONE: stesso DB dove hai eseguito il file principale.
-- =============================================================================

BEGIN;

-- ---------- user_reviews ----------------------------------------------------
DROP POLICY IF EXISTS "Insert reviews" ON user_reviews;
DROP POLICY IF EXISTS "Update reviews" ON user_reviews;
DROP POLICY IF EXISTS "Delete reviews" ON user_reviews;

-- SELECT policy "Users read own or published reviews" la MANTENIAMO:
-- garantisce leggibilità storica (non-negoziabile #7).

-- ---------- user_review_photos ----------------------------------------------
DROP POLICY IF EXISTS "Insert review photos" ON user_review_photos;
DROP POLICY IF EXISTS "Update review photos" ON user_review_photos;
DROP POLICY IF EXISTS "Delete review photos" ON user_review_photos;

-- SELECT "Read review photos" mantenuta.

COMMIT;

-- =============================================================================
-- VERIFICA post-esecuzione:
-- SELECT policyname, cmd, permissive
-- FROM pg_policies
-- WHERE tablename IN ('user_reviews','user_review_photos')
-- ORDER BY tablename, cmd;
--
-- Risultato atteso: solo 6 Deny RESTRICTIVE + 2 SELECT PERMISSIVE + eventuali Admin.
-- =============================================================================
