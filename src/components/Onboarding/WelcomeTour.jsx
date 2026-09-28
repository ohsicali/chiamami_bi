import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import BiLogoMark from '../UI/BiLogoMark'
import { formatDiscountBadge } from '../../lib/utils/discountFormat'
import { formatShortCode } from '../../lib/shortCode'
import { CHAT_MAINTENANCE } from '../../lib/chatMaintenance'
import { TOUR_COVERED_EVENT } from '../../lib/welcomeTour'
import { DUR, EASE_OUT, SPRING_SNAP, SPRING_SOFT } from '../../lib/motion'
import './WelcomeTour.css'

/**
 * Il tutorial di benvenuto (28/09).
 *
 * Chi lo mostra e quando: WelcomeTourGate + src/lib/welcomeTour.js.
 * Qui c'è solo il racconto:
 *   1. il benvenuto, a tutto corallo — deve far venire voglia di andare avanti;
 *   2. Esplora;
 *   3-6. gli sconti in quattro passi, perché sono la parte che conta e quella
 *        che da soli non si capiva: i due tipi → si sblocca e finisce in «I
 *        miei vantaggi» → su cosa e quando vale → alla cassa, sullo scontrino;
 *   7. i Salvati.
 * In fondo un'animazione di chiusura, e WelcomeTourGate porta alla home.
 *
 * Le illustrazioni sono pezzi dell'app in piccolo — la mappa coi pin, la
 * card di un drop, il selettore QR/Codice, la scheda delle regole — e non
 * screenshot: restano giuste quando cambia un colore e non pesano niente.
 * Le regole del resto del sito valgono anche qui, perché il primo posto in
 * cui le si impara è questo: il corallo col countdown è solo dei drop, le
 * convenzioni sono crema e oro; il badge dello sconto è verde e passa da
 * `formatDiscountBadge`; il codice si legge a tre + tre.
 *
 * Se cambia una di queste funzioni dell'app, va cambiato anche il testo qui.
 */

const DEMO_DROP = { discount_type: 'percentage', discount_value: '30' }
const DEMO_CONV = { discount_type: 'percentage', discount_value: '15' }
const DEMO_UNLOCK = { discount_type: 'percentage', discount_value: '20' }
const DEMO_CODE = 'K48213'

function buildSlides(name) {
  const slides = [
    {
      key: 'welcome',
      hero: true,
      eyebrow: name ? `Ciao ${name}!` : 'Ciao!',
      title: 'Mangia bene. Spendi meno.',
      body: 'In un minuto ti faccio vedere dove trovare i posti giusti e come usare gli sconti del Bi Club.',
      cta: 'Fammi vedere',
      Art: ArtHero,
    },
    {
      key: 'explore',
      eyebrow: 'Esplora',
      title: 'Trova dove andare.',
      body: 'Sulla mappa ci sono solo posti provati. Tocca un pin per orari, foto e come arrivarci; coi filtri vedi chi è aperto adesso.',
      Art: ArtMap,
    },
    {
      key: 'deals',
      eyebrow: 'Sconti · 1 di 4',
      title: 'Nel Bi Club, due tipi di sconto.',
      body: 'I drop, in corallo, durano poco e i posti finiscono: se ti piace, non aspettare. Le convenzioni, color crema, restano e valgono nei giorni indicati.',
      Art: ArtDeals,
    },
    {
      key: 'unlock',
      eyebrow: 'Sconti · 2 di 4',
      title: 'Prima lo sblocchi.',
      body: 'Nella sezione Sconti scegli quello che ti interessa e tocca «Sblocca sconto»: è gratis. Da quel momento è tuo e lo ritrovi in «I miei vantaggi».',
      Art: ArtUnlock,
    },
    {
      key: 'rules',
      eyebrow: 'Sconti · 3 di 4',
      title: 'Guarda su cosa e quando vale.',
      body: 'Ogni sconto dice su cosa si applica, in quali giorni, se a pranzo, a cena o tutti e due, e le condizioni. Il QR si apre solo quando lo sconto vale.',
      Art: ArtRules,
    },
    {
      key: 'checkout',
      eyebrow: 'Sconti · 4 di 4',
      title: 'Alla cassa, sullo scontrino.',
      body: 'Al momento del conto apri «I miei vantaggi» e mostra il QR in cassa, o detta il codice. Il locale lo convalida e lo sconto lo trovi sullo scontrino finale.',
      Art: ArtCheckout,
    },
    {
      key: 'save',
      eyebrow: 'Salvati',
      title: 'Tieni da parte i posti.',
      body: 'Col cuore li metti nei Salvati e li dividi in liste. Li ritrovi su qualsiasi telefono.',
      cta: 'Tutto chiaro, andiamo',
      Art: ArtSave,
    },
  ]
  // Chiedi a Bi compare solo quando la chat è accesa: raccontare una cosa
  // che poi risponde "in manutenzione" è peggio che non dirla.
  if (!CHAT_MAINTENANCE) {
    slides.splice(slides.length - 1, 0, {
      key: 'ask',
      eyebrow: 'Chiedi a Bi',
      title: 'Non sai cosa ti va?',
      body: 'Scrivimi com’è la serata — in quanti siete, quanto volete spendere — e ti dico io dove andare.',
      Art: ArtAsk,
    })
  }
  return slides
}

