/**
 * Le email "com'è andata?" dopo uno sconto convalidato (29/09).
 *
 * Nell'app, appena il locale convalida, parte la festa e poi le stelle
 * (src/components/Feedback). Chi non arriva in fondo — chiude l'app sulle
 * stelle, o le dà e salta il modulo — riceve:
 *   1. un'email circa 30 minuti dopo la convalida;
 *   2. una circa un giorno dopo, se non ha ancora finito.
 * Chi ha mandato il modulo (`completed_at`) non riceve più niente. Chi ha
 * dato solo le stelle riceve la versione "raccontami di più", con le sue
 * stelle già accese.
 *
 * Il giro parte ogni 10 minuti da pg_cron (supabase/redemption-feedback-
 * cron-2026-09-29.sql → /api/notify-subscribers?job=feedback-asks): i cron
 * di Vercel sul piano Hobby partono una volta al giorno, troppo pochi per
 * "dopo mezz'ora".
 *
 * Regole che non si saltano, tutte in FEEDBACK_RULES e sotto test in
 * tests/feedback-asks.test.mjs — se le cambi, cambia il test:
 *   - due email al massimo per convalida, mai la stessa due volte (indice
 *     unico di `email_sent_log` su kind + ref_id);
 *   - di notte (23–8, ora di Roma) non parte niente: la prima aspetta il
 *     mattino, se è ancora nella sua finestra;
 *   - la prima non parte oltre `firstMaxAgeHours`: a quel punto tanto vale
 *     aspettare la seconda, che dice "ieri";
 *   - una persona con due convalide lo stesso giorno riceve un'email per
 *     giro, per la più recente;
 *   - parte solo a chi ha acceso "I miei sconti" (`my_discounts`), come i
 *     promemoria: non è una ricevuta, è una domanda nostra.
 */

import { feedbackAskEmail } from './templates.js'
import { buildMessage, sendBatch, unsubscribeUrl, BATCH_SIZE } from './send.js'
import { formatDiscountBadge } from './discount.js'
import { SITE_URL } from './theme.js'

export const FEEDBACK_KINDS = { first: 'feedback-ask-1', second: 'feedback-ask-2' }

export const FEEDBACK_RULES = {
  /** La prima email, minuti dopo la convalida. */
  firstAfterMinutes: 30,
  /** Oltre, la prima non parte più (ci pensa la seconda). */
  firstMaxAgeHours: 12,
  /** La seconda, ore dopo la convalida. */
  secondAfterHours: 24,
  /** Oltre, niente più email: la cena è lontana. */
  secondMaxAgeHours: 72,
  /** Fra la prima e la seconda almeno tante ore. */
  minGapHours: 12,
  /** Di notte non si scrive: dalle 23 alle 8, ora di Roma. */
  quietFromHour: 23,
  quietToHour: 8,
  /** Tetto di sicurezza per un giro solo. */
  maxPerRun: 300,
}

const MIN = 60_000
const H = 60 * MIN

/** L'ora a Roma, 0–23. */
export function romeHour(now = new Date()) {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(now)
  return Number.parseInt(h, 10) % 24
}

export function isQuietHour(now = new Date(), rules = FEEDBACK_RULES) {
  const h = romeHour(now)
  return rules.quietFromHour > rules.quietToHour
    ? h >= rules.quietFromHour || h < rules.quietToHour
    : h >= rules.quietFromHour && h < rules.quietToHour
}

/**
 * Chi riceve cosa, in questo giro. Pura: niente DB, niente rete.
 *
 * @param {object} input
 * @param {Array}  input.rows        righe di redemption_feedback non finite
 *                                   ({ redemption_id, user_id, redeemed_at, rating, completed_at })
 * @param {Map}    input.sent        redemption_id → { [kind]: sent_at ISO }
 * @param {Map}    input.recipients  user_id → { email, name, token } (solo chi ha my_discounts acceso)
 * @param {Date}   [input.now]
 * @returns {Array<{ row, round: 1|2, recipient, kind }>}
 */
export function planFeedbackAsks({ rows = [], sent = new Map(), recipients = new Map(), now = new Date(), rules = FEEDBACK_RULES }) {
  if (isQuietHour(now, rules)) return []
  const t = now.getTime()
  const perUser = new Map()

  for (const row of rows) {
    if (!row || row.completed_at) continue
    const recipient = recipients.get(row.user_id)
    if (!recipient?.email) continue
    const at = Date.parse(row.redeemed_at ?? '')
    if (!Number.isFinite(at)) continue
    const age = t - at
    const log = sent.get(row.redemption_id) || {}
    const firstAt = log[FEEDBACK_KINDS.first] ? Date.parse(log[FEEDBACK_KINDS.first]) : null

    let round = null
    if (!log[FEEDBACK_KINDS.second]
        && age >= rules.secondAfterHours * H
        && age <= rules.secondMaxAgeHours * H
        && (!firstAt || t - firstAt >= rules.minGapHours * H)) {
      round = 2
    } else if (!firstAt
        && !log[FEEDBACK_KINDS.second]
        && age >= rules.firstAfterMinutes * MIN
        && age <= rules.firstMaxAgeHours * H) {
      round = 1
    }
    if (!round) continue

    // Una per persona a giro: la convalida più recente.
    const cur = perUser.get(row.user_id)
    if (!cur || Date.parse(cur.row.redeemed_at) < at) {
      perUser.set(row.user_id, { row, round, recipient, kind: round === 1 ? FEEDBACK_KINDS.first : FEEDBACK_KINDS.second })
    }
  }

  return [...perUser.values()]
    .sort((a, b) => Date.parse(a.row.redeemed_at) - Date.parse(b.row.redeemed_at))
    .slice(0, rules.maxPerRun)
}

