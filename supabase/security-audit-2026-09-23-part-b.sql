-- =====================================================================
-- AUDIT SICUREZZA 23/09 — parte B: il PIN dei ristoratori non si legge
-- più da utente loggato
-- =====================================================================
-- ✅ APPLICATA sul DB live il 23/09, dopo il deploy di produzione di #293
--    (migration `security_audit_2026_09_23_part_b`). Se si ricrea il DB da
--    zero, va eseguita dopo la parte A.
--
-- ⚠️ ESEGUIRE SOLO DOPO IL DEPLOY del frontend della PR dell'audit (e
-- dopo la parte A, che crea `admin_restaurant_secrets`). Prima di quel
-- deploy il pannello admin e le pagine "Salvati" chiedevano `select=*` su
-- restaurants: con i grant di colonna quella richiesta fallisce intera.
--
-- IL PROBLEMA (verificato sul DB live il 23/09): il ruolo `authenticated`
-- aveva il SELECT di tabella su `restaurants`, quindi chiunque si
-- registrasse (registrazione aperta) poteva leggere con la chiave pubblica
-- `verify_pin`, `partner_email`, `magic_token` di tutti i locali
-- pubblicati: 16 PIN su 16. Col PIN si entra nella dashboard del locale
-- (/verify): riscatto QR, statistiche, cambio PIN ed email. Era il
-- "residuo noto" A1 dell'audit del 09/06.
--
-- Stessa tecnica già usata per `anon` (hotfix-pin-column-exposure-2026-06-09):
-- un REVOKE di colonna non basta finché c'è il grant di tabella, quindi si
-- revoca la tabella e si ri-concedono le sole colonne pubbliche.
--
-- ⚠️ D'ora in poi: ogni NUOVA colonna di `restaurants` va concessa a mano
-- sia ad `anon` sia ad `authenticated` (come in
-- grant-location-label-select-2026-09-22.sql), altrimenti chi la chiede
-- riceve "permission denied".
-- =====================================================================

REVOKE SELECT ON public.restaurants FROM authenticated;
GRANT SELECT (
  id, name, slug, city, country, address, neighborhood, location_label,
  latitude, longitude, phone, google_maps_url, website, category,
  cuisine_type, price_range, our_rating, our_review, our_tip, is_published,
  created_at, updated_at, instagram_reel, recommended_for, tiktok_url,
  tagline, photos, place_id, place_id_confidence, place_id_verified_at,
  hours_cache, hours_cache_updated_at, seo_title, seo_description, og_title,
  og_description, og_image, noindex, is_disabled, last_pin_rotation_at,
  tags_dietary, menu_url, reservation_url, instagram_url, services, moments,
  opening_hours, search_tsv
) ON public.restaurants TO authenticated;
-- esclusi: verify_pin, partner_email, onboarding_email_sent_at,
--          magic_token, magic_token_expires_at
-- (l'admin li legge con l'RPC admin_restaurant_secrets; le UPDATE restano
--  permesse e le filtra la policy is_admin()).

-- Verifica (da utente non admin deve dare "permission denied"):
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}';
--   select verify_pin from public.restaurants limit 1;
--   rollback;
