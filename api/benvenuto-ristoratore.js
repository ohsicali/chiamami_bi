/**
 * Vercel Serverless Function — Invia mail di benvenuto al ristoratore
 * Chiamata dall'admin form subito dopo INSERT di un nuovo ristorante con verify_pin.
 *
 * Body atteso: { to, nomeLocale, pin, verifyUrl }
 * Auth: Bearer token dell'admin (validato via Supabase service role).
 */

import { createClient } from '@supabase/supabase-js'

const RATE_LIMIT_MAP = new Map()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW = 60_000

function checkRateLimit(ip) {
  const now = Date.now()
  const entry = RATE_LIMIT_MAP.get(ip) || { count: 0, reset: now + RATE_LIMIT_WINDOW }
  if (now > entry.reset) {
    entry.count = 0
    entry.reset = now + RATE_LIMIT_WINDOW
  }
  entry.count++
  RATE_LIMIT_MAP.set(ip, entry)
  return entry.count <= RATE_LIMIT_MAX
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown'
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Too many requests' })

  // Verifica che sia un admin autenticato
  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' })
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'DB not configured' })

  try {
    // Verifica admin
    const supabaseAdmin = createClient(supabaseUrl, serviceKey)
    const { data: { user }, error: authError } = await createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || serviceKey)
      .auth.getUser(token)
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (!profile?.is_admin) return res.status(403).json({ error: 'Admin only' })
  } catch {
    return res.status(401).json({ error: 'Auth check failed' })
  }

  const { to, nomeLocale, pin, verifyUrl } = req.body || {}
  if (!to || !nomeLocale || !pin || !verifyUrl) {
    return res.status(400).json({ error: 'Missing required fields: to, nomeLocale, pin, verifyUrl' })
  }

  const html = buildBenvenutoHtml({ nomeLocale, pin, verifyUrl })
  const text = buildBenvenutoText({ nomeLocale, pin, verifyUrl })

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
/*  Template HTML                                                       */
/* ------------------------------------------------------------------ */

// Tokens colore v4 hardcoded (i CSS var non funzionano nei client email)
// --corallo #E8453C  --ink #22181C  --page #FAF7F2  --cream #F2EDE4  --line #E8E1D4

function buildBenvenutoHtml({ nomeLocale, pin, verifyUrl }) {
  // PIN formattato con spazi ogni 2 cifre per leggibilità: "34 82 91"
  const pinFormatted = pin.replace(/(\d{2})(\d{2})(\d{2})/, '$1 $2 $3')

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
            <span style="font-family:'Georgia',serif;font-size:18px;font-weight:700;color:#22181C;letter-spacing:0.04em;">ChiamamiBi</span>
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
                    ${escapeHtml(pinFormatted)}
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

/* ------------------------------------------------------------------ */
/*  Plain text fallback                                                 */
/* ------------------------------------------------------------------ */

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
