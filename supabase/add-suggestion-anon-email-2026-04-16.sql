-- ============================================================================
-- 2026-04-16: supporto suggerimenti da utenti non loggati
-- ============================================================================
-- Aggiunge colonna `email` a restaurant_suggestions e allarga la RLS
-- INSERT per permettere inserimenti anonimi (user_id IS NULL, email fornita).
-- Gli inserimenti autenticati restano invariati.
-- ============================================================================

-- 1) Colonna email per i suggerimenti anonimi
ALTER TABLE public.restaurant_suggestions
  ADD COLUMN IF NOT EXISTS email text;

-- 2) Aggiorna la policy INSERT:
--    - utenti loggati: auth.uid() = user_id (invariato)
--    - utenti anonimi: user_id IS NULL AND email NOT NULL
DROP POLICY IF EXISTS "Users can insert their own" ON public.restaurant_suggestions;

CREATE POLICY "Users or anon can insert suggestions"
  ON public.restaurant_suggestions
  FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id)                          -- utente loggato
    OR (user_id IS NULL AND email IS NOT NULL)       -- anonimo con email
  );

-- 3) Gli anonimi non devono poter leggere altri suggerimenti
--    La policy SELECT esistente "Users can view their own" usa auth.uid() = user_id
--    → i righe anonime (user_id IS NULL) non sono visibili via REST ai client.
--    Nessuna modifica necessaria alla SELECT policy.

SELECT 'Migration completata: restaurant_suggestions supporta inserimenti anonimi.' AS status;
