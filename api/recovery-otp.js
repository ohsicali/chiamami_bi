/**
 * Vercel Serverless Function — Send OTP to recovery email or reset password via recovery email
 * Used when user can't access their primary email
 */
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, action } = req.body || {}
  // email = the primary email of the account
  // action = 'verify_recovery' | 'reset_password'

  if (!email || !action) {
    return res.status(400).json({ error: 'Email and action required' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // Find user by primary email and get their recovery email
    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, recovery_email, full_name')
      .eq('email', email)
      .single()

    if (profileErr || !profile) {
      // Don't reveal if account exists — generic message
      return res.status(200).json({ success: true, message: 'Se l\'account esiste e ha un\'email di recupero, riceverai un codice.' })
    }

    if (!profile.recovery_email) {
      return res.status(200).json({ success: false, no_recovery: true, message: 'Nessuna email di recupero configurata. Contatta info@chiamamibi.com' })
    }

    // Generate a 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000))

    // Store OTP in profile metadata (expires in 10 min)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await adminClient
      .from('profiles')
      .update({ recovery_otp: otp, recovery_otp_expires: expiresAt, recovery_otp_action: action })
      .eq('id', profile.id)

    // Send OTP via Resend
    if (!resendKey) {
      return res.status(500).json({ error: 'Email service not configured' })
    }

    const firstName = (profile.full_name || '').split(' ')[0] || 'Utente'
    const actionText = action === 'reset_password'
      ? 'reimpostare la password'
      : 'cambiare l\'email'

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'La Guida di Bi <noreply@chiamamibi.com>',
        to: [profile.recovery_email],
        subject: `${otp} — Codice di recupero La Guida di Bi`,
        html: buildOtpHtml(firstName, otp, actionText),
      }),
    })

    if (!emailResponse.ok) {
      console.error('Resend error:', await emailResponse.json())
      return res.status(500).json({ error: 'Failed to send recovery email' })
    }

    // Mask recovery email for display
    const masked = maskEmail(profile.recovery_email)
    return res.status(200).json({ success: true, masked_email: masked })
  } catch (err) {
    console.error('Recovery OTP error:', err)
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
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:2px;">LA GUIDA DI BI</h1>
  </div>
  <div style="padding:32px 24px;">
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a1a1a;">Codice di recupero</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      Ciao ${name}, hai richiesto di ${actionText} del tuo account La Guida di Bi.
      Usa questo codice per procedere. Il codice scade tra 10 minuti.
    </p>
    <div style="background:#fff5f5;border:2px solid #FF5757;border-radius:12px;padding:16px;text-align:center;margin-bottom:24px;">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#FF5757;font-family:monospace;">${otp}</span>
    </div>
  </div>
  <div style="padding:20px 24px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
    <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;">Se non hai richiesto questo codice, ignora questa email.</p>
    <p style="margin:0;font-size:11px;color:#9ca3af;">La Guida di Bi — Torino, Italia</p>
  </div>
</div>`
}
