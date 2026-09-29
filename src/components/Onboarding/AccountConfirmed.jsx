import { motion, useReducedMotion } from 'framer-motion'

/* ============================================================================
   La conferma che l'account è nato.

   Sta su tutto lo schermo e non è un messaggio verde in mezzo al modulo: è
   la fine della registrazione, e merita di essere detta chiaramente una
   volta sola invece di essere cercata fra le righe di un form.

   È la stessa schermata per tutte le strade con cui un account nasce: il
   codice della mail (LoginPage) e il ritorno da Google o dal link di
   conferma (AuthCallback). Prima Google aveva una spunta verde piccola e
   "Accesso effettuato!", e il tutorial arrivava dopo, sulla home.

   Dura un secondo, poi il suo cerchio corallo si allarga e diventa la prima
   schermata del tutorial di benvenuto (`data-signup-check` è il punto da
   cui parte, vedi `openWelcomeTour` in src/lib/welcomeTour.js): non c'è
   niente da leggere oltre due parole.

   Con "riduci animazioni" attivo resta tutto, ma fermo: chi ha chiesto meno
   movimento vuole meno movimento, non meno informazioni.
   ========================================================================= */
export default function AccountConfirmed({ name, line = 'Account confermato. Ti faccio vedere come funziona…' }) {
  const reduce = useReducedMotion()
  const primo = String(name || '').trim().split(/\s+/)[0]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.25 }}
      role="status"
      aria-live="assertive"
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'var(--color-bg, #FAF7F2)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 22,
        padding: 24, textAlign: 'center',
      }}
    >
      <motion.div
        // Da qui parte il cerchio del tutorial.
        data-signup-check=""
        initial={reduce ? false : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'var(--color-corallo, #E8453C)',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 10px 30px rgba(232,69,60,.32)',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 52 52" fill="none" aria-hidden="true">
          <motion.path
            d="M14 27.5 L22.5 36 L38 18"
            stroke="#fff"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: reduce ? 0 : 0.18, duration: reduce ? 0 : 0.35, ease: 'easeOut' }}
          />
        </svg>
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.3, duration: reduce ? 0 : 0.3 }}
      >
        <h2 style={{
          fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 28,
          letterSpacing: '-0.02em', color: 'var(--color-ink)', margin: '0 0 6px',
        }}>
          {primo ? `Ci sei, ${primo}.` : 'Ci sei.'}
        </h2>
        <p style={{ fontSize: 14.5, color: 'var(--color-ink-70)', margin: 0 }}>
          {line}
        </p>
      </motion.div>
    </motion.div>
  )
}
