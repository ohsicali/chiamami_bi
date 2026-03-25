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

    supabase
      .from('discount_redemptions')
      .select('*')
      .eq('discount_id', discountId)
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        setRedemption(data || null)
        setLoading(false)
      })
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

    const qrCode = generateQRCode()
    const { data, error } = await supabase
      .from('discount_redemptions')
      .insert({
        discount_id: discountId,
        user_id: userId,
        qr_code: qrCode,
        status: 'generated',
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
      .select('*, restaurant:restaurants(id, name, slug, city, address, cuisine_type, category, price_range, our_rating, photos:restaurant_photos(id, photo_url, sort_order))')
      .eq('is_active', true)
      .gt('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDiscounts(data || [])
        setLoading(false)
      })
  }, [])

  return { discounts, loading }
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
