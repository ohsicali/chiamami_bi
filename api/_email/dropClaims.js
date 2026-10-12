/**
 * Le email del drop coi giorni contati (12/10).
 *
 * Un drop nuovo ha N posti e chi lo prende ha 7 giorni per usarlo
 * (src/lib/dropClaim.js, supabase/drop-claim-window-2026-10-12.sql). Il
 * proprietario ha chiesto che la persona lo sappia anche per email, a ogni
 * tappa:
 *
 *   start    appena preso: "hai 7 giorni, fino a lunedì alle 21". Chi lo
 *            sblocca dal Bi Club ha già la ricevuta col codice, che lo dice
 *            (`discount-claimed`): a lui non si manda un'altra email. La
 *            ricevono chi lo prende da un'altra pagina e chi ha avuto il
 *            posto dalla lista d'attesa ("si è liberato un posto, è tuo");
 *   left4    quando restano 4 giorni;
 *   left2    quando restano 2 giorni;
 *   left1    quando restano 24 ore;
 *   expired  passati i giorni senza usarlo: "l'hai perso, il posto è
 *            passato a chi era in lista".
 *
 * Regole, tutte in DROP_CLAIM_RULES e sotto test (tests/drop-claims.test.mjs)
 * — se le cambi, cambia il test:
 *   - ogni tappa una volta sola per riscatto (indice unico di
 *     `email_sent_log` su kind + ref_id), e mai una tappa dopo una più
 *     avanti: se il giro si è fermato e sono già "2 giorni", il "4 giorni"
 *     non parte più;
 *   - una tappa che cade a meno di `minHoursAfterClaim` dallo sblocco si
 *     salta (con un drop da 2 giorni il "ti restano 2 giorni" arriverebbe
 *     insieme al "hai 2 giorni"): ci pensa l'email di partenza;
 *   - niente promemoria per un drop spento, finito o di un locale non
 *     pubblicato; niente "l'hai perso" se a chiudere è stata la fine del
 *     drop e non i suoi giorni;
 *   - di notte (23–8, Roma) non parte niente, tranne la partenza di chi ha
 *     appena sbloccato (è lì col telefono in mano). Il posto arrivato dalla
 *     lista alle 3 di notte si annuncia alle 8;
 *   - la partenza e il posto dalla lista sono ricevute: partono a tutti.
 *     I promemoria e il "perso" solo a chi ha "I miei sconti" acceso
 *     (`my_discounts`), come gli altri promemoria;
 *   - una email per persona a giro (la più urgente); le altre al giro dopo,
 *     dieci minuti più tardi.
 *
 * Il giro: pg_cron ogni 10 minuti (supabase/drop-claims-cron-2026-10-12.sql)
 * → GET /api/notify-subscribers?job=drop-claims. Prima delle email rilancia
 * `drop_claims_tick()` (scadenze e posti a chi è in lista), così chi ha
 * avuto il posto riceve l'email nello stesso giro.
 */

import { discountEndsAt } from '../../src/lib/discounts.js'
import {
  DEFAULT_CLAIM_WINDOW_DAYS, claimDeadline, claimWindowDays, formatClaimDeadline, formatClaimLeft,
} from '../../src/lib/dropClaim.js'
import { dropClaimEmail } from './templates.js'
import { buildMessage, sendBatch, unsubscribeUrl, BATCH_SIZE } from './send.js'
import { formatDiscountBadge, pickPerk } from './discount.js'
import { formatShortCode } from '../_short-code.js'
import { isQuietHour } from './feedback.js'
import { stillUsable } from './reminders.js'
import { SITE_URL } from './theme.js'

export const DROP_CLAIM_KINDS = {
  start: 'drop-claim-start',
  left4: 'drop-claim-4d',
  left2: 'drop-claim-2d',
  left1: 'drop-claim-1d',
  expired: 'drop-claim-expired',
}

/** L'ordine delle tappe: una tappa non parte se ne è già partita una dopo. */
export const STAGE_ORDER = ['start', 'left4', 'left2', 'left1', 'expired']

/** La ricevuta col codice mandata dal Bi Club allo sblocco (send-email.js). */
export const RECEIPT_KIND = 'discount-claimed'

export const DROP_CLAIM_RULES = {
  /** La partenza aspetta un po': la ricevuta del Bi Club parte subito e la sostituisce. */
  startAfterMinutes: 3,
  /** Oltre, la partenza non si manda più: arriverebbe fuori tempo. */
  startMaxAgeHours: 24,
  /** Le tappe: ore che restano. */
  left4Hours: 96,
  left2Hours: 48,
  left1Hours: 24,
  /** Una tappa che cade prima di tante ore dallo sblocco si salta. */
  minHoursAfterClaim: 12,
  /** Il "l'hai perso" parte entro tante ore dalla scadenza, non oltre. */
  expiredMaxAgeHours: 72,
  /** Di notte niente: dalle 23 alle 8, ora di Roma (come le email di feedback). */
  quietFromHour: 23,
  quietToHour: 8,
  /** Tetto di sicurezza per un giro solo. */
  maxPerRun: 300,
}

