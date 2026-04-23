import { Link } from 'react-router-dom'

/**
 * MapCta · card verde gradient con pin + count + arrow corallo.
 * Link a /esplora?moment={activeMoment}.
 */
export default function MapCta({ activeMoment, count }) {
  const label = activeMoment
    ? `${count} locali aperti per ${activeMoment} ora`
    : `${count} locali in guida · esplora sulla mappa`
  return (
    <div className="hfv4-mapcta-wrap" style={{ padding: '8px 16px 26px' }}>
      <Link
        to={`/esplora${activeMoment ? `?moment=${activeMoment}` : ''}`}
        className="hfv4-mapcta"
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: '56px 1fr auto',
          gap: 12,
          alignItems: 'center',
          background: 'linear-gradient(135deg,#2C5E4A 0%,#173D30 100%)',
          color: '#fff',
          borderRadius: 20,
          padding: '14px 16px',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)',
          textDecoration: 'none',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(200px 80px at 80% 30%,rgba(255,255,255,.08),transparent 60%),'
              + 'repeating-linear-gradient(45deg,rgba(255,255,255,.03) 0 2px,transparent 2px 8px)',
            pointerEvents: 'none',
          }}
        />
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'rgba(255,255,255,.12)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 22,
            position: 'relative',
            zIndex: 1,
          }}
        >
          📍
        </span>
        <span style={{ position: 'relative', zIndex: 1 }}>
          <span
            style={{
              display: 'block',
              fontFamily: 'var(--font-sans)',
              fontWeight: 800,
              fontSize: 14,
              lineHeight: 1.2,
              marginBottom: 3,
            }}
          >
            Mostrameli sulla mappa
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
            {label}
          </span>
        </span>
        <span
          style={{
            position: 'relative',
            zIndex: 1,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--color-corallo)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 16,
            fontWeight: 800,
          }}
        >
          →
        </span>
      </Link>
    </div>
  )
}
