import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'

const LS_KEY = 'chiamamibi_saved'

function loadLocalSaved(userId) {
  try {
    const raw = localStorage.getItem(`${LS_KEY}_${userId}`)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function persistLocalSaved(userId, ids) {
  try {
    localStorage.setItem(`${LS_KEY}_${userId}`, JSON.stringify([...ids]))
  } catch { /* ignore */ }
}

export function useSavedRestaurants(userId) {
  const [savedIds, setSavedIds] = useState(() => userId ? loadLocalSaved(userId) : new Set())
  const [loading, setLoading] = useState(false)

  // Fetch saved restaurant IDs for the user
  useEffect(() => {
    if (!userId) {
      setSavedIds(new Set())
      return
    }

    // Load from localStorage immediately
    const local = loadLocalSaved(userId)
    if (local.size > 0) setSavedIds(local)

    if (!isSupabaseConfigured()) return

    setLoading(true)
    // Dal più recente al più vecchio: un Set in JS conserva l'ordine in cui
    // gli elementi ci sono entrati, e i Salvati lo usano per mostrare per
    // primo l'ultimo locale salvato. Senza `order` il database restituisce
    // le righe nell'ordine che gli fa comodo, e "Recente" ordinava a caso.
    supabase
      .from('saved_restaurants')
      .select('restaurant_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const ids = new Set(data.map((r) => r.restaurant_id))
          setSavedIds(ids)
          persistLocalSaved(userId, ids)
        }
        setLoading(false)
      })
  }, [userId])

  const isSaved = useCallback(
    (restaurantId) => savedIds.has(restaurantId),
    [savedIds]
  )

  const toggleSave = useCallback(
    async (restaurantId) => {
      if (!userId) return false

      const currently = savedIds.has(restaurantId)

      // Optimistic update + persist to localStorage
      setSavedIds((prev) => {
        const next = new Set(prev)
        if (currently) {
          next.delete(restaurantId)
        } else {
          next.add(restaurantId)
        }
        persistLocalSaved(userId, next)
        return next
      })

      // Try Supabase (don't revert on error — localStorage is the source of truth)
      if (isSupabaseConfigured()) {
        if (currently) {
          await supabase
            .from('saved_restaurants')
            .delete()
            .eq('user_id', userId)
            .eq('restaurant_id', restaurantId)
        } else {
          await supabase
            .from('saved_restaurants')
            .insert({ user_id: userId, restaurant_id: restaurantId })
        }
      }

      return true
    },
    [userId, savedIds]
  )

  /**
   * Salva e basta, senza togliere.
   *
   * Serve al rientro dalla registrazione: chi ha toccato il cuore da
   * sloggato aveva già chiesto di salvare, e ripassare da `toggleSave`
   * significherebbe che se nel frattempo il locale risulta già salvato
   * glielo si toglie — l'esatto contrario di quello che ha chiesto.
   */
  const addSave = useCallback(
    async (restaurantId) => {
      if (!userId || !restaurantId) return false
      if (savedIds.has(restaurantId)) return true
      setSavedIds((prev) => {
        const next = new Set(prev)
        next.add(restaurantId)
        persistLocalSaved(userId, next)
        return next
      })
      if (isSupabaseConfigured()) {
        await supabase
          .from('saved_restaurants')
          .insert({ user_id: userId, restaurant_id: restaurantId })
      }
      return true
    },
    [userId, savedIds]
  )

  return { savedIds, isSaved, toggleSave, addSave, loading }
}
