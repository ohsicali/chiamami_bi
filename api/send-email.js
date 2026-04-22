/**
 * Vercel Serverless Function — Unified email dispatcher
 *
 * Router interno su `type`:
 * - type='user'    → welcome email dopo Google OAuth (no auth, body {email, name})
 * - type='partner' → benvenuto ristoratore dopo admin insert (Bearer admin, body {to, nomeLocale, pin, restaurantId})
 *
 * Motivo del merge: Vercel Hobby cap = 12 serverless functions.
 */

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { type } = req.body || {}
  if (!type) return res.status(400).json({ error: 'Missing required field: type' })

  maybeCleanup()

  if (type === 'user')    return handleUserWelcome(req, res)
  if (type === 'partner') return handlePartnerWelcome(req, res)
  return res.status(400).json({ error: `Unknown type: ${type}` })
}

/* ------------------------------------------------------------------ */
/*  USER — ex welcome-email.js                                         */
/* ------------------------------------------------------------------ */

async function handleUserWelcome(req, res) {
  const limited = rateLimit(req, { key: 'send-email-user', max: 10, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' })

  const { email, name } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Email required' })

  const firstName = (name || '').split(' ')[0] || 'there'

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Bi <ciao@chiamamibi.com>',
        reply_to: process.env.RESEND_REPLY_TO || 'info@chiamamibi.com',
        to: [email],
        subject: `Benvenuta su ChiamamiBi, ${firstName}! 🍕`,
        html: buildWelcomeHtml(firstName),
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('Resend error:', err)
      return res.status(500).json({ error: 'Failed to send email' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Welcome email error:', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}

/* ------------------------------------------------------------------ */
/*  PARTNER — ex benvenuto-ristoratore.js                              */
/* ------------------------------------------------------------------ */

async function handlePartnerWelcome(req, res) {
  const limited = rateLimit(req, { key: 'send-email-partner', max: 5, windowMs: 60_000 })
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

  const { to, nomeLocale, pin, restaurantId } = req.body || {}
  if (!to || !nomeLocale || !pin || !restaurantId) {
    return res.status(400).json({ error: 'Missing required fields: to, nomeLocale, pin, restaurantId' })
  }

  // Generate one-shot magic token (24h TTL) for email CTA auto-login
  const magicToken = randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const { error: tokenError } = await admin
    .from('restaurants')
    .update({
      magic_token: magicToken,
      magic_token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', restaurantId)

  if (tokenError) {
    console.error('Failed to store magic token:', tokenError)
  }

  const verifyUrl = !tokenError
    ? `https://chiamamibi.com/verify?token=${magicToken}&pin=${encodeURIComponent(pin)}`
    : `https://chiamamibi.com/verify?pin=${encodeURIComponent(pin)}`

  const html = buildBenvenutoHtml({ nomeLocale, pin, verifyUrl })
  const text = buildBenvenutoText({ nomeLocale, pin, verifyUrl })

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Bi <ciao@chiamamibi.com>',
        reply_to: process.env.RESEND_REPLY_TO || 'info@chiamamibi.com',
        to: [to],
        subject: 'Ciao, sono Bi — il tuo accesso a ChiamamiBi',
        html,
        text,
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('Resend error:', err)
      return res.status(502).json({ error: 'Failed to send email', detail: err })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Benvenuto ristoratore email error:', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}

/* ------------------------------------------------------------------ */
/*  Template USER                                                       */
/* ------------------------------------------------------------------ */

function buildWelcomeHtml(name) {
  return `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#FFF8F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF8F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background-color:#E8604C;padding:32px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-family:'Georgia',serif;font-size:28px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">CHIAMAMI BI</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 24px;">
          <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:22px;">Ciao ${name}! 👋</h2>
          <p style="margin:0 0 16px;color:#4a4a4a;font-size:15px;line-height:1.6;">
            Benvenuta su <strong>ChiamamiBi</strong> — la tua guida ai migliori ristoranti di Torino!
          </p>
          <p style="margin:0 0 24px;color:#4a4a4a;font-size:15px;line-height:1.6;">
            Ecco cosa puoi fare:
          </p>

          <!-- Features -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#4a4a4a;font-size:14px;">🗺️ &nbsp;Esplora i ristoranti sulla mappa interattiva</td></tr>
            <tr><td style="padding:8px 0;color:#4a4a4a;font-size:14px;">❤️ &nbsp;Salva i tuoi preferiti</td></tr>
            <tr><td style="padding:8px 0;color:#4a4a4a;font-size:14px;">🏷️ &nbsp;Riscatta sconti esclusivi con QR code</td></tr>
          </table>

          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="https://chiamamibi.com" style="display:inline-block;background-color:#E8604C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600;">
                Esplora i ristoranti
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px;border-top:1px solid #f0e6e3;text-align:center;">
          <p style="margin:0 0 8px;color:#999;font-size:12px;">ChiamamiBi — Torino, Italia</p>
          <p style="margin:0;color:#999;font-size:12px;">
            <a href="https://chiamamibi.com/privacy" style="color:#E8604C;text-decoration:none;">Privacy Policy</a>
            &nbsp;·&nbsp;
            <a href="https://chiamamibi.com/terms" style="color:#E8604C;text-decoration:none;">Termini di Servizio</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/* ------------------------------------------------------------------ */
/*  Template PARTNER                                                    */
/* ------------------------------------------------------------------ */

// Tokens colore v4 hardcoded (i CSS var non funzionano nei client email)
// --corallo #E8453C  --ink #22181C  --page #FAF7F2  --cream #F2EDE4  --line #E8E1D4

function buildBenvenutoHtml({ nomeLocale, pin, verifyUrl }) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;-webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAF7F2;padding:40px 16px;">
    <tr><td align="center">

      <!-- Card 540px max -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background-color:#F2EDE4;border-radius:16px;border:1px solid #E8E1D4;overflow:hidden;">

        <!-- Wordmark header -->
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid #E8E1D4;">
            <img
              src="https://chiamamibi.com/email-assets/guida-bi-ink.png"
              alt="La Guida di Bi"
              width="180"
              height="30"
              style="display:block;max-width:180px;height:auto;border:0;outline:none;"
            />
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 0;">

            <!-- H1 -->
            <h1 style="margin:0 0 20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:700;line-height:1.2;color:#22181C;">
              Ciao, sono Bi.
            </h1>

            <!-- P1 -->
            <p style="margin:0 0 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:1.65;color:#22181C;">
              Ho aggiunto <strong>${escapeHtml(nomeLocale)}</strong> alla guida.
              Da questo momento puoi aggiornare la tua scheda, pubblicare un drop o uno sconto,
              e rispondere alle candidature dei clienti.
            </p>

            <!-- PIN box -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
              <tr>
                <td style="background-color:#ffffff;border:1px solid #E8E1D4;border-radius:14px;padding:20px 28px;text-align:center;">
                  <p style="margin:0 0 10px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#888888;">
                    Il tuo PIN di accesso
                  </p>
                  <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:700;letter-spacing:0.18em;color:#22181C;line-height:1;">
                    ${escapeHtml(pin)}
                  </p>
                </td>
              </tr>
            </table>

            <!-- P2 -->
            <p style="margin:0 0 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:1.65;color:#22181C;">
              Entra da
              <a href="${escapeHtml(verifyUrl)}" style="color:#E8453C;text-decoration:underline;">chiamamibi.com/verify</a>
              e inseriscilo. Il PIN resta lo stesso &mdash; salvalo dove vuoi, non te lo rimando.
            </p>

            <!-- CTA button -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
              <tr>
                <td align="center">
                  <a href="${escapeHtml(verifyUrl)}"
                     style="display:inline-block;background-color:#E8453C;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;min-height:44px;line-height:44px;padding-top:0;padding-bottom:0;">
                    Accedi alla dashboard
                  </a>
                </td>
              </tr>
            </table>

            <!-- P3 -->
            <p style="margin:0 0 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;line-height:1.65;color:#6A6A6A;">
              Se qualcosa non torna &mdash; una foto sbagliata, un orario che cambia,
              una segnalazione &mdash; scrivimi a
              <a href="mailto:info@chiamamibi.com" style="color:#E8453C;text-decoration:underline;">info@chiamamibi.com</a>.
              Rispondo io.
            </p>

            <!-- Signature -->
            <p style="margin:0 0 40px;font-family:'Palatino Linotype','Palatino','Georgia',cursive,serif;font-size:24px;font-weight:400;color:#22181C;font-style:italic;">
              &mdash; Bi
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #E8E1D4;text-align:center;">
            <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:400;color:#888888;">
              ChiamamiBi &nbsp;&middot;&nbsp; Torino &nbsp;&middot;&nbsp;
              <a href="https://chiamamibi.com" style="color:#888888;text-decoration:none;">chiamamibi.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`
}

function buildBenvenutoText({ nomeLocale, pin, verifyUrl }) {
  return `Ciao, sono Bi.

Ho aggiunto ${nomeLocale} alla guida. Da questo momento puoi aggiornare la tua scheda, pubblicare un drop o uno sconto, e rispondere alle candidature dei clienti.

IL TUO PIN DI ACCESSO
${pin}

Entra da ${verifyUrl} e inseriscilo. Il PIN resta lo stesso — salvalo dove vuoi, non te lo rimando.

Se qualcosa non torna — una foto sbagliata, un orario che cambia, una segnalazione — scrivimi a info@chiamamibi.com. Rispondo io.

— Bi

ChiamamiBi · Torino · chiamamibi.com`
}

/* ------------------------------------------------------------------ */
/*  Utility                                                             */
/* ------------------------------------------------------------------ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
