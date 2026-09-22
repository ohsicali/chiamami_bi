/**
 * Le letture pubbliche che ogni visitatore fa all'apertura del sito, descritte
 * una volta sola e usate da due parti:
 *
 * - `api/public.js` le esegue su Supabase e le serve dalla cache CDN di
 *   Vercel, così con mille visitatori Supabase riceve una richiesta al minuto
 *   invece di mille (è il motivo per cui esiste: il 22/09, giorno del lancio,
 *   il progetto Supabase è andato giù sotto il traffico);
 * - gli hook (`useRestaurants`, `useCategories`, `useActiveDiscounts`,
 *   `useAdsValue`) le rifanno direttamente con supabase-js quando l'endpoint
 *   non risponde (sviluppo locale, errore), quindi la forma dei dati deve
 *   restare identica — per questo le colonne stanno qui e non nei due posti.
 *
 * Solo dati visibili con la chiave pubblica: l'endpoint usa la stessa chiave
 * anon del browser, niente service role.
 */

// Colonne lette dai componenti pubblici. `*` tirava ~30 campi inutili per riga.
export const RESTAURANT_COLUMNS = [
  'id', 'name', 'slug', 'city', 'country', 'address', 'neighborhood',
  'location_label',
  'latitude', 'longitude', 'phone', 'website', 'google_maps_url',
  'category', 'cuisine_type', 'price_range', 'our_rating',
  'our_review', 'our_tip', 'recommended_for', 'tagline',
  'tiktok_url', 'instagram_reel', 'moments',
  'place_id', 'place_id_verified_at', 'opening_hours',
  'is_published', 'created_at', 'updated_at',
].join(', ')

// `hours_cache` e' la risposta grezza di Google Places e pesa da sola
// 230 kB sui 544 kB della query: dentro ci sono `currentOpeningHours`
// (140 kB, ogni periodo con il suo oggetto `date` completo),
// `displayName` (copia di `name`) e una seconda copia di
// `weekdayDescriptions`. Di tutto questo l'app legge solo
// `regularOpeningHours` e `utcOffsetMinutes` (vedi `getHoursStatus` in
// lib/hours.js, `useOrariStatus` e OrariLocale). PostgREST sa proiettare
// dentro il JSONB, quindi ce li facciamo dare gia' separati e `useRestaurants`
// li ricompone sotto la stessa forma di prima.
export const HOURS_PROJECTION =
  'hours_regular:hours_cache->regularOpeningHours, hours_offset:hours_cache->utcOffsetMinutes'

export const RESTAURANTS_SELECT =
  `${RESTAURANT_COLUMNS}, ${HOURS_PROJECTION}, restaurant_photos(id, photo_url, thumb_url, sort_order), restaurant_locations(id, label, address, latitude, longitude, sort_order)`

export const ACTIVE_DISCOUNTS_SELECT =
  '*, products:discount_products(id, name, note, photo_url, thumb_url, sort_order), restaurant:restaurants(id, name, slug, city, address, cuisine_type, category, price_range, tagline, latitude, longitude, photos:restaurant_photos(id, photo_url, thumb_url, sort_order))'

// Stessa select di sempre dei banner (era `SELECT` in useAds.js).
export const ADS_SELECT = `
  *,
  restaurant:restaurants(id, name, slug, cuisine_type, category, price_range, address, tagline, hours_cache, photos:restaurant_photos(id, photo_url, thumb_url, sort_order)),
  discount:discounts(id, title, description, discount_type, discount_value, conditions, valid_until)
`.replace(/\s+/g, ' ').trim()

/**
 * Query string PostgREST per ciascuna risorsa. `nowIso` serve alle due che
 * filtrano per data (sconti non scaduti, banner nella loro finestra).
 */
export function publicQueryParams(resource, nowIso) {
  switch (resource) {
    case 'restaurants':
      return { table: 'restaurants', params: { select: RESTAURANTS_SELECT, is_published: 'eq.true', order: 'name.asc' } }
    case 'categories':
      return { table: 'categories', params: { select: '*', order: 'sort_order.asc' } }
    case 'discounts':
      return {
        table: 'discounts',
        params: {
          select: ACTIVE_DISCOUNTS_SELECT,
          is_active: 'eq.true',
          or: `(valid_until.is.null,valid_until.gt.${nowIso})`,
          order: 'created_at.desc',
        },
      }
    case 'ads':
      return {
        table: 'sponsored_placements',
        params: { select: ADS_SELECT, active: 'eq.true', start_at: `lte.${nowIso}`, end_at: `gt.${nowIso}` },
      }
    default:
      return null
  }
}

/**
 * Chiede la risorsa all'endpoint in cache. Lancia se l'endpoint non risponde
 * bene: il chiamante ripiega sulla query diretta a Supabase.
 */
export async function fetchPublic(resource, { timeoutMs = 8000 } = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const resp = await fetch(`/api/public?r=${encodeURIComponent(resource)}`, {
      signal: ctrl?.signal,
      headers: { Accept: 'application/json' },
    })
    if (!resp.ok) throw new Error(`/api/public ${resource}: ${resp.status}`)
    const data = await resp.json()
    if (!Array.isArray(data)) throw new Error(`/api/public ${resource}: risposta non valida`)
    return data
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Nel pannello admin serve il dato fresco appena salvato, non la copia in cache. */
export function isAdminPath() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
}
