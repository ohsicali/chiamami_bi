import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { subscribeToRedemptions } from '../../lib/hooks/useDiscounts'
import { track } from '../../lib/posthog'
import {
  fetchOwnFeedbackRow,
  fetchRecentOpenFeedback,
  fetchRedemptionStatus,
  getFeedback,
} from '../../lib/feedbackApi'
import {
  IN_APP_WINDOW_MS,
  QR_PASS_EVENT,
  QR_POLL_MS,
  REDEMPTION_VALIDATED_EVENT,
  hasShownFeedback,
  isFeedbackAllowedOnPath,
  markFeedbackShown,
  shouldCelebrate,
  shouldOpenFeedback,
} from '../../lib/redemptionFeedback'

// L'esperienza vera (Bi disegnata, animazioni) sta in un chunk a parte: la
// scarica solo chi ha appena usato uno sconto.
const loadFeedback = () => import('./RedemptionFeedback')
const RedemptionFeedback = lazy(loadFeedback)

// Dopo i primi minuti col QR aperto il controllo rallenta: chi lascia il pass
// aperto sul tavolo non deve interrogare il DB ogni quattro secondi per mezz'ora.
const SLOW_POLL_AFTER_MS = 3 * 60 * 1000
const SLOW_POLL_MS = 15_000
// Il controllo "c'è una convalida senza stelle?" al rientro nell'app, al
// massimo una volta al minuto.
const RECHECK_MIN_GAP_MS = 60_000

/**
 * Si accorge che il locale ha convalidato uno sconto e apre il feedback.
 *
 * Tre modi di accorgersene, perché nessuno da solo basta:
 *  1. il realtime di `discount_redemptions`, acceso SOLO mentre un QR è
 *     aperto (QRPassSheet lo dice con `QR_PASS_EVENT`): un canale aperto per
 *     ogni utente per tutta la visita peserebbe su Supabase per niente;
 *  2. mentre il QR è aperto, un controllo ogni pochi secondi dello stato di
 *     quel riscatto — il realtime su un telefono in tasca a volte tace;
 *  3. all'apertura dell'app e al rientro (schermo riacceso, cambio scheda):
 *     c'è una convalida delle ultime ore ancora senza stelle? Copre chi ha
 *     dettato il codice a pass chiuso o a telefono bloccato.
 * Le regole su quando aprire stanno in src/lib/redemptionFeedback.js.
 */
export default function RedemptionFeedbackGate() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { pathname } = useLocation()
  const [open, setOpen] = useState(null) // { data, celebrate, redemptionId }
  const openRef = useRef(null)
  const pathRef = useRef(pathname)
  const pendingRef = useRef(null)
  const busyRef = useRef(new Set())
  const [passes, setPasses] = useState([]) // redemption id dei QR aperti

  useEffect(() => { openRef.current = open }, [open])
  useEffect(() => { pathRef.current = pathname }, [pathname])

  const tryOpen = useCallback(async (redemptionId) => {
    if (!redemptionId || openRef.current || busyRef.current.has(redemptionId)) return
    if (!isFeedbackAllowedOnPath(pathRef.current)) {
      pendingRef.current = redemptionId
      return
    }
    busyRef.current.add(redemptionId)
    try {
      const row = await fetchOwnFeedbackRow(redemptionId)
      if (!shouldOpenFeedback(row)) return
      const info = await getFeedback(row.token)
      if (!info || info.error || info.completed) return
      if (openRef.current) return
      const celebrate = shouldCelebrate(row, { shown: hasShownFeedback(redemptionId) })
      markFeedbackShown(redemptionId)
      // Il pass del QR si chiude: sotto la festa non deve restare un codice
      // che ormai è usato.
      window.dispatchEvent(new CustomEvent(REDEMPTION_VALIDATED_EVENT, { detail: { redemptionId } }))
      const next = { redemptionId, celebrate, data: { ...info, token: row.token } }
      openRef.current = next
      setOpen(next)
      track('feedback_shown', { celebrate, source: 'app' })
    } finally {
      busyRef.current.delete(redemptionId)
    }
  }, [])

  // I QR aperti (possono essere zero, uno, di rado due).
  useEffect(() => {
    const onPass = (e) => {
      const id = e?.detail?.redemptionId
      if (!id) return
      setPasses((cur) => (e.detail.open
        ? (cur.includes(id) ? cur : [...cur, id])
        : cur.filter((x) => x !== id)))
    }
    window.addEventListener(QR_PASS_EVENT, onPass)
    return () => window.removeEventListener(QR_PASS_EVENT, onPass)
  }, [])

  // 1 + 2: realtime e controllo periodico, solo col QR aperto.
  const passKey = passes.join(',')

  // Col QR aperto la convalida può arrivare da un momento all'altro: il
  // chunk si scarica adesso, così la festa parte senza aspettare la rete.
  useEffect(() => {
    if (passKey) loadFeedback().catch(() => {})
  }, [passKey])
  useEffect(() => {
    if (!userId || !passKey) return undefined
    const ids = passKey.split(',')
    const unsubscribe = subscribeToRedemptions(userId, (payload) => {
      const row = payload?.new
      if (row?.status === 'redeemed' && ids.includes(row.id)) tryOpen(row.id)
    })
    const started = Date.now()
    let timer = null
    let alive = true
    const check = async () => {
      if (document.visibilityState === 'visible') {
        for (const id of ids) {
          const r = await fetchRedemptionStatus(id)
          if (!alive) return
          if (r?.status === 'redeemed') { tryOpen(id); return }
        }
      }
      const gap = Date.now() - started > SLOW_POLL_AFTER_MS ? SLOW_POLL_MS : QR_POLL_MS
      timer = setTimeout(check, gap)
    }
    timer = setTimeout(check, QR_POLL_MS)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      clearTimeout(timer)
      check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearTimeout(timer)
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, passKey, tryOpen])

  // 3: all'apertura e al rientro.
  const lastCheckRef = useRef(0)
  useEffect(() => {
    if (!userId) return undefined
    const recheck = async () => {
      if (openRef.current || document.visibilityState !== 'visible') return
      if (Date.now() - lastCheckRef.current < RECHECK_MIN_GAP_MS) return
      lastCheckRef.current = Date.now()
      const since = new Date(Date.now() - IN_APP_WINDOW_MS).toISOString()
      const rows = await fetchRecentOpenFeedback(userId, since)
      const row = rows.find((r) => shouldOpenFeedback(r))
      if (row) tryOpen(row.redemption_id)
    }
    // Un attimo dopo l'avvio: prima la pagina, poi il resto.
    const t = setTimeout(recheck, 1500)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [userId, tryOpen])

  // Una convalida arrivata mentre si era su una pagina dove non si apre
  // (login, /verify…) aspetta la pagina successiva.
  useEffect(() => {
    if (!pendingRef.current || !isFeedbackAllowedOnPath(pathname)) return
    const id = pendingRef.current
    pendingRef.current = null
    tryOpen(id)
  }, [pathname, tryOpen])

  // Chi esce dall'account col feedback aperto non se lo ritrova addosso chi
  // entra dopo sullo stesso telefono.
  useEffect(() => {
    if (!userId && openRef.current) {
      openRef.current = null
      setOpen(null)
    }
  }, [userId])

  const handleClose = () => {
    openRef.current = null
    setOpen(null)
  }

  return (
    <Suspense fallback={null}>
      <AnimatePresence>
        {open && (
          <RedemptionFeedback
            key={open.redemptionId}
            data={open.data}
            celebrate={open.celebrate}
            source="app"
            variant="overlay"
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </Suspense>
  )
}
