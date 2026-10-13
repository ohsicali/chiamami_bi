/**
 * Un ristorante ha sempre una sede "principale" (address/latitude/longitude
 * sulla riga di `restaurants`, come sempre) più, per chi ha due locali, le
 * sedi extra in `restaurant.locations` (join su `restaurant_locations`).
 *
 * Normalizzato in un posto solo perché la scheda ristorante (mobile e
 * desktop), le regole dello sconto e l'admin devono concordare su cosa vuol
 * dire "sede" — due copie della stessa lista divergono al primo campo
 * dimenticato.
 */

/** Id della sede principale: non è una riga di `restaurant_locations`. */
export const PRIMARY_LOCATION_ID = 'primary'

export function getAllLocations(restaurant) {
  if (!restaurant) return []
  const primary = {
    id: PRIMARY_LOCATION_ID,
    label: restaurant.location_label || null,
    address: restaurant.address,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    google_maps_url: restaurant.google_maps_url || null,
  }
  // `locations` arriva da useRestaurants già ordinato; `restaurant_locations`
  // è la join grezza (sconti, pannello) e va ordinata qui.
  const extra = Array.isArray(restaurant.locations)
    ? restaurant.locations
    : Array.isArray(restaurant.restaurant_locations)
      ? [...restaurant.restaurant_locations].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      : []
  return [primary, ...extra]
}

export function hasMultipleLocations(restaurant) {
  return getAllLocations(restaurant).length > 1
}

/**
 * Nome da mostrare quando la sede non ne ha uno suo. Mai "Sede 1" — un
 * segnaposto numerato non è un nome, e la sede principale lo è ancora meno
 * essendo l'unica su un ristorante normale. Usato sia sulla scheda pubblica
 * sia come placeholder nel form admin, così il fallback resta uno solo.
 */
export function defaultLocationLabel(index) {
  return index === 0 ? 'Sede principale' : `Sede ${index + 1}`
}

export function locationName(location, index) {
  return String(location?.label || '').trim() || defaultLocationLabel(index)
}

/**
 * Il link che apre la sede in Google Maps. La principale ha di solito il
 * suo link del locale; per le altre si cerca "Nome del locale, indirizzo",
 * che su Maps porta alla scheda di quella sede e non solo a un punto sulla
 * via.
 */
export function locationMapsUrl(location, placeName) {
  if (!location) return null
  if (location.google_maps_url) return location.google_maps_url
  if (!location.address) return null
  const query = [String(placeName || '').trim(), location.address].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

const CAP = /\b\d{5}\b/
const NOISE = /\b(turin|italy|italia)\b/gi

/** Il comune dell'indirizzo di Google ("10098 Rivoli TO" → "Rivoli"), o null. */
export function locationTown(address) {
  const parts = String(address || '').split(',').map((s) => s.trim())
  const seg = parts.find((s) => CAP.test(s))
  if (!seg) return null
  const town = seg
    .replace(CAP, '')
    .replace(NOISE, '')
    .replace(/\s+[A-Z]{2}$/, '') // sigla della provincia
    .replace(/\s{2,}/g, ' ')
    .trim()
  return town || null
}

/**
 * Via e civico, più il comune quando non è la città del locale:
 *   "C.so Francia, 21/N, 10138 Torino TO"        → "C.so Francia 21/N"
 *   "Via Rita Levi Montalcini, 1/a, 10098 Rivoli TO" → "Via Rita Levi Montalcini 1/a · Rivoli"
 * `formatAddress` prende solo il primo pezzo e lì il civico si perdeva.
 */
export function locationStreet(address, city) {
  const parts = String(address || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return ''
  let street = parts[0].replace(CAP, '').replace(/\s{2,}/g, ' ').trim()
  if (parts[1] && /^\d+[\w/-]*(\s?[a-z])?$/i.test(parts[1])) street = `${street} ${parts[1]}`
  const town = locationTown(address)
  if (town && city && !sameTown(town, city)) return `${street} · ${town}`
  return street
}

function sameTown(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
}

/**
 * "a Torino" se tutte le sedi sono in città, "a Torino e dintorni" se una è
 * fuori (Taco Bang a Rivoli, Shoro a Poirino). Senza città, niente.
 */
export function locationsArea(locations, city) {
  if (!city) return ''
  const outside = (locations || []).some((l) => {
    const town = locationTown(l.address)
    return town && !sameTown(town, city)
  })
  return outside ? `a ${city} e dintorni` : `a ${city}`
}

/**
 * In quali sedi vale uno sconto. `discounts.valid_location_ids` è NULL (o
 * vuoto) quando vale in tutte — il caso di sempre — oppure la lista delle
 * sedi in cui vale: `'primary'` per la principale, l'id della riga di
 * `restaurant_locations` per le altre.
 *
 * Ritorna null quando non c'è niente da dire: locale con una sede sola, o
 * sedi scelte che non esistono più (meglio tacere che indicare la sede
 * sbagliata). Altrimenti `{ all, locations, every, total }`: le sedi in cui
 * vale e tutte le sedi, già col nome e l'indice di come sono in scheda.
 */
export function discountLocationScope(deal, restaurant) {
  const all = getAllLocations(restaurant).map((l, i) => ({ ...l, index: i, name: locationName(l, i) }))
  if (all.length < 2) return null
  const ids = Array.isArray(deal?.valid_location_ids) ? deal.valid_location_ids.map(String) : []
  const whole = { all: true, locations: all, every: all, total: all.length }
  if (ids.length === 0) return whole
  const chosen = all.filter((l) => ids.includes(String(l.id)))
  if (chosen.length === 0) return null
  if (chosen.length === all.length) return whole
  return { all: false, locations: chosen, every: all, total: all.length }
}

/** Frase corta per le righe piccole (QR, anteprima): "Vale solo a San Salvario". */
export function discountLocationLine(scope) {
  if (!scope) return ''
  if (scope.all) return `Vale in tutte le ${scope.total} sedi`
  const names = scope.locations.map((l) => l.name)
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
  return `Vale solo ${names.length === 1 ? 'nella sede' : 'nelle sedi'} ${list}`
}
