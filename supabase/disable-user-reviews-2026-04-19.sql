-- =============================================================================
-- Track A1 — Disattivazione scrittura recensioni + foto utenti
-- Data: 19 aprile 2026
-- Branch: v4/track-a-disable-reviews-compliance
-- =============================================================================
--
-- COSA FA:
--   - Rimuove le policy RLS che permettono a utenti di INSERT/UPDATE/DELETE su
--     user_reviews e user_review_photos
--   - Mantiene la SELECT policy "Public read published reviews" solo per
--     integrity storica (i dati esistenti restano leggibili via API se servisse,
--     ma la UI v4 non mostra nulla)
--   - Mantiene "Admin full access" per operazioni future (cleanup, export)
--
-- COSA NON FA:
--   - NON cancella tabelle
--   - NON cancella dati storici (0 rating, 0 stars, ~pochissime review reali
--     per 4 utenti early)
--   - NON tocca schema: niente ALTER, niente DROP COLUMN
--
-- IDEMPOTENTE: può essere rilanciato senza errori (DROP POLICY IF EXISTS)
--
-- ROLLBACK: eseguire il file gemello `rollback-enable-user-reviews.sql`
-- (in fondo a questo file, commentato) — ricrea le policy originali
--
-- ESEGUZIONE: su branch Supabase PRIMA, poi su prod solo dopo OK Augusto
-- =============================================================================

BEGIN;

-- ---------- user_reviews ----------------------------------------------------

-- Rimuovi policy di scrittura utente
DROP POLICY IF EXISTS "Users create reviews" ON user_reviews;
DROP POLICY IF EXISTS "Users update own reviews" ON user_reviews;
DROP POLICY IF EXISTS "Users read own reviews" ON user_reviews;

-- Conserva:
--   - "Public read published reviews" (SELECT, per retrocompatibilità)
--   - "Admin full access reviews" (ALL, per admin future)

-- Esplicito DENY per INSERT/UPDATE/DELETE su ruolo authenticated e anon.
-- Usiamo policy restrittive che ritornano FALSE: così anche se un domani
-- qualcuno reintroduce una policy permissiva per errore, il deny resta.
CREATE POLICY "Deny writes to user_reviews (v4 compliance)"
  ON user_reviews
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Deny updates to user_reviews (v4 compliance)"
  ON user_reviews
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny deletes to user_reviews (v4 compliance)"
  ON user_reviews
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- ---------- user_review_photos ----------------------------------------------

DROP POLICY IF EXISTS "Users manage own review photos" ON user_review_photos;

-- Conserva:
--   - "Public read review photos" (SELECT, retrocompat)
--   - "Admin full access review photos" (ALL)

CREATE POLICY "Deny writes to user_review_photos (v4 compliance)"
  ON user_review_photos
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Deny updates to user_review_photos (v4 compliance)"
  ON user_review_photos
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny deletes to user_review_photos (v4 compliance)"
  ON user_review_photos
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated, anon
  USING (false);

COMMIT;

-- =============================================================================
-- ROLLBACK (copia/incolla in un nuovo query se serve tornare indietro):
-- =============================================================================
-- BEGIN;
--
-- DROP POLICY IF EXISTS "Deny writes to user_reviews (v4 compliance)" ON user_reviews;
-- DROP POLICY IF EXISTS "Deny updates to user_reviews (v4 compliance)" ON user_reviews;
-- DROP POLICY IF EXISTS "Deny deletes to user_reviews (v4 compliance)" ON user_reviews;
-- DROP POLICY IF EXISTS "Deny writes to user_review_photos (v4 compliance)" ON user_review_photos;
-- DROP POLICY IF EXISTS "Deny updates to user_review_photos (v4 compliance)" ON user_review_photos;
-- DROP POLICY IF EXISTS "Deny deletes to user_review_photos (v4 compliance)" ON user_review_photos;
--
-- CREATE POLICY "Users read own reviews" ON user_reviews
--   FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users create reviews" ON user_reviews
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users update own reviews" ON user_reviews
--   FOR UPDATE USING (auth.uid() = user_id);
-- CREATE POLICY "Users manage own review photos" ON user_review_photos
--   FOR ALL USING (
--     EXISTS (SELECT 1 FROM user_reviews WHERE id = review_id AND user_id = auth.uid())
--   );
--
-- COMMIT;
-- =============================================================================
