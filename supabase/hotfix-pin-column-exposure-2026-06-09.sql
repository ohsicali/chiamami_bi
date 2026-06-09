-- =====================================================================
-- HOTFIX CRITICO — esposizione PIN ristoratori al ruolo anon (2026-06-09)
-- =====================================================================
-- PROBLEMA (confermato sul DB live):
--   * La policy SELECT su `restaurants` era `USING (true)` e il ruolo `anon`
--     aveva il GRANT SELECT a livello di TABELLA → chiunque, con la sola
--     anon key pubblica (presente nel bundle JS), poteva leggere
--     `restaurants.verify_pin`, `magic_token`, `partner_email`, ecc. via
--     PostgREST. Con il `verify_pin` si effettua il login alla dashboard
--     ristoratore (RPC verify_login) → takeover dei merchant.
--   * Stessa esposizione su `restaurant_partners.pin_code`.
--   * `profiles.recovery_email` leggibile da anon.
--
-- NOTA SUI GRANT DI COLONNA:
--   Un REVOKE su singola colonna NON ha effetto se il ruolo possiede un
--   GRANT SELECT a livello di tabella. Bisogna revocare il SELECT di tabella
--   e ri-concedere solo le colonne "safe".
--
-- Questo script è idempotente: può essere rieseguito senza errori.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RESTAURANTS — solo ristoranti pubblicati, niente colonne segrete per anon
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read all restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Public read published restaurants" ON public.restaurants;
CREATE POLICY "Public read published restaurants" ON public.restaurants
  FOR SELECT USING (is_published = true OR is_admin());

REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (
  id, name, slug, city, country, address, latitude, longitude, phone,
  google_maps_url, website, category, cuisine_type, price_range, our_rating,
  our_review, our_tip, is_published, created_at, updated_at, instagram_reel,
  recommended_for, tiktok_url, tagline, photos, place_id, place_id_confidence,
  place_id_verified_at, hours_cache, hours_cache_updated_at, seo_title,
  seo_description, og_title, og_description, og_image, noindex, is_disabled,
  last_pin_rotation_at, tags_dietary, menu_url, reservation_url, instagram_url,
  services, moments, opening_hours, search_tsv
) ON public.restaurants TO anon;
-- esclusi da anon: verify_pin, partner_email, onboarding_email_sent_at,
--                  magic_token, magic_token_expires_at

-- ---------------------------------------------------------------------
-- 2. RESTAURANT_PARTNERS — lettura solo admin (merchant usa gli RPC verify_*)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read active partners" ON public.restaurant_partners;
DROP POLICY IF EXISTS "Admin read partners" ON public.restaurant_partners;
CREATE POLICY "Admin read partners" ON public.restaurant_partners
  FOR SELECT USING (is_admin());

-- ---------------------------------------------------------------------
-- 3. PROFILES — recovery_email non leggibile da anon
-- ---------------------------------------------------------------------
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, email, full_name, avatar_url, is_admin, created_at)
  ON public.profiles TO anon;
-- escluso da anon: recovery_email

-- ---------------------------------------------------------------------
-- 4. PROFILES.is_admin — difesa-in-profondità contro escalation da anon
--    (le UPDATE da anon sono già bloccate dalla policy auth.uid() = id, ma
--     revochiamo comunque il grant a livello colonna come ridondanza)
-- ---------------------------------------------------------------------
REVOKE UPDATE (is_admin) ON public.profiles FROM anon;

-- =====================================================================
-- RESIDUO NOTO (NON chiuso qui — richiede refactor lato admin):
--   Il ruolo `authenticated` mantiene SELECT su restaurants.verify_pin /
--   magic_token / partner_email perché il pannello admin (anch'esso
--   `authenticated`) li legge via PostgREST. Con la registrazione aperta,
--   un utente loggato può ancora leggere il verify_pin dei ristoranti
--   pubblicati. Fix consigliato: RPC SECURITY DEFINER `admin_get_verify_pin`
--   guardata da is_admin() + REVOKE di queste colonne anche da authenticated,
--   aggiornando DiscountManager/CredenzialiTab/EditRestaurant a usare l'RPC.
-- =====================================================================
