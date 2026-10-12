import { useEffect, useMemo, useRef, useState } from 'react'
// `motion` si usa come <motion.div>: la regola no-unused-vars non lo vede.
// eslint-disable-next-line no-unused-vars
import { motion, animate, useReducedMotion } from 'framer-motion'
import BiCharacter from '../Feedback/BiCharacter'
import { waitlistJoinedCopy } from '../../lib/dropWaitlist'
import './WaitlistJoined.css'

/**
 * "Sei il numero 134 nella lista d'attesa" (12/10) — si apre appena ci si
 * mette in lista per un drop esaurito. Il posto in fila in grande (sale da
 * zero), cosa succede adesso e "Buona fortuna!", come l'ha chiesto il
 * proprietario. Corallo perché è roba di drop (regola del colore).
 * Si chiude col bottone, con Esc o toccando fuori.
 */
export default function WaitlistJoined({ position, waiting, days, restaurantName, onClose }) {
  const reduce = useReducedMotion()
  const copy = useMemo(
    () => waitlistJoinedCopy({ position, waiting, days, restaurantName }),
    [position, waiting, days, restaurantName],
  )
  const shown = useCountUp(copy.position, reduce)
  const panelRef = useRef(null)

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current?.() }
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 50)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t) }
  }, [])

  return (
    <motion.div
      className="wlj-root"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: reduce ? 0 : 0.2 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        className="wlj-panel"
        initial={reduce ? false : { y: 24, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        <div className="wlj-bi" aria-hidden="true">
          <BiCharacter mood="smile" wave food={false} />
        </div>

        <div className="wlj-kicker">🔔 {copy.kicker}</div>

        {copy.position ? (
          <div className="wlj-number" aria-hidden="true">
            <small>n°</small>
            <span>{shown}</span>
          </div>
        ) : null}

        <h2 className="wlj-title">{copy.title}</h2>
        <p className="wlj-body">{copy.body}</p>
        <p className="wlj-after">{copy.after}</p>
        <p className="wlj-luck">{copy.luck}</p>

        <button type="button" className="wlj-btn" onClick={() => onClose?.()}>
          {copy.cta}
        </button>
      </motion.div>
    </motion.div>
  )
}

// Il numero sale da 1 al proprio posto, più in fretta se il posto è alto.
function useCountUp(target, reduce) {
  const [value, setValue] = useState(() => (!target || reduce ? target : 1))
  useEffect(() => {
    if (!target || reduce || target <= 1) return undefined
    const controls = animate(1, target, {
      duration: Math.min(1.2, 0.45 + target * 0.01),
      delay: 0.25,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
      onComplete: () => setValue(target),
    })
    return () => controls.stop()
  }, [target, reduce])
  return value
}