const MIN = 60_000
const H = 60 * MIN

function ms(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

/**
 * La tappa che tocca adesso a un riscatto, senza guardare cosa è già
 * partito (quello lo fa `planDropClaimEmails`). Pura.
 *
 * @param {object} row  riscatto con `status`, `generated_at`, `expires_at`,
 *                      `discount` (e `discount.restaurant`)
 * @returns {'start'|'left4'|'left2'|'left1'|'expired'|null}
 */
export function dueStage(row, now = new Date(), rules = DROP_CLAIM_RULES) {
  if (!row || row.status === 'redeemed') return null
  const exp = ms(row.expires_at)
  const gen = ms(row.generated_at)
  if (exp === null || gen === null) return null
  const t = now.getTime()
  const d = row.discount || null

  if (exp <= t) {
    // Scaduto per i suoi giorni. Se il drop era già finito prima, a
    // chiudere è stata la fine del drop: "non l'hai usato in 7 giorni"
    // sarebbe falso.
    const end = discountEndsAt(d)
    if (end && end.getTime() < exp) return null
    if (t - exp > rules.expiredMaxAgeHours * H) return null
    return 'expired'
  }
  if (row.status !== 'generated') return null
  if (!stillUsable(d, now)) return null

  const deadline = claimDeadline(row, d)
  if (!deadline) return null
  const left = deadline.getTime() - t
  const stages = [['left1', rules.left1Hours], ['left2', rules.left2Hours], ['left4', rules.left4Hours]]
  for (const [stage, hours] of stages) {
    if (left > hours * H) continue
    // È l'ora di questa tappa. Se cade troppo vicino allo sblocco la
    // partenza l'ha già detto (e le tappe prima cadono ancora prima).
    const at = deadline.getTime() - hours * H
    if (at - gen >= rules.minHoursAfterClaim * H) return stage
    break
  }
  const age = t - gen
  if (age >= rules.startAfterMinutes * MIN && age <= rules.startMaxAgeHours * H) return 'start'
  return null
}

/**
 * Chi riceve cosa, in questo giro. Pura: niente DB, niente rete.
 *
 * @param {object} input
 * @param {Array}  input.rows        riscatti con `expires_at` (status generated/expired),
 *                                   `discount` e `discount.restaurant` uniti
 * @param {Map}    input.sent        redemption_id → Set delle tappe già partite
 * @param {Set}    input.receipts    redemption_id che hanno avuto la ricevuta del Bi Club
 * @param {Set}    input.promoted    redemption_id arrivati dalla lista d'attesa
 * @param {Map}    input.recipients  user_id → { email, name, token, myDiscounts }
 * @returns {Array<{ row, stage, kind, recipient, promoted }>}
 */
export function planDropClaimEmails({
  rows = [], sent = new Map(), receipts = new Set(), promoted = new Set(),
  recipients = new Map(), now = new Date(), rules = DROP_CLAIM_RULES,
}) {
  const quiet = isQuietHour(now, rules)
  const perUser = new Map()
  for (const row of rows) {
    const stage = dueStage(row, now, rules)
    if (!stage) continue
    const fromList = promoted.has(row.id)
    const already = sent.get(row.id) || new Set()
    const idx = STAGE_ORDER.indexOf(stage)
    if (STAGE_ORDER.slice(idx).some((s) => already.has(s))) continue
    // La ricevuta col codice ha già detto "hai 7 giorni".
    if (stage === 'start' && !fromList && receipts.has(row.id)) continue
    if (quiet && !(stage === 'start' && !fromList)) continue
    const recipient = recipients.get(row.user_id)
    if (!recipient?.email) continue
    if (stage !== 'start' && !recipient.myDiscounts) continue

    const item = { row, stage, kind: DROP_CLAIM_KINDS[stage], recipient, promoted: fromList }
    const cur = perUser.get(row.user_id)
    // Una per persona a giro: la tappa più avanti, poi la scadenza più vicina.
    if (!cur
      || STAGE_ORDER.indexOf(cur.stage) < idx
      || (STAGE_ORDER.indexOf(cur.stage) === idx && ms(row.expires_at) < ms(cur.row.expires_at))) {
      perUser.set(row.user_id, item)
    }
  }
  return [...perUser.values()]
    .sort((a, b) => (ms(a.row.expires_at) || 0) - (ms(b.row.expires_at) || 0))
    .slice(0, rules.maxPerRun)
}

/** Da una voce del piano ai campi dell'email. */
export function dropClaimProps(item, { photo = null, unsubUrl = null, passedOn = false, now = new Date() } = {}) {
  const row = item.row
  const d = row.discount || {}
  const r = d.restaurant || {}
  const deadline = claimDeadline(row, d)
  const gen = ms(row.generated_at)
  const exp = ms(row.expires_at)
  const windowDays = claimWindowDays(d)
    || (gen !== null && exp !== null ? Math.max(1, Math.round((exp - gen) / (24 * H))) : DEFAULT_CLAIM_WINDOW_DAYS)
  const left = deadline ? deadline.getTime() - now.getTime() : 0
  const total = deadline && gen !== null ? Math.max(deadline.getTime() - gen, MIN) : windowDays * 24 * H
  const firstName = String(item.recipient?.name || '').trim().split(/\s+/)[0] || ''
  return {
    stage: item.stage,
    promoted: !!item.promoted,
    passedOn,
    name: firstName && !firstName.includes('@') ? firstName : '',
    value: formatDiscountBadge(d),
    restaurantName: r.name || 'il locale',
    perk: pickPerk(d),
    conditions: (d.conditions || '').trim() || null,
    cuisine: r.cuisine_type,
    city: r.city,
    photos: photo ? [photo] : [],
    windowDays,
    // In partenza "7 giorni" tondo; dopo, il tempo vero ("1 giorno e 20 ore").
    leftWords: item.stage === 'start' ? null : formatClaimLeft(left),
    deadline: deadline ? formatClaimDeadline(deadline) : null,
    pct: Math.round(Math.max(0, Math.min(1, left / total)) * 100),
    code: row.short_code ? formatShortCode(row.short_code) : null,
    href: `${SITE_URL}/sconti?tab=miei&open=${encodeURIComponent(row.discount_id)}`,
    othersHref: `${SITE_URL}/sconti`,
    unsubscribeUrl: unsubUrl,
  }
}

/* ------------------------------------------------------------------ */
/*  Dal DB all'email                                                   */
/* ------------------------------------------------------------------ */

const RESTAURANT_FIELDS = 'id, name, slug, address, neighborhood, city, cuisine_type, is_published'

async function inChunks(ids, fn, size = 150) {
  const out = []
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await fn(ids.slice(i, i + size))
    if (error) throw new Error(error.message)
    out.push(...(data || []))
  }
  return out
}

