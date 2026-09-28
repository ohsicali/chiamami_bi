import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import BiLogoMark from '../UI/BiLogoMark'
import { formatDiscountBadge } from '../../lib/utils/discountFormat'
import { formatShortCode } from '../../lib/shortCode'
import { CHAT_MAINTENANCE } from '../../lib/chatMaintenance'
import { DUR, EASE_OUT, SPRING_SNAP, SPRING_SOFT } from '../../lib/motion'
import './WelcomeTour.css'

/**
 * Il tutorial di benvenuto (28/09): cinque schermate, una cosa per volta.
 *
 * Chi lo mostra e quando: WelcomeTourGate + src/lib/welcomeTour.js.
 * Qui c'è solo il racconto. Le illustrazioni sono pezzi dell'app in piccolo
 * — la mappa coi pin, la card di un drop, il selettore QR/Codice — e non
 * screenshot: restano giuste quando cambia un colore e non pesano niente.
 *
 * Le regole del resto del sito valgono anche qui, perché il primo posto in
 * cui le si impara è questo: il corallo col countdown è solo dei drop, le
 * convenzioni sono crema e oro; il badge dello sconto è verde e passa da
 * `formatDiscountBadge`; il codice si legge a tre + tre.
 */

const DEMO_DROP = { discount_type: 'percentage', discount_value: '30' }
const DEMO_CONV = { discount_type: 'percentage', discount_value: '15' }
const DEMO_CODE = 'K48213'

function buildSlides(name) {
  const slides = [
    {
      key: 'welcome',
      eyebrow: name ? `Ciao ${name}!` : 'Ciao!',
      title: 'Sei nel Bi Club.',
      body: 'In quattro passi ti faccio vedere come trovare il posto giusto e pagarlo meno.',
      Art: ArtWelcome,
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
      eyebrow: 'Sconti',
      title: 'Due tipi di sconto.',
      body: 'I drop, in corallo, durano poco e i posti finiscono. Le convenzioni, color crema, valgono sempre nei giorni indicati.',
      Art: ArtDeals,
    },
    {
      key: 'redeem',
      eyebrow: 'Al locale',
      title: 'Mostra il QR, e basta.',
      body: 'Lo sconto che prendi lo ritrovi in “I miei vantaggi”. Alla cassa fai vedere il QR, o detti il codice di sei caratteri.',
      Art: ArtRedeem,
    },
    {
      key: 'save',
      eyebrow: 'Salvati',
      title: 'Tieni da parte i posti.',
      body: 'Col cuore li metti nei Salvati e li dividi in liste. Li ritrovi su qualsiasi telefono.',
      Art: ArtSave,
    },
  ]
  // Chiedi a Bi compare solo quando la chat è accesa: raccontare una cosa
  // che poi risponde "in manutenzione" è peggio che non dirla.
  if (!CHAT_MAINTENANCE) {
    slides.splice(4, 0, {
      key: 'ask',
      eyebrow: 'Chiedi a Bi',
      title: 'Non sai cosa ti va?',
      body: 'Scrivimi com’è la serata — in quanti siete, quanto volete spendere — e ti dico io dove andare.',
      Art: ArtAsk,
    })
    slides[0].body = 'In pochi passi ti faccio vedere come trovare il posto giusto e pagarlo meno.'
  }
  return slides
}

export default function WelcomeTour({ name, onClose }) {
  const reduce = useReducedMotion()
  const slides = useMemo(() => buildSlides(name), [name])
  const [[index, dir], setPage] = useState([0, 0])
  const panelRef = useRef(null)
  const slide = slides[index]
  const last = index === slides.length - 1

  const go = (next) => {
    if (next < 0 || next >= slides.length || next === index) return
    setPage([next, next > index ? 1 : -1])
  }
  const skip = () => onClose({ completed: false, step: slide.key })
  const next = () => (last ? onClose({ completed: true, step: slide.key }) : go(index + 1))

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

  return (
    <motion.div
      className="wt-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wt-title"
      aria-describedby="wt-body"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DUR.sheet, ease: EASE_OUT }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        className="wt-panel"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
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
            {last ? 'Chiudi' : 'Salta'}
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
                <h2 id="wt-title" className="wt-title">{slide.title}</h2>
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
            {last ? 'Iniziamo' : 'Avanti'}
            {!last && (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  )
}

/* ────────────────────────────────────────────────────────────────────
 * Illustrazioni. Ognuna parte da capo quando la sua schermata entra
 * (la chiave cambia, il componente si rimonta): non serve orchestrarle.
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

function ArtWelcome({ reduce }) {
  const tags = [
    { label: 'Pizza', x: '8%', y: '14%', d: 0.25 },
    { label: 'Brunch', x: '64%', y: '9%', d: 0.35 },
    { label: 'Aperitivo', x: '4%', y: '70%', d: 0.45 },
    { label: 'Sushi', x: '70%', y: '66%', d: 0.55 },
  ]
  return (
    <div className="wt-art-welcome">
      <motion.div
        className="wt-welcome-halo"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING_SOFT }}
      />
      <motion.div
        className="wt-welcome-mark"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, rotate: -18 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ ...SPRING_SOFT, delay: 0.08 }}
      >
        <BiLogoMark style={{ width: '100%', height: '100%' }} />
      </motion.div>
      {tags.map((t) => (
        <motion.span
          key={t.label}
          className="wt-welcome-tag"
          style={{ left: t.x, top: t.y }}
          {...pop(reduce, t.d)}
        >
          {t.label}
        </motion.span>
      ))}
      <motion.p className="wt-welcome-hand" {...pop(reduce, 0.7, { y: 6 })}>
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

function ArtRedeem({ reduce }) {
  // Il selettore QR / Codice si scambia da solo, come farebbe il dito:
  // così si vede che sono due strade per la stessa cosa.
  const [tab, setTab] = useState('qr')
  useEffect(() => {
    if (reduce) return undefined
    const t = setInterval(() => setTab((v) => (v === 'qr' ? 'code' : 'qr')), 2400)
    return () => clearInterval(t)
  }, [reduce])
  const code = formatShortCode(DEMO_CODE)

  return (
    <div className="wt-art-redeem">
      <motion.div className="wt-pass" {...pop(reduce, 0.08, { y: 24 })}>
        <div className="wt-pass-head">
          <strong>Pizzeria del Borgo</strong>
          <span className="wt-badge is-small">{formatDiscountBadge(DEMO_DROP)}</span>
        </div>
        <div className="wt-seg" role="presentation">
          <motion.span
            className="wt-seg-thumb"
            initial={false}
            animate={{ x: tab === 'qr' ? '0%' : '100%' }}
            transition={SPRING_SNAP}
          />
          <button type="button" tabIndex={-1} className={tab === 'qr' ? 'is-on' : ''} onClick={() => setTab('qr')}>QR</button>
          <button type="button" tabIndex={-1} className={tab === 'code' ? 'is-on' : ''} onClick={() => setTab('code')}>Codice</button>
        </div>
        <div className="wt-pass-body">
          <AnimatePresence mode="wait" initial={false}>
            {tab === 'qr' ? (
              <motion.div
                key="qr"
                className="wt-pass-qr"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: DUR.menu, ease: EASE_OUT }}
              >
                <FakeQR />
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
          <strong>Osteria Sotto i Portici</strong>
          <span>Piemontese · €€</span>
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
              <span className="wt-chip">Cene con amici</span>
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