// Quanto dura l'animazione di chiusura prima di passare alla home.
const FINALE_MS = 2000
const FINALE_MS_REDUCED = 900

export default function WelcomeTour({ name, origin, onClose }) {
  const reduce = useReducedMotion()
  const slides = useMemo(() => buildSlides(name), [name])
  const [[index, dir], setPage] = useState([0, 0])
  const [finishing, setFinishing] = useState(false)
  const panelRef = useRef(null)
  const slide = slides[index]
  const last = index === slides.length - 1

  const go = (next) => {
    if (finishing || next < 0 || next >= slides.length || next === index) return
    setPage([next, next > index ? 1 : -1])
  }
  const skip = () => { if (!finishing) onClose({ completed: false, step: slide.key }) }
  const next = () => {
    if (finishing) return
    if (last) setFinishing(true)
    else go(index + 1)
  }

  // Finita l'animazione di chiusura, il Gate chiude e porta alla home.
  // `onClose` passa da un ref: il Gate ne crea una nuova a ogni render, e
  // come dipendenza farebbe ripartire il timer.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    if (!finishing) return undefined
    const t = setTimeout(() => onCloseRef.current({ completed: true, step: 'finale' }), reduce ? FINALE_MS_REDUCED : FINALE_MS)
    return () => clearTimeout(t)
  }, [finishing, reduce])

  // Tastiera: frecce per sfogliare, Esc per uscire (come Salta).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); skip() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // La pagina sotto non scorre finché il tutorial è aperto, e alla chiusura
  // il fuoco torna dov'era. Il fuoco va al pannello e non al bottone
  // Avanti: sul bottone il browser disegnava l'anello di fuoco anche a chi
  // usa il dito.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    const prevFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = prevOverflow
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus({ preventScroll: true })
    }
  }, [])

  const slideVariants = reduce
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        enter: (d) => ({ opacity: 0, x: d >= 0 ? 48 : -48 }),
        center: { opacity: 1, x: 0 },
        exit: (d) => ({ opacity: 0, x: d >= 0 ? -48 : 48 }),
      }

  const onDragEnd = (_e, info) => {
    const swipe = info.offset.x + info.velocity.x * 0.2
    if (swipe < -60) next()
    else if (swipe > 60) go(index - 1)
  }

  const { Art } = slide

  // Entrata. Di solito una dissolvenza con il pannello che sale; dopo la
  // conferma dell'account (`origin`) invece un cerchio che si allarga dal
  // cerchio corallo della spunta fino a coprire lo schermo — la spunta
  // diventa la prima schermata, e il passaggio non ha stacchi.
  const [reveal] = useState(() => (origin && !reduce ? revealCircle(origin) : null))
  const rootMotion = reveal
    ? {
        initial: { clipPath: reveal.from },
        animate: { clipPath: reveal.to, transitionEnd: { clipPath: 'none' } },
        transition: { duration: 0.75, ease: [0.65, 0, 0.35, 1] },
      }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: DUR.sheet, ease: EASE_OUT },
      }

  return (
    <motion.div
      className="wt-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wt-title"
      aria-describedby="wt-body"
      {...rootMotion}
      // Finita l'entrata il tutorial copre tutto: chi aspettava per
      // cambiare pagina sotto (la conferma dell'account) può farlo ora.
      onAnimationComplete={() => {
        if (!finishing) window.dispatchEvent(new Event(TOUR_COVERED_EVENT))
      }}
      exit={{ opacity: 0, transition: { duration: DUR.sheet, ease: EASE_OUT } }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        className={`wt-panel ${slide.hero ? 'is-hero' : ''}`}
        initial={reduce ? { opacity: 0 } : reveal ? false : { opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
        transition={{ duration: DUR.sheet, ease: EASE_OUT }}
      >
        <header className="wt-top">
          <div className="wt-progress" aria-hidden="true">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                tabIndex={-1}
                className="wt-progress-seg"
                onClick={() => go(i)}
              >
                <motion.span
                  className="wt-progress-fill"
                  initial={false}
                  animate={{ scaleX: i <= index ? 1 : 0 }}
                  transition={{ duration: reduce ? 0 : DUR.sheet, ease: EASE_OUT }}
                />
              </button>
            ))}
          </div>
          <span className="wt-count" aria-live="polite">
            {index + 1} di {slides.length}
          </span>
          <button type="button" className="wt-skip" onClick={skip}>
            Salta
          </button>
        </header>

        <div className="wt-stage">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={slide.key}
              className="wt-slide"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: DUR.sheet, ease: EASE_OUT }}
              drag={reduce ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              dragSnapToOrigin
              onDragEnd={onDragEnd}
            >
              <div className="wt-art">
                <Art reduce={reduce} />
              </div>
              <div className="wt-copy">
                <p className="wt-eyebrow">{slide.eyebrow}</p>
                <h2 id="wt-title" className="wt-title" aria-label={slide.title}>
                  <Words text={slide.title} reduce={reduce} delay={slide.hero ? 0.55 : 0.08} />
                </h2>
                <p id="wt-body" className="wt-body">{slide.body}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="wt-actions">
          <button
            type="button"
            className="wt-back"
            onClick={() => go(index - 1)}
            aria-label="Schermata precedente"
            disabled={index === 0}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button type="button" className="wt-next" onClick={next}>
            {slide.cta || 'Avanti'}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </footer>

        <AnimatePresence>
          {finishing && <Finale key="finale" name={name} reduce={reduce} />}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

/**
 * Il cerchio dell'entrata: parte grande quanto il cerchio della spunta e
 * finisce abbastanza grande da coprire l'angolo più lontano dello schermo.
 */
function revealCircle({ x, y, r = 48 }) {
  const w = window.innerWidth
  const h = window.innerHeight
  const far = Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y))) + 2
  return {
    from: `circle(${r}px at ${x}px ${y}px)`,
    to: `circle(${far}px at ${x}px ${y}px)`,
  }
}

