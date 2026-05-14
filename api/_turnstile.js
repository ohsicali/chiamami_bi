/**
 * Cloudflare Turnstile server-side validator.
 *
 * Validates a Turnstile token via the siteverify endpoint. Returns:
 *   - { ok: true }                       on successful verification
 *   - { ok: true, skipped: true }        when TURNSTILE_SECRET_KEY is unset
 *     (dev / local environments — no captcha enforcement)
 *   - { ok: false, status, error }       on failure (caller should 4xx)
 *
 * Usage in a Vercel function:
 *   import { verifyTurnstile } from './_turnstile.js'
 *   const v = await verifyTurnstile(req)
 *   if (!v.ok) return res.status(v.status).json({ error: v.error })
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

function clientIp(req) {
  const h = req.headers || {}
  const fwd = (h['x-forwarded-for'] || '').toString().split(',')[0].trim()
  return fwd || h['x-real-ip'] || h['cf-connecting-ip'] || ''
}

export async function verifyTurnstile(req, { tokenField = 'captcha_token' } = {}) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Captcha not configured — let the request through. This keeps local dev
    // and preview deploys without env vars working.
    return { ok: true, skipped: true }
  }

  const token = (req.body && req.body[tokenField]) || ''
  if (!token || typeof token !== 'string') {
    return { ok: false, status: 400, error: 'Captcha mancante. Ricarica la pagina e riprova.' }
  }

  try {
    const form = new URLSearchParams()
    form.set('secret', secret)
    form.set('response', token)
    const ip = clientIp(req)
    if (ip) form.set('remoteip', ip)

    const resp = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const data = await resp.json().catch(() => ({}))
    if (data?.success === true) return { ok: true }
    // data['error-codes'] is an array of Cloudflare-defined codes; we don't
    // surface them to the client to avoid helping an attacker fingerprint
    // why a token failed.
    return { ok: false, status: 403, error: 'Verifica anti-spam fallita. Ricarica la pagina e riprova.' }
  } catch (err) {
    console.error('[turnstile] siteverify error:', err)
    return { ok: false, status: 502, error: 'Verifica anti-spam non disponibile, riprova fra poco.' }
  }
}
