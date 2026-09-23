/**
 * Il codice corto del riscatto, lato server — una lettera e cinque cifre.
 *
 * Gemello di `src/lib/shortCode.js`: le funzioni serverless non importano
 * da `src/` (stesso motivo per cui esiste `api/_email/discount.js`), quindi
 * qui vive solo quel poco che serve a PDF ed email. Il formato vero è
 * quello del DB, in `supabase/short-code-redemptions-2026-09-18.sql`: se
 * cambia lì, va cambiato in tutti e tre i posti.
 */

/** Toglie spazi, trattini e minuscole. Non taglia a sei caratteri: vedi il
 *  commento in `src/lib/shortCode.js`. */
export function normalizeShortCode(raw) {
  if (!raw) return ''
  return String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** `K48213` → `K48 213`. Tre caratteri per volta si tengono a mente. */
export function formatShortCode(raw) {
  const c = normalizeShortCode(raw)
  if (c.length <= 3) return c
  return `${c.slice(0, 3)} ${c.slice(3)}`
}

/** True se è un codice completo e ben formato (stessa regola del CHECK nel
 *  DB e di `isShortCode` in `src/lib/shortCode.js`). */
export function isShortCode(raw) {
  return /^[A-HJ-NP-Z][0-9]{5}$/.test(normalizeShortCode(raw))
}
