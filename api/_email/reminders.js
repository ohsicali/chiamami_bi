/**
 * Il promemoria degli sconti presi e non ancora usati.
 *
 * Il problema che risolve: il 24/09 i riscatti erano 192, e 188 mai usati.
 * Chi prende uno sconto spesso se ne dimentica, e un codice dimenticato non
 * porta nessuno al tavolo — né al locale né a noi.
 *
 * Il problema che NON deve creare: chi prende dieci sconti li prende tutti
 * insieme (sul DB, nove persone su dieci con più di uno sconto li hanno
 * presi nel giro di due o tre minuti). Un promemoria per sconto, dopo 48
 * ore, vorrebbe dire dieci email lo stesso giorno: la persona le segna come
 * spam e il dominio si brucia anche per le ricevute. Quindi:
 *
 *   - al massimo UN promemoria al giorno per persona, e un locale per email;
 *   - fra un promemoria e il successivo almeno `gapDays` giorni;
 *   - al massimo `maxPer30Days` promemoria in trenta giorni: dopo, la riga
 *     "hai altri N sconti" in fondo alle email già arrivate basta;
 *   - ogni riscatto si ricorda UNA volta sola (lo garantisce l'indice unico
 *     di `email_sent_log` su kind + ref_id);
 *   - se nelle ultime ore le abbiamo già scritto per qualcosa di suo (il
 *     codice di uno sconto appena preso, uno sconto usato) si aspetta domani;
 *   - l'ordine: prima un drop che sta per scadere (è l'unico caso in cui la
 *     fretta è vera, e può saltare l'attesa fra due promemoria), poi uno
 *     sconto che vale oggi, poi il più vecchio.
 *
 * Il giro parte una volta al giorno dal cron di Vercel (vercel.json →
 * /api/notify-subscribers?job=discount-reminders). Una volta al giorno è il
 * massimo che il piano Hobby concede, ed è anche il ritmo giusto: il
 * promemoria arriva sempre alla stessa ora, a metà mattina, quando si
 * decide dove andare a pranzo o a cena.
 *
 * `planReminders` è pura (niente DB, niente rete) e sta sotto test in
 * `tests/discount-reminders.test.mjs`; `runDiscountReminders` la nutre dal
 * DB e spedisce.
 */

import { discountEndsAt } from '../../src/lib/discounts.js'
import { discountReminderEmail } from './templates.js'
import { buildMessage, sendBatch, unsubscribeUrl, BATCH_SIZE } from './send.js'
import { formatDiscountBadge, pickPerk } from './discount.js'
import { formatShortCode } from '../_short-code.js'
import { SITE_URL } from './theme.js'

export const REMINDER_KIND = 'discount-reminder'

export const REMINDER_RULES = {
  /** Si ricorda uno sconto solo quando è stato preso da almeno tante ore. */
  firstAfterHours: 48,
  /** Oltre questa età un riscatto non si ricorda più: è acqua passata. */
  maxAgeDays: 30,
  /** Giorni minimi fra due promemoria alla stessa persona. */
  gapDays: 3,
  /** Promemoria al massimo in trenta giorni, per persona. */
  maxPer30Days: 4,
  /** Un drop che scade entro tante ore passa davanti e salta l'attesa. */
  urgentHours: 48,
  /** Se le abbiamo scritto nelle ultime tante ore, per qualunque motivo, si aspetta. */
  quietHours: 20,
  /** Tetto di sicurezza per un giro solo. */
  maxPerRun: 500,
}

// Il cron di Vercel parte "entro l'ora", non al minuto: fra un giro e il
// successivo possono passare 23 ore come 25. Senza questo margine un
// promemoria mandato alle 11:40 bloccherebbe quello di tre giorni dopo alle
// 11:05, e l'attesa diventerebbe di quattro giorni.
const JITTER_H = 6
const H = 3_600_000

const GIORNI_EN = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/** Il giorno della settimana a Roma, 1 = lunedì … 7 = domenica (come `valid_days`). */
export function romeWeekday(now = new Date()) {
  const w = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', weekday: 'short' }).format(now)
  return GIORNI_EN[w] || null
}

/** Lo sconto si può usare ancora: attivo, non scaduto, locale pubblicato. */
export function stillUsable(discount, now = new Date()) {
  if (!discount || discount.is_active === false) return false
  if (discount.restaurant && discount.restaurant.is_published === false) return false
  const end = discountEndsAt(discount)
  return !end || end.getTime() > now.getTime()
}

