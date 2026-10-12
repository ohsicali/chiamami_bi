/**
 * Drop coi giorni contati (12/10) — quanto tempo resta per usare un drop preso.
 *
 * Richiesta del proprietario: da adesso un drop ha N posti, e chi riesce a
 * prenderlo ha 7 giorni per usarlo, a partire dal tocco su "Sblocca sconto".
 * Passati i 7 giorni il codice non vale più e il posto va al primo della
 * lista d'attesa (chi ha trovato il drop esaurito e si è messo in lista).
 * I drop usciti prima restano senza limite.
 *
 * Il DB decide tutto (supabase/drop-claim-window-2026-10-12.sql):
 * `discounts.claim_window_days` (i giorni, NULL = nessun limite) e
 * `discount_redemptions.expires_at` (fin quando vale QUEL riscatto, scritto
 * dal trigger, mai dal browser). Qui ci sono solo i conti e le parole, uguali
 * per l'app (barra, countdown, «I miei vantaggi») e per le email
 * (api/_email/dropClaims.js). Sotto test in tests/drop-claims.test.mjs.
 */

import { discountEndsAt } from './discounts.js'

/** I giorni che il pannello propone per un drop nuovo. */
export const DEFAULT_CLAIM_WINDOW_DAYS = 7

const MIN = 60_000
const H = 60 * MIN
const DAY = 24 * H

