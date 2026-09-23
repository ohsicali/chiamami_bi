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
import { randomInt, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'
import { applyCors } from './_cors.js'
import { recoveryOtpEmail } from './_email/templates.js'
import { sendEmail } from './_email/send.js'
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
  if (action !== 'reset_password' && action !== 'verify_recovery') {
    return res.status(400).json({ error: 'Invalid action' })
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

    // crypto, non Math.random: chi indovina il codice cambia password o
    // email dell'account.
    const otp = String(randomInt(100000, 1000000))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { error: upsertErr } = await adminClient
      .from('auth_recovery_tokens')
      .upsert({
        user_id: profile.id,
        otp,
        expires_at: expiresAt,
        action,
        // Un codice nuovo riparte da zero tentativi: senza, il contatore
        // restava quello del codice precedente.
        failed_attempts: 0,
      }, { onConflict: 'user_id' })

    if (upsertErr) {
      console.error('Recovery OTP upsert error:', upsertErr)
      return res.status(500).json({ error: 'Internal error' })
    }

    if (!resendKey) {
      return res.status(500).json({ error: 'Email service not configured' })
    }

    // Senza nome si saluta e basta: "Ciao Utente" è peggio di "Ciao".
    const firstName = (profile.full_name || '').split(' ')[0] || ''
    const actionText = action === 'reset_password' ? 'reimpostare la password' : 'cambiare l\'email'

    const mail = recoveryOtpEmail({ name: firstName, otp, actionText })
    const sentMail = await sendEmail({ to: profile.recovery_email, ...mail })

    if (!sentMail.ok) {
      console.error('[recovery-otp] ', sentMail.error)
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
  // Prima di consumare il codice: un input storto non deve bruciare l'OTP.
  if (new_password != null && (typeof new_password !== 'string' || new_password.length < 6 || new_password.length > 72)) {
    return res.status(400).json({ error: 'La password deve avere fra 6 e 72 caratteri' })
  }
  if (new_email != null && (typeof new_email !== 'string' || new_email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email.trim()))) {
    return res.status(400).json({ error: 'Email non valida' })
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

    if (!token.otp || !sameCode(token.otp, String(otp).trim())) {
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

/** Confronto a tempo costante: il tempo di risposta non dice quante cifre sono giuste. */
function sameCode(expected, given) {
  const a = Buffer.from(String(expected))
  const b = Buffer.from(String(given))
  return a.length === b.length && timingSafeEqual(a, b)
}

function maskEmail(email) {
  const [user, domain] = email.split('@')
  const masked = user.slice(0, 2) + '***'
  return `${masked}@${domain}`
}

