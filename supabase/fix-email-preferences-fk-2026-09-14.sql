-- ===========================================================================
--  Fix: email_preferences puntava alla tabella sbagliata
--  Eseguito il 2026-09-14 via connettore Supabase.
-- ===========================================================================
--
--  Bug: `supabase/email-preferences-2026-09-13.sql` ha creato
--  `email_preferences.user_id` con FK verso `auth.users(id)`, mentre ogni
--  altra tabella collegata a un utente in questo schema (saved_restaurants,
--  discount_redemptions, saved_lists, push_subscriptions, ecc.) punta a
--  `public.profiles(id)`.
--
--  Conseguenza: `recipientsFor()` in `api/_email/send.js` fa
--  `.from('email_preferences').select('..., profiles!inner(email, full_name)')`.
--  PostgREST costruisce l'embed seguendo le foreign key esposte nello schema
--  `public` — non attraversa `auth`, che non è esposto — quindi non trovava
--  nessuna relazione tra `email_preferences` e `profiles` e la query falliva
--  con un errore "could not find a relationship" ad ogni chiamata.
--
--  Effetto pratico: dal 2026-09-13 (creazione della tabella) NESSUNA email di
--  nuovo sconto/drop è mai partita, né automatica alla pubblicazione né dal
--  bottone "Notifica iscritti" — `email_notifications_log` non ha infatti
--  nessuna riga di tipo `discount` o `drop`, solo `restaurant` (trigger
--  diverso, non tocca `email_preferences`). Il fallimento è silenzioso lato
--  admin: lo sconto si salva comunque, e l'unico segnale è un avviso
--  discreto ("l'annuncio non è partito") facile da non notare.
-- ---------------------------------------------------------------------------

alter table public.email_preferences
  drop constraint if exists email_preferences_user_id_fkey,
  add constraint email_preferences_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

-- Fa ricaricare subito la schema cache di PostgREST, altrimenti il fix non
-- si vede finché non scade la cache da sola (~in genere pochi minuti).
notify pgrst, 'reload schema';
