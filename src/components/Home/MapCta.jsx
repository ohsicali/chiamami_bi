import { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * MapCta · card con anteprima mappa Mapbox Static + overlay ink + CTA corallo.
 * Link a /esplora?moment={activeMoment}.
 *
 * Rendering strategy:
 * - SEMPRE il gradient verde come background base (fallback visibile).
 * - Sopra, un <img> Mapbox Static absolute-positioned con onError handler:
 *   se il token manca o l'URL fallisce, l'img si nasconde e vediamo il gradient.
 * - Overlay ink gradient al 55% sopra tutto per leggibilità del testo.
 */
const TORINO_CENTER = [45.0703, 7.6869] // lat, lng — Piazza Castello

// OpenStreetMap static map — gratuito, nessun token richiesto
function buildOsmUrl() {
  const [lat, lng] = TORINO_CENTER
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=13&size=800x400&markers=${lat},${lng},red-pushpin`
}

export default function MapCta({ activeMoment, count }) {
  const [imgOk, setImgOk] = useState(true)

  const label = activeMoment
    ? `${count} locali aperti per ${activeMoment} ora`
    : `${count} locali in guida · esplora sulla mappa`

  const staticUrl = buildOsmUrl()

  return (
    <div className="hfv4-mapcta-wrap" style={{ padding: '8px 16px 26px' }}>
      <Link
        to={`/esplora${activeMoment ? `?moment=${activeMoment}` : ''}`}
        className="hfv4-mapcta"
        style={{
          position: 'relative',
          display: 'block',
          background: 'linear-gradient(135deg,#2C5E4A 0%,#173D30 100%)',
          color: '#fff',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)',
          textDecoration: 'none',
          minHeight: 160,
          height: 160,
        }}
      >
        {/* Layer 1: OSM static map (fallback su verde se non carica) */}
        {imgOk && (
          <img
            src={staticUrl}
            alt=""
            onError={() => setImgOk(false)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}

        {/* Layer 2: pattern grid (fallback se img non carica) */}
        {!imgOk && (
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

        {/* Layer 3: overlay ink sopra la mappa per leggibilità */}
        {imgOk && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(34,24,28,.1) 0%, rgba(34,24,28,.55) 100%)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Layer 4: content row in fondo */}
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
            zIndex: 2,
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
            <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 15, lineHeight: 1.2, marginBottom: 3, textShadow: '0 1px 3px rgba(0,0,0,.35)' }}>
              Mostrameli sulla mappa
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.92)', textShadow: '0 1px 3px rgba(0,0,0,.35)' }}>
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
