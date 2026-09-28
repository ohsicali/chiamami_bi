import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { track } from '../../lib/posthog'
import { loadWelcomeTour } from './loadWelcomeTour'
import {
  OPEN_TOUR_EVENT,
  greetingName,
  hasSeenTour,
  markTourSeen,
  shouldShowTour,
} from '../../lib/welcomeTour'

// Il tutorial vero (illustrazioni, animazioni) sta in un chunk a parte: lo
// scarica solo chi lo vede, cioè chi si è appena registrato.
const WelcomeTour = lazy(loadWelcomeTour)

/**
 * Decide se aprire il tutorial di benvenuto e lo monta sopra la pagina.
 * Le regole stanno in src/lib/welcomeTour.js.
 */
export default function WelcomeTourGate() {
  const { user, profile } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // Per chi è aperto:
  //   `{ source: 'auto', userId }`  — l'ha deciso il Gate guardando l'account;
  //   `{ source: 'signup', origin }` — la pagina di conferma, appena il
  //     codice è passato (l'utente nel contesto può arrivare un attimo dopo);
  //   `{ source: 'settings' }`      — riaperto a mano da Impostazioni.
  // A PostHog serve per non mescolare le tre cose. Quello automatico è
  // legato all'utente, così chi esce dall'account col tutorial aperto non se
  // lo ritrova addosso, né lo eredita chi entra dopo sullo stesso browser.
  const [openAs, setOpenAs] = useState(null)
  const userId = user?.id ?? null
  const open = !!openAs && (openAs.source !== 'auto' || openAs.userId === userId)
  const source = openAs?.source ?? 'auto'

  useEffect(() => {
    if (open) return undefined
    if (!shouldShowTour({ user, pathname, seen: hasSeenTour(userId) })) return undefined
    // Un attimo di respiro: prima si vede la pagina su cui si è arrivati,
    // poi il tutorial ci sale sopra. Aperto nello stesso istante del
    // redirect sembrava un'altra pagina di registrazione.
    const t = setTimeout(() => setOpenAs({ source: 'auto', userId }), 700)
    return () => clearTimeout(t)
  }, [user, userId, pathname, open])

  useEffect(() => {
    const onOpen = (e) => setOpenAs((cur) => cur ?? {
      source: e?.detail?.source || 'settings',
      origin: e?.detail?.origin || null,
    })
    window.addEventListener(OPEN_TOUR_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_TOUR_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (open) track('onboarding_shown', { source })
  }, [open, source])

  // Arrivato in fondo si va alla home (l'animazione di chiusura sta in
  // WelcomeTour); chi salta resta sulla pagina dov'era.
  const handleClose = ({ completed, step }) => {
    markTourSeen(userId)
    track(completed ? 'onboarding_completed' : 'onboarding_skipped', { step, source })
    if (completed && pathname !== '/') navigate('/')
    setOpenAs(null)
  }

  return (
    <Suspense fallback={null}>
      <AnimatePresence>
        {open && (
          <WelcomeTour
            key="welcome-tour"
            name={greetingName(user, profile)}
            origin={openAs?.origin}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </Suspense>
  )
}