/** Legge dal DB tutto quello che serve a `planDropClaimEmails`. */
export async function loadDropClaimInput(admin, now = new Date()) {
  const since = new Date(now.getTime() - DROP_CLAIM_RULES.expiredMaxAgeHours * H).toISOString()
  // `*` e non l'elenco delle colonne: `expires_at` esiste solo dopo
  // drop-claim-window-2026-10-12.sql, e un elenco esplicito farebbe
  // fallire il giro intero prima di quell'SQL.
  const { data: rows, error } = await admin
    .from('discount_redemptions')
    .select(`*, discount:discounts(*, restaurant:restaurants(${RESTAURANT_FIELDS}))`)
    .not('expires_at', 'is', null)
    .in('status', ['generated', 'expired'])
    .gte('expires_at', since)
    .order('expires_at', { ascending: true })
    .limit(3000)
  if (error) throw new Error(`Lettura riscatti fallita: ${error.message}`)
  const list = (rows || []).filter((r) => r.discount)
  if (!list.length) return { rows: [] }

  const ids = list.map((r) => r.id)
  const kinds = [...Object.values(DROP_CLAIM_KINDS), RECEIPT_KIND]
  const logs = await inChunks(ids, (chunk) => admin
    .from('email_sent_log').select('ref_id, kind').eq('ok', true).in('kind', kinds).in('ref_id', chunk))
  const byKind = Object.fromEntries(Object.entries(DROP_CLAIM_KINDS).map(([stage, kind]) => [kind, stage]))
  const sent = new Map()
  const receipts = new Set()
  for (const l of logs) {
    if (l.kind === RECEIPT_KIND) { receipts.add(l.ref_id); continue }
    const set = sent.get(l.ref_id) || new Set()
    set.add(byKind[l.kind])
    sent.set(l.ref_id, set)
  }

  const waitRows = await inChunks(ids, (chunk) => admin
    .from('drop_waitlist').select('redemption_id').in('redemption_id', chunk))
  const promoted = new Set(waitRows.map((w) => w.redemption_id).filter(Boolean))

  // Il "perso" dice se il posto è andato a qualcuno in lista: c'è un
  // promosso di quel drop dopo la scadenza.
  const expiredDiscounts = [...new Set(list.filter((r) => ms(r.expires_at) <= now.getTime()).map((r) => r.discount_id))]
  const promotions = expiredDiscounts.length
    ? await inChunks(expiredDiscounts, (chunk) => admin
      .from('drop_waitlist').select('discount_id, promoted_at').eq('status', 'promoted').in('discount_id', chunk))
    : []

  // Tutti, non solo chi ha "I miei sconti" acceso: la partenza e il posto
  // dalla lista sono ricevute. Il filtro per i promemoria lo fa il piano.
  const userIds = [...new Set(list.map((r) => r.user_id))]
  const profiles = await inChunks(userIds, (chunk) => admin
    .from('profiles').select('id, email, full_name').in('id', chunk))
  const prefs = await inChunks(userIds, (chunk) => admin
    .from('email_preferences').select('user_id, my_discounts, unsubscribe_token').in('user_id', chunk))
  const prefByUser = new Map(prefs.map((p) => [p.user_id, p]))
  const recipients = new Map()
  for (const p of profiles) {
    const email = p.email?.trim().toLowerCase()
    if (!email) continue
    const pref = prefByUser.get(p.id)
    recipients.set(p.id, {
      email,
      name: p.full_name || '',
      token: pref?.unsubscribe_token || null,
      myDiscounts: pref ? pref.my_discounts !== false : true,
    })
  }

  return { rows: list, sent, receipts, promoted, promotions, recipients }
}