/** Il titolo che sale una parola alla volta. */
function Words({ text, reduce, delay = 0 }) {
  const words = text.split(' ')
  return (
    <span aria-hidden="true">
      {words.map((w, i) => (
        // Lo spazio sta fuori dal blocco della parola: dentro un
        // inline-block quello in coda sparisce e le parole si attaccano.
        <Fragment key={`${w}-${i}`}>
          {i > 0 && ' '}
          <span className="wt-word">
            <motion.span
              className="wt-word-in"
              initial={reduce ? { opacity: 0 } : { y: '105%' }}
              animate={reduce ? { opacity: 1 } : { y: '0%' }}
              transition={reduce ? { duration: DUR.reveal } : { duration: 0.5, ease: EASE_OUT, delay: delay + i * 0.06 }}
            >
              {w}
            </motion.span>
          </span>
        </Fragment>
      ))}
    </span>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Illustrazioni. Ognuna parte da capo quando la sua schermata entra
 * (la chiave cambia, il componente si rimonta): non serve orchestrarle.
 * Quelle che raccontano un gesto (sblocco, cassa) girano in loop, così
 * chi legge prima il testo e guarda dopo non si è perso niente.
 * ──────────────────────────────────────────────────────────────────── */

// Entrata a cascata per gli elementi di un'illustrazione.
function pop(reduce, delay = 0, from = { y: 12, scale: 0.96 }) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: DUR.reveal, delay } }
  return {
    initial: { opacity: 0, ...from },
    animate: { opacity: 1, y: 0, x: 0, scale: 1 },
    transition: { ...SPRING_SNAP, delay },
  }
}

/**
 * Una sequenza a fasi che si ripete: `durations[i]` è quanto resta nella
 * fase i. Con "riduci movimento" resta ferma su `still`, la fase che da
 * sola racconta tutto.
 */
function usePhases(durations, reduce, still) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (reduce) return undefined
    const t = setTimeout(() => setPhase((p) => (p + 1) % durations.length), durations[phase])
    return () => clearTimeout(t)
  }, [phase, reduce, durations])
  return reduce ? still : phase
}

// Il giro di cibo attorno al logo.
const ORBIT = ['🍕', '🍣', '🍝', '🥐', '🍷', '🍔', '🍜', '🍰']

