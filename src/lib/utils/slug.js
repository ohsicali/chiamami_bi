// slugify — slug canonico per gli URL pubblici (/restaurant/:slug).
//
// Era riscritto in 10 file: 7 copie NON avevano guardia sul nome nullo e
// lanciavano un TypeError se `name` mancava. Qui la guardia c'è sempre.
//
// ⚠️ Usa la mappa esplicita degli accenti italiani e NON `normalize('NFD')`:
// gli slug già memorizzati in `restaurants.slug` sono stati generati così, e
// cambiare algoritmo produrrebbe URL diversi da quelli indicizzati.
// (L'admin — NewRestaurant / DettagliTab — usa di proposito una variante NFD
// con troncamento per *generare* lo slug da salvare: quella resta separata.)
//
// @param {string|null|undefined} name
// @param {string} [fallback='']  valore se il risultato è vuoto (es. 'sconto')
// @returns {string}
export function slugify(name, fallback = '') {
  const out = String(name ?? '')
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return out || fallback
}

export default slugify
