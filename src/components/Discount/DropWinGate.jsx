import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { track } from '../../lib/posthog'
import { useAuth } from '../../lib/hooks/useAuth'
import { DROP_WIN_EVENT, NO_WIN, hasSeenFirstClaimTour, isFirstClaim, markFirstClaimTourSeen } from '../../lib/dropWin'
import { openUseTour } from '../../lib/welcomeTour'

// Bi che applaude e i coriandoli stanno in un chunk a parte: li scarica solo
// chi prende un drop. Il download parte insieme alla domanda al DB.
const loadDropWin = () => import('./DropWin')
const DropWin = lazy(loadDropWin)

// Se il DB non risponde in fretta la festa parte senza numero: chi ha appena
// preso il drop non deve restare a guardare un bottone che gira.
const RANK_TIMEOUT_MS = 2500

async function fetchRank(redemptionId) {
  const call = supabase.rpc('my_claim_rank', { p_redemption_id: redemptionId })
  const timeout = new Promise((resolve) => setTimeout(() => resolve({ data: null, timedOut: true }), RANK_TIMEOUT_MS))
  try {
    const { data, error, timedOut } = await Promise.race([call, timeout])
    if (error || timedOut) return { failed: true }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return { failed: true }
    return {
      rank: row.claim_rank,
      total: row.total,
      isDrop: !!row.is_drop,
      restaurantName: row.restaurant_name || null,
    }
  } catch {
    return { failed: true }
  }
}

// Quanti sconti ha sbloccato l'utente (compreso quello appena preso). Solo i
// suoi: la RLS non gli fa vedere gli altri. null se non risponde in fretta.
async function countMyClaims(userId) {
  if (!userId) return null
  const call = supabase
    .from('discount_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  const timeout = new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), RANK_TIMEOUT_MS))
  try {
    const { count, error, timedOut } = await Promise.race([call, timeout])
    if (error || timedOut || typeof count !== 'number') return null
    return count
  } catch {
    return null
  }
}

/**
 * Ascolta `celebrateClaim()` (src/lib/dropWin.js) e mostra "Ce l'hai fatta!"
 * a chi ha appena preso un drop. Montato una volta in App.jsx, così vale da
 * qualunque punto si sblocchi (Bi Club, scheda del locale).
 */
export default function DropWinGate() {
  const { user } = useAuth()
  const userIdRef = useRef(null)
  useEffect(() => { userIdRef.current = user?.id || null }, [user])
  const [open, setOpen] = useState(null) // { key, rank, total, restaurantName, first }
  const doneRef = useRef(null)

  // Chiude il giro: chi aveva chiamato `celebrateClaim` sa com'è finita.
  const finish = (result) => {
    const done = doneRef.current
    doneRef.current = null
    done?.(result)
  }

  useEffect(() => {
    const onWin = async (e) => {
      const { redemptionId, deal, take, done } = e.detail || {}
      if (!redemptionId) return
      take?.()
      // Una festa alla volta: se ne arriva un'altra mentre questa è aperta,
      // la seconda va avanti subito.
      if (doneRef.current) { done?.(NO_WIN); return }
      doneRef.current = done
      const userId = userIdRef.current
      const knownConvention = !!deal && !deal.is_drop
      if (!knownConvention) loadDropWin().catch(() => {})
      // Il posto in fila serve solo ai drop; il conteggio solo a chi non ha
      // ancora visto "Come si usa lo sconto" su questo browser.
      const seen = hasSeenFirstClaimTour(userId)
      const [info, claimCount] = await Promise.all([
        knownConvention ? Promise.resolve({}) : fetchRank(redemptionId),
        seen ? Promise.resolve(null) : countMyClaims(userId),
      ])
      const first = isFirstClaim({ claimCount, seen })
      // Primo sblocco, o ne aveva già altri: in tutti e due i casi non si
      // conta più su questo browser.
      if (first || claimCount > 1) markFirstClaimTourSeen(userId)
      const isDrop = deal ? !!deal.is_drop : !!info.isDrop
      if (!isDrop) {
        // Convenzione: niente festa. Al primo sblocco "Come si usa lo
        // sconto", e il QR si apre quando il tutorial si chiude.
        if (first) {
          track('first_claim_tour', { discount_id: deal?.id || null, is_drop: false })
          await openUseTour({ source: 'first_claim' })
        }
        finish(NO_WIN)
        return
      }
      const restaurant = deal?.restaurant || deal?.restaurants || null
      const restaurantName = info.restaurantName || restaurant?.name || null
      track('drop_win_shown', {
        discount_id: deal?.id || null,
        rank: info.rank ?? null,
        total: info.total ?? null,
        rank_failed: !!info.failed,
        first_claim: first,
      })
      setOpen({ key: redemptionId, rank: info.rank, total: info.total, restaurantName, first })
    }
    window.addEventListener(DROP_WIN_EVENT, onWin)
    return () => window.removeEventListener(DROP_WIN_EVENT, onWin)
  }, [])

  // "Scopri come usare lo sconto" apre le quattro schermate sugli sconti
  // del tutorial di benvenuto; "Chiudi" (o Esc) lascia dov'era.
  // Al primo sconto sbloccato il tutorial parte comunque (la festa mostra
  // solo quel bottone).
  const handleClose = (action) => {
    const first = !!open?.first
    setOpen(null)
    track('drop_win_closed', { action, first_claim: first })
    finish({ shown: true, action })
    if (action === 'tutorial' || first) {
      if (first) track('first_claim_tour', { is_drop: true })
      openUseTour({ source: first ? 'first_claim' : 'drop_win' })
    }
  }

  return (
    <Suspense fallback={null}>
      <AnimatePresence>
        {open && (
          <DropWin
            key={open.key}
            rank={open.rank}
            total={open.total}
            restaurantName={open.restaurantName}
            first={open.first}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </Suspense>
  )
}
