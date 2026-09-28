import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'
import { createActivityFeed } from '../activityFeed'
import { formatDiscountBadge } from '../utils/discountFormat'

/**
 * Cronologia completa della dashboard admin: tutte le attività, dalla più
 * recente, caricate a pezzi mentre si scende (merge in `lib/activityFeed.js`).
 *
 * Prima la card "Attività recente" prendeva 6 righe per tabella e ne
 * mostrava 8: il resto della storia non si poteva vedere.
 */

const DISCOUNT_COLS = 'title, discount_type, discount_value, restaurants(name)'

function discountLabel(d) {
  if (!d) return ''
  return formatDiscountBadge(d) || d.title || ''
}

function range(query, offset, limit) {
  return query.range(offset, offset + limit - 1).then(({ data, error }) => {
    if (error) throw error
    return data || []
  })
}

// Ogni tipo: da quale tabella, ordinata su quale data, e come si racconta.
export const ACTIVITY_SOURCES = {
  used: {
    fetch: (o, n) => range(
      supabase.from('discount_redemptions')
        .select(`id, redeemed_at, user_name, discounts(${DISCOUNT_COLS})`)
        .eq('status', 'redeemed')
        .order('redeemed_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false }),
      o, n
    ),
    toItem: (r) => ({
      key: `used:${r.id}`,
      type: 'redemption',
      at: r.redeemed_at,
      text: `${r.discounts?.restaurants?.name || 'Un locale'} ha convalidato lo sconto di ${r.user_name?.trim() || 'un utente'}`,
      value: discountLabel(r.discounts),
    }),
  },
  taken: {
    fetch: (o, n) => range(
      supabase.from('discount_redemptions')
        .select(`id, generated_at, user_name, discounts(${DISCOUNT_COLS})`)
        .order('generated_at', { ascending: false })
        .order('id', { ascending: false }),
      o, n
    ),
    toItem: (r) => ({
      key: `taken:${r.id}`,
      type: 'taken',
      at: r.generated_at,
      text: `${r.user_name?.trim() || 'Un utente'} ha preso lo sconto di ${r.discounts?.restaurants?.name || 'un locale'}`,
      value: discountLabel(r.discounts),
    }),
  },
  signup: {
    fetch: (o, n) => range(
      supabase.from('profiles')
        .select('id, full_name, email, created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
      o, n
    ),
    toItem: (r) => ({
      key: `signup:${r.id}`,
      type: 'signup',
      at: r.created_at,
      text: `${r.full_name || (r.email ? r.email.split('@')[0] : 'Nuovo utente')} si è registrato`,
    }),
  },
  application: {
    fetch: (o, n) => range(
      supabase.from('partner_applications')
        .select('id, restaurant_name, city, created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
      o, n
    ),
    toItem: (r) => ({
      key: `application:${r.id}`,
      type: 'application',
      at: r.created_at,
      text: `Candidatura da ${r.restaurant_name}${r.city ? ` — ${r.city}` : ''}`,
    }),
  },
  suggestion: {
    fetch: (o, n) => range(
      supabase.from('restaurant_suggestions')
        .select('id, restaurant_name, created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
      o, n
    ),
    toItem: (r) => ({
      key: `suggestion:${r.id}`,
      type: 'suggestion',
      at: r.created_at,
      text: `Suggerimento: ${r.restaurant_name}`,
    }),
  },
  review: {
    fetch: (o, n) => range(
      supabase.from('user_reviews')
        .select('id, created_at, restaurants(name)')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
      o, n
    ),
    toItem: (r) => ({
      key: `review:${r.id}`,
      type: 'review',
      at: r.created_at,
      text: `Nuova recensione · ${r.restaurants?.name || '—'}`,
    }),
  },
  restaurant: {
    // Colonne esplicite: `restaurants` non si legge mai con `*` (audit 23/09).
    fetch: (o, n) => range(
      supabase.from('restaurants')
        .select('id, name, city, created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
      o, n
    ),
    toItem: (r) => ({
      key: `restaurant:${r.id}`,
      type: 'restaurant',
      at: r.created_at,
      text: `Locale aggiunto · ${r.name}${r.city ? ` — ${r.city}` : ''}`,
    }),
  },
  discount: {
    fetch: (o, n) => range(
      supabase.from('discounts')
        .select(`id, created_at, is_drop, ${DISCOUNT_COLS}`)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
      o, n
    ),
    toItem: (r) => ({
      key: `discount:${r.id}`,
      type: r.is_drop ? 'drop' : 'discount',
      at: r.created_at,
      text: `${r.is_drop ? 'Drop creato' : 'Sconto creato'} · ${r.restaurants?.name || '—'}`,
      value: discountLabel(r),
    }),
  },
}

// I filtri della card: "Tutto" più un gruppo per tipo di attività.
export const ACTIVITY_FILTERS = [
  { id: 'all', label: 'Tutto', sources: Object.keys(ACTIVITY_SOURCES) },
  { id: 'used', label: 'Sconti utilizzati', sources: ['used'] },
  { id: 'taken', label: 'Sconti presi', sources: ['taken'] },
  { id: 'signup', label: 'Iscrizioni', sources: ['signup'] },
  { id: 'catalog', label: 'Locali e sconti', sources: ['restaurant', 'discount'] },
  { id: 'inbox', label: 'Candidature e segnalazioni', sources: ['application', 'suggestion', 'review'] },
]

const FIRST_PAGE = 15
const NEXT_PAGE = 25

export function useAdminActivity({ enabled = true, filter = 'all' } = {}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const feedRef = useRef(null)
  const busyRef = useRef(false)
  // Cambia a ogni nuova cronologia (filtro diverso): i pezzi che arrivano
  // da quella vecchia si buttano.
  const genRef = useRef(0)

  const loadPage = useCallback(async (n) => {
    const feed = feedRef.current
    if (!feed || busyRef.current || feed.isDone()) return
    const gen = genRef.current
    busyRef.current = true
    setLoading(true)
    try {
      const { items: more, done: end } = await feed.next(n)
      if (gen !== genRef.current) return
      setItems((prev) => prev.concat(more))
      setDone(end)
    } finally {
      if (gen === genRef.current) {
        busyRef.current = false
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return
    const def = ACTIVITY_FILTERS.find((f) => f.id === filter) || ACTIVITY_FILTERS[0]
    genRef.current += 1
    busyRef.current = false
    feedRef.current = createActivityFeed(
      def.sources.map((k) => ACTIVITY_SOURCES[k]),
      {
        batch: NEXT_PAGE,
        onError: (err) => console.error('[admin] cronologia: una fonte non risponde', err),
      }
    )
    setItems([])
    setDone(false)
    loadPage(FIRST_PAGE)
  }, [enabled, filter, loadPage])

  const loadMore = useCallback(() => loadPage(NEXT_PAGE), [loadPage])

  return { items, loading, done, loadMore }
}
