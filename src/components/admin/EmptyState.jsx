import { Link } from 'react-router-dom'

/**
 * EmptyState — centered empty-list placeholder.
 * Used on the Ristoranti list / Sconti / Candidature pages (PR15b/PR15d).
 *
 * Props:
 *   icon      → emoji or small React node displayed in a cream disc
 *   title     → big heading
 *   subtitle  → small muted paragraph
 *   cta       → { label, to } → internal navigation link
 *              | { label, onClick } → inline callback
 */
export default function EmptyState({ icon, title, subtitle, cta }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--color-line, #EAE3D7)',
        borderRadius: 18,
        padding: '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {icon && (
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'var(--color-cream, #F5F0E4)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 28,
          }}
          aria-hidden
        >
          {icon}
        </div>
      )}
      {title && (
        <h3
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: '-0.01em',
            color: 'var(--color-ink, #22181C)',
            margin: 0,
          }}
        >
          {title}
        </h3>
      )}
      {subtitle && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
            fontWeight: 500,
            margin: 0,
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}
      {cta && renderCta(cta)}
    </div>
  )
}

function renderCta(cta) {
  const baseStyle = {
    background: 'var(--color-corallo, #E8453C)',
    color: '#fff',
    border: 0,
    padding: '10px 18px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
    fontFamily: 'var(--font-sans)',
  }
  if (cta.to) {
    return (
      <Link to={cta.to} style={baseStyle}>
        {cta.label}
      </Link>
    )
  }
  return (
    <button type="button" onClick={cta.onClick} style={baseStyle}>
      {cta.label}
    </button>
  )
}
