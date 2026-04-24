import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'

/**
 * useSponsoredPlacement — ritorna il placement sponsor attivo con priorità
 * più alta (o null). Le policy Supabase RLS filtrano già per active +
 * finestra temporale, ma duplichiamo il check client-side per resilienza.
 *
 * Schema atteso (migration pr17-home-redesign-2026-04-24.sql):
 *   sponsored_placements.variant IN ('restaurant_discount','restaurant_plain','brand')
 *
 * Output: un oggetto placement arricchito con relazioni:
 *   { ...row, restaurant?, discount? }
 */
export function useSponsoredPlacement() {
  const [placement, setPlacement] = useState(null)
  const [loading, setLoading] = useState(() => isSupabaseConfigured())

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    let cancelled = false
    const nowIso = new Date().toISOString()
    supabase
      .from('sponsored_placements')
      .select(`
        *,
        restaurant:restaurants(id, name, slug, cuisine_type, category, price_range, address, tagline, hours_cache, photos:restaurant_photos(id, photo_url, thumb_url, sort_order)),
        discount:discounts(id, title, description, discount_type, discount_value, conditions, valid_until)
      `)
      .eq('active', true)
      .lte('start_at', nowIso)
      .gt('end_at', nowIso)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[useSponsoredPlacement]', error.message)
          setPlacement(null)
        } else {
          setPlacement((data && data[0]) || null)
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { placement, loading }
}
