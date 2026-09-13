import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'
import { normalizeNote, noteForDb } from '../utils/savedNote'

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
  // La nota personale, per locale. Sta qui e non in un hook a parte perché
  // arriva dalla stessa riga di `saved_restaurants`: separarla vorrebbe dire
  // due letture per lo stesso dato.
  const [notes, setNotes] = useState({})
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
    supabase
      .from('saved_restaurants')
      .select('restaurant_id, note')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const ids = new Set(data.map((r) => r.restaurant_id))
          setSavedIds(ids)
          persistLocalSaved(userId, ids)
          setNotes(Object.fromEntries(
            data.filter((r) => r.note).map((r) => [r.restaurant_id, r.note])
          ))
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

      // Togliendo il cuore se ne va anche la nota: la riga non c'è più, e
      // lasciarla nello stato farebbe ricomparire un pensiero vecchio se il
      // locale viene risalvato più avanti.
      if (currently) {
        setNotes((prev) => {
          if (!(restaurantId in prev)) return prev
          const next = { ...prev }
          delete next[restaurantId]
          return next
        })
      }

      return true
    },
    [userId, savedIds]
  )

  /**
   * Scrive (o cancella, con stringa vuota) la nota su un locale salvato.
   *
   * Aggiorna prima lo stato e poi il database: chi scrive vede la propria
   * frase restare lì mentre la rete fa il suo. Se la riga non c'è ancora
   * perché il salvataggio è solo locale, l'update non trova niente e la nota
   * resta sullo schermo ma non viene conservata — è il caso raro di chi
   * salva e scrive nello stesso istante con la rete che non risponde.
   */
  const setNote = useCallback(async (restaurantId, text) => {
    if (!userId || !restaurantId) return false
    const clean = normalizeNote(text)
    setNotes((prev) => {
      const next = { ...prev }
      if (clean) next[restaurantId] = clean
      else delete next[restaurantId]
      return next
    })
    if (!isSupabaseConfigured()) return true
    const { error } = await supabase
      .from('saved_restaurants')
      .update({ note: noteForDb(text) })
      .eq('user_id', userId)
      .eq('restaurant_id', restaurantId)
    return !error
  }, [userId])

  return { savedIds, isSaved, toggleSave, loading, notes, setNote }
}
