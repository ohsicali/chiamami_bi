/**
 * Vercel Serverless Function — Partner application submission
 * Saves the application to Supabase and sends a notification email to info@chiamamibi.com
 */

import { rateLimit, maybeCleanup } from './_rate-limit.js'
import { applyCors } from './_cors.js'
import { verifyTurnstile } from './_turnstile.js'
import { internalPartnerApplicationEmail, partnerApplicationConfirmationEmail } from './_email/templates.js'
import { sendEmail, REPLY_TO } from './_email/send.js'

const NOTIFY_EMAIL = 'info@chiamamibi.com'
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://chiamamibi.com'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Rate-limit to prevent application-form spam.
  maybeCleanup()
  const limited = rateLimit(req, { key: 'partner-application', max: 3, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  // Cloudflare Turnstile verification (no-op if TURNSTILE_SECRET_KEY unset).
  const captcha = await verifyTurnstile(req)
  if (!captcha.ok) return res.status(captcha.status).json({ error: captcha.error })

  const {
    restaurant_name,
    contact_name,
    email,
    phone,
    address,
    instagram,
    motivation,
  } = req.body || {}

  // Validation
  if (!restaurant_name || !contact_name || !email || !address) {
    return res.status(400).json({
      error: 'Campi obbligatori mancanti (nome ristorante, nome e cognome, email, indirizzo)',
    })
  }

  // Strict email validation — prevents email header injection via CR/LF in reply_to.
  // Resend would refuse a malformed address, but defense-in-depth here keeps any
  // future direct SMTP integration safe.
  const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  const cleanEmail = String(email).trim()
  if (cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail) || /[\r\n]/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Indirizzo email non valido' })
  }

  // Sanitize free-text fields: cap length, strip control chars (defense-in-depth).
  const sanitizeText = (v, max) => {
    if (v == null) return null
    const s = String(v).replace(/[\u0000-\u001F\u007F]/g, '').trim()
    return s.length === 0 ? null : s.slice(0, max)
  }
  const cleanRestaurantName = sanitizeText(restaurant_name, 200)
  const cleanContactName = sanitizeText(contact_name, 200)
  const cleanPhone = sanitizeText(phone, 50)
  const cleanAddress = sanitizeText(address, 500)
  const cleanInstagram = sanitizeText(instagram, 200)
  const cleanMotivation = sanitizeText(motivation, 2000)

  if (!cleanRestaurantName || !cleanContactName || !cleanAddress) {
    return res.status(400).json({ error: 'Campi obbligatori non validi' })
  }

  // Save to Supabase using the service role (bypasses RLS cleanly from the
  // server). We intentionally no longer fall back to the anon key: doing so
  // would require a permissive anon INSERT policy on partner_applications,
  // which would expose the table to write-spam from the public.
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseKey) {
      const dbResponse = await fetch(`${supabaseUrl}/rest/v1/partner_applications`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          restaurant_name: cleanRestaurantName,
          contact_name: cleanContactName,
          email: cleanEmail,
          phone: cleanPhone,
          address: cleanAddress,
          instagram: cleanInstagram,
          motivation: cleanMotivation,
          // legacy compat: ApplicationManager still reads these
          message: cleanMotivation,
          city: 'Torino',
          status: 'pending',
        }),
      })

      if (!dbResponse.ok) {
        const errText = await dbResponse.text()
        console.error('Supabase insert failed:', dbResponse.status, errText)
        // don't hard-fail: still try to send email
      }
    }
  } catch (err) {
    console.error('Supabase insert error:', err)
  }

  // Send notification email via Resend
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    try {
      const mail = internalPartnerApplicationEmail({
        restaurantName: cleanRestaurantName,
        contactName: cleanContactName,
        email: cleanEmail,
        phone: cleanPhone,
        address: cleanAddress,
        instagram: cleanInstagram,
        motivation: cleanMotivation,
        urlAdmin: `${SITE_URL}/admin/applications`,
      })
      // Il reply-to è il candidato: rispondere alla notifica scrive a lui.
      const sent = await sendEmail({ to: NOTIFY_EMAIL, ...mail, replyTo: cleanEmail })
      if (!sent.ok) console.error('[partner-application] ', sent.error)
    } catch (err) {
      console.error('Email send error:', err)
    }

    // La conferma al candidato parte da qui, dopo captcha e rate limit.
    // Prima passava da un tipo di /api/send-email aperto a chiunque, che
    // spediva la stessa email a qualsiasi indirizzo gli si desse.
    try {
      const confirmation = partnerApplicationConfirmationEmail({
        nomeReferente: cleanContactName,
        nomeAttivita: cleanRestaurantName,
      })
      const sent = await sendEmail({
        to: cleanEmail,
        ...confirmation,
        headers: { 'List-Unsubscribe': `<mailto:${REPLY_TO()}?subject=unsubscribe>` },
      })
      if (!sent.ok) console.warn('[partner-application] confirmation send failed:', sent.error)
    } catch (err) {
      console.warn('[partner-application] confirmation send failed:', err)
    }
  }

  return res.status(200).json({ success: true })
}

