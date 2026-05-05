-- Manual moments selection per restaurant.
--
-- Until now the moment buckets (colazione, pranzo, aperitivo, cena, dopocena)
-- were inferred only from hours_cache via lib/hours.js#isOpenForMoment.
-- That works for the obvious cases but Google Places hours don't always
-- reflect reality (e.g. a cocktail bar that "officially" opens at 18:00
-- but is the right place for aperitivo). With this column the admin can
-- pin a restaurant to one or more moments explicitly. The frontend treats
-- a non-empty `moments` array as the source of truth and falls back to
-- the hours-based heuristic only when the array is empty.
--
-- Allowed values match MOMENT_KEYS in src/lib/hours.js:
--   'colazione' | 'pranzo' | 'aperitivo' | 'cena' | 'dopocena'

alter table restaurants
  add column if not exists moments text[] default '{}';

-- Allowed-values check: all entries must be one of the canonical 5 keys.
-- Using a check on the array via array_op so existing empty arrays pass.
alter table restaurants
  drop constraint if exists restaurants_moments_check;

alter table restaurants
  add constraint restaurants_moments_check
  check (moments <@ array['colazione','pranzo','aperitivo','cena','dopocena']::text[]);

-- GIN index so filtering "where moments @> array['aperitivo']" stays fast
-- once we have hundreds of restaurants tagged.
create index if not exists restaurants_moments_idx
  on restaurants using gin (moments);
