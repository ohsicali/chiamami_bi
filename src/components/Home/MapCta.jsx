import { Link } from 'react-router-dom'

/**
 * MapCta · card con anteprima mappa Mapbox Static + overlay ink + CTA corallo.
 * Link a /esplora?moment={activeMoment}.
 *
 * La preview usa Mapbox Static Images API (chiave client-side già esposta in
 * env var VITE_MAPBOX_TOKEN). Se la chiave manca, fallback a gradient verde.
 */
const TORINO_CENTER = [7.6869, 45.0703] // lng, lat — Piazza Castello
const MAPBOX_STYLE = 'mapbox/streets-v12'

export default function MapCta({ activeMoment, count }) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN

  const label = activeMoment
    ? `${count} locali aperti per ${activeMoment} ora`
    : `${count} locali in guida · esplora sulla mappa`

  const [lng, lat] = TORINO_CENTER
  const staticUrl = token
    ? `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/static/pin-s-restaurant+EE5C55(${lng},${lat})/${lng},${lat},13,0/800x400@2x?access_token=${token}&logo=false&attribution=false`
    : null

  const background = staticUrl
    ? `linear-gradient(180deg, rgba(34,24,28,.1) 0%, rgba(34,24,28,.55) 100%), url(${staticUrl}) center/cover`
    : 'linear-gradient(135deg,#2C5E4A 0%,#173D30 100%)'

  return (
    <div className="hfv4-mapcta-wrap" style={{ padding: '8px 16px 26px' }}>
      <Link
        to={`/esplora${activeMoment ? `?moment=${activeMoment}` : ''}`}
        className="hfv4-mapcta"
        style={{
          position: 'relative',
          display: 'block',
          background,
          color: '#fff',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)',
          textDecoration: 'none',
          minHeight: 160,
        }}
      >
        {/* Overlay subtle grid pattern quando c'è la mappa (aggiunge profondità) */}
        {!staticUrl && (
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
        )}

        {/* Content row in fondo alla card */}
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 14,
            display: 'grid',
            gridTemplateColumns: '56px 1fr auto',
            gap: 12,
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          <span
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'rgba(255,255,255,.18)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              border: '1px solid rgba(255,255,255,.25)',
            }}
          >
            📍
          </span>
          <span>
            <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 15, lineHeight: 1.2, marginBottom: 3, textShadow: '0 1px 3px rgba(0,0,0,.3)' }}>
              Mostrameli sulla mappa
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.9)', textShadow: '0 1px 3px rgba(0,0,0,.3)' }}>
              {label}
            </span>
          </span>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--color-corallo)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 18,
              fontWeight: 800,
              boxShadow: '0 4px 14px rgba(232,92,85,.5)',
            }}
          >
            →
          </span>
        </div>
      </Link>
    </div>
  )
}
