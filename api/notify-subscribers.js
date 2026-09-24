/**
 * Vercel Serverless Function — Broadcast notification to newsletter subscribers
 *
 * POST body: { type: 'restaurant' | 'discount' | 'drop', id: uuid, force?: boolean }
 *
 * - Admin-only (Bearer token → profiles.is_admin = true)
 * - Fetches the target item, builds an HTML email, loops over
 *   newsletter_subscribers and sends via Resend.
 * - Writes to email_notifications_log to prevent duplicate sends unless
 *   `force: true` is passed.
 *
 * In più, il giro quotidiano dei promemoria (sconti presi e non usati):
 * - GET  ?job=discount-reminders  → dal cron di Vercel (vercel.json), con
 *   `Authorization: Bearer $CRON_SECRET`. Vive qui e non in un file suo per
 *   il cap di 12 funzioni del piano Hobby. Le regole in _email/reminders.js.
 * - POST { type: 'discount-reminders', dryRun?: boolean } → lo stesso giro
 *   lanciato a mano da un admin; con `dryRun` dice chi riceverebbe cosa
 *   senza spedire niente.
 */
import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'
import { applyCors } from './_cors.js'
import { newDiscountEmail, newRestaurantEmail } from './_email/templates.js'
import { sendBatch, buildMessage, recipientsFor, unsubscribeUrl } from './_email/send.js'
import { formatDiscountBadge, pickPerk } from './_email/discount.js'
import { countdownWords } from './_email/content.js'
import { claimedCount, remainingCount, discountEndsAt } from '../src/lib/discounts.js'
import { runDiscountReminders } from './_email/reminders.js'

