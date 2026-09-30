/**
 * I video di Bea su un locale, per il riquadro "Ho fatto un video" della
 * scheda (mobile e desktop).
 *
 * I link Instagram stanno in due colonne: `instagram_reel`, riempita dal
 * vecchio form, e `instagram_url`, che è il campo "Video Instagram" del
 * pannello rifatto — quello dove Bea li mette adesso. Fino al 30/09 la scheda
 * leggeva solo `instagram_reel`, e i reel messi dal pannello nuovo non si
 * vedevano. Vince `instagram_url` (è il campo che si modifica oggi), sennò il
 * vecchio `instagram_reel`. TikTok ha una colonna sola, `tiktok_url`.
 *
 * Un link che non è http(s) non si mostra: finisce in un `href`.
 */

function cleanUrl(value) {
  const url = String(value || '').trim()
  if (!url) return null
  const withScheme = /^https?:\/\//i.test(url) ? url : (/^(www\.)?[a-z0-9-]+\.[a-z]/i.test(url) ? `https://${url}` : null)
  if (!withScheme) return null
  try {
    const { protocol } = new URL(withScheme)
    return protocol === 'http:' || protocol === 'https:' ? withScheme : null
  } catch {
    return null
  }
}

/** @returns {{ instagram: string|null, tiktok: string|null }} */
export function restaurantVideos(restaurant) {
  if (!restaurant) return { instagram: null, tiktok: null }
  return {
    instagram: cleanUrl(restaurant.instagram_url) || cleanUrl(restaurant.instagram_reel),
    tiktok: cleanUrl(restaurant.tiktok_url),
  }
}

