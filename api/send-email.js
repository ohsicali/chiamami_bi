/**
 * Vercel Serverless Function — Unified email dispatcher
 *
 * Router interno su `type`:
 * - type='user'            → welcome email dopo Google OAuth (no auth, body {email, name})
 * - type='partner'         → benvenuto ristoratore dopo admin insert (Bearer admin, body {to, nomeLocale, pin, restaurantId})
 * - type='confirmation'    → conferma suggerimento utente (no auth, body {to, nome_locale, nome_utente?})
 * - type='internal-notify' → notifica interna a info@chiamamibi.com (no auth, body {nome_locale, address?, tags?, description?, nome_utente?, email_utente, id?})
 *
 * Motivo del merge: Vercel Hobby cap = 12 serverless functions.
 */

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'
import { applyCors } from './_cors.js'
import { verifyTurnstile } from './_turnstile.js'
import {
  welcomeEmail, newDiscountEmail, newRestaurantEmail,
  discountClaimedEmail, discountUsedEmail, SAMPLE,
} from './_email/templates.js'
import {
  sendEmail, claimSendSlot, logFailure, tokenForUser,
  unsubscribeUrl, listUnsubscribeHeaders,
} from './_email/send.js'
import { formatDiscountBadge, pickPerk } from './_email/discount.js'
import { SITE_URL as PUBLIC_SITE } from './_email/theme.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { type } = req.body || {}
  if (!type) return res.status(400).json({ error: 'Missing required field: type' })

  maybeCleanup()

  if (type === 'user')                             return handleUserWelcome(req, res)
  if (type === 'partner')                          return handlePartnerWelcome(req, res)
  if (type === 'confirmation')                     return handleSuggestionConfirmation(req, res)
  if (type === 'internal-notify')                  return handleInternalNotify(req, res)
  if (type === 'partner-application-confirmation') return handlePartnerApplicationConfirmation(req, res)
  // Le ricevute degli sconti (Blocco mail): chi le chiede deve essere
  // l'utente stesso, con il proprio token di sessione — vedi handleDiscount*.
  if (type === 'discount-claimed')                 return handleDiscountClaimed(req, res)
  if (type === 'discount-used')                    return handleDiscountUsed(req, res)
  // Anteprima: manda a sé stesso una copia di prova di una qualunque email.
  if (type === 'preview')                          return handlePreview(req, res)
  return res.status(400).json({ error: `Unknown type: ${type}` })
}

/* ------------------------------------------------------------------ */
/*  Le ricevute degli sconti                                           */
/* ------------------------------------------------------------------ */

/**
 * Da chi arriva la richiesta.
 *
 * Non ci si fida del `userId` scritto nel corpo: chiunque potrebbe mandare
 * quello di un altro e farsi spedire il codice sconto altrui. L'identità la
 * decide il token di sessione, e l'email la leggiamo dal profilo, non dal
 * corpo della richiesta.
 */
async function requireUser(req) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return { error: 'Missing authorization token', status: 401 }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) return { error: 'Server configuration error', status: 500 }

  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const { data: { user }, error } = await asUser.auth.getUser()
  if (error || !user) return { error: 'Invalid token', status: 401 }

  const admin = createClient(url, service, { auth: { persistSession: false } })
  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .maybeSingle()

  return {
    user,
    admin,
    email: profile?.email || user.email,
    name: profile?.full_name || user.user_metadata?.full_name || '',
  }
}

