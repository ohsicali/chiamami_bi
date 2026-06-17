-- PR24 · Blocco A — Dati & immagini
-- A2/A4: aggiunge la colonna `neighborhood` (quartiere/rione) ai ristoranti.
--
-- Perché serve:
--  - Indirizzi formattati "Via Bonafous 7 · Vanchiglia" (helper formatAddress)
--  - Match di zona in Chiedi a Bi (es. "Vanchiglia") senza dipendere dalla
--    stringa raw di Google.
--
-- Popolamento: scritto in fase di sync Google Places (api/resolve-maps.js)
-- dal componente address_components (sublocality/neighborhood). I record
-- esistenti restano NULL finché non vengono ri-sincronizzati: il backfill
-- è non bloccante e l'app degrada con grazia (mostra solo via, niente zona).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS neighborhood text;

COMMENT ON COLUMN public.restaurants.neighborhood IS
  'Quartiere/rione (es. "Vanchiglia"). Derivato da Google Places address_components (neighborhood/sublocality) in fase di sync. Usato per indirizzi formattati e match zona in Chiedi a Bi. Null = non ancora sincronizzato.';

-- IMPORTANTE: il ruolo `anon` ha GRANT SELECT a livello di COLONNA su
-- public.restaurants (hardening PIN/token in #201: solo le colonne pubbliche
-- sono leggibili). Una colonna nuova NON eredita il grant, quindi senza la
-- riga sotto QUALSIASI query pubblica che seleziona `neighborhood` fallisce
-- con "42501 permission denied" e la lista locali si svuota.
-- `authenticated` ha già il grant (SELECT a livello di tabella).
GRANT SELECT (neighborhood) ON public.restaurants TO anon;

-- Ricarica la cache schema di PostgREST così la REST API vede subito la
-- nuova colonna (altrimenti il client riceve errore finché la cache scade).
NOTIFY pgrst, 'reload schema';
