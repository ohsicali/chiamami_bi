-- ============================================================================
-- 2026-09-18: restaurant_suggestions.user_id puntava a auth.users, non a
-- profiles — l'admin non vedeva MAI i suggerimenti
-- ============================================================================
-- Sintomo: un ristorante suggerito dal sito arriva via email ("SUGGERIMENTO
-- DAL SITO") e l'insert in DB va a buon fine, ma /admin/suggestions mostra
-- sempre "Nessun suggerimento", per ogni riga, sempre.
--
-- Causa: SuggestionsManager.jsx fa
--   .from('restaurant_suggestions').select('*, profile:profiles(...)')
-- L'embed `profile:profiles(...)` richiede una FK diretta fra le due tabelle
-- che PostgREST possa risolvere. restaurant_suggestions.user_id referenzia
-- auth.users(id) (schema originale di restaurant-suggestions.sql), non
-- profiles(id) — a differenza di ogni altra tabella "contenuto utente" del
-- progetto (discount_redemptions, saved_lists, saved_restaurants,
-- user_reviews, email_preferences, push_subscriptions, ai_user_preferences),
-- che puntano tutte a profiles(id) proprio per questo. PostgREST non risolve
-- relazioni fra tabelle "sorelle" che puntano entrambe ad auth.users: la
-- query fallisce con "Could not find a relationship...", e
-- `const { data } = await supabase...` in SuggestionsManager.jsx ignora
-- l'errore, quindi `data` è null e la UI mostra la lista vuota.
--
-- Fix: la FK ora punta a profiles(id), come le tabelle equivalenti.
-- Nessuna riga orfana trovata (verificato prima di scrivere la migration).
-- ============================================================================

ALTER TABLE public.restaurant_suggestions
  DROP CONSTRAINT IF EXISTS restaurant_suggestions_user_id_fkey;

ALTER TABLE public.restaurant_suggestions
  ADD CONSTRAINT restaurant_suggestions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

SELECT 'Migration completata: restaurant_suggestions.user_id ora punta a profiles(id).' AS status;
