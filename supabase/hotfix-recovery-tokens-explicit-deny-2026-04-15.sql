-- ============================================================================
-- HOTFIX 2026-04-15 (notte): policy esplicita deny su auth_recovery_tokens
-- ============================================================================
-- L'advisor Supabase (Lint 0008 rls_enabled_no_policy) segnala la tabella
-- auth_recovery_tokens perché ha RLS ON ma zero policy.
-- Questo è il comportamento VOLUTO (la tabella è accessibile solo via
-- service_role dagli endpoint /api/recovery-otp e /api/verify-recovery-otp,
-- e service_role bypassa nativamente RLS).
--
-- Aggiungiamo una policy esplicita che nega qualsiasi accesso ad anon e
-- authenticated. Effetto funzionale: identico (già nessuno aveva accesso).
-- Effetto sull'advisor: sparisce il warning, e rende chiaro a chi legge lo
-- schema che la tabella è blindata by design.
-- ============================================================================

-- Idempotente
DROP POLICY IF EXISTS "Deny all client access" ON public.auth_recovery_tokens;

CREATE POLICY "Deny all client access"
  ON public.auth_recovery_tokens
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Spiegazione: con AS RESTRICTIVE + USING (false) + WITH CHECK (false)
-- nessun anon/authenticated può SELECT/INSERT/UPDATE/DELETE. service_role
-- bypassa RLS indipendentemente da qualsiasi policy.

SELECT 'Policy deny-all aggiunta su auth_recovery_tokens. Warning advisor risolto.' AS status;
