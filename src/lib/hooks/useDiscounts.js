import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'

// Generate a short unique code for QR
function generateQRCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let code = 'BiSc-'
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Fetch active discount for a specific restaurant
 */
export function useRestaurantDiscount(restaurantId) {
  const [discount, setDiscount] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurantId || !isSupabaseConfigured()) {
      setDiscount(null)
      setLoading(false)
      return
    }

    supabase
      .from('discounts')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .gt('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setDiscount(data?.[0] || null)
        setLoading(false)
      })
      .catch(() => {
        setDiscount(null)
        setLoading(false)
      })
  }, [restaurantId])

  return { discount, loading }
}

/**
 * Fetch user's redemption for a specific discount
 */
export function useUserRedemption(discountId, userId) {
  const [redemption, setRedemption] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!discountId || !userId || !isSupabaseConfigured()) {
      setRedemption(null)
      setLoading(false)
      return
    }

    let cancelled = false

    const load = () => {
      supabase
        .from('discount_redemptions')
        .select('*')
        .eq('discount_id', discountId)
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()
        .then(({ data }) => {
          if (cancelled) return
          setRedemption(data || null)
          setLoading(false)
        })
    }

    load()

    // Realtime subscription: when the restaurant marks this redemption as
    // redeemed, auto-update the UI so the user sees the dimmed/used state
    // without a page refresh. Filter client-side so we catch every event
    // reliably even if the server-side filter semantics change.
    const channel = supabase
      .channel(`redemption:${userId}:${discountId}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'discount_redemptions' },
        (payload) => {
          const row = payload.new || payload.old
          if (!row) return
          if (row.user_id !== userId) return
          if (row.discount_id !== discountId) return
          if (payload.eventType === 'DELETE') {
            setRedemption(null)
          } else {
            // Refetch so we always have a fresh, fully-joined row
            load()
          }
        }
      )
      .subscribe()

    // Fallback: refetch when the user returns to the tab. Covers cases
    // where the realtime websocket may have disconnected in the background.
    const onFocus = () => {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [discountId, userId])

  const generateRedemption = useCallback(async () => {
    if (!discountId || !userId || !isSupabaseConfigured()) return null

    // Check if user already has a redemption for this discount
    const { data: existing } = await supabase
      .from('discount_redemptions')
      .select('id, qr_code, status')
      .eq('discount_id', discountId)
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (existing) {
      setRedemption(existing)
      return existing
    }

    // Capture the user's display name so the restaurant's verify dashboard
    // can show it in the activity feed without needing RLS access to profiles.
    let userName = null
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle()
      userName = profile?.full_name || null
    } catch {
      // profile fetch is best-effort; ignore errors
    }

    const qrCode = generateQRCode()
    const { data, error } = await supabase
      .from('discount_redemptions')
      .insert({
        discount_id: discountId,
        user_id: userId,
        qr_code: qrCode,
        status: 'generated',
        user_name: userName,
      })
      .select()
      .single()

    if (error) throw error

    // Increment total_redeemed counter
    const { error: rpcError } = await supabase.rpc('increment_discount_redeemed', { discount_uuid: discountId })
    if (rpcError) {
      // Fallback: manual increment if RPC doesn't exist
      const { data: d } = await supabase
        .from('discounts')
        .select('total_redeemed')
        .eq('id', discountId)
        .single()
      if (d) {
        await supabase
          .from('discounts')
          .update({ total_redeemed: (d.total_redeemed || 0) + 1 })
          .eq('id', discountId)
      }
    }

    setRedemption(data)
    return data
  }, [discountId, userId])

  return { redemption, loading, generateRedemption }
}

/**
 * Fetch all active discounts (for deals page)
 * Separates: activeDrops, upcomingDrops, featured, regular
 */
export function useActiveDiscounts() {
  const [discounts, setDiscounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    supabase
      .from('discounts')
      .select('*, restaurant:restaurants(id, name, slug, city, address, cuisine_type, category, price_range, tagline, latitude, longitude, photos:restaurant_photos(id, photo_url, thumb_url, sort_order))')
      .eq('is_active', true)
      .gt('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDiscounts(data || [])
        setLoading(false)
      })
  }, [])

  const now = new Date().toISOString()
  const activeDrops = discounts.filter(d =>
    d.is_drop && d.drop_starts_at && d.drop_starts_at <= now &&
    (!d.drop_ends_at || d.drop_ends_at > now) &&
    (!d.max_quantity || (d.claimed_count || 0) < d.max_quantity)
  )
  const upcomingDrops = discounts.filter(d =>
    d.is_drop && d.drop_starts_at && d.drop_starts_at > now
  )
  const allFeatured = discounts.filter(d => d.is_featured && !d.is_drop)
  // Pick 1 random featured on each page load — rotates on refresh
  // Use session-level seed so it's stable during the session but changes on refresh
  const [featuredSeed] = useState(() => Math.floor(Math.random() * 1000))
  const featured = allFeatured.length > 0 ? [allFeatured[featuredSeed % allFeatured.length]] : []
  const regular = discounts.filter(d => !d.is_drop && !d.is_featured)

  return { discounts, activeDrops, upcomingDrops, featured, allFeatured, regular, loading }
}

/**
 * Fetch user's claimed discounts (active + used) for "I miei" tab
 */
export function useMyDiscounts(userId) {
  const [active, setActive] = useState([])
  const [used, setUsed] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) {
      setActive([])
      setUsed([])
      setLoading(false)
      return
    }

    let cancelled = false

    const load = () => {
      supabase
        .from('discount_redemptions')
        .select('*, discount:discounts(*, restaurant:restaurants(id, name, slug, city, cuisine_type, category, price_range, tagline, photos:restaurant_photos(id, photo_url, thumb_url, sort_order)))')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .then(({ data }) => {
          if (cancelled) return
          const items = data || []
          setActive(items.filter(r => r.status === 'generated'))
          setUsed(items.filter(r => r.status === 'redeemed'))
          setLoading(false)
        })
    }

    load()

    // Realtime: when restaurant validates a QR (status: generated→redeemed),
    // refetch so the item moves from "active" to "used" (dimmed) automatically.
    // Filter client-side for reliability across event types.
    const channel = supabase
      .channel(`my-discounts:${userId}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'discount_redemptions' },
        (payload) => {
          const row = payload.new || payload.old
          if (!row || row.user_id !== userId) return
          load()
        }
      )
      .subscribe()

    // Fallback: refetch on tab focus so data stays fresh even if realtime
    // misses an event (eg. connection dropped in background).
    const onFocus = () => {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [userId])

  return { active, used, loading }
}

