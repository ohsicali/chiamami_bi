import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import BiCharacter from './BiCharacter'
import { formatDiscountBadge } from '../../lib/utils/discountFormat'
import { proxyImg } from '../../lib/supabase'
import { track } from '../../lib/posthog'
import { rateFeedbackNow, submitFeedback } from '../../lib/feedbackApi'
import {
  COMMENT_MAX,
  DISCOUNT_OPTIONS,
  LIKED_OPTIONS,
  RETURN_OPTIONS,
  buildAnswers,
  hasFeedbackContent,
  likedQuestion,
  ratingCopy,
} from '../../lib/redemptionFeedback'
import { EASE_OUT, SPRING_SOFT } from '../../lib/motion'
import './RedemptionFeedback.css'

/**
 * Dopo la convalida: la festa, le stelle, il modulo per Bi, il grazie.
 *
 *   celebrate — tutto corallo: la spunta si disegna, i coriandoli saltano,
 *               "Sconto convalidato!" col badge. Due secondi e mezzo, o un
 *               tocco, e si passa alle stelle;
 *   stars     — "Com'è andata da X?". NON si salta: niente X, niente Salta,
 *               Esc non chiude (deciso dal proprietario il 29/09). Bi cambia
 *               faccia con il voto. Il voto si salva al tocco, così chi
 *               chiude subito dopo l'ha dato comunque;
 *   form      — cosa ti è piaciuto, com'è andato lo sconto, ci torneresti, e
 *               due righe per Bi. Questo sì si salta;
 *   thanks    — Bi saluta coi cuori (solo per chi ha mandato il modulo);
 *   bye       — chi salta: un saluto breve e si chiude.
 *
 * Chi salta (le stelle chiudendo l'app, o il modulo) riceve le email a ~30
 * minuti e a un giorno — le regole in api/_email/feedback.js.
 *
 * Due cornici: `variant="overlay"` sopra l'app (RedemptionFeedbackGate) e
 * `variant="page"` per /feedback, dove si arriva dall'email.
 */

const CELEBRATE_MS = 2600
const BYE_MS = 1700

