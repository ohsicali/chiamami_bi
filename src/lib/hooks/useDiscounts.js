import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'

// Stale-while-revalidate cache for the active discounts list. Painted at mount
// from localStorage so the home and deals page render instantly on repeat
// visits while a fresh fetch runs in the background. Bump the key version
// when the select shape changes.
const ACTIVE_DISCOUNTS_CACHE_KEY = 'cb_active_discounts_v2'
function readActiveDiscountsCache() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(ACTIVE_DISCOUNTS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.data) ? parsed.data : null
  } catch { return null }
}
function writeActiveDiscountsCache(data) {
  try { localStorage.setItem(ACTIVE_DISCOUNTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })) } catch { /* quota / private mode */ }
}

// Channel pool for discount_redemptions: one WebSocket subscription per
// user_id, with multiple in-process listeners. Without this, every component
// that calls useUserRedemption / useMyDiscounts opens its own channel —
// N redemption cards = N parallel WebSocket subscriptions.
const redemptionChannels = new Map()

function subscribeToRedemptions(userId, listener) {
  if (!userId || !isSupabaseConfigured()) return () => {}
  let entry = redemptionChannels.get(userId)
  if (!entry) {
    const listeners = new Set()
    const channel = supabase
      .channel(`redemptions:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'discount_redemptions' },
        (payload) => {
          const row = payload.new || payload.old
          if (!row || row.user_id !== userId) return
          listeners.forEach((cb) => { try { cb(payload) } catch { /* swallow */ } })
        }
      )
      .subscribe()
    entry = { channel, listeners }
    redemptionChannels.set(userId, entry)
  }
  entry.listeners.add(listener)
  return () => {
    entry.listeners.delete(listener)
    if (entry.listeners.size === 0) {
      try { supabase.removeChannel(entry.channel) } catch { /* noop */ }
      redemptionChannels.delete(userId)
    }
  }
}

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

    // Reset state when discountId/userId changes so we don't briefly show
    // a redeemed/generated state from a different discount while the new
    // fetch is in flight (caused "Sblocca sconto" flashes / stale "Già
    // utilizzato" labels when navigating between restaurants).
    setRedemption(null)
    setLoading(true)

    let cancelled = false

    const load = () => {
      supabase
        .from('discount_redemptions')
        .select('*')
        .eq('discount_id', discountId)
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return
          setRedemption(data || null)
          setLoading(false)
        })
    }

    load()

    // Realtime: pooled subscription on discount_redemptions filtered to this
    // user. When the restaurant marks the QR as redeemed, refetch so the UI
    // moves to the dimmed/used state without a page refresh.
    const unsubscribe = subscribeToRedemptions(userId, (payload) => {
      const row = payload.new || payload.old
      if (!row || row.discount_id !== discountId) return
      if (payload.eventType === 'DELETE') setRedemption(null)
      else load()
    })

    // Fallback: refetch when the user returns to the tab. visibilitychange
    // fires on `document`, NOT window — binding to window means the listener
    // never fires, leaving the UI stuck on a stale "Sblocca sconto" after
    // the restaurant marks the QR redeemed in another tab/PWA.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') load()
    }
    const onFocus = () => load()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
      unsubscribe()
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
// Module-scoped in-flight promise: when multiple components mount on the same
// page (e.g. HomeFeedV4 + SponsorBanner) they share a single fetch instead of
// firing duplicate identical queries to Supabase.
let activeDiscountsInFlight = null

function fetchActiveDiscounts() {
  if (activeDiscountsInFlight) return activeDiscountsInFlight
  activeDiscountsInFlight = supabase
    .from('discounts')
    .select('*, restaurant:restaurants(id, name, slug, city, address, cuisine_type, category, price_range, tagline, latitude, longitude, photos:restaurant_photos(id, photo_url, thumb_url, sort_order))')
    .eq('is_active', true)
    .gt('valid_until', new Date().toISOString())
    .order('created_at', { ascending: false })
    .then(({ data }) => {
      const fresh = data || []
      writeActiveDiscountsCache(fresh)
      return fresh
    })
    .finally(() => {
      // Release the lock so subsequent navigations can revalidate.
      activeDiscountsInFlight = null
    })
  return activeDiscountsInFlight
}

export function useActiveDiscounts() {
  const cached = typeof window !== 'undefined' ? readActiveDiscountsCache() : null
  const [discounts, setDiscounts] = useState(cached || [])
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }
    let cancelled = false
    fetchActiveDiscounts().then((fresh) => {
      if (cancelled) return
      setDiscounts(fresh)
      setLoading(false)
    })
    return () => { cancelled = true }
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

    // Realtime: pooled subscription so multiple components mounted on the
    // same page (e.g. saved page + redemption card) share a single channel.
    const unsubscribe = subscribeToRedemptions(userId, () => load())

    // Fallback: refetch on tab focus so data stays fresh even if realtime
    // misses an event (eg. connection dropped in background).
    // `visibilitychange` fires on `document`, not `window`.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') load()
    }
    const onFocus = () => load()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
      unsubscribe()
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
