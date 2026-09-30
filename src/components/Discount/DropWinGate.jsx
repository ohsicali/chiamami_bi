import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { track } from '../../lib/posthog'
import { DROP_WIN_EVENT } from '../../lib/dropWin'
import { openWelcomeTour } from '../../lib/welcomeTour'

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

/**
 * Ascolta `celebrateClaim()` (src/lib/dropWin.js) e mostra "Ce l'hai fatta!"
 * a chi ha appena preso un drop. Montato una volta in App.jsx, così vale da
 * qualunque punto si sblocchi (Bi Club, scheda del locale).
 */
export default function DropWinGate() {
  const [open, setOpen] = useState(null) // { key, rank, total, restaurantName }
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
      if (doneRef.current) { done?.(); return }
      doneRef.current = done
      loadDropWin().catch(() => {})
      const info = await fetchRank(redemptionId)
      const isDrop = deal ? !!deal.is_drop : !!info.isDrop
      if (!isDrop) { finish(); return }
      const restaurant = deal?.restaurant || deal?.restaurants || null
      const restaurantName = info.restaurantName || restaurant?.name || null
      track('drop_win_shown', {
        discount_id: deal?.id || null,
        rank: info.rank ?? null,
        total: info.total ?? null,
        rank_failed: !!info.failed,
      })
      setOpen({ key: redemptionId, rank: info.rank, total: info.total, restaurantName })
    }
    window.addEventListener(DROP_WIN_EVENT, onWin)
    return () => window.removeEventListener(DROP_WIN_EVENT, onWin)
  }, [])

  // "Scopri come usare lo sconto" apre le quattro schermate sugli sconti
  // del tutorial di benvenuto; "Chiudi" (o Esc) lascia dov'era.
  const handleClose = (action) => {
    setOpen(null)
    track('drop_win_closed', { action })
    finish({ shown: true, action })
    if (action === 'tutorial') openWelcomeTour({ source: 'drop_win', topic: 'use' })
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
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </Suspense>
  )
}