export default function RedemptionFeedback({
  data,               // { token, restaurant: { name, photo }, discount, rating, first_name }
  source = 'app',     // 'app' | 'email'
  variant = 'overlay',
  celebrate = false,
  initialRating = null,
  startAt = null,     // 'stars' | 'form' — di solito lo si deduce
  onClose,            // ({ step, completed, rating }) → void
}) {
  const reduce = useReducedMotion()
  const firstStep = startAt || (celebrate ? 'celebrate' : (initialRating ? 'form' : 'stars'))
  const [step, setStep] = useState(firstStep)
  const [rating, setRating] = useState(initialRating ?? data?.rating ?? null)
  const [liked, setLiked] = useState(() => data?.answers?.liked || [])
  const [sconto, setSconto] = useState(() => data?.answers?.sconto || null)
  const [tornare, setTornare] = useState(() => data?.answers?.tornare || null)
  const [comment, setComment] = useState(() => data?.comment || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const panelRef = useRef(null)

  const restaurantName = data?.restaurant?.name || 'il locale'
  const name = data?.first_name || ''
  const badge = data?.discount ? formatDiscountBadge(data.discount) : ''
  const answers = useMemo(() => buildAnswers({ liked, sconto, tornare }), [liked, sconto, tornare])
  const canSend = hasFeedbackContent({ answers, comment }) && !!rating && !sending

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  const close = (extra) => onCloseRef.current?.({ step, rating, completed: false, ...extra })

  // La festa passa da sola alle stelle.
  useEffect(() => {
    if (step !== 'celebrate') return undefined
    try { navigator.vibrate?.([40, 60, 40]) } catch { /* niente vibrazione */ }
    const t = setTimeout(() => setStep('stars'), reduce ? 1400 : CELEBRATE_MS)
    return () => clearTimeout(t)
  }, [step, reduce])

  // Chi salta il modulo: un saluto e via.
  useEffect(() => {
    if (step !== 'bye') return undefined
    const t = setTimeout(() => onCloseRef.current?.({ step: 'form', rating, completed: false }), BYE_MS)
    return () => clearTimeout(t)
  }, [step, rating])

  // La sovrapposizione blocca lo scroll sotto e tiene il fuoco dentro.
  useEffect(() => {
    if (variant !== 'overlay') return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus({ preventScroll: true })
    // Se sotto c'era il popup del QR, si è chiuso nel frattempo: il suo
    // "hidden" non va ripristinato, o la pagina resta bloccata.
    return () => { document.body.style.overflow = prev === 'hidden' ? '' : prev }
  }, [variant])

  // Il voto si salva al tocco, subito e con `keepalive`: chi dà le stelle e
  // chiude il sito un istante dopo le ha date comunque. Due tocchi rapidi
  // potrebbero arrivare al DB in ordine inverso: per questo l'ultimo voto si
  // rimanda quando si va avanti e quando la pagina si nasconde o si chiude.
  const ratingRef = useRef(rating)
  const sentRef = useRef(false) // il modulo è partito: da lì niente più rinvii
  const saveRating = (n) => {
    if (!n || !data?.token) return
    rateFeedbackNow(data.token, n, source).then((r) => {
      if (r?.error) setError('Non riesco a salvare il voto. Riprova tra un attimo.')
    })
  }
  const pickRating = (n) => {
    setRating(n)
    ratingRef.current = n
    setError(null)
    saveRating(n)
    try { navigator.vibrate?.(12) } catch { /* niente */ }
  }
  useEffect(() => {
    const flush = () => {
      if (sentRef.current || !ratingRef.current || !data?.token) return
      rateFeedbackNow(data.token, ratingRef.current, source)
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
    }
  }, [data?.token, source])

  const goForm = () => {
    if (!rating) return
    // Il voto definitivo, per l'ordine (vedi sopra).
    saveRating(rating)
    track('feedback_rated', { rating, source })
    setStep('form')
  }

  const skipForm = () => {
    track('feedback_skipped', { step: 'form', rating, source })
    setStep('bye')
  }

  // Esc chiude solo dove si può chiudere: mai sulle stelle.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (step === 'form') skipForm()
      else if (step === 'thanks') close({ completed: true, step: 'thanks' })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const send = async () => {
    if (!canSend) return
    setSending(true)
    setError(null)
    const r = await submitFeedback(data.token, { rating, answers, comment: comment.trim() }, source)
    setSending(false)
    if (r?.error) {
      setError('Non è partito. Controlla la connessione e riprova.')
      return
    }
    sentRef.current = true
    track('feedback_submitted', {
      rating,
      source,
      has_comment: comment.trim().length > 0,
      answers: Object.keys(answers).length,
    })
    setStep('thanks')
  }

  const toggleLiked = (key) =>
    setLiked((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))

  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 24, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -16, scale: 0.98 },
      }

  const Root = variant === 'overlay' ? motion.div : 'div'
  const rootProps = variant === 'overlay'
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0, transition: { duration: 0.22 } },
        transition: { duration: reduce ? 0 : 0.2 },
      }
    : {}

  return (
    <Root
      className={`rf-root rf-${variant} ${step === 'celebrate' ? 'is-coral' : ''}`}
      role={variant === 'overlay' ? 'dialog' : undefined}
      aria-modal={variant === 'overlay' ? 'true' : undefined}
      aria-label="Com'è andata?"
      {...rootProps}
    >
      <div className={`rf-panel ${step === 'celebrate' ? 'is-coral' : ''}`} ref={panelRef} tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          {step === 'celebrate' && (
            <motion.button
              key="celebrate"
              type="button"
              className="rf-step rf-celebrate"
              onClick={() => setStep('stars')}
              aria-label="Continua"
              {...slide}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              <Celebrate reduce={reduce} restaurantName={restaurantName} badge={badge} />
            </motion.button>
          )}

          {step === 'stars' && (
            <motion.section
              key="stars"
              className="rf-step rf-stars-step"
              {...slide}
              transition={{ duration: 0.34, ease: EASE_OUT }}
            >
              <PlaceChip name={restaurantName} photo={data?.restaurant?.photo} badge={badge} />
              <div className="rf-bi-stage">
                <span className="rf-bi-halo" aria-hidden="true" />
                <BiCharacter className="rf-bi" mood={ratingCopy(rating).mood} hearts={rating === 5} />
              </div>
              <h2 className="rf-title">
                Com’è andata da <span className="rf-title-place">{restaurantName}</span>?
              </h2>
              <p className="rf-sub">Dimmelo con le stelle: lo leggo io, e lo vede anche il locale.</p>
              <StarRating value={rating} onChange={pickRating} reduce={reduce} />
              <p className="rf-rating-label" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={rating || 0}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    {ratingCopy(rating).label}
                  </motion.span>
                </AnimatePresence>
              </p>
              {error && <p className="rf-error" role="alert">{error}</p>}
              <div className="rf-actions">
                <motion.button
                  type="button"
                  className="rf-btn rf-btn-primary"
                  onClick={goForm}
                  disabled={!rating}
                  whileTap={rating ? { scale: 0.97 } : undefined}
                >
                  Avanti
                </motion.button>
              </div>
            </motion.section>
          )}

          {step === 'form' && (
            <motion.section
              key="form"
              className="rf-step rf-form-step"
              {...slide}
              transition={{ duration: 0.34, ease: EASE_OUT }}
            >
              <div className="rf-form-top">
                <MiniStars value={rating} onEdit={() => setStep('stars')} />
                <button type="button" className="rf-skip" onClick={skipForm}>Salta</button>
              </div>

              <div className="rf-form-scroll">
                <div className="rf-speech">
                  <div className="rf-speech-avatar" aria-hidden="true">
                    <BiCharacter mood={ratingCopy(rating).mood} food={false} />
                  </div>
                  <div className="rf-bubble">
                    <strong>{rating >= 4 ? 'Che bello!' : rating === 3 ? 'Grazie!' : 'Mi dispiace.'}</strong>{' '}
                    {rating <= 2
                      ? 'Raccontami cosa non è andato: mi serve per scegliere meglio i posti.'
                      : 'Raccontami qualcosa di più, se ti va. Mi aiuta a scegliere i prossimi posti.'}
                  </div>
                </div>

                <fieldset className="rf-q">
                  <legend>{likedQuestion(rating)}</legend>
                  <div className="rf-chips">
                    {LIKED_OPTIONS.map((o) => (
                      <Chip key={o.key} on={liked.includes(o.key)} onClick={() => toggleLiked(o.key)}>
                        <span aria-hidden="true">{o.emoji}</span> {o.label}
                      </Chip>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="rf-q">
                  <legend>Lo sconto com’è andato?</legend>
                  <Segmented options={DISCOUNT_OPTIONS} value={sconto} onChange={setSconto} />
                </fieldset>

                <fieldset className="rf-q">
                  <legend>Ci torneresti?</legend>
                  <Segmented options={RETURN_OPTIONS} value={tornare} onChange={setTornare} />
                </fieldset>

                <label className="rf-q rf-comment">
                  <span className="rf-q-label">Scrivi a Bi</span>
                  <textarea
                    value={comment}
                    maxLength={COMMENT_MAX}
                    rows={4}
                    placeholder="Un piatto da non perdere, un consiglio, una cosa da sistemare…"
                    onChange={(e) => setComment(e.target.value)}
                  />
                  {comment.length > COMMENT_MAX - 200 && (
                    <span className="rf-count">{comment.length}/{COMMENT_MAX}</span>
                  )}
                </label>
                <p className="rf-privacy">Stelle, risposte e messaggio li vede anche il locale, con il tuo nome di battesimo.</p>
              </div>

              {error && <p className="rf-error" role="alert">{error}</p>}
              <div className="rf-actions rf-actions-form">
                <motion.button
                  type="button"
                  className="rf-btn rf-btn-primary"
                  onClick={send}
                  disabled={!canSend}
                  whileTap={canSend ? { scale: 0.97 } : undefined}
                >
                  {sending ? 'Invio…' : 'Manda a Bi'}
                </motion.button>
              </div>
            </motion.section>
          )}

          {step === 'thanks' && (
            <motion.section
              key="thanks"
              className="rf-step rf-thanks-step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Thanks reduce={reduce} name={name} />
              <motion.div
                className="rf-actions"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : 1.1, duration: 0.3, ease: EASE_OUT }}
              >
                <button
                  type="button"
                  className="rf-btn rf-btn-primary"
                  onClick={() => close({ completed: true, step: 'thanks' })}
                >
                  {variant === 'page' ? 'Vai al Bi Club' : 'Chiudi'}
                </button>
              </motion.div>
            </motion.section>
          )}

          {step === 'bye' && (
            <motion.section
              key="bye"
              className="rf-step rf-bye-step"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              <div className="rf-bi-stage rf-bi-stage-sm">
                <span className="rf-bi-halo" aria-hidden="true" />
                <BiCharacter className="rf-bi" mood="ok" wave />
              </div>
              <h2 className="rf-title">Va bene!</h2>
              <p className="rf-sub">Se ti torna in mente qualcosa, me lo racconti dopo.</p>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </Root>
  )
}

/* ── La festa ─────────────────────────────────────────────────────────── */

function Celebrate({ reduce, restaurantName, badge }) {
  return (
    <div className="rf-celebrate-inner" role="status" aria-live="assertive">
      <div className="rf-check-wrap">
        {!reduce && (
          <>
            <motion.span
              className="rf-ring"
              initial={{ scale: 0.6, opacity: 0.55 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.15 }}
            />
            <motion.span
              className="rf-ring"
              initial={{ scale: 0.6, opacity: 0.4 }}
              animate={{ scale: 3.4, opacity: 0 }}
              transition={{ duration: 1.4, ease: EASE_OUT, delay: 0.35 }}
            />
            <Confetti />
          </>
        )}
        <motion.div
          className="rf-check"
          initial={reduce ? false : { scale: 0.3, opacity: 0, rotate: -30 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16 }}
        >
          <svg width="58" height="58" viewBox="0 0 52 52" fill="none" aria-hidden="true">
            <motion.path
              d="M14 27.5 L22.5 36 L38 18"
              stroke="#E8453C"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: reduce ? 0 : 0.22, duration: reduce ? 0 : 0.36, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>
      </div>

      <motion.h2
        className="rf-celebrate-title"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.38, ...SPRING_SOFT }}
      >
        Sconto convalidato!
      </motion.h2>
      <motion.div
        className="rf-celebrate-place"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.52, duration: 0.3, ease: EASE_OUT }}
      >
        {badge && <span className="rf-badge">{badge}</span>}
        <span>da {restaurantName}</span>
      </motion.div>
      <motion.p
        className="rf-celebrate-note"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 0.9, duration: 0.4 }}
      >
        Lo trovi sullo scontrino. Buon appetito!
      </motion.p>
    </div>
  )
}