/** POST { type:'discount-claimed', redemptionId } — il codice via email. */
async function handleDiscountClaimed(req, res) {
  const limited = rateLimit(req, { key: 'send-email-claimed', max: 20, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const ctx = await requireUser(req)
  if (ctx.error) return res.status(ctx.status).json({ error: ctx.error })

  const { redemptionId } = req.body || {}
  if (!redemptionId) return res.status(400).json({ error: 'redemptionId required' })

  // Il riscatto deve essere suo: `eq('user_id', …)` non è ridondante con la
  // RLS, perché qui stiamo usando la service role key che la salta.
  const { data: red } = await ctx.admin
    .from('discount_redemptions')
    .select('id, qr_code, status, generated_at, discount_id, user_id, discount:discounts(*, restaurant:restaurants(name, slug, address, neighborhood, city, cuisine_type))')
    .eq('id', redemptionId)
    .eq('user_id', ctx.user.id)
    .maybeSingle()

  if (!red) return res.status(404).json({ error: 'Redemption not found' })
  if (!ctx.email) return res.status(400).json({ error: 'No email on profile' })

  const first = await claimSendSlot(ctx.admin, {
    userId: ctx.user.id, kind: 'discount-claimed', refId: red.id, toEmail: ctx.email,
  })
  if (!first) return res.status(200).json({ ok: true, skipped: 'already-sent' })

  const mail = discountClaimedEmail(discountClaimedProps(red))
  const r = await sendEmail({ to: ctx.email, ...mail })
  if (!r.ok) {
    await logFailure(ctx.admin, { userId: ctx.user.id, kind: 'discount-claimed', refId: red.id, toEmail: ctx.email, error: r.error })
    return res.status(502).json({ error: 'Send failed', detail: r.error })
  }
  return res.status(200).json({ ok: true, id: r.id })
}

/** POST { type:'discount-used', redemptionId } — la conferma dopo la scansione. */
async function handleDiscountUsed(req, res) {
  const limited = rateLimit(req, { key: 'send-email-used', max: 30, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  // Qui chi chiama è il locale che ha appena scansionato, non l'utente:
  // l'autorizzazione è il codice QR stesso, che solo chi ha il telefono in
  // mano davanti a sé può aver letto.
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) return res.status(500).json({ error: 'Server configuration error' })
  const admin = createClient(url, service, { auth: { persistSession: false } })

  const { qrCode } = req.body || {}
  if (!qrCode) return res.status(400).json({ error: 'qrCode required' })

  const { data: red } = await admin
    .from('discount_redemptions')
    .select('id, status, redeemed_at, user_id, discount:discounts(*, restaurant:restaurants(name, slug))')
    .eq('qr_code', qrCode)
    .maybeSingle()

  if (!red) return res.status(404).json({ error: 'Redemption not found' })
  // 'redeemed' è il valore che scrive la RPC verify_redeem_qr: mandare la
  // conferma per uno sconto non ancora scansionato sarebbe una bugia.
  if (red.status !== 'redeemed') return res.status(409).json({ error: 'Redemption not marked as redeemed' })

  const { data: profile } = await admin
    .from('profiles').select('email').eq('id', red.user_id).maybeSingle()
  const to = profile?.email
  if (!to) return res.status(200).json({ ok: true, skipped: 'no-email' })

  const first = await claimSendSlot(admin, {
    userId: red.user_id, kind: 'discount-used', refId: red.id, toEmail: to,
  })
  if (!first) return res.status(200).json({ ok: true, skipped: 'already-sent' })

  const mail = discountUsedEmail(discountUsedProps(red))
  const r = await sendEmail({ to, ...mail })
  if (!r.ok) {
    await logFailure(admin, { userId: red.user_id, kind: 'discount-used', refId: red.id, toEmail: to, error: r.error })
    return res.status(502).json({ error: 'Send failed', detail: r.error })
  }
  return res.status(200).json({ ok: true, id: r.id })
}

/** POST { type:'preview', template } — una copia di prova a sé stessi (admin). */
async function handlePreview(req, res) {
  const ctx = await requireUser(req)
  if (ctx.error) return res.status(ctx.status).json({ error: ctx.error })

  const { data: me } = await ctx.admin
    .from('profiles').select('is_admin').eq('id', ctx.user.id).maybeSingle()
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin only' })

  const { template } = req.body || {}
  const token = await tokenForUser(ctx.admin, ctx.user.id)
  const u = unsubscribeUrl(token)
  const built = {
    welcome: () => welcomeEmail({ ...SAMPLE.welcome, name: ctx.name || SAMPLE.welcome.name, unsubscribeUrl: u }),
    'new-discount': () => newDiscountEmail({ ...SAMPLE.newDiscount, unsubscribeUrl: u }),
    'new-place': () => newRestaurantEmail({ ...SAMPLE.newRestaurant, unsubscribeUrl: u }),
    'discount-claimed': () => discountClaimedEmail(SAMPLE.discountClaimed),
    'discount-used': () => discountUsedEmail(SAMPLE.discountUsed),
  }[template]

  if (!built) return res.status(400).json({ error: `Unknown template: ${template}` })
  const mail = built()
  const r = await sendEmail({
    to: ctx.email,
    subject: `[PROVA] ${mail.subject}`,
    html: mail.html,
    text: mail.text,
    headers: listUnsubscribeHeaders(token),
  })
  if (!r.ok) return res.status(502).json({ error: 'Send failed', detail: r.error })
  return res.status(200).json({ ok: true, to: ctx.email, id: r.id })
}

/* ── Dalla riga del DB ai campi dell'email ───────────────────────────── */

function discountClaimedProps(red) {
  const d = red.discount || {}
  const r = d.restaurant || {}
  return {
    value: formatDiscountBadge(d),
    restaurantName: r.name || 'il locale',
    perk: pickPerk(d),
    conditions: (d.conditions || '').trim() || null,
    address: [r.address, r.city].filter(Boolean).join(', ') || null,
    code: red.qr_code,
    expiryLabel: expiryLabel(d),
    href: `${PUBLIC_SITE}/sconti`,
  }
}

function discountUsedProps(red) {
  const d = red.discount || {}
  const r = d.restaurant || {}
  return {
    value: formatDiscountBadge(d),
    restaurantName: r.name || 'il locale',
    whenLabel: red.redeemed_at ? formatWhen(red.redeemed_at) : null,
    href: `${PUBLIC_SITE}/sconti`,
  }
}

function expiryLabel(d) {
  if (!d?.valid_until) return null
  const date = new Date(d.valid_until)
  if (Number.isNaN(date.getTime())) return null
  return `Scade il ${date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })}`
}

function formatWhen(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `il ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })} alle ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}`
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  // Il token per "scegli cosa ricevere": senza, il benvenuto sarebbe l'unica
  // email di annuncio senza via d'uscita. Lo cerchiamo con la service role
  // key perché qui la chiamata arriva subito dopo la registrazione, quando
  // il browser una sessione valida può non averla ancora.
  let unsubUrl = null
  try {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && service) {
      const admin = createClient(url, service, { auth: { persistSession: false } })
      const { data: prof } = await admin
        .from('profiles').select('id').eq('email', String(email).trim().toLowerCase()).maybeSingle()
      if (prof?.id) unsubUrl = unsubscribeUrl(await tokenForUser(admin, prof.id))
    }
  } catch { /* il benvenuto parte comunque */ }

  const mail = welcomeEmail({ name, unsubscribeUrl: unsubUrl })

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
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
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
/*  CONFIRMATION — conferma suggerimento all'utente proponente         */
/* ------------------------------------------------------------------ */

async function handleSuggestionConfirmation(req, res) {
  // Tightened from 5 → 3 / min: this endpoint is unauthenticated and a
  // determined attacker could use it to spam arbitrary inboxes via Resend.
  const limited = rateLimit(req, { key: 'send-email-confirmation', max: 3, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' })

  const { to, nome_locale, nome_utente } = req.body || {}
  if (!to || !nome_locale) return res.status(400).json({ error: 'Missing required fields: to, nome_locale' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: 'Invalid email address' })

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
        subject: 'Ho ricevuto il tuo suggerimento',
        html: buildConfirmationHtml({ nome_utente: nome_utente || '', nome_locale }),
        headers: {
          'List-Unsubscribe': '<mailto:info@chiamamibi.com?subject=unsubscribe>',
        },
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('[send-email confirmation] Resend error:', err)
      return res.status(502).json({ error: 'Failed to send email' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[send-email confirmation] error:', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}

/* ------------------------------------------------------------------ */
/*  INTERNAL-NOTIFY — notifica interna a info@chiamamibi.com           */
/* ------------------------------------------------------------------ */

async function handleInternalNotify(req, res) {
  // Unauthenticated endpoint that delivers arbitrary user-supplied text to
  // info@chiamamibi.com. Defenses, layered:
  //   • Cloudflare Turnstile (verifyTurnstile below)
  //   • Rate-limit 3/min per IP
  //   • Strict input validation
  const limited = rateLimit(req, { key: 'send-email-internal-notify', max: 3, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const captcha = await verifyTurnstile(req)
  if (!captcha.ok) return res.status(captcha.status).json({ error: captcha.error })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' })

  const { nome_locale, address, tags, description, nome_utente, email_utente, id } = req.body || {}
  if (!nome_locale || !email_utente) {
    return res.status(400).json({ error: 'Missing required fields: nome_locale, email_utente' })
  }
  // Strict email validation — escapeHtml already runs in the template, but
  // reject anything that's not a real address up front (prevents future
  // template variants from accidentally introducing a header injection).
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(email_utente).trim())) {
    return res.status(400).json({ error: 'Invalid email_utente' })
  }
  // Cap free-text field lengths to prevent oversized payloads to Resend.
  const cap = (v, n) => (v == null ? null : String(v).slice(0, n))
  const safe = {
    nome_locale: cap(nome_locale, 200),
    address: cap(address, 500),
    tags: cap(tags, 500),
    description: cap(description, 2000),
    nome_utente: cap(nome_utente, 200),
    email_utente: String(email_utente).trim().slice(0, 254),
    id,
  }

  // No individual detail route exists — link to the filterable list
  const urlAdmin = `https://chiamamibi.com/admin/suggestions`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Bi <ciao@chiamamibi.com>',
        to: ['info@chiamamibi.com'],
        subject: `[Bi] Nuovo suggerimento: ${safe.nome_locale}`,
        html: buildInternalNotifyHtml({
          nome_locale: safe.nome_locale,
          address: safe.address,
          tags: safe.tags,
          description: safe.description,
          nome_utente: safe.nome_utente || '',
          email_utente: safe.email_utente,
          urlAdmin,
        }),
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('[send-email internal-notify] Resend error:', err)
      return res.status(502).json({ error: 'Failed to send email' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[send-email internal-notify] error:', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}

/* ------------------------------------------------------------------ */
/*  Template CONFIRMATION                                               */
/* ------------------------------------------------------------------ */

function buildConfirmationHtml({ nome_utente, nome_locale }) {
  const greeting = nome_utente ? `Ciao ${escapeHtml(nome_utente)},` : 'Ciao,'
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;-webkit-font-smoothing:antialiased;">

  <!-- Preheader hidden -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Ci passo e ti faccio sapere</span>

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

            <p style="margin:0 0 20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:1.65;color:#22181C;">
              ${greeting}
            </p>

            <p style="margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:1.65;color:#22181C;">
              Grazie per avermi suggerito <strong>${escapeHtml(nome_locale)}</strong>. Ci vado al pi&ugrave; presto &mdash; se merita, finisce nella Guida.
            </p>

            <p style="margin:0 0 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:1.65;color:#22181C;">
              Ogni segnalazione la leggo io, anche quelle che non passano il mio filtro. Se ti va di suggerirne altri, sai dove trovarmi.
            </p>

            <!-- CTA button -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
              <tr>
                <td>
                  <a href="https://chiamamibi.com"
                     style="display:inline-block;background-color:#E8453C;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1;">
                    Torna alla Guida
                  </a>
                </td>
              </tr>
            </table>

            <!-- Signature -->
            <p style="margin:0 0 8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:1.65;color:#22181C;">
              A presto,
            </p>
            <p style="margin:0 0 40px;font-family:'Palatino Linotype','Palatino','Georgia',cursive,serif;font-size:24px;font-weight:400;color:#22181C;font-style:italic;">
              &mdash; Bi
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #E8E1D4;">
            <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:400;color:#8E6B3E;">
              ChiamamiBi &nbsp;&middot;&nbsp; Torino &nbsp;&middot;&nbsp;
              <a href="mailto:info@chiamamibi.com" style="color:#8E6B3E;text-decoration:none;">info@chiamamibi.com</a>
              &nbsp;&middot;&nbsp;
              <a href="https://chiamamibi.com/privacy" style="color:#8E6B3E;text-decoration:none;">Privacy</a>
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
/*  Template INTERNAL-NOTIFY                                           */
/* ------------------------------------------------------------------ */

function buildInternalNotifyHtml({ nome_locale, address, tags, description, nome_utente, email_utente, urlAdmin }) {
  const tagsHtml = tags
    ? `<tr style="border-top:1px solid #EAE3D7;"><td style="color:#8E6B3E;padding:8px 12px;width:120px;vertical-align:top;">Categorie</td><td style="padding:8px 12px;">${escapeHtml(tags)}</td></tr>`
    : ''
  const addressHtml = address
    ? `<tr style="border-top:1px solid #EAE3D7;"><td style="color:#8E6B3E;padding:8px 12px;width:120px;">Zona</td><td style="padding:8px 12px;">${escapeHtml(address)}</td></tr>`
    : ''
  const descriptionHtml = description
    ? `<div style="margin-top:16px;">
        <p style="margin:0 0 6px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8E6B3E;">Nota</p>
        <p style="margin:0;background:#fff;border:1px solid #E8E1D4;border-radius:8px;padding:12px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#22181C;white-space:pre-wrap;">${escapeHtml(description)}</p>
      </div>`
    : ''
  const mittente = nome_utente
    ? `${escapeHtml(nome_utente)} &middot; <a href="mailto:${escapeHtml(email_utente)}" style="color:#22181C;text-decoration:none;">${escapeHtml(email_utente)}</a>`
    : `<a href="mailto:${escapeHtml(email_utente)}" style="color:#22181C;text-decoration:none;">${escapeHtml(email_utente)}</a>`

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:24px;background-color:#FAF7F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#22181C;font-size:14px;line-height:1.5;">

  <div style="max-width:540px;margin:0 auto;">

    <p style="margin:0 0 16px;font-weight:700;font-size:15px;">Nuovo suggerimento da rivedere in admin:</p>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#F2EDE4;border:1px solid #E8E1D4;border-radius:8px;width:100%;overflow:hidden;">
      <tr>
        <td style="color:#8E6B3E;padding:8px 12px;width:120px;">Locale</td>
        <td style="padding:8px 12px;font-weight:600;">${escapeHtml(nome_locale)}</td>
      </tr>
      ${addressHtml}
      ${tagsHtml}
      <tr style="border-top:1px solid #EAE3D7;">
        <td style="color:#8E6B3E;padding:8px 12px;width:120px;vertical-align:top;">Suggerito da</td>
        <td style="padding:8px 12px;">${mittente}</td>
      </tr>
    </table>

    ${descriptionHtml}

    <p style="margin:24px 0 0;">
      <a href="${escapeHtml(urlAdmin)}" style="color:#E8453C;font-weight:700;text-decoration:none;">&rarr; Apri in admin</a>
    </p>

    <p style="margin-top:32px;font-size:11px;color:#8E6B3E;border-top:1px solid #E8E1D4;padding-top:12px;">
      Notifica automatica &nbsp;&middot;&nbsp; chiamamibi.com/admin
    </p>

  </div>

</body>
</html>`
}

/* ------------------------------------------------------------------ */
/*  PARTNER-APPLICATION-CONFIRMATION — conferma al candidato           */
/* ------------------------------------------------------------------ */

async function handlePartnerApplicationConfirmation(req, res) {
  const limited = rateLimit(req, { key: 'send-email-partner-app-conf', max: 5, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' })

  const { to, nome_referente, nome_attivita } = req.body || {}
  if (!to || !nome_referente || !nome_attivita) {
    return res.status(400).json({ error: 'Missing required fields: to, nome_referente, nome_attivita' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Bi <ciao@chiamamibi.com>',
        reply_to: 'info@chiamamibi.com',
        to: [to],
        subject: 'Abbiamo ricevuto la tua richiesta',
        html: buildPartnerAppConfirmationHtml({ nome_referente, nome_attivita }),
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('[send-email partner-application-confirmation] Resend error:', err)
      return res.status(502).json({ error: 'Failed to send email' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[send-email partner-application-confirmation] error:', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}

/* ------------------------------------------------------------------ */
/*  Template PARTNER-APPLICATION-CONFIRMATION                          */
/* ------------------------------------------------------------------ */

function buildPartnerAppConfirmationHtml({ nome_referente, nome_attivita }) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,'Poppins',Helvetica,sans-serif;color:#22181C;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF7F2;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#F2EDE4;border-radius:16px;border:1px solid #E8E1D4;overflow:hidden;">

        <!-- Wordmark -->
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid #E8E1D4;">
            <img src="https://chiamamibi.com/email-assets/guida-bi-ink.png" alt="CHIAMAMI BI" width="180" style="display:block;max-width:180px;height:auto;border:0;outline:none;" />
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 0;font-size:16px;line-height:1.65;">
            <p style="margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#22181C;">
              Gentile ${escapeHtml(nome_referente)},
            </p>
            <p style="margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#22181C;">
              grazie per aver scelto di raccontare il tuo progetto al team di Bi.
              Abbiamo ricevuto correttamente la tua richiesta di collaborazione
              per <strong>${escapeHtml(nome_attivita)}</strong>.
            </p>
            <p style="margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#22181C;">
              Il team di Bi analizzer&agrave; la richiesta nei prossimi 7 giorni.
              In caso di valutazione positiva, ti contatteremo personalmente
              per discutere le modalit&agrave; di promozione sui canali di Bi
              &mdash; sito, social, feed editoriale.
            </p>
            <p style="margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#22181C;">
              Ti segnaliamo che la mancata risposta entro 7 giorni equivale
              a una non selezione per il periodo in corso.
            </p>
            <p style="margin:0 0 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#22181C;">
              Grazie dell&rsquo;interesse verso ChiamamiBi.
            </p>
            <p style="margin:0 0 40px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#22181C;">
              Il team di ChiamamiBi
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #E8E1D4;">
            <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#8E6B3E;line-height:1.5;">
              ChiamamiBi &nbsp;&middot;&nbsp; Torino &nbsp;&middot;&nbsp;
              <a href="mailto:info@chiamamibi.com" style="color:#8E6B3E;text-decoration:none;">info@chiamamibi.com</a>
              &nbsp;&middot;&nbsp;
              <a href="https://chiamamibi.com/privacy" style="color:#8E6B3E;text-decoration:none;">Privacy</a>
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