/** Le foto grandi dei locali coinvolti, la prima per ognuno. */
async function firstPhotos(admin, restaurantIds) {
  const map = new Map()
  const rows = await inChunks(restaurantIds, (chunk) => admin
    .from('restaurant_photos')
    .select('restaurant_id, photo_url, thumb_url, sort_order')
    .in('restaurant_id', chunk)
    .order('sort_order', { ascending: true }))
  for (const row of rows) {
    if (!map.has(row.restaurant_id)) map.set(row.restaurant_id, row.photo_url || row.thumb_url)
  }
  return map
}

/**
 * Il giro: scadenze e lista d'attesa nel DB, poi le email.
 * Stessa prudenza degli altri giri: la riga in `email_sent_log` si scrive
 * prima dell'invio (due giri insieme non mandano due volte), e se Resend
 * rifiuta torna `ok = false` così il giro dopo ci riprova.
 */
export async function runDropClaims(admin, { dryRun = false, now = new Date(), send } = {}) {
  const summary = { tick: null, open: 0, planned: 0, quiet: isQuietHour(now, DROP_CLAIM_RULES), sent: 0, skipped: 0, failed: 0, errors: [] }

  if (!dryRun) {
    const { data, error } = await admin.rpc('drop_claims_tick')
    if (error) summary.errors.push(`drop_claims_tick: ${error.message}`)
    else summary.tick = data
  }

  const input = await loadDropClaimInput(admin, now)
  const plan = planDropClaimEmails({ ...input, now })
  summary.open = input.rows.length
  summary.planned = plan.length
  if (dryRun) {
    summary.preview = plan.slice(0, 20).map((p) => ({
      restaurant: p.row.discount?.restaurant?.name,
      stage: p.stage,
      promoted: p.promoted,
      expiresAt: p.row.expires_at,
    }))
    return summary
  }
  if (!plan.length) return summary

  const photos = await firstPhotos(admin, [...new Set(plan.map((p) => p.row.discount?.restaurant_id).filter(Boolean))])
  const passedOn = (item) => item.stage === 'expired' && (input.promotions || []).some((w) =>
    w.discount_id === item.row.discount_id && ms(w.promoted_at) >= ms(item.row.expires_at) - MIN)

  const queue = []
  for (const item of plan) {
    const { error } = await admin.from('email_sent_log').insert({
      user_id: item.row.user_id, kind: item.kind, ref_id: item.row.id,
      to_email: item.recipient.email, ok: true,
    })
    if (error) {
      if (error.code !== '23505') summary.errors.push(error.message)
      summary.skipped += 1
      continue
    }
    const receipt = item.stage === 'start'
    const mail = dropClaimEmail(dropClaimProps(item, {
      photo: photos.get(item.row.discount?.restaurant_id) || null,
      unsubUrl: !receipt && item.recipient.token ? unsubscribeUrl(item.recipient.token) : null,
      passedOn: passedOn(item),
      now,
    }))
    queue.push({
      item,
      // La ricevuta non porta le intestazioni di disiscrizione (come quella
      // del Bi Club); i promemoria sì.
      message: buildMessage({ to: item.recipient.email, token: receipt ? null : item.recipient.token, ...mail }),
    })
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
    for (const kind of Object.values(DROP_CLAIM_KINDS)) {
      const refs = chunk.filter((q) => q.item.kind === kind).map((q) => q.item.row.id)
      if (!refs.length) continue
      await admin.from('email_sent_log').update({ ok: false, error })
        .eq('kind', kind).in('ref_id', refs).then(() => {}, () => {})
    }
  }
  return summary
}