const SITE_URL = 'https://chiamamibi.com'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method === 'GET' && req.query?.job === 'discount-reminders') return handleReminderCron(req, res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  maybeCleanup()
  const limited = rateLimit(req, { key: 'notify-subscribers', max: 10, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const resendKey = process.env.RESEND_API_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return res.status(500).json({ error: 'Server configuration error: missing Supabase env vars' })
  }
  if (!resendKey) {
    return res.status(500).json({ error: 'Server configuration error: missing RESEND_API_KEY' })
  }

  // Verify caller is an authenticated admin.
  const token = authHeader.replace('Bearer ', '')
  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) {
    return res.status(403).json({ error: 'Admin role required' })
  }

  const { type, id, force } = req.body || {}
  if (type === 'discount-reminders') {
    try {
      const summary = await runDiscountReminders(admin, { dryRun: !!req.body?.dryRun })
      return res.status(200).json(summary)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }
  if (!type || !id) return res.status(400).json({ error: 'type and id required' })
  if (!['restaurant', 'discount', 'drop'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' })
  }

  // Dedup check
  if (!force) {
    const { data: existing } = await admin
      .from('email_notifications_log')
      .select('sent_at, sent_count')
      .eq('type', type)
      .eq('item_id', id)
      .maybeSingle()
    if (existing) {
      return res.status(409).json({
        error: 'Already sent',
        sent_at: existing.sent_at,
        sent_count: existing.sent_count,
      })
    }
  }

  // Load target item
  let payload
  try {
    payload = await loadPayload(admin, type, id)
  } catch (err) {
    return res.status(404).json({ error: err.message })
  }

  // I destinatari sono TUTTI gli utenti registrati che non hanno spento
  // l'interruttore di questo tipo — non più la sola lista newsletter, che
  // era un insieme separato e molto più piccolo. Il filtro sta dentro
  // `recipientsFor`: così nessun punto di invio può dimenticarsi di
  // applicarlo.
  const kind = type === 'restaurant' ? 'new-place' : 'new-discount'
  let recipients
  try {
    recipients = await recipientsFor(admin, kind)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  if (recipients.length === 0) {
    return res.status(200).json({ sent: 0, message: 'Nessun destinatario per questo tipo' })
  }

  // Ogni messaggio è diverso dall'altro: il link per scegliere cosa ricevere
  // porta il token di quella persona. Per questo si costruisce dentro al
  // ciclo e non una volta sola fuori.
  const messages = recipients.map((r) => {
    const mail = buildMail(type, payload, unsubscribeUrl(r.token))
    return buildMessage({ to: r.email, token: r.token, ...mail })
  })

  const { sent, failed: errors, errors: errorDetails } = await sendBatch(messages)
  const emails = recipients

  // Log
  await admin
    .from('email_notifications_log')
    .upsert(
      {
        type,
        item_id: id,
        sent_count: sent,
        error_count: errors,
        sent_by: user.id,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'type,item_id' }
    )

  return res.status(200).json({ sent, errors, total: emails.length, errorDetails })
}

/**
 * Il giro dei promemoria lanciato dal cron di Vercel.
 *
 * Vercel chiama con GET e mette da sé `Authorization: Bearer $CRON_SECRET`.
 * Senza la variabile impostata il giro non parte affatto: un endpoint che
 * spedisce email a centinaia di persone non resta aperto per distrazione.
 */
async function handleReminderCron(req, res) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey || !process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error' })
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  try {
    const summary = await runDiscountReminders(admin)
    console.log('[discount-reminders]', JSON.stringify({ ...summary, errors: summary.errors.slice(0, 5) }))
    return res.status(200).json(summary)
  } catch (err) {
    console.error('[discount-reminders]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ---------------------------------------------------------------
// Payload loaders
// ---------------------------------------------------------------

async function loadPayload(admin, type, id) {
  if (type === 'restaurant') {
    const { data: r, error } = await admin
      .from('restaurants')
      .select('id, name, slug, address, neighborhood, city, tagline, our_review, our_tip, is_published, cuisine_type, price_range')
      .eq('id', id)
      .single()
    if (error || !r) throw new Error('Restaurant not found')
    if (!r.is_published) throw new Error('Restaurant is not published — publish it before sending')

    return { restaurant: r, ...(await photoSet(admin, id)) }
  }

  if (type === 'discount' || type === 'drop') {
    const { data: d, error } = await admin
      .from('discounts')
      .select('id, title, description, conditions, discount_type, discount_value, valid_until, valid_days, valid_meal_slots, valid_time_from, valid_time_to, is_drop, drop_starts_at, drop_ends_at, max_quantity, max_redemptions, claimed_count, total_redeemed, restaurant_id, is_active')
      .eq('id', id)
      .single()
    if (error || !d) throw new Error('Discount not found')
    if (!d.is_active) throw new Error('Discount is not active')
    if (type === 'drop' && !d.is_drop) throw new Error('This discount is not a drop')

    // `our_review` e `tagline` non servono allo sconto in sé: servono
    // all'email. Un annuncio fatto di sola offerta è un volantino, e si
    // legge come tale — la riga in cui Bi dice perché quel posto merita è
    // l'unica parte che nessun altro potrebbe aver scritto.
    const { data: r } = await admin
      .from('restaurants')
      .select('id, name, slug, address, neighborhood, city, cuisine_type, price_range, tagline, our_review')
      .eq('id', d.restaurant_id)
      .single()
    if (!r) throw new Error('Restaurant linked to discount not found')

    return { discount: d, restaurant: r, ...(await photoSet(admin, r.id)) }
  }

  throw new Error('Unknown type')
}

/**
 * Le foto del locale: le prime quattro, più quante ne esistono in tutto.
 *
 * Prima se ne prendeva una sola, perché una sola ne entrava: l'email aveva
 * una fascia in cima e basta. Adesso "nuovo in guida" e le convenzioni
 * mostrano un mosaico 1+3, e il conteggio totale serve al "+N" sull'ultima
 * tessera — senza, il badge direbbe sempre lo stesso numero o non ci
 * sarebbe affatto.
 *
 * Qui serve la foto grande, non la `thumb_url`: quella è il ritaglio da
 * 400px delle card, e dentro una fascia larga 600 arrivava sgranata. Il
 * ridimensionamento lo fa `/api/img` a valle (vedi `croppedPhoto` in
 * _email/blocks.js).
 */
async function photoSet(admin, restaurantId) {
  const { data, count } = await admin
    .from('restaurant_photos')
    .select('photo_url, thumb_url, sort_order', { count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true })
    .limit(4)
  const photos = (data || []).map((r) => r.photo_url || r.thumb_url).filter(Boolean)
  return { photos, photoCount: count ?? photos.length, photo: photos[0] || null }
}

// ---------------------------------------------------------------
// Email rendering
// ---------------------------------------------------------------
//
// L'HTML non sta più qui: lo fanno i template in _email/, gli stessi che
// usano le ricevute degli sconti. Prima ogni email aveva il suo HTML
// scritto a mano e le due famiglie si erano già allontanate — intestazioni
// diverse, piè di pagina diverso, nessun link per scegliere cosa ricevere.

const SLUG_URL = (slug) => `${SITE_URL}/restaurant/${slug}`

/** Da payload a { subject, html, text }. */
function buildMail(type, p, unsubUrl) {
  if (type === 'restaurant') {
    const r = p.restaurant
    return newRestaurantEmail({
      restaurantName: r.name,
      tagline: r.tagline,
      review: r.our_review,
      city: r.city,
      cuisine: r.cuisine_type,
      priceRange: r.price_range,
      address: r.address,
      neighborhood: r.neighborhood,
      photos: p.photos,
      photoCount: p.photoCount,
      href: SLUG_URL(r.slug),
      unsubscribeUrl: unsubUrl,
    })
  }

  const d = p.discount
  const r = p.restaurant
  // È `is_drop` a scegliere il template, non il `type` della chiamata: il
  // colore dell'email dice che tipo di sconto è (corallo = scade, crema e
  // oro = non scade), e sbagliarlo brucia l'urgenza anche sui drop veri.
  const isDrop = type === 'drop' || !!d.is_drop
  // I posti restano nel drop e solo lì. `remainingCount` torna null quando
  // lo sconto non ha un tetto: la barra allora non si disegna, perché una
  // barra su una quantità illimitata racconterebbe una scarsità inventata.
  const left = isDrop ? remainingCount(d) : null
  return newDiscountEmail({
    value: formatDiscountBadge(d),
    restaurantName: r.name,
    perk: pickPerk(d),
    conditions: (d.conditions || '').trim() || null,
    review: (r.our_review || r.tagline || '').trim() || null,
    city: r.city,
    cuisine: r.cuisine_type,
    priceRange: r.price_range,
    address: r.address,
    neighborhood: r.neighborhood,
    photos: p.photos,
    photoCount: p.photoCount,
    href: `${SITE_URL}/sconti`,
    scheda: r.slug ? SLUG_URL(r.slug) : null,
    isDrop,
    countdown: isDrop ? countdownWords(discountEndsAt(d)) : null,
    taken: left === null ? null : claimedCount(d),
    left,
    // Quando vale davvero: il chip della convenzione (pranzo, cena, giorni,
    // scadenza) e la riga del drop ("valido solo a cena") vengono da qui.
    validity: {
      days: d.valid_days,
      slots: d.valid_meal_slots,
      timeFrom: d.valid_time_from,
      timeTo: d.valid_time_to,
      until: d.valid_until,
    },
    unsubscribeUrl: unsubUrl,
  })
}
