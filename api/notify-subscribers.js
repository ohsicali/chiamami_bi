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

const SITE_URL = 'https://chiamamibi.com'
const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch'
// Resend batch endpoint accepts up to 100 messages per request.
const RESEND_BATCH_SIZE = 100

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
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

  // Load subscribers
  const { data: subs, error: subsErr } = await admin
    .from('newsletter_subscribers')
    .select('email')
  if (subsErr) {
    return res.status(500).json({ error: `Failed to load subscribers: ${subsErr.message}` })
  }
  const emails = (subs || []).map((s) => s.email).filter(Boolean)
  if (emails.length === 0) {
    return res.status(200).json({ sent: 0, message: 'No subscribers' })
  }

  // Build email content
  const subject = buildSubject(type, payload)
  const html = buildHtml(type, payload)
  const from = process.env.RESEND_FROM || 'ChiamamiBi <noreply@chiamamibi.com>'

  // Send in batches via Resend
  let sent = 0
  let errors = 0
  const errorDetails = []

  for (let i = 0; i < emails.length; i += RESEND_BATCH_SIZE) {
    const chunk = emails.slice(i, i + RESEND_BATCH_SIZE)
    try {
      const resp = await fetch(RESEND_BATCH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          chunk.map((email) => ({ from, to: [email], subject, html }))
        ),
      })
      const respText = await resp.text()
      if (!resp.ok) {
        errors += chunk.length
        errorDetails.push({ status: resp.status, body: respText.slice(0, 500) })
        console.error('[notify-subscribers] Resend error', resp.status, respText)
      } else {
        sent += chunk.length
        console.log('[notify-subscribers] Resend OK', resp.status, respText.slice(0, 500))
      }
    } catch (err) {
      errors += chunk.length
      errorDetails.push({ message: err.message })
      console.error('[notify-subscribers] Resend fetch threw', err.message)
    }
  }

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
      .select('id, name, slug, address, our_review, our_tip, is_published, cuisine_type, price_range')
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
      .select('id, title, description, discount_type, discount_value, valid_until, is_drop, drop_starts_at, restaurant_id, is_active')
      .eq('id', id)
      .single()
    if (error || !d) throw new Error('Discount not found')
    if (!d.is_active) throw new Error('Discount is not active')
    if (type === 'drop' && !d.is_drop) throw new Error('This discount is not a drop')

    const { data: r } = await admin
      .from('restaurants')
      .select('id, name, slug, address')
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

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildSubject(type, p) {
  if (type === 'restaurant') return `Nuovo ristorante su ChiamamiBi: ${p.restaurant.name}`
  if (type === 'drop') return `Drop in arrivo da ${p.restaurant.name} 🔥`
  return `Nuovo sconto da ${p.restaurant.name}`
}

function buildHtml(type, p) {
  if (type === 'restaurant') return renderRestaurantEmail(p)
  if (type === 'drop') return renderDropEmail(p)
  return renderDiscountEmail(p)
}

