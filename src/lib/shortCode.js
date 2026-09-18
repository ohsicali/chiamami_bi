/**
 * Il codice corto del riscatto — una lettera e cinque cifre, es. `K48213`.
 *
 * È il piano B del QR: quando la fotocamera non collabora (vetrina
 * controluce, schermo del cliente rotto, locale col tablet fisso alla cassa)
 * il cliente legge il codice ad alta voce e il ristoratore lo digita.
 *
 * Il codice lo genera il database (trigger `trg_redemption_short_code`), non
 * il client: qui stanno solo il formato e le funzioni per mostrarlo e per
 * ripulire quello che il ristoratore ha digitato. Le regole devono restare
 * identiche a quelle in `supabase/short-code-redemptions-2026-09-18.sql`.
 */

export const SHORT_CODE_LENGTH = 6

/** Lettere ammesse in prima posizione: l'alfabeto meno I e O, che a schermo
 *  e detti al telefono si confondono con 1 e 0. */
export const SHORT_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

const SHORT_CODE_RE = /^[A-HJ-NP-Z][0-9]{5}$/

/**
 * Da quello che è stato digitato o incollato al codice come sta nel DB:
 * maiuscolo, senza spazi né trattini. Ritorna una stringa anche parziale —
 * serve a normalizzare mentre si scrive, non solo a fine input.
 *
 * Non taglia a sei caratteri di proposito: spazi e minuscole sono rumore di
 * chi digita e si possono togliere, un carattere in più no. Tagliando,
 * `isShortCode('K482134')` direbbe di sì perché guarderebbe `K48213`, e ci
 * ritroveremmo a cercare nel DB un codice che nessuno ha mai dettato.
 */
export function normalizeShortCode(raw) {
  if (!raw) return ''
  return String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** True se la stringa è un codice completo e ben formato. */
export function isShortCode(raw) {
  return SHORT_CODE_RE.test(normalizeShortCode(raw))
}

/**
 * Il carattere in posizione `i` è valido? La prima è una lettera, le altre
 * cinque cifre. Usata dall'input a celle per scartare i tasti sbagliati
 * invece di far scrivere un codice che non potrà mai esistere.
 */
export function isValidShortCodeChar(char, index) {
  if (!char) return false
  const c = String(char).toUpperCase()
  return index === 0 ? SHORT_CODE_LETTERS.includes(c) : /^[0-9]$/.test(c)
}

/**
 * Il codice come si legge: `K48 213`. Lo spazio a metà è lì perché tre
 * caratteri per volta si tengono a mente mentre si attraversa la sala —
 * sei di fila no. Nel DB e nelle query resta senza spazio.
 */
export function formatShortCode(raw) {
  const c = normalizeShortCode(raw)
  if (c.length <= 3) return c
  return `${c.slice(0, 3)} ${c.slice(3)}`
}