function validToday(discount, weekday) {
  const days = Array.isArray(discount?.valid_days) ? discount.valid_days : []
  return !days.length || days.includes(weekday)
}

/**
 * Decide chi riceve un promemoria oggi, e per quale sconto.
 *
 * @param {object}   input
 * @param {Array}    input.pending     riscatti `generated` con `discount` (e
 *                                     `discount.restaurant`) già uniti
 * @param {Set}      input.redeemed    `${user_id}:${discount_id}` già usati
 * @param {Set}      input.reminded    id dei riscatti già ricordati
 * @param {Map}      input.history     user_id → [{ kind, sent_at }] degli invii
 *                                     riusciti negli ultimi 30 giorni
 * @param {Map}      input.recipients  user_id → { email, name, token } di chi
 *                                     ha "I miei sconti" acceso
 * @param {Date}     [input.now]
 * @param {object}   [input.rules]
 * @returns {Array<{ userId, recipient, redemption, others, urgent }>}
 */
export function planReminders({
  pending = [], redeemed = new Set(), reminded = new Set(), history = new Map(),
  recipients = new Map(), now = new Date(), rules = REMINDER_RULES,
}) {
  const t = now.getTime()
  const weekday = romeWeekday(now)

  // Tutti gli sconti ancora in tasca, per persona: servono al "hai altri N
  // sconti" in fondo all'email, che conta anche quelli già ricordati o presi
  // ieri — la persona li vede tutti nel Bi Club.
  const inTasca = new Map()
  for (const r of pending) {
    if (!r?.user_id || !r.discount) continue
    if (redeemed.has(`${r.user_id}:${r.discount_id}`)) continue
    if (!stillUsable(r.discount, now)) continue
    const perUser = inTasca.get(r.user_id) || new Map()
    // Due riscatti dello stesso sconto sono uno sconto solo: si tiene il primo.
    const prima = perUser.get(r.discount_id)
    if (!prima || new Date(r.generated_at) < new Date(prima.generated_at)) perUser.set(r.discount_id, r)
    inTasca.set(r.user_id, perUser)
  }

  const out = []
  for (const [userId, perDiscount] of inTasca) {
    const recipient = recipients.get(userId)
    if (!recipient?.email) continue

    const log = history.get(userId) || []
    const inviati = log.filter((e) => e.kind === REMINDER_KIND)
    const recenti = inviati.filter((e) => t - new Date(e.sent_at).getTime() < 30 * 24 * H)
    if (recenti.length >= rules.maxPer30Days) continue
    // Le abbiamo scritto da poco, per qualunque cosa: oggi no.
    if (log.some((e) => t - new Date(e.sent_at).getTime() < rules.quietHours * H)) continue

    const tutti = [...perDiscount.values()]
    const candidati = tutti
      .filter((r) => !reminded.has(r.id))
      .filter((r) => {
        const eta = t - new Date(r.generated_at).getTime()
        return eta >= rules.firstAfterHours * H && eta <= rules.maxAgeDays * 24 * H
      })
      .map((r) => {
        const end = discountEndsAt(r.discount)
        const urgent = !!end && end.getTime() - t <= rules.urgentHours * H
        return { r, end, urgent, today: validToday(r.discount, weekday) }
      })
    if (!candidati.length) continue

    candidati.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1
      if (a.urgent && b.urgent) return a.end - b.end
      if (a.today !== b.today) return a.today ? -1 : 1
      return new Date(a.r.generated_at) - new Date(b.r.generated_at)
    })
    const scelto = candidati[0]

    const ultimo = Math.max(0, ...inviati.map((e) => new Date(e.sent_at).getTime()))
    const attesa = (rules.gapDays * 24 - JITTER_H) * H
    if (!scelto.urgent && ultimo && t - ultimo < attesa) continue

    out.push({
      userId,
      recipient,
      redemption: scelto.r,
      others: tutti.length - 1,
      urgent: scelto.urgent,
    })
  }

  // Se il tetto del giro si raggiunge, passano prima i drop in scadenza:
  // gli altri possono aspettare domani, loro no.
  out.sort((a, b) => (a.urgent === b.urgent ? 0 : a.urgent ? -1 : 1))
  return out.slice(0, rules.maxPerRun)
}

/* ------------------------------------------------------------------ */
/*  Dal DB all'email                                                   */
/* ------------------------------------------------------------------ */

const DISCOUNT_FIELDS =
  'id, title, description, conditions, discount_type, discount_value, valid_until, valid_days, valid_meal_slots, valid_time_from, valid_time_to, is_drop, drop_ends_at, is_active, restaurant_id'
