/**
 * I prodotti di uno sconto, normalizzati — un solo posto.
 *
 * La stessa lista serve in tre punti con tre esigenze diverse: la scheda
 * dello sconto (foto grandi con nome e nota), la riga in lista del Bi Club
 * (tre pastiglie e una didascalia) e il banner sulla scheda del locale. Se
 * ognuno riordinasse e filtrasse per conto suo, basterebbe un `sort_order`
 * dimenticato in un punto perché lo stesso sconto mostri le foto in due
 * ordini diversi a due schermate di distanza.
 */

/**
 * Ordina per `sort_order`, scarta le righe senza niente da mostrare e
 * appiattisce i due campi foto in uno.
 *
 * @param {Array|null|undefined} products righe `discount_products` dal DB
 * @returns {Array<{key: string, name: string, note: string, photo: string|null}>}
 */
export function normalizeProducts(products) {
  if (!Array.isArray(products)) return []
  return products
    .filter((p) => p && (p.name || p.photo_url || p.thumb_url))
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((p, i) => ({
      key: p.id || `${p.name}-${i}`,
      name: p.name || '',
      note: p.note || '',
      // La thumb basta per le tessere piccole, ma la foto piena è l'unica che
      // regge la tessera singola a tutta larghezza: si prende quella che c'è
      // e ci pensa il proxy (`proxyImg`) a ridurla alla misura giusta.
      photo: p.photo_url || p.thumb_url || null,
    }))
}

/**
 * La didascalia dell'anteprima in lista: «Matcha latte, chai e altri 3».
 *
 * Due nomi e basta, perché la riga della card è alta 21px e il terzo nome
 * andrebbe a capo spingendo giù tutta la lista. Il resto diventa un conteggio.
 */
export function productsSummary(items, maxNames = 2) {
  const named = items.filter((p) => p.name)
  if (named.length === 0) return null
  const shown = named.slice(0, maxNames).map((p) => p.name)
  const rest = named.length - shown.length
  if (rest <= 0) return shown.join(', ')
  return `${shown.join(', ')} e ${rest === 1 ? 'un altro' : `altri ${rest}`}`
}
