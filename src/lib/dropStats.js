/**
 * I numeri di un drop per chi lo gestisce (12/10): il locale in /verify e
 * l'admin nel pannello sconti. Quante persone l'hanno preso, quante l'hanno
 * già usato, quante devono ancora usarlo, quante l'hanno perso perché non
 * l'hanno usato in tempo e quante aspettano in lista.
 *
 * Il locale li riceve già contati dal DB (`verify_drops_overview`, SQL
 * supabase/verify-drops-overview-2026-10-12.sql: dal browser non può
 * leggere i riscatti degli altri); l'admin li conta dalle righe che ha già
 * in memoria per i contatori dal vivo (`dropPeopleFromRows`). Le parole
 * stanno qui, così il locale e l'admin leggono la stessa cosa.
 *
 * Sotto test in tests/drop-claims.test.mjs.
 */

import { maxQuantity } from './discounts.js'
import { formatClaimDeadline } from './dropClaim.js'

const n = (v) => Math.max(0, Number(v) || 0)

/**
 * Dai numeri grezzi (una riga di `verify_drops_overview`, o quella costruita
 * da `dropPeopleFromRows`) a quello che si mostra.
 *
 * `taken` sono i posti occupati adesso (usati + ancora da usare): è su quelli
 * che il drop è esaurito. Chi l'ha perso ha lasciato il posto libero.
 */
export function dropPeopleSummary(item) {
  if (!item) return null
  const total = n(item.total) || null
  const used = n(item.used)
  const toUse = n(item.to_use)
  const lost = n(item.lost)
  const taken = item.taken != null ? n(item.taken) : used + toUse
  const waiting = n(item.waiting)
  const fromWaitlist = n(item.from_waitlist)
  const days = n(item.claim_window_days) || null
  const soldOut = !!total && taken >= total
  const free = total ? Math.max(0, total - taken) : null
  const pct = total ? Math.min(100, Math.round((taken / total) * 100)) : null
  return {
    total, taken, used, toUse, lost, waiting, fromWaitlist, days, soldOut, free, pct,
    windowed: !!days,
    nextExpiry: item.next_expiry || null,
  }
}

/**
 * Le righe sotto i numeri: come funziona e cosa succede adesso.
 * @returns {string[]}
 */
export function dropPeopleNotes(s) {
  if (!s) return []
  const out = []
  if (s.windowed) {
    out.push(`Chi lo prende ha ${s.days} ${s.days === 1 ? 'giorno' : 'giorni'} per usarlo. Se non lo usa, il posto passa al primo della lista d’attesa.`)
    if (s.nextExpiry && s.toUse > 0) {
      out.push(`Se non viene usato, il primo posto si libera ${formatClaimDeadline(s.nextExpiry)}.`)
    }
    if (s.fromWaitlist > 0) {
      out.push(s.fromWaitlist === 1
        ? '1 posto è già passato a chi era in lista.'
        : `${s.fromWaitlist} posti sono già passati a chi era in lista.`)
    }
  }
  return out
}

/**
 * Per l'admin: i numeri di un drop dalle righe dei riscatti che il pannello
 * ha già (useAdminRedemptions) e dalla lista d'attesa (`drop_waitlist`).
 * Restituisce la stessa forma di una riga di `verify_drops_overview`.
 *
 * @param {object} deal          la riga dello sconto
 * @param {Iterable<object>} rows i riscatti di QUESTO sconto (status, expires_at)
 * @param {{ waiting?: number, promoted?: number }} [wait]
 */
export function dropPeopleFromRows(deal, rows, wait = null, now = new Date()) {
  const t = now.getTime()
  let claims = 0
  let used = 0
  let toUse = 0
  let lost = 0
  let next = null
  for (const r of rows || []) {
    claims += 1
    const exp = r.expires_at ? new Date(r.expires_at).getTime() : null
    if (r.status === 'redeemed') used += 1
    else if (r.status === 'expired' || (r.status === 'generated' && exp != null && exp <= t)) lost += 1
    else if (r.status === 'generated') {
      toUse += 1
      if (exp != null && (next == null || exp < next)) next = exp
    }
  }
  return {
    id: deal?.id,
    total: maxQuantity(deal) || null,
    claim_window_days: deal?.claim_window_days || null,
    claims,
    used,
    to_use: toUse,
    lost,
    taken: used + toUse,
    waiting: n(wait?.waiting),
    from_waitlist: n(wait?.promoted),
    next_expiry: next != null ? new Date(next).toISOString() : null,
  }
}