/**
 * Fetch all user's redemptions (for profile page)
 */
export function useUserDiscounts(userId) {
  const [redemptions, setRedemptions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) {
      setRedemptions([])
      setLoading(false)
      return
    }

    supabase
      .from('discount_redemptions')
      .select('*, discount:discounts(*, restaurant:restaurants(id, name, slug, city, photos:restaurant_photos(id, photo_url, sort_order)))')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .then(({ data }) => {
        setRedemptions(data || [])
        setLoading(false)
      })
  }, [userId])

  return { redemptions, loading }
}

/**
 * Verify a QR code (for restaurant verify page)
 */
export async function verifyQRCode(qrCode, pinCode) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')

  // 1. Find the redemption by QR code (no profiles join - may be accessed by unauthenticated users)
  const { data: redemption, error: rError } = await supabase
    .from('discount_redemptions')
    .select('*, discount:discounts(*, restaurant:restaurants(id, name, slug))')
    .eq('qr_code', qrCode)
    .single()

  if (rError || !redemption) {
    console.error('QR lookup failed:', rError, 'code:', qrCode)
    return { valid: false, error: 'not_found', message: 'Codice non riconosciuto' }
  }

  // Fetch user info separately (may be blocked by RLS for anon users, that's ok)
  let userName = 'Utente'
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', redemption.user_id)
    .single()
  if (userProfile) {
    userName = userProfile.full_name || 'Utente'
  }

  // 2. Check if already redeemed
  if (redemption.status === 'redeemed') {
    return {
      valid: false,
      error: 'already_redeemed',
      message: `Questo sconto è già stato usato il ${new Date(redemption.redeemed_at).toLocaleDateString('it-IT')}`,
      redemption,
    }
  }

  // 3. Check if expired
  if (redemption.status === 'expired' || new Date(redemption.discount?.valid_until) < new Date()) {
    return {
      valid: false,
      error: 'expired',
      message: `Questo sconto è scaduto`,
      redemption,
    }
  }

  // 4. Verify PIN
  const { data: partner } = await supabase
    .from('restaurant_partners')
    .select('*')
    .eq('restaurant_id', redemption.discount?.restaurant_id)
    .eq('pin_code', pinCode)
    .eq('is_active', true)
    .single()

  if (!partner) {
    return { valid: false, error: 'invalid_pin', message: 'PIN non valido — verifica con il gestore' }
  }

  // 5. Mark as redeemed
  const { error: uError } = await supabase
    .from('discount_redemptions')
    .update({
      status: 'redeemed',
      redeemed_at: new Date().toISOString(),
      redeemed_by_restaurant: true,
    })
    .eq('id', redemption.id)

  if (uError) {
    return { valid: false, error: 'update_failed', message: 'Errore durante la validazione' }
  }

  // 6. Increment total_redeemed on the discount
  const discountId = redemption.discount?.id || redemption.discount_id
  if (discountId) {
    const { error: rpcErr } = await supabase.rpc('increment_discount_redeemed', { discount_uuid: discountId })
    if (rpcErr) {
      // Fallback: manual increment
      const { data: d } = await supabase
        .from('discounts')
        .select('total_redeemed')
        .eq('id', discountId)
        .single()
      if (d) {
        await supabase
          .from('discounts')
          .update({ total_redeemed: (d.total_redeemed || 0) + 1 })
          .eq('id', discountId)
      }
    }
  }

  return {
    valid: true,
    message: 'Sconto validato!',
    discount_title: redemption.discount?.title,
    discount_value: redemption.discount?.discount_value,
    user_name: userName,
    restaurant_name: redemption.discount?.restaurant?.name,
    redemption,
  }
}

