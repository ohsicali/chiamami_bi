import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'

/**
 * BLOCCO 6 — le liste dei salvati.
 *
 * Sono ETICHETTE, non cartelle: un locale può stare in più liste
 * contemporaneamente e resta comunque in "tutti i salvati". Chi non usa le
 * liste vede lo stesso tutto quello che ha salvato.
 *
 * Le tre liste pronte non esistono in database finché nessuno le tocca: sono
 * suggerimenti, e si materializzano al primo uso. Così chi salva e basta non
 * si ritrova tre cartelle vuote nel profilo, che sarebbero solo tre modi per
 * sentirsi in disordine.
 *
 * Nessuna lista viene generata dal comportamento: sembra intelligente ma
 * l'utente non capisce perché un locale ci sia finito.
 */

/** I tre suggerimenti mostrati fin dal primo salvataggio. */
export const DEFAULT_LISTS = [
  { name: 'Da provare', emoji: '✨' },
  { name: 'Per un date', emoji: '💕' },
  { name: 'Con i miei', emoji: '👨‍👩‍👧' },
]

export function useSavedLists(userId) {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      setLists([])
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('saved_lists')
      .select('id, name, emoji, created_at, items:saved_list_items(restaurant_id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    setLists(
      (data || []).map((l) => ({
        ...l,
        restaurantIds: (l.items || []).map((i) => i.restaurant_id),
      }))
    )
    setLoading(false)
  }, [userId])

  // `load` è async e i setState finiscono dentro la promise, non nel corpo
  // dell'effetto: la chiamata va comunque avvolta, se no ESLint la legge come
  // un set sincrono in effetto (e in caso di errore lo diventerebbe davvero).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (cancelled) return
      await load()
    })()
    return () => { cancelled = true }
  }, [load])

  /**
   * Le tre liste pronte più quelle create dall'utente, senza doppioni.
   * I suggerimenti non ancora usati hanno `id: null`: la riga in database
   * nasce quando ci si mette dentro il primo locale.
   */
  const suggestions = DEFAULT_LISTS
    .filter((d) => !lists.some((l) => l.name === d.name))
    .map((d) => ({ ...d, id: null, restaurantIds: [] }))

  /** Crea la lista se non c'è ancora, e restituisce il suo id. */
  const ensureList = useCallback(async ({ id, name, emoji }) => {
    if (id) return id
    if (!userId) return null
    const existing = lists.find((l) => l.name === name)
    if (existing) return existing.id
    const { data, error } = await supabase
      .from('saved_lists')
      .insert({ user_id: userId, name, emoji })
      .select('id')
      .single()
    // Doppio tocco rapido sullo stesso suggerimento: il vincolo di unicità
    // rifiuta il secondo insert, e la lista che serve è già lì.
    if (error) {
      const { data: found } = await supabase
        .from('saved_lists')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name)
        .maybeSingle()
      return found?.id || null
    }
    return data?.id || null
  }, [userId, lists])

  /** Mette o toglie un locale da una lista. Ritorna il nuovo stato. */
  const toggleInList = useCallback(async (list, restaurantId) => {
    if (!userId || !restaurantId) return false
    const listId = await ensureList(list)
    if (!listId) return false

    const isIn = lists.find((l) => l.id === listId)?.restaurantIds.includes(restaurantId)
    if (isIn) {
      await supabase.from('saved_list_items').delete().eq('list_id', listId).eq('restaurant_id', restaurantId)
    } else {
      await supabase.from('saved_list_items').insert({ list_id: listId, restaurant_id: restaurantId })
    }
    await load()
    return !isIn
  }, [userId, lists, ensureList, load])

  const createList = useCallback(async (name, emoji = '📁') => {
    const clean = String(name || '').trim()
    if (!clean || !userId) return null
    const id = await ensureList({ id: null, name: clean, emoji })
    await load()
    return id
  }, [userId, ensureList, load])

  return { lists, suggestions, loading, toggleInList, createList, reload: load }
}
