import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

/**
 * I drop del locale in /verify (12/10): quante persone l'hanno preso e
 * quante sono in lista d'attesa. Dal browser il locale non può contare i
 * riscatti degli altri: li conta la RPC `verify_drops_overview` (device
 * token, solo il proprio locale, solo numeri — SQL
 * supabase/verify-drops-overview-2026-10-12.sql). Li mostra `DropPeople`
 * (components/Verify/VerifyDrops.jsx).
 */
export function useVerifyDrops({ restaurantId, deviceToken, onSessionExpired, reloadKey = 0 }) {
  const [byId, setById] = useState({})
  const [items, setItems] = useState([])
  // Il genitore ricrea la funzione a ogni render: non deve far ripartire la
  // richiesta.
  const expiredRef = useRef(onSessionExpired)
  useEffect(() => { expiredRef.current = onSessionExpired })
  useEffect(() => {
    if (!restaurantId || !deviceToken) return undefined
    let cancelled = false
    supabase
      .rpc('verify_drops_overview', { p_restaurant_id: restaurantId, p_device_token: deviceToken })
      .then(({ data, error }) => {
        if (cancelled || error) return
        if (data?.error === 'unauthorized') { expiredRef.current?.(); return }
        const list = Array.isArray(data?.items) ? data.items : []
        setItems(list)
        setById(Object.fromEntries(list.map((it) => [it.id, it])))
      })
      .catch(() => { /* senza numeri la card dello sconto resta com'era */ })
    return () => { cancelled = true }
  }, [restaurantId, deviceToken, reloadKey])
  return { items, byId }
}