const RESTAURANT_FIELDS =
  'id, name, slug, address, neighborhood, city, cuisine_type, price_range, tagline, our_review, is_published'

/** Le righe di una tabella a pagine da mille: PostgREST non ne dà di più. */
async function allRows(build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) return out
  }
}

/**
 * Come `allRows`, ma con un filtro `in` spezzato a blocchi: cento uuid
 * stanno in un indirizzo, mille no (il limite è sulla lunghezza dell'URL).
 */
async function rowsIn(ids, build, size = 150) {
  const out = []
  for (let i = 0; i < ids.length; i += size) out.push(...(await allRows(() => build(ids.slice(i, i + size)))))
  return out
}

/** Legge dal DB tutto quello che serve a `planReminders`. */
export async function loadReminderInput(admin, now = new Date()) {
  const since = new Date(now.getTime() - REMINDER_RULES.maxAgeDays * 24 * H).toISOString()

  const pending = await allRows(() => admin
    .from('discount_redemptions')
    .select(`id, user_id, discount_id, short_code, qr_code, generated_at, discount:discounts(${DISCOUNT_FIELDS}, restaurant:restaurants(${RESTAURANT_FIELDS}))`)
    .eq('status', 'generated')
    .gte('generated_at', since)
    .order('generated_at', { ascending: true }))

  const userIds = [...new Set(pending.map((r) => r.user_id).filter(Boolean))]
  if (!userIds.length) return { pending: [] }

  // Stesso sconto già usato con un altro riscatto: il promemoria sarebbe falso.
  const used = await rowsIn(userIds, (ids) => admin
    .from('discount_redemptions')
    .select('user_id, discount_id')
    .eq('status', 'redeemed')
    .in('user_id', ids))
  const redeemed = new Set(used.map((r) => `${r.user_id}:${r.discount_id}`))

  const logRows = await rowsIn(userIds, (ids) => admin
    .from('email_sent_log')
    .select('user_id, kind, ref_id, sent_at')
    .eq('ok', true)
    .in('user_id', ids)
    .gte('sent_at', since))
  const history = new Map()
  for (const e of logRows) {
    const list = history.get(e.user_id) || []
    list.push(e)
    history.set(e.user_id, list)
  }

  // Un riscatto ricordato più di trenta giorni fa è comunque fuori finestra,
  // quindi basta cercare fra quelli ancora in gioco.
  const giaRicordati = await rowsIn(pending.map((r) => r.id), (ids) => admin
    .from('email_sent_log')
    .select('ref_id')
    .eq('kind', REMINDER_KIND)
    .eq('ok', true)
    .in('ref_id', ids))
  const reminded = new Set(giaRicordati.map((row) => row.ref_id))

  // Chi ha "I miei sconti" acceso. Il filtro sta qui e non a valle, come in
  // recipientsFor: nessuno può dimenticarsi di applicarlo.
  const prefs = await rowsIn(userIds, (ids) => admin
    .from('email_preferences')
    .select('user_id, unsubscribe_token, profiles!inner(email, full_name)')
    .eq('my_discounts', true)
    .in('user_id', ids))
  const recipients = new Map()
  for (const row of prefs) {
    const email = row?.profiles?.email?.trim().toLowerCase()
    if (email) recipients.set(row.user_id, { email, name: row.profiles.full_name || '', token: row.unsubscribe_token })
  }

  return { pending, redeemed, reminded, history, recipients }
}

/** Le foto grandi dei locali coinvolti, la prima per ognuno. */
async function firstPhotos(admin, restaurantIds) {
  const map = new Map()
  const rows = await rowsIn(restaurantIds, (ids) => admin
    .from('restaurant_photos')
    .select('restaurant_id, photo_url, thumb_url, sort_order')
    .in('restaurant_id', ids)
    .order('sort_order', { ascending: true }))
  for (const row of rows) {
    if (!map.has(row.restaurant_id)) map.set(row.restaurant_id, row.photo_url || row.thumb_url)
  }
  return map
}

