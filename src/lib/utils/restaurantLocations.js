/**
 * Un ristorante ha sempre una sede "principale" (address/latitude/longitude
 * sulla riga di `restaurants`, come sempre) più, per chi ha due locali, le
 * sedi extra in `restaurant.locations` (join su `restaurant_locations`).
 *
 * Normalizzato in un posto solo perché la scheda ristorante (mobile e
 * desktop) e l'admin devono concordare su cosa vuol dire "sede" — due copie
 * della stessa lista divergono al primo campo dimenticato.
 */
export function getAllLocations(restaurant) {
  if (!restaurant) return []
  const primary = {
    id: 'primary',
    label: restaurant.location_label || null,
    address: restaurant.address,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    google_maps_url: restaurant.google_maps_url || null,
  }
  const extra = Array.isArray(restaurant.locations) ? restaurant.locations : []
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

export function locationMapsUrl(location) {
  if (!location) return null
  if (location.google_maps_url) return location.google_maps_url
  if (!location.address) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`
}
