/**
 * Vercel Serverless Function — Delete user account completely
 * Deletes user from auth.users (which cascades to profiles and all related data)
 * Requires SUPABASE_SERVICE_ROLE_KEY env var in Vercel
 */
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  // Verify the user's session with anon key first
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  // Use service role to delete the user from auth.users
  // CASCADE on profiles will clean up all related data automatically
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Also clean up newsletter subscription (not cascaded)
  if (user.email) {
    await adminClient.from('newsletter_subscribers').delete().eq('email', user.email)
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

  if (deleteError) {
    console.error('Delete user error:', deleteError)
    return res.status(500).json({ error: 'Failed to delete account' })
  }

  return res.status(200).json({ success: true })
}
