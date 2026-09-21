/**
 * Le regole di contenuto delle email.
 *
 * Tre delle quattro cose che in posta si vedevano più di tutto il resto —
 * il testo tagliato a metà parola, la fascia di prezzo stampata come numero
 * grezzo, l'indirizzo con il CAP e "Torino TO, Italy" in coda — non erano
 * un problema di disegno: erano tre formattazioni fatte al volo dentro i
 * template. Qui stanno in un posto solo, e dove il sito ha già la regola la
 * riusiamo invece di riscriverla (`formatAddress`, `formatPrice`): due copie
 * della stessa regola, prima o poi, divergono.
 */

export { formatAddress } from '../../src/lib/utils/formatAddress.js'
export { formatPrice } from '../../src/lib/utils/price.js'

import { formatAddress } from '../../src/lib/utils/formatAddress.js'
import { formatPrice } from '../../src/lib/utils/price.js'

/**
 * Il testo di Bi tagliato **su una frase intera**, mai a metà parola.
 *
 * Prima usciva "…paella (sempre di pesce, carne, verdu…" e "…Menzione
 * d'onore anche ai p…": tagliare a caso non fa sembrare il testo lungo, fa
 * sembrare il prodotto rotto. La regola è semplice e non ha eccezioni:
 * si prendono le frasi intere finché ci stanno, e se nemmeno la prima ci
 * sta si taglia sull'ultimo spazio con i puntini — che è l'unico caso in
 * cui i puntini compaiono, e non cadono comunque dentro una parola.
 *
 * @param {string} text
 * @param {number} [max]   quanti caratteri al massimo (default ~180)
 * @param {number} [frasi] quante frasi al massimo (default 2)
 */
export function clipSentences(text, max = 180, frasi = 2) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''

  // Il tetto sulle frasi vale anche quando il testo starebbe nei caratteri:
  // in un annuncio di Bi ne bastano due, la terza è già la recensione.
  const pezzi = t.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [t]
  if (pezzi.length <= frasi && t.length <= max) return t
  let out = ''
  for (const pezzo of pezzi.slice(0, frasi)) {
    const prova = (out + pezzo).trim()
    if (out && prova.length > max) break
    out = prova
    if (out.length >= max) break
  }
  out = out.trim()
  if (out && out.length <= max) return out

  // Nemmeno la prima frase ci sta: si taglia sull'ultimo spazio buono.
  const duro = t.slice(0, max)
  const spazio = duro.lastIndexOf(' ')
  return `${(spazio > 40 ? duro.slice(0, spazio) : duro).replace(/[\s,;:]+$/, '')}…`
}

/**
 * La riga sotto il titolo: "Spagnolo · €€ · Piazza Madama Cristina".
 *
 * La fascia di prezzo è un numero da 1 a 4 sul database e usciva così com'è
 * ("Spagnolo · 2 · Torino"): piccolo, ma è il genere di dettaglio che fa
 * "fatto in fretta". L'indirizzo passa da `formatAddress` — via e civico o
 * piazza, niente CAP, niente "Torino TO, Italy" — e la città resta solo
 * come ripiego, se un indirizzo non c'è.
 */
export function metaFor({ cuisine, priceRange, address, neighborhood, city }) {
  const luogo = formatAddress(address, neighborhood) || city || ''
  return [cuisine, priceSymbols(priceRange), luogo].filter(Boolean).join(' · ')
}

/**
 * La fascia di prezzo in simboli, da qualunque forma arrivi.
 *
 * Dal database è un numero da 1 a 4, ma un paio di chiamanti passano già i
 * simboli (`price_range` letto da una vista, o un campo compilato a mano):
 * un "€€€" ripassato da `formatPrice` diventa NaN e sparisce dalla riga,
 * che è un modo silenzioso di perdere un'informazione.
 */
export function priceSymbols(v) {
  const t = String(v ?? '').trim()
  if (/^€{1,4}$/.test(t)) return t
  return formatPrice(v)
}

/**
 * Il conto alla rovescia detto a parole: "3 giorni", "domani", "poche ore".
 *
 * Prima era "3g 2h", che è una sigla da cruscotto. In un'email si legge una
 * volta sola e di fretta: le parole si capiscono senza decodificare.
 */
export function countdownWords(endsAt, now = new Date()) {
  if (!endsAt) return null
  const ms = new Date(endsAt).getTime() - now.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null
  const ore = Math.floor(ms / 3_600_000)
  const giorni = Math.floor(ore / 24)
  if (giorni >= 2) return `${giorni} giorni`
  if (giorni === 1) return '1 giorno'
  if (ore >= 2) return `${ore} ore`
  return 'poche ore'
}
