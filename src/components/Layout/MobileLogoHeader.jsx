import { Link } from 'react-router-dom'
import BiLogoMark from '../UI/BiLogoMark'

/**
 * Sticky logo bar per le pagine mobile (Sconti, Salvati, Profilo, ecc).
 * Wordmark "LA GUIDA DI BI" a sx + pill "Chiedi a Bi" a dx.
 * NON include la chip Torino: quella sta solo su Esplora (Navbar).
 */
export default function MobileLogoHeader() {
  return (
    <div
      className="md:hidden"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 20px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(250, 247, 242, 0.94)',
        backdropFilter: 'saturate(180%) blur(12px)',
        WebkitBackdropFilter: 'saturate(180%) blur(12px)',
        borderBottom: '1px solid rgba(34,24,28,0.05)',
      }}
    >
      <Link
        to="/"
        style={{
          display: 'flex',
          flexDirection: 'column',
          lineHeight: 0.92,
          textDecoration: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
            fontSize: 18,
            letterSpacing: '0.02em',
            color: 'var(--color-corallo)',
          }}
        >
          LA GUIDA DI BI
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 8,
            letterSpacing: '0.15em',
            color: 'rgba(34,24,28,.4)',
            marginTop: 3,
            textTransform: 'uppercase',
          }}
        >
          by Chiamami Bi
        </span>
      </Link>

      <Link
        to="/chiedi"
        aria-label="Chiedi a Bi"
        style={{
          marginLeft: 'auto',
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 16px 5px 5px',
          borderRadius: 999,
          background: 'linear-gradient(135deg, var(--color-corallo) 0%, var(--color-corallo-ink, #C6372F) 100%)',
          color: '#fff',
          textDecoration: 'none',
          boxShadow: '0 6px 14px rgba(232,69,60,.35)',
          border: '2px solid #fff',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'relative',
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#fff',
            color: 'var(--color-corallo, #E8453C)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            overflow: 'visible',
          }}
        >
          <BiLogoMark style={{ width: '88%', height: '88%' }} />
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -9,
              right: -9,
              width: 14,
              height: 14,
              background: 'var(--color-oro, #B08954)',
              borderRadius: '50%',
              border: '2px solid #fff',
              boxShadow: '0 1px 3px rgba(0,0,0,.18)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 7,
              color: '#fff',
              fontWeight: 700,
              lineHeight: 1,
              zIndex: 2,
            }}
          >
            ✦
          </span>
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 800,
            fontSize: 13.5,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          Chiedi a Bi
        </span>
      </Link>
    </div>
  )
}
