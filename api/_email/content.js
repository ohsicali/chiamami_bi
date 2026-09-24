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

/**
 * Il vantaggio, ma solo se aggiunge qualcosa al valore già scritto grande.
 *
 * Il difetto che l'handoff v11 chiama "il drop dice lo sconto due volte":
 * il badge fa "−30%" e la riga sotto fa "30% di sconto", che non aggiunge
 * niente e diluisce la prima. Non è un problema di template ma di dati —
 * sul database metà dei titoli **sono** la percentuale e basta ("30% di
 * sconto", "20% di sconto"), e `pickPerk` giustamente li restituisce,
 * perché in una card del sito quella riga il posto ce l'ha.
 *
 * In un'email dove il numero è già il pezzo più grande, no: qui la riga si
 * tiene solo quando dice una cosa in più ("10% sulle bevande Matcha",
 * "1€ di sconto sui tramezzini"). Se è il valore ripetuto con del
 * riempimento intorno, sparisce — meglio una riga in meno che una riga che
 * ripete.
 */
export function perkBeyondValue(perk, value) {
  const t = String(perk || '').trim()
  if (!t) return ''
  const nudo = (s) => String(s || '')
    .toLowerCase()
    .replace(/^[−-]\s*/, '')
    // Il riempimento che sta fra il numero e il nulla.
    .replace(/\b(di|in|il|lo|la|uno|una)\s+(sconto|meno|omaggio)\b/g, '')
    .replace(/\b(sconto|omaggio)\b/g, '')
    .replace(/[^a-z0-9àèéìòù%€]/g, '')
  const resto = nudo(t)
  return resto && resto !== nudo(value) ? t : ''
}

/* ── Quando vale una convenzione ───────────────────────────────────── */

// In ordine di orologio, non di database: "a pranzo e a cena", mai il
// contrario. Le chiavi sono quelle di MEAL_SLOTS in src/lib/validity.js.
const PASTI = [
  ['colazione', 'a colazione'],
  ['brunch', 'al brunch'],
  ['pranzo', 'a pranzo'],
  ['aperitivo', 'all’aperitivo'],
  ['cena', 'a cena'],
]
const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
const NOMI_GIORNI = /lune|marte|merco|giove|vener|sabat|domen/i

const elenco = (voci) => (voci.length < 2 ? voci[0] || '' : `${voci.slice(0, -1).join(', ')} e ${voci.at(-1)}`)

/** "a pranzo e a cena", "solo a cena", "dalle 19:00 alle 23:00", o null. */
function fasciaWords({ slots, timeFrom, timeTo }) {
  // L'orario esplicito vince sulla fascia, come nell'app e nel PDF.
  if (timeFrom && timeTo) return `dalle ${String(timeFrom).slice(0, 5)} alle ${String(timeTo).slice(0, 5)}`
  const scelti = Array.isArray(slots) ? slots : []
  const pasti = PASTI.filter(([k]) => scelti.includes(k)).map(([, v]) => v)
  if (!pasti.length) return null
  return pasti.length === 1 ? `solo ${pasti[0]}` : elenco(pasti)
}

/** "dal lunedì al giovedì", "il mercoledì e il giovedì", o null se vale sempre. */
function giorniWords(days) {
  const d = [...new Set((Array.isArray(days) ? days : []).filter((n) => n >= 1 && n <= 7))].sort((a, b) => a - b)
  if (!d.length || d.length === 7) return null
  const filati = d.every((n, i) => i === 0 || n === d[i - 1] + 1)
  if (filati && d.length >= 3) return `dal ${GIORNI[d[0] - 1]} al ${GIORNI[d.at(-1) - 1]}`
  return elenco(d.map((n) => `il ${GIORNI[n - 1]}`))
}

/** "fino al 30 novembre", "fino al 1° novembre", "fino all’8 dicembre". */
function finoAl(until, now) {
  const fine = new Date(until)
  if (Number.isNaN(fine.getTime())) return null
  const parti = Object.fromEntries(new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', day: 'numeric', month: 'long', year: 'numeric',
  }).formatToParts(fine).map((x) => [x.type, x.value]))
  const annoOra = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', year: 'numeric' }).format(now)
  const giorno = parti.day === '1' ? '1°' : parti.day
  const prep = ['8', '11'].includes(parti.day) ? 'all’' : 'al '
  // Spazi non separabili: nel chip stretto "fino al 30 / novembre" andava
  // a capo spezzato; così la scadenza scende intera sulla seconda riga.
  return `fino ${prep}${giorno} ${parti.month}${parti.year !== annoOra ? ` ${parti.year}` : ''}`.replace(/ /g, '\u00A0')
}

/**
 * Quando vale una convenzione, detto come lo direbbe Bi: "Valido solo a
 * cena", "Valido a pranzo e a cena", "Valido dalle 19:00 alle 23:00".
 *
 * Prima il chip diceva "sempre valido" a tutte, e sotto una condizione
 * "valido solo il mercoledì e il giovedì" lo smentiva nella riga accanto —
 * Locanda Bellezia, che per giunta vale solo a cena. "Sempre" voleva dire
 * "non scade", ma si legge "a ogni ora": qui si dice la fascia vera, e la
 * scadenza a parte.
 *
 * I giorni entrano solo se le condizioni non li nominano già: sul database
 * quasi tutte li scrivono ("dal lunedì al giovedì"), e ripeterli nel chip
 * lo allunga senza dire niente di nuovo. Se non c'è nessuna fascia, il
 * chip dice "tutto il giorno" quando i giorni sono limitati (vale per
 * intero, ma solo in quei giorni) e "tutti i giorni" quando non lo sono.
 *
 * `until` è la scadenza vera (`valid_until`): la verifica al bancone la
 * rispetta, quindi "nessuna scadenza" si scrive solo quando non c'è.
 *
 * @returns {{ when: string, until: string|null }}
 */
export function conventionValidity({ days, slots, timeFrom, timeTo, until, conditions } = {}, now = new Date()) {
  const fascia = fasciaWords({ slots, timeFrom, timeTo })
  const giorni = giorniWords(days)
  const giorniDetti = giorni && NOMI_GIORNI.test(String(conditions || ''))
  const g = giorniDetti ? null : giorni

  let when
  if (fascia && g) when = `Valido ${fascia}, ${g}`
  else if (fascia) when = `Valido ${fascia}`
  else if (g) when = `Valido solo ${g}`
  else when = giorni ? 'Valido tutto il giorno' : 'Valido tutti i giorni'

  return { when, until: until ? finoAl(until, now) : null }
}
