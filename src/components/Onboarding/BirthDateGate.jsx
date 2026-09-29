import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { track } from '../../lib/posthog'
import { greetingName, hasSeenTour, shouldShowTour } from '../../lib/welcomeTour'
import { markAskedThisVisit, shouldAskBirthDate, wasAskedThisVisit } from '../../lib/birthDate'

// Il popup sta in un chunk a parte: lo scarica solo chi la data non l'ha messa.
const BirthDatePrompt = lazy(() => import('./BirthDatePrompt'))

// Prima si vede la pagina, poi il popup ci sale sopra.
const OPEN_DELAY_MS = 2500
// Se c'è già un'altra finestra aperta (QR, feedback, tutorial) si riprova.
const RETRY_MS = 5000

/** C'è già una finestra a tutto schermo aperta? Non ci si mette sopra. */
function anotherDialogOpen() {
  return !!document.querySelector('[aria-modal="true"]')
}

/**
 * Chiede la data di nascita a chi non l'ha ancora messa: una volta per
 * visita, finché non la mette. Le regole stanno in src/lib/birthDate.js.
 */
export default function BirthDateGate() {
  const { user, profile, refreshProfile } = useAuth()
  const { pathname } = useLocation()
  const userId = user?.id ?? null
  const [openFor, setOpenFor] = useState(null) // userId per cui è aperto
  const open = !!openFor && openFor === userId

  const eligible = !open && shouldAskBirthDate({
    user,
    profile,
    pathname,
    askedThisVisit: wasAskedThisVisit(userId),
    // Chi si è appena registrato con Google vede prima il tutorial.
    tourPending: shouldShowTour({ user, pathname, seen: hasSeenTour(userId) }),
  })

  useEffect(() => {
    if (!eligible) return undefined
    let timer
    const tryOpen = () => {
      if (document.visibilityState !== 'visible' || anotherDialogOpen()) {
        timer = setTimeout(tryOpen, RETRY_MS)
        return
      }
      markAskedThisVisit(userId)
      setOpenFor(userId)
      track('birthdate_asked')
    }
    timer = setTimeout(tryOpen, OPEN_DELAY_MS)
    return () => clearTimeout(timer)
  }, [eligible, userId])

  const handleSaved = () => {
    track('birthdate_saved', { source: 'popup' })
    setOpenFor(null)
    refreshProfile?.()
  }

  const handleLater = () => {
    track('birthdate_later')
    setOpenFor(null)
  }

  if (!open) return null
  return (
    <Suspense fallback={null}>
      <BirthDatePrompt
        userId={userId}
        name={greetingName(user, profile)}
        onSaved={handleSaved}
        onLater={handleLater}
      />
    </Suspense>
  )
}