const CONFETTI_COLORS = ['#FFFFFF', '#F5F0E4', '#C9A063', '#A3E635', '#FFD2CC', '#FFFFFF']

// Un "caso" che dà sempre lo stesso numero per la stessa coppia: i
// coriandoli sembrano sparsi a caso ma il render resta puro.
function jitter(i, k) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const angle = (i / 28) * Math.PI * 2 + (jitter(i, 1) - 0.5) * 0.5
    const dist = 90 + jitter(i, 2) * 90
    return {
      id: i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 20,
      rot: (jitter(i, 3) - 0.5) * 540,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: 6 + jitter(i, 4) * 6,
      h: 4 + jitter(i, 5) * 8,
      round: i % 4 === 0,
      delay: 0.12 + jitter(i, 6) * 0.12,
    }
  }), [])
  return (
    <span className="rf-confetti" aria-hidden="true">
      {bits.map((b) => (
        <motion.span
          key={b.id}
          className="rf-confetto"
          style={{
            width: b.w,
            height: b.round ? b.w : b.h,
            background: b.color,
            borderRadius: b.round ? '50%' : 2,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 60], opacity: [1, 1, 0], rotate: b.rot, scale: 1 }}
          transition={{ duration: 1.5, delay: b.delay, ease: [0.16, 1, 0.3, 1], times: [0, 0.55, 1] }}
        />
      ))}
    </span>
  )
}