function ArtHero({ reduce }) {
  return (
    <div className="wt-hero">
      <div className="wt-hero-rays" aria-hidden="true" />
      {!reduce && (
        <motion.span
          className="wt-hero-shock"
          initial={{ scale: 0.3, opacity: 0.9 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.32 }}
          aria-hidden="true"
        />
      )}

      <div className="wt-hero-ring" aria-hidden="true">
        {ORBIT.map((e, i) => {
          const a = (i / ORBIT.length) * Math.PI * 2 - Math.PI / 2
          return (
            <span
              key={e}
              className="wt-hero-orb"
              style={{ left: `${50 + 50 * Math.cos(a)}%`, top: `${50 + 50 * Math.sin(a)}%` }}
            >
              <motion.span
                className="wt-hero-orb-in"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduce ? { duration: DUR.reveal } : { ...SPRING_SOFT, delay: 0.45 + i * 0.07 }}
              >
                {e}
              </motion.span>
            </span>
          )
        })}
      </div>

      <motion.div
        className="wt-hero-logo"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.6, rotate: -30 }}
        animate={{ opacity: 1, scale: 1, rotate: -4 }}
        transition={reduce ? { duration: DUR.reveal } : { type: 'spring', duration: 0.7, bounce: 0.45, delay: 0.12 }}
      >
        <BiLogoMark style={{ width: '100%', height: '100%' }} />
      </motion.div>

      <motion.span
        className="wt-hero-sticker"
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: 140, y: -90, rotate: 50, scale: 1.8 }}
        animate={{ opacity: 1, x: 0, y: 0, rotate: 12, scale: 1 }}
        transition={reduce ? { duration: DUR.reveal } : { type: 'spring', duration: 0.6, bounce: 0.5, delay: 1.05 }}
        aria-hidden="true"
      >
        {formatDiscountBadge(DEMO_DROP)}
      </motion.span>

      <motion.p className="wt-hero-hand" {...pop(reduce, 1.3, { y: 8 })}>
        la guida food di Torino
      </motion.p>
    </div>
  )
}

function Pin({ active }) {
  return (
    <svg viewBox="0 0 24 30" width="26" height="32" aria-hidden="true">
      <path
        d="M12 1C6.2 1 2 5.3 2 10.8 2 18 12 29 12 29s10-11 10-18.2C22 5.3 17.8 1 12 1z"
        fill={active ? 'var(--color-corallo)' : 'var(--color-ink)'}
        stroke="#fff"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="11" r="3.6" fill="#fff" />
    </svg>
  )
}

function ArtMap({ reduce }) {
  const pins = [
    { x: '18%', y: '30%', d: 0.15 },
    { x: '72%', y: '22%', d: 0.25 },
    { x: '30%', y: '58%', d: 0.35 },
    { x: '82%', y: '52%', d: 0.45 },
    { x: '52%', y: '40%', d: 0.55, active: true },
  ]
  return (
    <div className="wt-art-map">
      <svg className="wt-map-roads" viewBox="0 0 300 220" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-10 150 C 60 120, 120 190, 200 150 S 290 90, 320 110" className="wt-map-river" />
        <path d="M-10 60 L 320 90" />
        <path d="M60 -10 L 110 230" />
        <path d="M190 -10 L 170 230" />
        <path d="M-10 190 L 320 170" />
        <path d="M240 -10 C 250 60, 280 120, 320 140" />
      </svg>

      <div className="wt-map-chips">
        <motion.span className="wt-chip is-on" {...pop(reduce, 0.05, { y: -8 })}>
          <i className="wt-dot" /> Aperto ora
        </motion.span>
        <motion.span className="wt-chip" {...pop(reduce, 0.12, { y: -8 })}>Pizza</motion.span>
        <motion.span className="wt-chip" {...pop(reduce, 0.19, { y: -8 })}>Brunch</motion.span>
      </div>

      {pins.map((p, i) => (
        <motion.div
          key={i}
          className={`wt-pin ${p.active ? 'is-active' : ''}`}
          style={{ left: p.x, top: p.y }}
          {...pop(reduce, p.d, { y: -22, scale: 0.8 })}
        >
          {p.active && !reduce && <span className="wt-pin-pulse" />}
          <Pin active={p.active} />
        </motion.div>
      ))}

      <motion.div className="wt-map-card" {...pop(reduce, 0.9, { y: 30 })}>
        <div className="wt-map-card-photo" />
        <div className="wt-map-card-text">
          <strong>Trattoria da Bi</strong>
          <span><i className="wt-dot" /> Aperto ora · 400 m</span>
        </div>
        <span className="wt-map-card-go" aria-hidden="true">›</span>
      </motion.div>
    </div>
  )
}

