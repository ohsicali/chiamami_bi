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
 * La didascalia dell'anteprima in lista: «Matcha latte e altri 4».
 *
 * Lo spazio è quello che è: nella riga del Bi Club, tolti foto, pastiglie e
 * bottone «Sblocca», al testo restano circa 130px — una ventina di caratteri
 * a corpo 10. Quindi si nominano tutti finché ci stanno, e appena la frase
 * sfora si passa al primo nome più il conteggio. Meglio «Matcha latte e altri
 * 4» per intero che «Matcha latte, Chai la…» tagliato a metà parola.
 */
const BUDGET = 26

export function productsSummary(items) {
  const named = (items || []).filter((p) => p.name).map((p) => p.name)
  if (named.length === 0) return null
  if (named.length === 1) return named[0]

  // Due prodotti: i nomi per esteso, se ci stanno.
  if (named.length === 2) {
    const both = named.join(', ')
    return both.length <= BUDGET ? both : `${named[0]} e un altro`
  }

  // Da tre in su i nomi non ci stanno mai tutti: il primo, e quanti altri.
  const rest = named.length - 1
  return `${named[0]} e altri ${rest}`
}
