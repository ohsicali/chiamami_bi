/**
 * Vercel Serverless Function — Broadcast notification to newsletter subscribers
 *
 * POST body: { type: 'restaurant' | 'discount' | 'drop', id: uuid, force?: boolean }
 * - Admin-only (Bearer token → profiles.is_admin = true)
 * - Fetches the target item, builds an HTML email, loops over
 *   newsletter_subscribers and sends via Resend.
 * - Writes to email_notifications_log to prevent duplicate sends unless
 *   `force: true` is passed.
 */
import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'
import { applyCors } from './_cors.js'
import { newDiscountEmail, newRestaurantEmail } from './_email/templates.js'
import {
  sendBatch, recipientsFor, unsubscribeUrl, listUnsubscribeHeaders, FROM, REPLY_TO,
} from './_email/send.js'
import { formatDiscountBadge, pickPerk } from './_email/discount.js'

const SITE_URL = 'https://chiamamibi.com'
const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch'
// Resend batch endpoint accepts up to 100 messages per request.
const RESEND_BATCH_SIZE = 100

export default async function handler(req, res) {
  if (applyCors(req, res)) return
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
    return {
      from: FROM(),
      reply_to: REPLY_TO(),
      to: [r.email],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: listUnsubscribeHeaders(r.token),
    }
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

// ---------------------------------------------------------------
// Payload loaders
// ---------------------------------------------------------------

async function loadPayload(admin, type, id) {
  if (type === 'restaurant') {
    const { data: r, error } = await admin
      .from('restaurants')
      .select('id, name, slug, address, city, tagline, our_review, our_tip, is_published, cuisine_type, price_range')
      .eq('id', id)
      .single()
    if (error || !r) throw new Error('Restaurant not found')
    if (!r.is_published) throw new Error('Restaurant is not published — publish it before sending')

    const { data: photos } = await admin
      .from('restaurant_photos')
      .select('photo_url, thumb_url, sort_order')
      .eq('restaurant_id', id)
      .order('sort_order', { ascending: true })
      .limit(1)
    const photo = photos?.[0]?.thumb_url || photos?.[0]?.photo_url || null

    return { restaurant: r, photo }
  }

  if (type === 'discount' || type === 'drop') {
    const { data: d, error } = await admin
      .from('discounts')
      .select('id, title, description, conditions, discount_type, discount_value, valid_until, is_drop, drop_starts_at, restaurant_id, is_active')
      .eq('id', id)
      .single()
    if (error || !d) throw new Error('Discount not found')
    if (!d.is_active) throw new Error('Discount is not active')
    if (type === 'drop' && !d.is_drop) throw new Error('This discount is not a drop')

    const { data: r } = await admin
      .from('restaurants')
      .select('id, name, slug, address, city, cuisine_type')
      .eq('id', d.restaurant_id)
      .single()
    if (!r) throw new Error('Restaurant linked to discount not found')

    const { data: photos } = await admin
      .from('restaurant_photos')
      .select('photo_url, thumb_url, sort_order')
      .eq('restaurant_id', r.id)
      .order('sort_order', { ascending: true })
      .limit(1)
    const photo = photos?.[0]?.thumb_url || photos?.[0]?.photo_url || null

    return { discount: d, restaurant: r, photo }
  }

  throw new Error('Unknown type')
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
      price: r.price_range,
      photoUrl: p.photo,
      href: SLUG_URL(r.slug),
      unsubscribeUrl: unsubUrl,
    })
  }

  const d = p.discount
  const r = p.restaurant
  return newDiscountEmail({
    value: formatDiscountBadge(d),
    restaurantName: r.name,
    perk: pickPerk(d),
    conditions: (d.conditions || '').trim() || null,
    city: r.city,
    cuisine: r.cuisine_type,
    photoUrl: p.photo,
    href: `${SITE_URL}/sconti`,
    isDrop: type === 'drop' || !!d.is_drop,
    countdown: dropCountdown(d),
    unsubscribeUrl: unsubUrl,
  })
}

/** "3g 2h" — quanto manca alla scadenza del drop. */
function dropCountdown(d) {
  if (!d?.valid_until) return null
  const ms = new Date(d.valid_until).getTime() - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return null
  const h = Math.floor(ms / 3_600_000)
  const days = Math.floor(h / 24)
  return days > 0 ? `${days}g ${h % 24}h` : `${h}h`
}