/** Da una voce del piano ai campi dell'email. */
export function reminderProps(item, { photo = null, unsubUrl = null, now = new Date() } = {}) {
  const red = item.redemption
  const d = red.discount || {}
  const r = d.restaurant || {}
  const end = discountEndsAt(d)
  return {
    value: formatDiscountBadge(d),
    restaurantName: r.name || 'il locale',
    perk: pickPerk(d),
    conditions: (d.conditions || '').trim() || null,
    review: (r.our_review || r.tagline || '').trim() || null,
    city: r.city,
    cuisine: r.cuisine_type,
    priceRange: r.price_range,
    address: r.address,
    neighborhood: r.neighborhood,
    photos: photo ? [photo] : [],
    isDrop: !!d.is_drop,
    endsAt: end ? end.toISOString() : null,
    validity: {
      days: d.valid_days,
      slots: d.valid_meal_slots,
      timeFrom: d.valid_time_from,
      timeTo: d.valid_time_to,
      until: d.valid_until,
    },
    claimedAt: red.generated_at,
    // Il codice da dettare, mai il qr_code per esteso.
    code: red.short_code ? formatShortCode(red.short_code) : null,
    // `?open=` apre direttamente il QR di quello sconto nel Bi Club.
    href: `${SITE_URL}/sconti?tab=miei&open=${encodeURIComponent(red.discount_id)}`,
    others: item.others,
    othersHref: `${SITE_URL}/sconti?tab=miei`,
    unsubscribeUrl: unsubUrl,
    now,
  }
}

/**
 * Il giro del giorno: legge, decide, spedisce, annota.
 *
 * La riga in `email_sent_log` si scrive PRIMA dell'invio: se due giri
 * partissero insieme (il cron ripetuto, un lancio a mano), il secondo trova
 * l'indice unico occupato e salta — meglio un promemoria in meno che due
 * uguali. Se poi Resend rifiuta il blocco, le righe tornano `ok = false`,
 * così domani quel riscatto si riprova.
 *
 * @param {object}  admin      client Supabase con la service role key
 * @param {object}  [opts]
 * @param {boolean} [opts.dryRun]  decide e basta, non scrive e non spedisce
 * @param {Function} [opts.send]   invio di un blocco (per le prove); default sendBatch
 */
export async function runDiscountReminders(admin, { dryRun = false, now = new Date(), send } = {}) {
  const input = await loadReminderInput(admin, now)
  const plan = planReminders({ ...input, now })

  const summary = {
    pendingRedemptions: input.pending.length,
    planned: plan.length,
    urgent: plan.filter((p) => p.urgent).length,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }
  if (dryRun) {
    summary.preview = plan.slice(0, 20).map((p) => ({
      restaurant: p.redemption.discount?.restaurant?.name,
      isDrop: !!p.redemption.discount?.is_drop,
      claimedAt: p.redemption.generated_at,
      others: p.others,
      urgent: p.urgent,
    }))
    return summary
  }
  if (!plan.length) return summary

  const photos = await firstPhotos(admin, [...new Set(plan.map((p) => p.redemption.discount?.restaurant_id).filter(Boolean))])

  // Prima si prenota il posto nel registro, poi si costruisce il messaggio.
  const queue = []
  for (const item of plan) {
    const { error } = await admin.from('email_sent_log').insert({
      user_id: item.userId, kind: REMINDER_KIND, ref_id: item.redemption.id,
      to_email: item.recipient.email, ok: true,
    })
    if (error) {
      // 23505 = già ricordato da un altro giro. Altri errori: meglio non
      // mandare, che mandare senza poterlo annotare (domani ci si riprova).
      if (error.code !== '23505') summary.errors.push(error.message)
      summary.skipped += 1
      continue
    }
    const mail = discountReminderEmail(reminderProps(item, {
      photo: photos.get(item.redemption.discount?.restaurant_id) || null,
      unsubUrl: unsubscribeUrl(item.recipient.token),
      now,
    }))
    queue.push({ item, message: buildMessage({ to: item.recipient.email, token: item.recipient.token, ...mail }) })
  }

  const sendChunk = send || sendBatch
  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const chunk = queue.slice(i, i + BATCH_SIZE)
    // Lo stesso mezzo secondo di sendBatch fra un blocco e l'altro.
    if (i > 0) await new Promise((ok) => setTimeout(ok, 500))
    const r = await sendChunk(chunk.map((q) => q.message))
    if (r.sent === chunk.length) {
      summary.sent += chunk.length
      continue
    }
    summary.failed += chunk.length
    summary.errors.push(...(r.errors || []))
    const error = String((r.errors || [])[0] || 'invio fallito').slice(0, 400)
    await admin
      .from('email_sent_log')
      .update({ ok: false, error })
      .eq('kind', REMINDER_KIND)
      .in('ref_id', chunk.map((q) => q.item.redemption.id))
      .then(() => {}, () => {})
  }
  return summary
}
