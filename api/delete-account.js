/**
 * Vercel Serverless Function — Delete user account completely
 * Cleans up all user data, then deletes from auth.users
 * Requires SUPABASE_SERVICE_ROLE_KEY env var in Vercel
 */
import { createClient } from '@supabase/supabase-js'
import { applyCors } from './_cors.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars:', { hasUrl: !!supabaseUrl, hasServiceKey: !!serviceRoleKey })
    return res.status(500).json({ error: 'Server configuration error: missing env vars' })
  }

  // Verify the user's session
  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // Clean up all user data before deleting auth user
    // (in case CASCADE is not set on all foreign keys)
    const userId = user.id

    // Delete in order to respect foreign key dependencies
    await adminClient.from('discount_redemptions').delete().eq('user_id', userId)

    // Get review IDs first, then delete their photos
    const { data: reviews } = await adminClient
      .from('user_reviews')
      .select('id')
      .eq('user_id', userId)
    if (reviews?.length) {
      const reviewIds = reviews.map(r => r.id)
      await adminClient.from('user_review_photos').delete().in('review_id', reviewIds)
    }
    await adminClient.from('user_reviews').delete().eq('user_id', userId)
    await adminClient.from('saved_restaurants').delete().eq('user_id', userId)
    await adminClient.from('push_subscriptions').delete().eq('user_id', userId)

    if (user.email) {
      await adminClient.from('newsletter_subscribers').delete().eq('email', user.email)
    }

    // Delete profile
    await adminClient.from('profiles').delete().eq('id', userId)

    // Finally delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Delete auth user error:', deleteError)
      return res.status(500).json({ error: `Failed to delete account: ${deleteError.message}` })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Delete account error:', err)
    return res.status(500).json({ error: `Delete failed: ${err.message}` })
  }
}