/**
 * Fetch QR preview info (no PIN needed, just read-only)
 */
export async function fetchQRPreview(qrCode) {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from('discount_redemptions')
    .select('status, user_id, discount:discounts(title, discount_value, discount_type, restaurant:restaurants(name))')
    .eq('qr_code', qrCode)
    .single()

  if (error) {
    console.error('QR preview lookup failed:', error)
    return null
  }

  // Try to fetch user name separately
  if (data?.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', data.user_id)
      .single()
    data.user = { full_name: profile?.full_name || 'Utente' }
  }

  return data || null
}

/**
 * Fetch redemptions for a restaurant's dashboard (by PIN)
 */
export async function fetchRestaurantRedemptions(pinCode) {
  if (!isSupabaseConfigured()) return { active: [], used: [] }

  // Get restaurant from PIN
  const { data: partner } = await supabase
    .from('restaurant_partners')
    .select('restaurant_id')
    .eq('pin_code', pinCode)
    .eq('is_active', true)
    .single()

  if (!partner) return null

  // Get all redemptions for this restaurant's discounts
  const { data } = await supabase
    .from('discount_redemptions')
    .select('*, discount:discounts!inner(restaurant_id, title, discount_value), user:profiles(full_name, email)')
    .eq('discount.restaurant_id', partner.restaurant_id)
    .order('generated_at', { ascending: false })

  if (!data) return { active: [], used: [] }

  return {
    active: data.filter(r => r.status === 'generated'),
    used: data.filter(r => r.status === 'redeemed'),
  }
}
