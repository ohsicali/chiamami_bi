import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { WAITLIST_JOINED_EVENT } from '../../lib/dropWaitlist'

// La schermata sta in un chunk a parte: la scarica solo chi si mette in lista.
const WaitlistJoined = lazy(() => import('./WaitlistJoined'))

/**
 * Ascolta `openWaitlistJoined()` (src/lib/dropWaitlist.js, lo chiama
 * `useDropWaitlist` quando si entra in lista) e mostra il proprio posto in
 * fila. Montato una volta in App.jsx, così vale dalla home e dal Bi Club.
 */
export default function WaitlistJoinedGate() {
  const [open, setOpen] = useState(null)
  useEffect(() => {
    const onJoined = (e) => setOpen({ key: Date.now(), ...(e.detail || {}) })
    window.addEventListener(WAITLIST_JOINED_EVENT, onJoined)
    return () => window.removeEventListener(WAITLIST_JOINED_EVENT, onJoined)
  }, [])
  return (
    <Suspense fallback={null}>
      <AnimatePresence>
        {open && (
          <WaitlistJoined
            key={open.key}
            position={open.position}
            waiting={open.waiting}
            days={open.days}
            restaurantName={open.restaurantName}
            onClose={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
    </Suspense>
  )
}
