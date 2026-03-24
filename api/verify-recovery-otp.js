/**
 * Vercel Serverless Function — Verify recovery OTP and perform action
 * Supports: reset_password (generates magic link), verify_recovery (for email change)
 */
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, otp, new_email, new_password } = req.body || {}

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP required' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // Get profile with OTP
    const { data: profile, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, recovery_otp, recovery_otp_expires, recovery_otp_action')
      .eq('email', email)
      .single()

    if (profileErr || !profile) {
      return res.status(400).json({ error: 'Account non trovato' })
    }

    // Verify OTP
    if (!profile.recovery_otp || profile.recovery_otp !== otp.trim()) {
      return res.status(400).json({ error: 'Codice non valido' })
    }

    // Check expiration
    if (new Date(profile.recovery_otp_expires) < new Date()) {
      // Clear expired OTP
      await adminClient
        .from('profiles')
        .update({ recovery_otp: null, recovery_otp_expires: null, recovery_otp_action: null })
        .eq('id', profile.id)
      return res.status(400).json({ error: 'Codice scaduto. Richiedine uno nuovo.' })
    }

    const action = profile.recovery_otp_action

    // Clear OTP (one-time use)
    await adminClient
      .from('profiles')
      .update({ recovery_otp: null, recovery_otp_expires: null, recovery_otp_action: null })
      .eq('id', profile.id)

    if (action === 'reset_password' && new_password) {
      // Reset password via admin API
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(profile.id, {
        password: new_password,
      })
      if (updateErr) {
        return res.status(500).json({ error: `Errore: ${updateErr.message}` })
      }
      return res.status(200).json({ success: true, action: 'password_reset' })
    }

    if (action === 'verify_recovery' && new_email) {
      // Change email via admin API
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(profile.id, {
        email: new_email,
      })
      if (updateErr) {
        return res.status(500).json({ error: `Errore: ${updateErr.message}` })
      }
      // Update email in profiles table too
      await adminClient.from('profiles').update({ email: new_email }).eq('id', profile.id)
      return res.status(200).json({ success: true, action: 'email_changed' })
    }

    // OTP verified but no action data provided — return verified status
    return res.status(200).json({ success: true, action: 'verified' })
  } catch (err) {
    console.error('Verify recovery OTP error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