function shell(innerHtml) {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#FFF8F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF8F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background-color:#E8604C;padding:28px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-family:'Georgia',serif;font-size:26px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">CHIAMAMI BI</h1>
        </td></tr>
        ${innerHtml}
        <tr><td style="padding:20px 24px;border-top:1px solid #f0e6e3;text-align:center;">
          <p style="margin:0 0 6px;color:#999;font-size:12px;">ChiamamiBi — Torino, Italia</p>
          <p style="margin:0;color:#999;font-size:12px;">
            <a href="${SITE_URL}/privacy" style="color:#E8604C;text-decoration:none;">Privacy</a>
            &nbsp;·&nbsp;
            <a href="${SITE_URL}/profile" style="color:#E8604C;text-decoration:none;">Gestisci iscrizione</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function photoBlock(photo) {
  if (!photo) return ''
  return `<tr><td><img src="${esc(photo)}" alt="" style="display:block;width:100%;height:auto;max-height:320px;object-fit:cover;" /></td></tr>`
}

function cta(href, label) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
    <tr><td align="center">
      <a href="${esc(href)}" style="display:inline-block;background-color:#E8604C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600;">${esc(label)}</a>
    </td></tr>
  </table>`
}

function renderRestaurantEmail({ restaurant, photo }) {
  const url = `${SITE_URL}/restaurant/${restaurant.slug}`
  const subtitle = [restaurant.cuisine_type, restaurant.address].filter(Boolean).map(esc).join(' · ')
  const body = restaurant.our_review
    ? `<p style="margin:0 0 16px;color:#4a4a4a;font-size:15px;line-height:1.6;">${esc(restaurant.our_review)}</p>`
    : `<p style="margin:0 0 16px;color:#4a4a4a;font-size:15px;line-height:1.6;">Scoprilo sulla mappa e leggi la nostra recensione.</p>`
  const tip = restaurant.our_tip
    ? `<div style="margin:16px 0 20px;padding:14px 16px;background:#FFF3EF;border-radius:12px;border-left:3px solid #E8604C;">
        <p style="margin:0;color:#22181C;font-size:14px;line-height:1.5;"><strong>Il nostro consiglio:</strong> ${esc(restaurant.our_tip)}</p>
       </div>`
    : ''
  return shell(`
    ${photoBlock(photo)}
    <tr><td style="padding:28px 24px;">
      <p style="margin:0 0 4px;color:#E8604C;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Nuovo a Torino</p>
      <h2 style="margin:0 0 6px;color:#1a1a1a;font-size:24px;">${esc(restaurant.name)}</h2>
      ${subtitle ? `<p style="margin:0 0 16px;color:#8A8680;font-size:13px;">${subtitle}</p>` : ''}
      ${body}
      ${tip}
      ${cta(url, 'Scopri il ristorante')}
    </td></tr>
  `)
}

function renderDiscountEmail({ discount, restaurant, photo }) {
  const url = `${SITE_URL}/restaurant/${restaurant.slug}`
  const value = formatDiscountValue(discount)
  const until = discount.valid_until
    ? `<p style="margin:0 0 16px;color:#8A8680;font-size:13px;">Valido fino al ${esc(formatDate(discount.valid_until))}</p>`
    : ''
  return shell(`
    ${photoBlock(photo)}
    <tr><td style="padding:28px 24px;">
      <p style="margin:0 0 4px;color:#E8604C;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Nuovo sconto</p>
      <h2 style="margin:0 0 6px;color:#1a1a1a;font-size:24px;">${esc(discount.title)}</h2>
      <p style="margin:0 0 12px;color:#22181C;font-size:15px;">da <strong>${esc(restaurant.name)}</strong></p>
      <div style="margin:12px 0 16px;padding:16px;background:#FFF3EF;border-radius:12px;text-align:center;">
        <p style="margin:0;color:#E8604C;font-size:26px;font-weight:800;">${esc(value)}</p>
      </div>
      ${discount.description ? `<p style="margin:0 0 16px;color:#4a4a4a;font-size:14px;line-height:1.6;">${esc(discount.description)}</p>` : ''}
      ${until}
      ${cta(url, 'Richiedi lo sconto')}
    </td></tr>
  `)
}

function renderDropEmail({ discount, restaurant, photo }) {
  const url = `${SITE_URL}/restaurant/${restaurant.slug}`
  const value = formatDiscountValue(discount)
  const when = discount.drop_starts_at
    ? `<p style="margin:0 0 16px;color:#8A8680;font-size:13px;">Parte il ${esc(formatDate(discount.drop_starts_at))}</p>`
    : ''
  return shell(`
    ${photoBlock(photo)}
    <tr><td style="padding:28px 24px;">
      <p style="margin:0 0 4px;color:#E8604C;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">🔥 Drop in arrivo</p>
      <h2 style="margin:0 0 6px;color:#1a1a1a;font-size:24px;">${esc(discount.title)}</h2>
      <p style="margin:0 0 12px;color:#22181C;font-size:15px;">da <strong>${esc(restaurant.name)}</strong></p>
      <div style="margin:12px 0 16px;padding:16px;background:#22181C;border-radius:12px;text-align:center;">
        <p style="margin:0;color:#ffffff;font-size:26px;font-weight:800;">${esc(value)}</p>
      </div>
      ${discount.description ? `<p style="margin:0 0 16px;color:#4a4a4a;font-size:14px;line-height:1.6;">${esc(discount.description)}</p>` : ''}
      ${when}
      <p style="margin:0 0 16px;color:#22181C;font-size:13px;line-height:1.5;">I drop durano poco e vanno a esaurimento — meglio farsi trovare pronti.</p>
      ${cta(url, 'Vai alla pagina del drop')}
    </td></tr>
  `)
}

function formatDiscountValue(d) {
  if (d.discount_type === 'percentage') return `${d.discount_value}% di sconto`
  if (d.discount_type === 'fixed') return `${d.discount_value}€ di sconto`
  if (d.discount_type === 'freebie') return `${d.discount_value} in omaggio`
  return d.discount_value || 'Sconto riservato'
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('it-IT', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return ''
  }
}