/** Il link della pagina di feedback, con le stelle già scelte o no. */
export function feedbackUrl(token, stars = null) {
  const base = `${SITE_URL}/feedback?t=${encodeURIComponent(token)}`
  return stars ? `${base}&stelle=${stars}` : base
}

/** Da una voce del piano ai campi dell'email. */
export function feedbackAskProps(item, { unsubUrl = null } = {}) {
  const row = item.row
  const firstName = String(item.recipient?.name || '').trim().split(/\s+/)[0] || ''
  return {
    name: firstName,
    restaurantName: row.restaurant?.name || 'il locale',
    value: row.discount ? formatDiscountBadge(row.discount) : '',
    rating: row.rating ?? null,
    round: item.round,
    city: row.restaurant?.city,
    starHref: (n) => feedbackUrl(row.token, n),
    formHref: feedbackUrl(row.token),
    unsubscribeUrl: unsubUrl,
  }
}

const ROW_FIELDS = 'redemption_id, user_id, token, redeemed_at, rating, completed_at, restaurant:restaurants(name, city), discount:discounts(discount_type, discount_value, title)'

/** Legge dal DB quello che serve a `planFeedbackAsks`. */
export async function loadFeedbackInput(admin, now = new Date()) {
  const from = new Date(now.getTime() - FEEDBACK_RULES.secondMaxAgeHours * H).toISOString()
  const to = new Date(now.getTime() - FEEDBACK_RULES.firstAfterMinutes * MIN).toISOString()
  const { data: rows, error } = await admin
    .from('redemption_feedback')
    .select(ROW_FIELDS)
    .is('completed_at', null)
    .gte('redeemed_at', from)
    .lte('redeemed_at', to)
    .order('redeemed_at', { ascending: true })
    .limit(2000)
  if (error) throw new Error(`Lettura feedback fallita: ${error.message}`)
  if (!rows?.length) return { rows: [], sent: new Map(), recipients: new Map() }

  const ids = rows.map((r) => r.redemption_id)
  const userIds = [...new Set(rows.map((r) => r.user_id))]

  const sent = new Map()
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await admin
      .from('email_sent_log')
      .select('ref_id, kind, sent_at')
      .in('kind', Object.values(FEEDBACK_KINDS))
      .eq('ok', true)
      .in('ref_id', ids.slice(i, i + 150))
    for (const l of data || []) {
      const cur = sent.get(l.ref_id) || {}
      cur[l.kind] = l.sent_at
      sent.set(l.ref_id, cur)
    }
  }

  const recipients = new Map()
  for (let i = 0; i < userIds.length; i += 150) {
    const { data } = await admin
      .from('email_preferences')
      .select('user_id, unsubscribe_token, profiles!inner(email, full_name)')
      .eq('my_discounts', true)
      .in('user_id', userIds.slice(i, i + 150))
    for (const p of data || []) {
      const email = p?.profiles?.email?.trim().toLowerCase()
      if (email) recipients.set(p.user_id, { email, name: p.profiles.full_name || '', token: p.unsubscribe_token })
    }
  }

  return { rows, sent, recipients }
}

/**
 * Il giro: legge, decide, prenota la riga nel registro, spedisce.
 * Stessa prudenza dei promemoria: la riga in `email_sent_log` si scrive
 * prima dell'invio (due giri insieme non mandano due volte), e se Resend
 * rifiuta torna `ok = false` così il giro dopo ci riprova.
 */
export async function runFeedbackAsks(admin, { dryRun = false, now = new Date(), send } = {}) {
  const input = await loadFeedbackInput(admin, now)
  const plan = planFeedbackAsks({ ...input, now })
  const summary = {
    open: input.rows.length,
    planned: plan.length,
    quiet: isQuietHour(now),
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }
  if (dryRun) {
    summary.preview = plan.slice(0, 20).map((p) => ({
      restaurant: p.row.restaurant?.name,
      round: p.round,
      rated: p.row.rating != null,
      redeemedAt: p.row.redeemed_at,
    }))
    return summary
  }

  const queue = []
  for (const item of plan) {
    const { error } = await admin.from('email_sent_log').insert({
      user_id: item.row.user_id, kind: item.kind, ref_id: item.row.redemption_id,
      to_email: item.recipient.email, ok: true,
    })
    if (error) {
      if (error.code !== '23505') summary.errors.push(error.message)
      summary.skipped += 1
      continue
    }
    const mail = feedbackAskEmail(feedbackAskProps(item, { unsubUrl: unsubscribeUrl(item.recipient.token) }))
    queue.push({ item, message: buildMessage({ to: item.recipient.email, token: item.recipient.token, ...mail }) })
  }

  const sendChunk = send || sendBatch
  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const chunk = queue.slice(i, i + BATCH_SIZE)
    if (i > 0) await new Promise((ok) => setTimeout(ok, 500))
    const r = await sendChunk(chunk.map((q) => q.message))
    if (r.sent === chunk.length) {
      summary.sent += chunk.length
      continue
    }
    summary.failed += chunk.length
    summary.errors.push(...(r.errors || []))
    const error = String((r.errors || [])[0] || 'invio fallito').slice(0, 400)
    for (const kind of Object.values(FEEDBACK_KINDS)) {
      const refs = chunk.filter((q) => q.item.kind === kind).map((q) => q.item.row.redemption_id)
      if (!refs.length) continue
      await admin.from('email_sent_log').update({ ok: false, error })
        .eq('kind', kind).in('ref_id', refs).then(() => {}, () => {})
    }
  }
  return summary
}