// Il countdown gira davvero: è la cosa che fa capire "drop" più di
// qualunque parola.
function useCountdown(startSeconds, reduce) {
  const [s, setS] = useState(startSeconds)
  useEffect(() => {
    if (reduce) return undefined
    const t = setInterval(() => setS((v) => (v > 0 ? v - 1 : startSeconds)), 1000)
    return () => clearInterval(t)
  }, [startSeconds, reduce])
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function ArtDeals({ reduce }) {
  const countdown = useCountdown(2 * 3600 + 14 * 60 + 9, reduce)
  return (
    <div className="wt-art-deals">
      <motion.div className="wt-drop" {...pop(reduce, 0.1, { x: 30 })}>
        <div className="wt-drop-head">
          <span className="wt-drop-tag"><i className="wt-live" /> DROP</span>
          <span className="wt-drop-timer" aria-label="Scade tra">{countdown}</span>
        </div>
        <div className="wt-deal-row">
          <span className="wt-badge">{formatDiscountBadge(DEMO_DROP)}</span>
          <div>
            <strong>Pizzeria del Borgo</strong>
            <span>sul conto, solo stasera</span>
          </div>
        </div>
        <div className="wt-drop-bar" aria-hidden="true">
          <motion.i
            initial={{ scaleX: reduce ? 0.7 : 0 }}
            animate={{ scaleX: 0.7 }}
            transition={{ duration: reduce ? 0 : 0.9, ease: EASE_OUT, delay: 0.4 }}
          />
        </div>
        <span className="wt-drop-left">Restano 3 posti su 10</span>
      </motion.div>

      <motion.div className="wt-conv" {...pop(reduce, 0.3, { x: -30 })}>
        <div className="wt-deal-row">
          <span className="wt-badge">{formatDiscountBadge(DEMO_CONV)}</span>
          <div>
            <strong>Caffè Aurora</strong>
            <span>su colazioni e brunch</span>
          </div>
        </div>
        <span className="wt-conv-chip">valido a pranzo e a cena</span>
      </motion.div>
    </div>
  )
}

function LockIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d={open ? 'M8 11V7a4 4 0 0 1 7.6-1.8' : 'M8 11V7a4 4 0 0 1 8 0v4'} />
    </svg>
  )
}

// 0 fermo · 1 il dito arriva · 2 tocco, sbloccato · 3 vola in «I miei
// vantaggi» · 4 è lì, col suo QR. Poi da capo.
const UNLOCK_PHASES = [900, 650, 850, 650, 2600]

