/**
 * Card per una sezione numerata di Privacy/Termini. Il numero riprende la
 * numerazione del testo legale (serve a chi cita "il punto 5" via email) ma
 * lo rende un badge invece che una cifra persa nel paragrafo.
 */
export default function LegalSection({ n, title, children }) {
  return (
    <section
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-line)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '20px 22px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--color-corallo-wash)',
            color: 'var(--color-corallo-ink)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          {n}
        </span>
        <h2
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 17,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>
      <div style={{ color: 'var(--color-ink-70)', fontSize: 14.5, lineHeight: 1.6 }} className="space-y-3">
        {children}
      </div>
    </section>
  )
}
