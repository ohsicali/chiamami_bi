/**
 * Le colonne di `restaurants` che un browser può leggere, e come il
 * pannello admin recupera quelle che non può.
 *
 * `verify_pin`, `partner_email`, `magic_token` & co. non sono concesse né ad
 * `anon` né ad `authenticated` (supabase/security-audit-2026-09-23-part-b.sql):
 * col PIN si entra nella dashboard del locale, e la registrazione è aperta a
 * chiunque. Con i grant di colonna un `select('*')` su restaurants fallisce
 * intero, per questo qui c'è l'elenco esplicito.
 *
 * ⚠️ Una colonna nuova in `restaurants` va aggiunta qui E concessa in SQL ad
 * anon e authenticated, altrimenti le query che la chiedono falliscono.
 */
import { supabase } from './supabase'

export const RESTAURANT_READABLE_COLUMNS = [
  'id', 'name', 'slug', 'city', 'country', 'address', 'neighborhood', 'location_label',
  'latitude', 'longitude', 'phone', 'google_maps_url', 'website', 'category',
  'cuisine_type', 'price_range', 'our_rating', 'our_review', 'our_tip', 'is_published',
  'created_at', 'updated_at', 'instagram_reel', 'recommended_for', 'tiktok_url',
  'tagline', 'photos', 'place_id', 'place_id_confidence', 'place_id_verified_at',
  'hours_cache', 'hours_cache_updated_at', 'seo_title', 'seo_description', 'og_title',
  'og_description', 'og_image', 'noindex', 'is_disabled', 'last_pin_rotation_at',
  'tags_dietary', 'menu_url', 'reservation_url', 'instagram_url', 'services', 'moments',
  'opening_hours', 'search_tsv',
].join(', ')

/**
 * PIN, email del partner e date dell'onboarding, per id — solo admin (l'RPC
 * rifiuta chiunque altro). Ritorna una mappa id → { verify_pin, partner_email,
 * onboarding_email_sent_at, magic_token_expires_at }.
 *
 * @param {string[]|null} ids  null = tutti i locali
 */
export async function fetchRestaurantSecrets(ids = null) {
  const { data, error } = await supabase.rpc('admin_restaurant_secrets', {
    p_restaurant_ids: ids,
  })
  if (error) throw error
  return Object.fromEntries((data || []).map(({ id, ...rest }) => [id, rest]))
}