function ms(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

/** È un drop coi giorni contati (i drop nuovi; i vecchi e le convenzioni no). */
export function hasClaimWindow(deal) {
  return !!deal?.is_drop && Number(deal?.claim_window_days) > 0
}

/** I giorni per usarlo, o null se non c'è limite. */
export function claimWindowDays(deal) {
  return hasClaimWindow(deal) ? Math.floor(Number(deal.claim_window_days)) : null
}

/**
 * Fin quando vale un riscatto: il suo `expires_at`, o la fine del drop se
 * arriva prima (un drop con una data di fine smette di valere per tutti a
 * quell'ora, anche per chi l'ha preso). null = nessun limite.
 */
export function claimDeadline(redemption, deal = redemption?.discount) {
  const exp = ms(redemption?.expires_at)
  if (exp === null) return null
  const end = discountEndsAt(deal)
  const t = end && end.getTime() < exp ? end.getTime() : exp
  return new Date(t)
}

/**
 * Scaduto per i giorni: il giro del DB l'ha già segnato `expired`, o è
 * ancora `generated` ma l'ora è passata (il giro passa ogni 10 minuti).
 */
export function isClaimExpired(redemption, now = new Date()) {
  if (!redemption) return false
  if (redemption.status === 'expired') return true
  if (redemption.status !== 'generated') return false
  const exp = ms(redemption.expires_at)
  return exp !== null && exp <= now.getTime()
}

/**
 * Il tempo che resta, pronto per barra e countdown.
 * `fraction` è la parte di tempo che resta (1 appena preso, 0 scaduto):
 * la barra si svuota man mano che passano i giorni.
 * null se il riscatto non ha limite.
 */
export function claimTimeLeft(redemption, deal = redemption?.discount, now = new Date()) {
  const deadline = claimDeadline(redemption, deal)
  if (!deadline) return null
  const left = Math.max(0, deadline.getTime() - now.getTime())
  const start = ms(redemption?.generated_at)
  const days = claimWindowDays(deal) || DEFAULT_CLAIM_WINDOW_DAYS
  const total = start !== null && deadline.getTime() > start
    ? Math.max(deadline.getTime() - start, MIN)
    : days * DAY
  const totS = Math.floor(left / 1000)
  return {
    deadline,
    ms: left,
    expired: left <= 0,
    fraction: Math.max(0, Math.min(1, left / total)),
    days: Math.floor(totS / 86400),
    hours: Math.floor((totS % 86400) / 3600),
    minutes: Math.floor((totS % 3600) / 60),
    seconds: totS % 60,
    urgency: claimUrgency(left),
  }
}

/** calm (più di 4 giorni) · soon (4 giorni o meno) · urgent (ultime 24 ore) · over. */
export function claimUrgency(leftMs) {
  if (!(leftMs > 0)) return 'over'
  if (leftMs <= DAY) return 'urgent'
  if (leftMs <= 4 * DAY) return 'soon'
  return 'calm'
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * Il tempo che resta detto a parole: "6 giorni e 4 ore", "1 giorno",
 * "23 ore", "45 minuti", "meno di un minuto". Per testi e aria-label.
 */
export function formatClaimLeft(leftMs) {
  if (!(leftMs > 0)) return null
  const totMin = Math.floor(leftMs / MIN)
  const d = Math.floor(totMin / 1440)
  const h = Math.floor((totMin % 1440) / 60)
  const m = totMin % 60
  if (d > 0) return h > 0 ? `${plural(d, 'giorno', 'giorni')} e ${plural(h, 'ora', 'ore')}` : plural(d, 'giorno', 'giorni')
  if (h > 0) return plural(h, 'ora', 'ore')
  if (m > 0) return plural(m, 'minuto', 'minuti')
  return 'meno di un minuto'
}

/** Il countdown compatto: "6g 04h", "23h 05m", "04m 12s". */
export function formatClaimLeftShort(leftMs) {
  if (!(leftMs > 0)) return null
  const totS = Math.floor(leftMs / 1000)
  const d = Math.floor(totS / 86400)
  const h = Math.floor((totS % 86400) / 3600)
  const m = Math.floor((totS % 3600) / 60)
  const s = totS % 60
  const p = (n) => String(n).padStart(2, '0')
  if (d > 0) return `${d}g ${p(h)}h`
  if (h > 0) return `${h}h ${p(m)}m`
  return `${p(m)}m ${p(s)}s`
}

/** "lunedì 19 ottobre alle 21:00", all'ora di Roma. */
export function formatClaimDeadline(deadline) {
  const t = deadline instanceof Date ? deadline : new Date(deadline)
  if (!deadline || Number.isNaN(t.getTime())) return null
  const parts = Object.fromEntries(new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(t).map((x) => [x.type, x.value]))
  return `${parts.weekday} ${parts.day} ${parts.month} alle ${parts.hour}:${parts.minute}`
}

/** "lun 19 ott, 21:00": la stessa data, corta, per le card. */
export function formatClaimDeadlineShort(deadline) {
  const t = deadline instanceof Date ? deadline : new Date(deadline)
  if (!deadline || Number.isNaN(t.getTime())) return null
  const parts = Object.fromEntries(new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(t).map((x) => [x.type, x.value]))
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`.replace(/\./g, '')
}

/**
 * I riscatti di una persona divisi come li mostra «I miei vantaggi»:
 * - `active`: da usare. In testa i drop coi giorni contati, il più vicino
 *   a scadere per primo (deciso il 12/10: "il drop va in cima, più in
 *   evidenza"); poi gli altri nell'ordine in cui arrivano (il più recente);
 * - `used`: già convalidati;
 * - `expired`: drop non usati in tempo, il più recente per primo.
 * Un riscatto senza sconto leggibile (una prova da cui si è stati tolti)
 * resta fuori.
 */
export function splitMyRedemptions(items, now = new Date()) {
  const list = (items || []).filter((r) => r && r.discount)
  const used = list.filter((r) => r.status === 'redeemed')
  const expired = list
    .filter((r) => isClaimExpired(r, now))
    .sort((a, b) => (ms(b.expires_at) || 0) - (ms(a.expires_at) || 0))
  const open = list.filter((r) => r.status === 'generated' && !isClaimExpired(r, now))
  const timed = open
    .filter((r) => claimDeadline(r))
    .sort((a, b) => claimDeadline(a).getTime() - claimDeadline(b).getTime())
  const rest = open.filter((r) => !claimDeadline(r))
  return { active: [...timed, ...rest], used, expired }
}
