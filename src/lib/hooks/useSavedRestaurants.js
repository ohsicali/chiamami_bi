import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'

export function useSavedRestaurants(userId) {
  const [savedIds, setSavedIds] = useState(new Set())
  const [loading, setLoading] = useState(false)

  // Fetch saved restaurant IDs for the user
  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) {
      setSavedIds(new Set())
      return
    }

    setLoading(true)
    supabase
      .from('saved_restaurants')
      .select('restaurant_id')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (data) {
          setSavedIds(new Set(data.map((r) => r.restaurant_id)))
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
      if (!userId || !isSupabaseConfigured()) return false

      const currently = savedIds.has(restaurantId)

      // Optimistic update
      setSavedIds((prev) => {
        const next = new Set(prev)
        if (currently) {
          next.delete(restaurantId)
        } else {
          next.add(restaurantId)
        }
        return next
      })

      if (currently) {
        const { error } = await supabase
          .from('saved_restaurants')
          .delete()
          .eq('user_id', userId)
          .eq('restaurant_id', restaurantId)

        if (error) {
          // Revert on error
          setSavedIds((prev) => new Set([...prev, restaurantId]))
          return false
        }
      } else {
        const { error } = await supabase
          .from('saved_restaurants')
          .insert({ user_id: userId, restaurant_id: restaurantId })

        if (error) {
          // Revert on error
          setSavedIds((prev) => {
            const next = new Set(prev)
            next.delete(restaurantId)
            return next
          })
          return false
        }
      }

      return true
    },
    [userId, savedIds]
  )

  return { savedIds, isSaved, toggleSave, loading }
}
