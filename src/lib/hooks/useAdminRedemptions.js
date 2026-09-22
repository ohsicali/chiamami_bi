import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'
import { applyRedemptionChange, deriveRedemptionStats } from '../redemptionsLive'

/**
 * Riscatti degli sconti visti dall'admin, in tempo reale.
 *
 * Una sola fonte per tre cose che prima erano (o sarebbero state) tre query
 * diverse: i contatori "presi / utilizzati" di ogni card, il riepilogo di
 * oggi e il feed "In diretta". Tutte e tre sono derivate dalla stessa mappa
 * di righe, così non possono mai contraddirsi — il feed che dice "Mario ha
 * preso lo sconto di Orso" e la card di Orso che resta ferma non succede.
 *
 * La logica (cosa conta come preso/utilizzato, come si applica un evento)
 * sta in `lib/redemptionsLive.js`.
 *
 * Il realtime passa da RLS: la policy "Read redemptions" lascia leggere
 * tutto a `is_admin()`, e la tabella è già nella publication
 * `supabase_realtime` (la usa anche `useDiscounts`).
 */

const PAGE = 1000 // tetto righe di PostgREST: oltre, si pagina
const COLS = 'id, discount_id, status, generated_at, redeemed_at, user_name'

async function fetchAllRows() {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('discount_redemptions')
      .select(COLS)
      .order('generated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE) return rows
  }
}

export function useAdminRedemptions({ enabled = true } = {}) {
  // id → riga. Il realtime la aggiorna a pezzi dentro il ref; ogni volta se
  // ne pubblica una copia in `rows`, che è quella da cui si deriva tutto.
  const rowsRef = useRef(new Map())
  const [rows, setRows] = useState(() => new Map())
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState('connecting') // 'live' | 'connecting' | 'offline'
  // Ultimo cambio arrivato dal realtime: la card coinvolta lo usa per
  // lampeggiare il contatore. Non si valorizza al caricamento iniziale.
  const [lastChange, setLastChange] = useState(null)
  // Chiavi degli eventi arrivati dal vivo, per evidenziarli nel feed.
  const [freshKeys, setFreshKeys] = useState(() => new Set())
  // Avanza ogni minuto, così "oggi" (dopo mezzanotte) e "3 min fa" restano veri.
  const [tick, setTick] = useState(() => Date.now())

  const bump = useCallback(() => setRows(new Map(rowsRef.current)), [])

  const markFresh = useCallback((key) => {
    setFreshKeys((prev) => new Set(prev).add(key))
    setTimeout(() => {
      setFreshKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }, 6000)
  }, [])

  const applyChange = useCallback((payload) => applyRedemptionChange(rowsRef.current, payload), [])

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return
    let cancelled = false
    let loading = false
    let buffered = null // eventi arrivati mentre la fotografia iniziale è in volo
    let everLive = false

    const load = async () => {
      if (loading) return
      loading = true
      buffered = []
      try {
        const data = await fetchAllRows()
        if (cancelled) return
        rowsRef.current = new Map(data.map((r) => [r.id, r]))
        // Riapplica quello che il realtime ha consegnato durante la query,
        // altrimenti la fotografia lo cancellerebbe.
        buffered.forEach((p) => applyChange(p))
        setLoaded(true)
        bump()
      } catch (err) {
        console.error('[admin] riscatti: caricamento fallito', err)
        if (!cancelled) setLoaded(true)
      } finally {
        buffered = null
        loading = false
      }
    }

    const channel = supabase
      .channel('admin:redemptions-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'discount_redemptions' },
        (payload) => {
          if (buffered) { buffered.push(payload); return }
          const change = applyChange(payload)
          if (!change) return
          bump()
          if (change.kind === 'taken' || change.kind === 'used') {
            setLastChange({ ...change, at: Date.now() })
            markFresh(`${change.kind}:${change.id}`)
          }
        }
      )
      .subscribe((s) => {
        if (cancelled) return
        if (s === 'SUBSCRIBED') {
          setStatus('live')
          // Dopo una caduta della connessione gli eventi persi non tornano:
          // si rifà la fotografia.
          if (everLive) load()
          everLive = true
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          setStatus('offline')
        } else if (s === 'CLOSED') {
          setStatus('connecting')
        }
      })

    load()

    // Rete: se la scheda è rimasta in background a lungo, il socket può
    // essere morto senza dirlo. Tornando in primo piano si riallinea.
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)

    const timer = setInterval(() => setTick(Date.now()), 60000)

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      try { supabase.removeChannel(channel) } catch { /* noop */ }
    }
  }, [enabled, applyChange, bump, markFresh])

  const derived = useMemo(() => deriveRedemptionStats(rows, tick), [rows, tick])

  return { ...derived, loaded, status, lastChange, freshKeys, now: tick }
}
