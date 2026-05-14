/**
 * Vercel Serverless Function — Recovery OTP (request + verify in single file)
 *
 * Consolidato 2026-04-27 (PR21): la verifica OTP è stata accorpata qui dal
 * vecchio /api/verify-recovery-otp per restare entro il cap 12 funzioni
 * Vercel Hobby quando si è aggiunto /api/discount/pdf/[id].
 *
 * Dispatch by request body:
 *   - body.otp presente → step "verify": valida OTP + esegue azione
 *     (reset_password o verify_recovery con eventuale new_email/new_password)
 *   - altrimenti → step "request": genera OTP, lo salva in
 *     auth_recovery_tokens, lo manda via Resend all'email di recupero
 *
 * Compatibilità:
 *   - Vecchi client che chiamano /api/verify-recovery-otp continuano a
 *     funzionare grazie al rewrite in vercel.json.
 */
import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'
import { applyCors } from './_cors.js'
import { verifyTurnstile } from './_turnstile.js'

const MAX_FAILED_ATTEMPTS = 5

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body || {}
  const isVerify = !!body.otp

  // Rate-limit separato per i due step. Verify abbassato da 10 a 5/min per
  // limitare brute-force distribuito; in più la riga auth_recovery_tokens
  // viene cancellata dopo MAX_FAILED_ATTEMPTS tentativi falliti (sotto).
  maybeCleanup()
  const limited = isVerify
    ? rateLimit(req, { key: 'verify-recovery-otp', max: 5, windowMs: 60_000 })
    : rateLimit(req, { key: 'recovery-otp', max: 5, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return isVerify
    ? handleVerify({ adminClient, body, res })
    : handleRequest({ adminClient, body, req, res })
}

/* ===================== STEP "request" ===================== */
async function handleRequest({ adminClient, body, req, res }) {
  const { email, action } = body
  // email = the primary email of the account
  // action = 'verify_recovery' | 'reset_password'

  if (!email || !action) {
    return res.status(400).json({ error: 'Email and action required' })
  }

  // Captcha required only on the "request" step — the verify step is gated
  // by knowledge of the OTP itself and the failed_attempts cap.
  const captcha = await verifyTurnstile(req)
  if (!captcha.ok) return res.status(captcha.status).json({ error: captcha.error })

  const resendKey = process.env.RESEND_API_KEY

  try {
    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, recovery_email, full_name')
      .eq('email', email)
      .single()

    if (profileErr || !profile) {
      return res.status(200).json({ success: true, message: 'Se l\'account esiste e ha un\'email di recupero, riceverai un codice.' })
    }

    if (!profile.recovery_email) {
      return res.status(200).json({ success: false, no_recovery: true, message: 'Nessuna email di recupero configurata. Contatta supporto@chiamamibi.com' })
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { error: upsertErr } = await adminClient
      .from('auth_recovery_tokens')
      .upsert({
        user_id: profile.id,
        otp,
        expires_at: expiresAt,
        action,
      }, { onConflict: 'user_id' })

    if (upsertErr) {
      console.error('Recovery OTP upsert error:', upsertErr)
      return res.status(500).json({ error: 'Internal error' })
    }

    if (!resendKey) {
      return res.status(500).json({ error: 'Email service not configured' })
    }

    const firstName = (profile.full_name || '').split(' ')[0] || 'Utente'
    const actionText = action === 'reset_password' ? 'reimpostare la password' : 'cambiare l\'email'

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Bi <ciao@chiamamibi.com>',
        reply_to: process.env.RESEND_REPLY_TO || 'info@chiamamibi.com',
        to: [profile.recovery_email],
        subject: `${otp} — Codice di recupero ChiamamiBi`,
        html: buildOtpHtml(firstName, otp, actionText),
      }),
    })

    if (!emailResponse.ok) {
      console.error('Resend error:', await emailResponse.json())
      return res.status(500).json({ error: 'Failed to send recovery email' })
    }

    const masked = maskEmail(profile.recovery_email)
    return res.status(200).json({ success: true, masked_email: masked })
  } catch (err) {
    console.error('Recovery OTP error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}

/* ===================== STEP "verify" ===================== */
async function handleVerify({ adminClient, body, res }) {
  const { email, otp, new_email, new_password } = body

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP required' })
  }

  try {
    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (profileErr || !profile) {
      return res.status(400).json({ error: 'Account non trovato' })
    }

    const { data: token, error: tokenErr } = await adminClient
      .from('auth_recovery_tokens')
      .select('otp, expires_at, action, failed_attempts')
      .eq('user_id', profile.id)
      .single()

    if (tokenErr || !token) {
      return res.status(400).json({ error: 'Codice non valido' })
    }

    if (new Date(token.expires_at) < new Date()) {
      await adminClient
        .from('auth_recovery_tokens')
        .delete()
        .eq('user_id', profile.id)
      return res.status(400).json({ error: 'Codice scaduto. Richiedine uno nuovo.' })
    }

    // Defense-in-depth against brute force: cap failed attempts per OTP row.
    // The column is added by supabase/security-hardening-2026-05.sql; if the
    // migration hasn't run yet the field is `undefined` and we skip the cap
    // (rate-limit still applies).
    const currentFailed = Number(token.failed_attempts) || 0
    if (currentFailed >= MAX_FAILED_ATTEMPTS) {
      await adminClient
        .from('auth_recovery_tokens')
        .delete()
        .eq('user_id', profile.id)
      return res.status(429).json({ error: 'Troppi tentativi errati. Richiedi un nuovo codice.' })
    }

    if (!token.otp || token.otp !== String(otp).trim()) {
      // Best-effort increment; ignore failure if column missing.
      await adminClient
        .from('auth_recovery_tokens')
        .update({ failed_attempts: currentFailed + 1 })
        .eq('user_id', profile.id)
        .then(() => null, () => null)
      return res.status(400).json({ error: 'Codice non valido' })
    }

    const action = token.action

    // One-time use: pulisci subito.
    await adminClient
      .from('auth_recovery_tokens')
      .delete()
      .eq('user_id', profile.id)

    if (action === 'reset_password' && new_password) {
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(profile.id, {
        password: new_password,
      })
      if (updateErr) {
        return res.status(500).json({ error: `Errore: ${updateErr.message}` })
      }
      return res.status(200).json({ success: true, action: 'password_reset' })
    }

    if (action === 'verify_recovery' && new_email) {
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(profile.id, {
        email: new_email,
      })
      if (updateErr) {
        return res.status(500).json({ error: `Errore: ${updateErr.message}` })
      }
      await adminClient.from('profiles').update({ email: new_email }).eq('id', profile.id)
      return res.status(200).json({ success: true, action: 'email_changed' })
    }

    return res.status(200).json({ success: true, action: 'verified' })
  } catch (err) {
    console.error('Verify recovery OTP error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}

function maskEmail(email) {
  const [user, domain] = email.split('@')
  const masked = user.slice(0, 2) + '***'
  return `${masked}@${domain}`
}

function buildOtpHtml(name, otp, actionText) {
  return `
<div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #f0f0f0;">
  <div style="background:#FF5757;padding:32px 24px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:2px;">CHIAMAMI BI</h1>
  </div>
  <div style="padding:32px 24px;">
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a1a1a;">Codice di recupero</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      Ciao ${name}, hai richiesto di ${actionText} del tuo account ChiamamiBi.
      Usa questo codice per procedere. Il codice scade tra 10 minuti.
    </p>
    <div style="background:#fff5f5;border:2px solid #FF5757;border-radius:12px;padding:16px;text-align:center;margin-bottom:24px;">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#FF5757;font-family:monospace;">${otp}</span>
    </div>
  </div>
  <div style="padding:20px 24px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
    <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;">Se non hai richiesto questo codice, ignora questa email.</p>
    <p style="margin:0;font-size:11px;color:#9ca3af;">ChiamamiBi — Torino, Italia</p>
  </div>
</div>`
}
