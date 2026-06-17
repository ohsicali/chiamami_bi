// formatAddress — rende leggibile l'indirizzo grezzo di Google (Blocco A3).
//
//   "Via Bonafous 7, 10123 Torino Turin, Italy"  →  "Via Bonafous 7 · Vanchiglia"
//
// Regole (dall'handoff PR24): prende via + civico (primo segmento), rimuove
// il CAP e i ridondanti "Turin/Italy/Italia/Province of…", e appende il
// quartiere se disponibile. L'indirizzo completo resta SOLO nel link
// "Indicazioni" (la mappa usa lat/lng o la stringa raw, non questo output).

const REDUNDANT = /\b(turin|italy|italia|province of [a-zà-ù'\s]+|citt[àa] metropolitana di [a-zà-ù'\s]+)\b/gi
const CAP = /\b\d{5}\b/g

function cleanSegment(s = '') {
  return String(s)
    .replace(CAP, '')
    .replace(REDUNDANT, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*$/, '')
    .trim()
}

/**
 * @param {string} rawAddress  formatted_address di Google
 * @param {string} [neighborhood]  quartiere (colonna `neighborhood`)
 * @returns {string} es. "Via Bonafous 7 · Vanchiglia"
 */
export function formatAddress(rawAddress, neighborhood) {
  const zone = (neighborhood || '').trim()
  if (!rawAddress) return zone
  const street = cleanSegment(String(rawAddress).split(',')[0])
  return [street, zone].filter(Boolean).join(' · ')
}

export default formatAddress
