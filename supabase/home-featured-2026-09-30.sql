-- Vetrina della home scelta a mano (30/09).
--
-- La card grande della home mostra l'ultimo drop uscito. Dal pannello sconti
-- (bottone 🏠 sulla card) il proprietario può mettere al suo posto un altro
-- sconto: qui si segna QUANDO l'ha scelto. Vince la cosa più recente fra la
-- scelta e l'uscita dell'ultimo drop (regole in `chooseFeaturedDeal`,
-- src/lib/discounts.js, sotto test in tests/discounts.test.mjs).
-- Il pannello ne tiene una sola alla volta (la scelta nuova spegne le altre).
--
-- Solo la vetrina della home: il Bi Club non la guarda.
-- `discounts` ha grant a livello di tabella, quindi la colonna nuova si legge
-- già da anon e authenticated; la scrittura resta all'admin (RLS).

ALTER TABLE public.discounts
  ADD COLUMN IF NOT EXISTS home_featured_at timestamptz;

COMMENT ON COLUMN public.discounts.home_featured_at IS
  'Quando l''admin ha messo lo sconto in vetrina in home (al posto del drop). NULL = non scelto.';