function ArtUnlock({ reduce }) {
  const phase = usePhases(UNLOCK_PHASES, reduce, 4)
  const inWallet = phase >= 4
  const unlocked = phase >= 2

  return (
    <div className="wt-art-unlock">
      <div className="wt-seg wt-seg-club">
        <motion.span
          className="wt-seg-thumb"
          initial={false}
          animate={{ x: inWallet ? '100%' : '0%' }}
          transition={SPRING_SNAP}
        />
        <span className={!inWallet ? 'is-on' : ''}>Tutti gli sconti</span>
        <span className={inWallet ? 'is-on' : ''}>
          I miei vantaggi
          <motion.b
            className="wt-seg-count"
            key={inWallet ? 'one' : 'zero'}
            initial={inWallet && !reduce ? { scale: 0.2 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.6 }}
          >
            {inWallet ? 1 : 0}
          </motion.b>
        </span>
      </div>

      <div className="wt-unlock-stage">
        <AnimatePresence mode="wait" initial={false}>
          {!inWallet ? (
            <motion.div
              key="catalog"
              className="wt-unlock-card"
              initial={{ opacity: 0, y: 14 }}
              animate={phase === 3 ? { opacity: 0, y: -120, x: 60, scale: 0.25, rotate: 8 } : { opacity: 1, y: 0, x: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0 }}
              transition={phase === 3 ? { duration: 0.6, ease: [0.5, 0, 0.75, 0] } : SPRING_SNAP}
            >
              <div className="wt-deal-row">
                <span className="wt-badge">{formatDiscountBadge(DEMO_UNLOCK)}</span>
                <div>
                  <strong>Osteria Sotto i Portici</strong>
                  <span>su tutto il menù</span>
                </div>
              </div>
              <motion.span
                className={`wt-unlock-btn ${unlocked ? 'is-done' : ''}`}
                animate={phase === 2 && !reduce ? { scale: [1, 0.94, 1.04, 1] } : { scale: 1 }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
              >
                <LockIcon open={unlocked} />
                {unlocked ? 'Sbloccato' : 'Sblocca sconto'}
                {phase === 2 && !reduce && <span className="wt-ripple" />}
              </motion.span>
              {!reduce && (
                <motion.span
                  className="wt-finger"
                  aria-hidden="true"
                  initial={false}
                  animate={
                    phase === 0 ? { opacity: 0, x: 60, y: 60, scale: 1 }
                      : phase === 1 ? { opacity: 1, x: 0, y: 0, scale: 1 }
                        : phase === 2 ? { opacity: 1, x: 0, y: 0, scale: 0.8 }
                          : { opacity: 0, x: 0, y: 0, scale: 1 }
                  }
                  transition={{ duration: phase === 2 ? 0.15 : 0.5, ease: EASE_OUT }}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="wallet"
              className="wt-wallet-row"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={SPRING_SNAP}
            >
              <span className="wt-badge is-small">{formatDiscountBadge(DEMO_UNLOCK)}</span>
              <div>
                <strong>Osteria Sotto i Portici</strong>
                <span>Pronto da usare</span>
              </div>
              <span className="wt-wallet-qr">Apri QR</span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <AnimatePresence>
        {inWallet && (
          <motion.div
            className="wt-toast"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: DUR.sheet, ease: EASE_OUT, delay: reduce ? 0 : 0.25 }}
          >
            <span className="wt-toast-ok" aria-hidden="true">✓</span>
            Salvato in «I miei vantaggi»
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// La luce passa sui tre blocchi della scheda: su cosa, quando, condizioni.
const RULES_PHASES = [1500, 1500, 1500]
// L M M G V S D — accesi da martedì a sabato.
const RULE_DAYS = [false, true, true, true, true, true, false]

function ArtRules({ reduce }) {
  const lit = usePhases(RULES_PHASES, reduce, -1)
  const block = (i) => `wt-rule ${lit === i ? 'is-lit' : ''}`
  return (
    <div className="wt-art-rules">
      <motion.div className="wt-rules-card" {...pop(reduce, 0.05, { y: 20 })}>
        <div className="wt-rules-head">
          <strong>Osteria Sotto i Portici</strong>
          <span className="wt-badge is-small">{formatDiscountBadge(DEMO_UNLOCK)}</span>
        </div>

        <div className={block(0)}>
          <span className="wt-rule-eyebrow">Lo sconto vale su</span>
          <div className="wt-rule-prods">
            <span><i>🍝</i>Primi</span>
            <span><i>🥩</i>Secondi</span>
            <span><i>🍷</i>Vini</span>
          </div>
        </div>

        <div className={block(1)}>
          <span className="wt-rule-eyebrow">Quando</span>
          <div className="wt-rule-days" aria-label="Valido da martedì a sabato">
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
              <i key={i} className={RULE_DAYS[i] ? 'is-on' : ''}>{d}</i>
            ))}
          </div>
          <div className="wt-rule-slots">
            <span className="is-off">☀︎ Pranzo</span>
            <span className="is-on">☾ Cena · 19:00 – 23:30</span>
          </div>
        </div>

        <div className={block(2)}>
          <span className="wt-rule-eyebrow">Da sapere</span>
          <ul className="wt-rule-conds">
            <li>Non cumulabile con altre promozioni</li>
            <li>Per tavoli fino a 4 persone</li>
          </ul>
        </div>
      </motion.div>
    </div>
  )
}

// Un QR finto ma credibile: i tre quadrati d'angolo veri e un riempimento
// deterministico (stesso disegno a ogni giro, niente sfarfallio).
const QR_N = 21
const QR_CELLS = (() => {
  const cells = []
  let seed = 7
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  const inFinder = (x, y) => (x < 8 && y < 8) || (x > QR_N - 9 && y < 8) || (x < 8 && y > QR_N - 9)
  for (let y = 0; y < QR_N; y++) {
    for (let x = 0; x < QR_N; x++) {
      if (!inFinder(x, y) && rand() > 0.52) cells.push([x, y])
    }
  }
  return cells
})()

function FakeQR() {
  const finder = (x, y) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" rx="1.2" fill="var(--color-ink)" />
      <rect x={x + 1} y={y + 1} width="5" height="5" rx="0.8" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" rx="0.6" fill="var(--color-ink)" />
    </g>
  )
  return (
    <svg viewBox={`-1 -1 ${QR_N + 2} ${QR_N + 2}`} className="wt-qr" aria-hidden="true">
      <rect x="-1" y="-1" width={QR_N + 2} height={QR_N + 2} fill="#fff" />
      {QR_CELLS.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x + 0.08} y={y + 0.08} width="0.84" height="0.84" rx="0.2" fill="var(--color-ink)" />
      ))}
      {finder(0, 0)}
      {finder(QR_N - 7, 0)}
      {finder(0, QR_N - 7)}
    </svg>
  )
}

