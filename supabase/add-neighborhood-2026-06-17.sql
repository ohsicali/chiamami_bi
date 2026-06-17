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
