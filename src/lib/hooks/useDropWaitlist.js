import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'
import { hasClaimWindow } from '../dropClaim'
import { isSoldOut } from '../discounts'
import { track } from '../posthog'

/**
 * La lista d'attesa dei drop esauriti in pagina (12/10).
 *
 * Chiede al DB, con una RPC sola per tutti i drop della pagina, quanti sono
 * in lista e — se c'è una sessione — il posto in fila di chi guarda
 * (`drop_waitlist_status`, supabase/drop-claim-window-2026-10-12.sql). Solo
 * per i drop esauriti coi giorni contati: per tutti gli altri non c'è
 * niente da chiedere, e nella maggior parte delle visite la RPC non parte.
 *
 * `join`/`leave` passano dalle RPC (il browser non scrive mai nella
 * tabella) e aggiornano subito lo stato. Cosa dire dopo: `waitlistJoinMessage`
 * in src/lib/dropWaitlist.js.
 */
export function useDropWaitlist(deals, userId) {
  const ids = useMemo(
    () => (deals || [])
      .filter((d) => d?.id && hasClaimWindow(d) && isSoldOut(d))
      .map((d) => d.id)
      .sort()
      .join(','),
    [deals],
  )
  const [byId, setById] = useState({})
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    if (!ids || !isSupabaseConfigured()) return
    try {
      const { data, error } = await supabase.rpc('drop_waitlist_status', { p_discount_ids: ids.split(',') })
      if (error || !Array.isArray(data)) return
      setById(Object.fromEntries(data.map((r) => [r.discount_id, r])))
    } catch { /* senza lista il bottone resta "Mettiti in lista" */ }
  }, [ids])

  // Si richiede anche quando cambia chi guarda (entra nell'account: adesso
  // ha un posto in fila da vedere).
  useEffect(() => { load() }, [load, userId])

  // Al ritorno sulla scheda: il posto in fila può essere salito.
  useEffect(() => {
    if (!ids) return undefined
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [ids, load])

  const join = useCallback(async (deal) => {
    if (!deal?.id) return null
    setBusyId(deal.id)
    try {
      const { data, error } = await supabase.rpc('drop_waitlist_join', { p_discount_id: deal.id })
      if (error) throw error
      track('drop_waitlist_joined', { discount_id: deal.id, status: data?.status || null, position: data?.position ?? null })
      if (data?.status === 'joined' || data?.status === 'already') {
        setById((m) => ({
          ...m,
          [deal.id]: { ...(m[deal.id] || {}), discount_id: deal.id, waiting: data.waiting, my_position: data.position, my_status: 'waiting' },
        }))
      }
      return data || null
    } catch {
      return { status: 'error' }
    } finally {
      setBusyId(null)
    }
  }, [])

  const leave = useCallback(async (deal) => {
    if (!deal?.id) return null
    setBusyId(deal.id)
    try {
      const { data, error } = await supabase.rpc('drop_waitlist_leave', { p_discount_id: deal.id })
      if (error) throw error
      track('drop_waitlist_left', { discount_id: deal.id })
      setById((m) => {
        const cur = m[deal.id] || {}
        return {
          ...m,
          [deal.id]: { ...cur, my_status: 'left', my_position: null, waiting: Math.max(0, (Number(cur.waiting) || 1) - 1) },
        }
      })
      return data || null
    } catch {
      return { status: 'error' }
    } finally {
      setBusyId(null)
    }
  }, [])

  return { byId, busyId, join, leave, reload: load }
}