// Lo scontrino: i conti tornano (31,00 − 20% = 24,80).
const RECEIPT = [
  ['Tagliatelle', '12,00'],
  ['Brasato', '19,00'],
]
// 0 il QR · 1 codice · 2 il locale scansiona · 3 convalidato · 4 lo scontrino
const CHECKOUT_PHASES = [1300, 1300, 1100, 900, 4200]

function ArtCheckout({ reduce }) {
  const phase = usePhases(CHECKOUT_PHASES, reduce, 4)
  const showCode = phase === 1
  const receipt = phase >= 4
  const code = formatShortCode(DEMO_CODE)

  return (
    <div className="wt-art-checkout">
      <motion.div
        className="wt-pass"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={receipt
          ? { opacity: 1, y: reduce ? 0 : -6, x: reduce ? 0 : '-14%', scale: 0.66, rotate: reduce ? 0 : -5 }
          : { opacity: 1, y: 0, x: '0%', scale: 1, rotate: 0 }}
        transition={SPRING_SNAP}
      >
        <div className="wt-pass-head">
          <strong>Osteria Sotto i Portici</strong>
          <span className="wt-badge is-small">{formatDiscountBadge(DEMO_UNLOCK)}</span>
        </div>
        <div className="wt-seg" role="presentation">
          <motion.span
            className="wt-seg-thumb"
            initial={false}
            animate={{ x: showCode ? '100%' : '0%' }}
            transition={SPRING_SNAP}
          />
          <span className={!showCode ? 'is-on' : ''}>QR</span>
          <span className={showCode ? 'is-on' : ''}>Codice</span>
        </div>
        <div className="wt-pass-body">
          <AnimatePresence mode="wait" initial={false}>
            {!showCode ? (
              <motion.div
                key="qr"
                className="wt-pass-qr"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: DUR.menu, ease: EASE_OUT }}
              >
                <FakeQR />
                {phase === 2 && <span className="wt-scanline" aria-hidden="true" />}
                <AnimatePresence>
                  {phase === 3 && (
                    <motion.span
                      className="wt-stamp"
                      initial={{ opacity: 0, scale: 1.8, rotate: -18 }}
                      animate={{ opacity: 1, scale: 1, rotate: -8 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', duration: 0.45, bounce: 0.45 }}
                    >
                      ✓ Convalidato
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="code"
                className="wt-pass-code"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: DUR.menu, ease: EASE_OUT }}
                aria-label={`Codice ${code}`}
              >
                <span className="wt-code-label">Detta questo codice</span>
                <span className="wt-code-cells" aria-hidden="true">
                  {DEMO_CODE.split('').map((c, i) => (
                    <i key={i} className={i === 0 ? 'is-letter' : ''}>{c}</i>
                  ))}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {receipt && (
          <motion.div
            className="wt-receipt"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: '70%', rotate: 6 }}
            animate={{ opacity: 1, y: '0%', rotate: reduce ? 0 : 3 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: '30%' }}
            transition={{ ...SPRING_SNAP, delay: reduce ? 0 : 0.15 }}
          >
            <span className="wt-receipt-title">Scontrino</span>
            {RECEIPT.map(([label, price], i) => (
              <motion.span key={label} className="wt-receipt-row" {...pop(reduce, 0.45 + i * 0.25, { y: 4 })}>
                <span>{label}</span><span>{price}</span>
              </motion.span>
            ))}
            <motion.span className="wt-receipt-row wt-receipt-discount" {...pop(reduce, 1.05, { y: 4, scale: 0.9 })}>
              <span>Sconto {formatDiscountBadge(DEMO_UNLOCK)}</span><span>−6,20</span>
            </motion.span>
            <motion.span className="wt-receipt-row wt-receipt-total" {...pop(reduce, 1.4, { y: 4 })}>
              <span>Totale</span><span>24,80 €</span>
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ArtSave({ reduce }) {
  const [saved, setSaved] = useState(!!reduce)
  useEffect(() => {
    if (reduce) return undefined
    const t = setTimeout(() => setSaved(true), 650)
    return () => clearTimeout(t)
  }, [reduce])
  return (
    <div className="wt-art-save">
      <motion.div className="wt-save-card" {...pop(reduce, 0.06, { y: 20 })}>
        <div className="wt-save-photo">
          <motion.button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={`wt-heart ${saved ? 'is-on' : ''}`}
            onClick={() => setSaved((v) => !v)}
            animate={saved && !reduce ? { scale: [1, 1.35, 1] } : { scale: 1 }}
            transition={{ duration: 0.36, ease: EASE_OUT }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"
                fill={saved ? 'var(--color-corallo)' : 'none'}
                stroke={saved ? 'var(--color-corallo)' : 'currentColor'}
                strokeWidth="2"
              />
            </svg>
          </motion.button>
        </div>
        <div className="wt-save-text">
          <strong>Caffè Aurora</strong>
          <span>Colazioni e brunch · €</span>
        </div>
      </motion.div>

      <AnimatePresence>
        {saved && (
          <motion.div
            className="wt-save-lists"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.sheet, ease: EASE_OUT, delay: reduce ? 0 : 0.25 }}
          >
            <span className="wt-save-lists-label">Metti in una lista</span>
            <div className="wt-save-chips">
              <span className="wt-chip is-on">✓ Da provare</span>
              <span className="wt-chip">Domenica mattina</span>
              <span className="wt-chip is-new">+ Nuova</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ArtAsk({ reduce }) {
  return (
    <div className="wt-art-ask">
      <motion.div className="wt-bubble is-me" {...pop(reduce, 0.1, { x: 20 })}>
        Stasera in 4, qualcosa di buono sotto i 25 €?
      </motion.div>
      <motion.div className="wt-bubble is-bi" {...pop(reduce, 0.7, { x: -20 })}>
        <span className="wt-bubble-mark"><BiLogoMark style={{ width: '100%', height: '100%' }} /></span>
        Ne ho tre in zona, e uno ha un drop attivo…
      </motion.div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * La chiusura: il corallo sale dal bottone e copre tutto, il logo
 * rimbalza, i coriandoli esplodono. Poi il Gate porta alla home.
 * ──────────────────────────────────────────────────────────────────── */

const CONFETTI_COLORS = ['#FFFFFF', '#A3E635', '#F6B7B1', '#F7C873', '#22181C']
const CONFETTI = Array.from({ length: 26 }, (_, i) => {
  const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.2
  const r = 120 + ((i * 37) % 90)
  return {
    x: Math.cos(a) * r,
    y: Math.sin(a) * r - 40,
    rot: ((i * 53) % 360) - 180,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: i % 4 === 0,
    d: (i % 5) * 0.02,
  }
})

function Finale({ name, reduce }) {
  return (
    <motion.div
      className="wt-finale"
      role="status"
      initial={reduce ? { opacity: 0 } : { clipPath: 'circle(0% at 50% 100%)' }}
      animate={reduce ? { opacity: 1 } : { clipPath: 'circle(150% at 50% 100%)' }}
      transition={{ duration: reduce ? DUR.reveal : 0.6, ease: [0.65, 0, 0.35, 1] }}
    >
      <div className="wt-hero-rays" aria-hidden="true" />
      <div className="wt-finale-burst" aria-hidden="true">
        {!reduce && CONFETTI.map((c, i) => (
          <motion.i
            key={i}
            className={c.round ? 'is-round' : ''}
            style={{ background: c.color }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
            animate={{ x: c.x, y: [0, c.y, c.y + 160], opacity: [1, 1, 0], rotate: c.rot, scale: 1 }}
            transition={{ duration: 1.6, ease: EASE_OUT, delay: 0.45 + c.d, times: [0, 0.45, 1] }}
          />
        ))}
      </div>
      <motion.div
        className="wt-finale-logo"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.2, rotate: -40 }}
        animate={{ opacity: 1, scale: 1, rotate: -4 }}
        transition={reduce ? { duration: DUR.reveal } : { type: 'spring', duration: 0.7, bounce: 0.5, delay: 0.35 }}
      >
        <BiLogoMark style={{ width: '100%', height: '100%' }} />
      </motion.div>
      <motion.p className="wt-finale-title" {...pop(reduce, 0.6, { y: 14 })}>
        Tutto pronto{name ? `, ${name}` : ''}!
      </motion.p>
      <motion.p className="wt-finale-sub" {...pop(reduce, 0.8, { y: 10 })}>
        Ti porto alla home…
      </motion.p>
    </motion.div>
  )
}
