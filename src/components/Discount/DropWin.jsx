import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, animate, useReducedMotion } from 'framer-motion'
import BiCharacter from '../Feedback/BiCharacter'
import { dropWinCopy } from '../../lib/dropWin'
import { EASE_OUT, SPRING_SOFT } from '../../lib/motion'
import './DropWin.css'

/**
 * "Ce l'hai fatta!" — chi prende un drop (30/09). Vedi src/lib/dropWin.js.
 *
 * Tutto corallo, perché il corallo è il colore dei drop (regola del colore,
 * CLAUDE.md): Bi applaude, i coriandoli saltano, il numero sale fino al
 * proprio posto e nei pallini (uno per posto) si accende il tuo, dopo quelli
 * di chi è arrivato prima. Sotto, "Scopri come usare lo sconto" (il
 * tutorial sugli sconti) e "Chiudi". Niente QR qui: chi ha appena preso il
 * drop non è alla cassa (deciso dal proprietario il 30/09). Si chiude solo
 * coi bottoni o con Esc, non toccando a caso: il numero è il bello, non
 * deve sparire per un tocco mentre sale.
 */
export default function DropWin({ rank, total, restaurantName, first = false, onClose }) {
  const reduce = useReducedMotion()
  const copy = useMemo(() => dropWinCopy({ rank, total, restaurantName }), [rank, total, restaurantName])
  const panelRef = useRef(null)
  const countDone = useCountUp(copy.rank, reduce)
  const shown = countDone.value

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current?.('close') }
    window.addEventListener('keydown', onKey)
    // Il fuoco sulla finestra (non sul bottone, che su telefono si
    // accenderebbe col contorno): Tab porta al bottone, Esc chiude.
    const t = setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 50)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t) }
  }, [])

  return (
    <motion.div
      className="dw-root"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: reduce ? 0 : 0.2 }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        className="dw-panel"
        initial={reduce ? false : { scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <div className="dw-stage">
          {!reduce && <Burst />}
          <motion.div
            className="dw-bi"
            initial={reduce ? false : { y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12, type: 'spring', stiffness: 220, damping: 20 }}
          >
            <BiCharacter mood="love" clap hearts heartColor="#FFFFFF" food={false} title="Bi applaude" />
          </motion.div>
        </div>

        <motion.h2
          className="dw-title"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.3, ...SPRING_SOFT }}
        >
          {copy.title}
        </motion.h2>

        {copy.rank && (
          <motion.div
            className="dw-rank"
            initial={reduce ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: reduce ? 0 : 0.42, type: 'spring', stiffness: 320, damping: 18 }}
            aria-hidden="true"
          >
            <span className="dw-rank-no">N°</span>
            <motion.span
              key={countDone.done ? 'done' : 'counting'}
              className="dw-rank-num"
              initial={countDone.done && !reduce ? { scale: 1.25 } : false}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 12 }}
            >
              {shown}
            </motion.span>
            {copy.total && <span className="dw-rank-of">su {copy.total}</span>}
          </motion.div>
        )}

        {copy.showDots && <Dots rank={copy.rank} total={copy.total} lit={countDone.done} reduce={reduce} />}

        <motion.p
          className="dw-line"
          role="status"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.6, duration: 0.3, ease: EASE_OUT }}
        >
          {copy.line} <b>{copy.outro}</b>
          <small className="dw-where">Lo ritrovi in «I miei vantaggi»: il QR lo mostri alla cassa.</small>
        </motion.p>

        <motion.div
          className="dw-actions"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.9, duration: 0.3, ease: EASE_OUT }}
        >
          <button type="button" className="dw-btn" onClick={() => onClose?.('tutorial')}>
            Scopri come usare lo sconto
          </button>
          {/* Al primo sconto sbloccato il tutorial non si salta: c'è solo
              il bottone per vederlo. */}
          {!first && (
            <button type="button" className="dw-btn-ghost" onClick={() => onClose?.('close')}>
              Chiudi
            </button>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

/** Il numero sale da 1 al proprio posto: veloce all'inizio, piano alla fine. */
function useCountUp(target, reduce) {
  const [state, setState] = useState(() => ({
    value: !target || reduce ? target : 1,
    done: !target || !!reduce || target <= 1,
  }))
  useEffect(() => {
    if (!target || reduce || target <= 1) return undefined
    const duration = Math.min(1.4, 0.5 + target * 0.05)
    const controls = animate(1, target, {
      duration,
      delay: 0.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setState({ value: Math.round(v), done: false }),
      onComplete: () => setState({ value: target, done: true }),
    })
    return () => controls.stop()
  }, [target, reduce])
  return state
}

/**
 * Un pallino per posto: quelli di chi è arrivato prima si riempiono in
 * fila, il tuo si accende in oro quando il numero ha finito di salire, i
 * posti ancora liberi restano vuoti.
 */
function Dots({ rank, total, lit, reduce }) {
  return (
    <div className="dw-dots" aria-hidden="true" style={{ '--dw-cols': Math.min(total, 10) }}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        const state = n < rank ? 'taken' : n === rank ? 'mine' : 'free'
        if (state === 'mine') {
          return (
            <span key={n} className={`dw-dot dw-dot--mine ${lit ? 'is-lit' : ''}`}>
              {lit && !reduce && <span className="dw-dot-ring" />}
            </span>
          )
        }
        return (
          <motion.span
            key={n}
            className={`dw-dot dw-dot--${state}`}
            initial={reduce || state === 'free' ? false : { scale: 0.2, opacity: 0.3 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.04, duration: 0.22, ease: EASE_OUT }}
          />
        )
      })}
    </div>
  )
}

const BURST_COLORS = ['#FFFFFF', '#F5F0E4', '#F2C14E', '#FFD2CC', '#C9A063', '#FFFFFF']

// Stesso "caso" riproducibile dei coriandoli della convalida: il render
// resta puro e i pezzi sembrano sparsi a mano.
function jitter(i, k) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function Burst() {
  const bits = useMemo(() => Array.from({ length: 34 }, (_, i) => {
    const angle = (i / 34) * Math.PI * 2 + (jitter(i, 1) - 0.5) * 0.5
    const dist = 100 + jitter(i, 2) * 110
    return {
      id: i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist * 0.8 - 30,
      rot: (jitter(i, 3) - 0.5) * 540,
      color: BURST_COLORS[i % BURST_COLORS.length],
      w: 6 + jitter(i, 4) * 6,
      h: 4 + jitter(i, 5) * 8,
      round: i % 4 === 0,
      delay: 0.08 + jitter(i, 6) * 0.14,
    }
  }), [])
  return (
    <span className="dw-burst" aria-hidden="true">
      <motion.span
        className="dw-ring"
        initial={{ scale: 0.5, opacity: 0.6 }}
        animate={{ scale: 2.8, opacity: 0 }}
        transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.1 }}
      />
      {bits.map((b) => (
        <motion.span
          key={b.id}
          className="dw-bit"
          style={{
            width: b.w,
            height: b.round ? b.w : b.h,
            background: b.color,
            borderRadius: b.round ? '50%' : 2,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 80], opacity: [1, 1, 0], rotate: b.rot, scale: 1 }}
          transition={{ duration: 1.7, delay: b.delay, ease: [0.16, 1, 0.3, 1], times: [0, 0.55, 1] }}
        />
      ))}
    </span>
  )
}
