/**
 * Vercel Serverless Function — Partner application submission
 * Saves the application to Supabase and sends a notification email to info@chiamamibi.com
 */

import { rateLimit, maybeCleanup } from './_rate-limit.js'

const NOTIFY_EMAIL = 'info@chiamamibi.com'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Rate-limit to prevent application-form spam.
  maybeCleanup()
  const limited = rateLimit(req, { key: 'partner-application', max: 3, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

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
          restaurant_name,
          contact_name,
          email,
          phone: phone || null,
          address,
          instagram: instagram || null,
          motivation: motivation || null,
          // legacy compat: ApplicationManager still reads these
          message: motivation || null,
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
      const html = buildEmailHtml({
        restaurant_name,
        contact_name,
        email,
        phone,
        address,
        instagram,
        motivation,
      })

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Bi <ciao@chiamamibi.com>',
          to: [NOTIFY_EMAIL],
          reply_to: email,
          subject: `Nuova candidatura partner: ${restaurant_name}`,
          html,
        }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        console.error('Resend error:', err)
      }
    } catch (err) {
      console.error('Email send error:', err)
    }
  }

  return res.status(200).json({ success: true })
}

function escape(str) {
  return String(str || '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildEmailHtml({ restaurant_name, contact_name, email, phone, address, instagram, motivation }) {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F2;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E8E5DE;">
        <tr><td style="background-color:#22181C;padding:24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Nuova Candidatura Partner</h1>
        </td></tr>
        <tr><td style="padding:32px 24px;">
          <h2 style="margin:0 0 20px;color:#22181C;font-size:20px;">${escape(restaurant_name)}</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#22181C;">
            <tr><td style="padding:8px 0;color:#8A8680;width:140px;">Referente</td><td style="padding:8px 0;">${escape(contact_name)}</td></tr>
            <tr><td style="padding:8px 0;color:#8A8680;">Email</td><td style="padding:8px 0;"><a href="mailto:${escape(email)}" style="color:#E8453C;text-decoration:none;">${escape(email)}</a></td></tr>
            <tr><td style="padding:8px 0;color:#8A8680;">Telefono</td><td style="padding:8px 0;">${escape(phone)}</td></tr>
            <tr><td style="padding:8px 0;color:#8A8680;">Indirizzo</td><td style="padding:8px 0;">${escape(address)}</td></tr>
            <tr><td style="padding:8px 0;color:#8A8680;">Instagram</td><td style="padding:8px 0;">${escape(instagram)}</td></tr>
          </table>
          ${motivation ? `
          <div style="margin-top:24px;padding:16px;background-color:#FAF7F2;border-radius:12px;border:1px solid #E8E5DE;">
            <p style="margin:0 0 8px;color:#8A8680;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Perché sceglierli</p>
            <p style="margin:0;color:#22181C;font-size:14px;line-height:1.6;">${escape(motivation)}</p>
          </div>` : ''}
          <div style="margin-top:24px;text-align:center;">
            <a href="https://chiamamibi.com/admin/applications" style="display:inline-block;background-color:#E8453C;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;">
              Apri pannello admin
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:20px 24px;border-top:1px solid #E8E5DE;text-align:center;">
          <p style="margin:0;color:#8A8680;font-size:12px;">ChiamamiBi — Torino</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
