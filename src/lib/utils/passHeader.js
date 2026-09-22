import { proxyImg } from '../supabase'

/**
 * Nome, riga sotto e miniatura per la testa del pass, dal locale che la
 * pagina ha già caricato. Le due schede (telefono e computer) la usano
 * uguale, così il pass dice le stesse cose che dice nel Bi Club.
 */
export function passHeaderFromRestaurant(restaurant) {
  if (!restaurant) return {}
  const cuisine = restaurant.cuisine_type
    || (Array.isArray(restaurant.category) ? restaurant.category[0] : null)
  const street = restaurant.address ? restaurant.address.split(',')[0].trim() : null
  const first = (restaurant.photos || [])[0]
  const raw = (typeof first === 'string' ? first : first?.photo_url || first?.url) || restaurant.image || null
  return {
    restaurantName: restaurant.name,
    restaurantSubtitle: [cuisine, street].filter(Boolean).join(' · '),
    photoUrl: raw ? proxyImg(raw, { w: 160 }) : null,
  }
}
