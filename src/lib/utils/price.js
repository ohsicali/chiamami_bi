// formatPrice — unica fonte di verità per il prezzo mostrato come simboli €.
//
// Prima era riscritto a mano in 8 file con tre guardie diverse, di cui una
// (`price_range || 2`) *inventava* un prezzo: i locali senza dato prezzo
// venivano mostrati come "€€". La UI non deve mai asserire un dato che il
// database non ha: qui, se il prezzo manca, si ritorna null e chi chiama
// semplicemente non lo rende.
//
// @param {number|string|null|undefined} priceRange  colonna restaurants.price_range (1-4)
// @returns {string|null} es. "€€€", oppure null se il dato manca
export function formatPrice(priceRange) {
  const n = Number(priceRange)
  if (!Number.isFinite(n) || n < 1) return null
  return '€'.repeat(Math.min(Math.trunc(n), 4))
}

export default formatPrice
