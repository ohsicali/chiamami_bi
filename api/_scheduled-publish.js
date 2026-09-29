/**
 * Uscite programmate: locali e sconti che vanno online da soli all'ora
 * scelta dall'admin, con le loro email.
 *
 * Nel DB (supabase/scheduled-publish-2026-09-29.sql) una riga programmata ha
 * `publish_at` pieno e resta nascosta (`is_published = false` per i locali,
 * `is_active = false` per gli sconti). Ogni 5 minuti pg_cron chiama
 * `/api/notify-subscribers?job=scheduled-publish`, che arriva qui:
 *
 *   1. i locali la cui ora è arrivata vanno online (`publish_at` → NULL);
 *      se `notify_on_publish`, parte l'email "nuovo in guida" a tutti, e al
 *      locale il benvenuto col PIN — le stesse due email della prima
 *      pubblicazione fatta a mano dall'admin;
 *   2. poi gli sconti: si accendono e, se `notify_on_publish`, parte
 *      l'annuncio. Uno sconto il cui locale non è ancora online **aspetta**
 *      (resta programmato e si riprova al giro dopo): acceso, non si
 *      vedrebbe comunque, e l'email porterebbe a una scheda che non c'è.
 *
 * Ogni riga si prende con un UPDATE condizionato (`publish_at` ancora pieno
 * e già passato): se due giri partono insieme, solo uno la trova e le email
 * partono una volta sola. Il registro `email_notifications_log` fa il resto.
 */
import { announce } from './_email/announce.js'
import { sendPartnerWelcome } from './_email/partner.js'

/** È arrivata l'ora di questa riga? */
export function isDue(row, now = new Date()) {
  if (!row?.publish_at) return false
  const at = new Date(row.publish_at)
  return !Number.isNaN(at.getTime()) && at.getTime() <= now.getTime()
}

/**
 * Chi esce adesso e chi aspetta. Pura, sotto test
 * (tests/scheduled-publish.test.mjs).
 *
 * @param {{ restaurants: object[], discounts: object[], now?: Date }} input
 *   - restaurants: `{ id, is_published, publish_at, ... }`
 *   - discounts:   `{ id, restaurant_id, publish_at, restaurant: { is_published }, ... }`
 * @returns {{ restaurants: object[], discounts: object[], waiting: object[] }}
 */
export function planScheduledPublish({ restaurants = [], discounts = [], now = new Date() }) {
  const dueRestaurants = restaurants.filter((r) => isDue(r, now))
  const goingOnline = new Set(dueRestaurants.map((r) => r.id))

  const dueDiscounts = []
  const waiting = []
  for (const d of discounts) {
    if (!isDue(d, now)) continue
    const restaurantOnline = d.restaurant?.is_published === true || goingOnline.has(d.restaurant_id)
    ;(restaurantOnline ? dueDiscounts : waiting).push(d)
  }
  return { restaurants: dueRestaurants, discounts: dueDiscounts, waiting }
}

/**
 * Il giro. Con `dryRun` dice cosa uscirebbe senza toccare niente.
 *
 * @param {object} admin  client Supabase con service role
 */
export async function runScheduledPublish(admin, { dryRun = false, now = new Date() } = {}) {
  const [restRes, discRes] = await Promise.all([
    admin
      .from('restaurants')
      .select('id, name, is_published, publish_at, notify_on_publish, partner_email, verify_pin')
      .not('publish_at', 'is', null),
    admin
      .from('discounts')
      .select('id, title, restaurant_id, is_drop, is_active, is_test, publish_at, notify_on_publish, restaurant:restaurants(id, name, is_published)')
      .not('publish_at', 'is', null),
  ])
  if (restRes.error) throw new Error(`restaurants: ${restRes.error.message}`)
  if (discRes.error) throw new Error(`discounts: ${discRes.error.message}`)

  const plan = planScheduledPublish({ restaurants: restRes.data || [], discounts: discRes.data || [], now })
  const summary = {
    now: now.toISOString(),
    dryRun,
    published: [],
    waiting: plan.waiting.map((d) => ({ id: d.id, title: d.title, restaurant: d.restaurant?.name || null })),
    errors: [],
  }
  if (dryRun) {
    summary.published = [
      ...plan.restaurants.map((r) => ({ kind: 'restaurant', id: r.id, name: r.name, notify: r.notify_on_publish })),
      ...plan.discounts.map((d) => ({ kind: 'discount', id: d.id, name: d.title, notify: d.notify_on_publish && !d.is_test })),
    ]
    return summary
  }

  const nowIso = now.toISOString()

  // 1. Locali — prima degli sconti, così uno sconto programmato alla stessa
  // ora del suo locale esce nello stesso giro.
  for (const r of plan.restaurants) {
    const { data: claimed, error } = await admin
      .from('restaurants')
      .update({ is_published: true, publish_at: null, updated_at: nowIso })
      .eq('id', r.id)
      .not('publish_at', 'is', null)
      .lte('publish_at', nowIso)
      .select('id')
    if (error) {
      summary.errors.push({ kind: 'restaurant', id: r.id, error: error.message })
      continue
    }
    if (!claimed?.length) continue // l'ha preso un altro giro, o l'admin l'ha cambiato

    const item = { kind: 'restaurant', id: r.id, name: r.name, announced: null, partner: null }
    // Era già online (pubblicato a mano senza togliere la data): niente
    // email di "nuovo", non lo è.
    if (!r.is_published) {
      if (r.notify_on_publish) {
        const out = await announce(admin, { type: 'restaurant', id: r.id })
        item.announced = out.status === 200 ? (out.body.sent ?? 0) : `${out.status} ${out.body.error || ''}`.trim()
      }
      if (r.partner_email && r.verify_pin) {
        const sent = await sendPartnerWelcome(admin, {
          to: r.partner_email, nomeLocale: r.name, pin: r.verify_pin, restaurantId: r.id,
        })
        item.partner = sent.ok ? 'sent' : `error: ${sent.error}`
      }
    }
    summary.published.push(item)
  }

  // 2. Sconti.
  for (const d of plan.discounts) {
    const { data: claimed, error } = await admin
      .from('discounts')
      .update({ is_active: true, publish_at: null })
      .eq('id', d.id)
      .not('publish_at', 'is', null)
      .lte('publish_at', nowIso)
      .select('id')
    if (error) {
      summary.errors.push({ kind: 'discount', id: d.id, error: error.message })
      continue
    }
    if (!claimed?.length) continue

    const item = { kind: 'discount', id: d.id, name: d.title, restaurant: d.restaurant?.name || null, announced: null }
    // Uno sconto di prova non si annuncia a nessuno (e il server lo
    // rifiuterebbe comunque); uno già acceso non è una novità.
    if (d.notify_on_publish && !d.is_test && !d.is_active) {
      const out = await announce(admin, { type: d.is_drop ? 'drop' : 'discount', id: d.id })
      item.announced = out.status === 200 ? (out.body.sent ?? 0) : `${out.status} ${out.body.error || ''}`.trim()
    }
    summary.published.push(item)
  }

  return summary
}