/* ── Le stelle ────────────────────────────────────────────────────────── */

function StarRating({ value, onChange, reduce }) {
  const [hover, setHover] = useState(null)
  const shown = hover ?? value ?? 0
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)) }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(1, (value || 1) - 1)) }
  }
  return (
    <div
      className="rf-stars"
      role="radiogroup"
      aria-label="Voto da 1 a 5 stelle"
      onKeyDown={onKeyDown}
      onPointerLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= shown
        return (
          <motion.button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'stella' : 'stelle'}`}
            tabIndex={value ? (value === n ? 0 : -1) : (n === 1 ? 0 : -1)}
            className={`rf-star ${on ? 'is-on' : ''}`}
            onClick={() => onChange(n)}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(n) }}
            whileTap={reduce ? undefined : { scale: 0.82 }}
            animate={on && !reduce ? { scale: [1, 1.22, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
            transition={{ duration: 0.34, delay: on && hover == null ? (n - 1) * 0.04 : 0, ease: EASE_OUT }}
          >
            <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
              <path
                d="M12 2.6l2.83 5.74 6.33.92-4.58 4.46 1.08 6.3L12 17.04l-5.66 2.98 1.08-6.3L2.84 9.26l6.33-.92L12 2.6z"
                strokeLinejoin="round"
              />
            </svg>
            {value === n && !reduce && <Sparkles key={`sp-${value}`} />}
          </motion.button>
        )
      })}
    </div>
  )
}

function Sparkles() {
  const bits = [0, 1, 2, 3, 4, 5]
  return (
    <span className="rf-sparkles" aria-hidden="true">
      {bits.map((i) => {
        const a = (i / bits.length) * Math.PI * 2
        return (
          <motion.span
            key={i}
            className="rf-sparkle"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x: Math.cos(a) * 30, y: Math.sin(a) * 30, opacity: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: EASE_OUT }}
          />
        )
      })}
    </span>
  )
}

function MiniStars({ value, onEdit }) {
  return (
    <button type="button" className="rf-ministars" onClick={onEdit} aria-label={`Hai dato ${value} stelle. Cambia voto`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" width="18" height="18" className={n <= value ? 'is-on' : ''} aria-hidden="true">
          <path d="M12 2.6l2.83 5.74 6.33.92-4.58 4.46 1.08 6.3L12 17.04l-5.66 2.98 1.08-6.3L2.84 9.26l6.33-.92L12 2.6z" />
        </svg>
      ))}
    </button>
  )
}

/* ── Il modulo ────────────────────────────────────────────────────────── */

function Chip({ on, onClick, children }) {
  return (
    <motion.button
      type="button"
      className={`rf-chip ${on ? 'is-on' : ''}`}
      aria-pressed={on}
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
    >
      {children}
    </motion.button>
  )
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="rf-seg" role="radiogroup">
      {options.map((o) => {
        const on = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            className={`rf-seg-opt ${on ? 'is-on' : ''}`}
            onClick={() => onChange(on ? null : o.key)}
          >
            {on && <motion.span layoutId={`seg-${options[0].key}`} className="rf-seg-pill" transition={{ type: 'spring', duration: 0.35, bounce: 0.18 }} />}
            <span className="rf-seg-text">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ── Il grazie ────────────────────────────────────────────────────────── */

function Thanks({ reduce, name }) {
  return (
    <div className="rf-thanks">
      <div className="rf-bi-stage rf-bi-stage-lg">
        <motion.span
          className="rf-bi-halo"
          aria-hidden="true"
          initial={reduce ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        />
        <motion.div
          initial={reduce ? false : { y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: reduce ? 0 : 0.12, type: 'spring', stiffness: 220, damping: 18 }}
        >
          <BiCharacter className="rf-bi" mood="love" wave hearts />
        </motion.div>
      </div>
      <motion.h2
        className="rf-title rf-thanks-title"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.5, ...SPRING_SOFT }}
      >
        {name ? `Grazie, ${name}!` : 'Grazie!'}
      </motion.h2>
      <motion.p
        className="rf-sub"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.7, duration: 0.3, ease: EASE_OUT }}
      >
        Ho letto tutto. Con i vostri racconti scelgo i prossimi posti del Bi Club.
        <span className="rf-sign"> — Bi</span>
      </motion.p>
    </div>
  )
}

function PlaceChip({ name, photo, badge }) {
  const src = photo ? proxyImg(photo, { w: 96 }) : null
  return (
    <div className="rf-place">
      <span className="rf-place-thumb">
        {src ? <img src={src} alt="" width="28" height="28" decoding="async" /> : <span>{(name || 'B').charAt(0)}</span>}
      </span>
      <span className="rf-place-name">{name}</span>
      {badge && <span className="rf-badge rf-badge-sm">{badge}</span>}
      <span className="rf-place-ok" aria-label="convalidato">✓</span>
    </div>
  )
}
