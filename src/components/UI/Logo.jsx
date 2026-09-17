import BiLogoMark from './BiLogoMark'

/**
 * ChiamamiBi logo components
 * - LogoFull: wordmark "LA GUIDA DI BI" + "by Chiamami Bi" — lo stesso
 *   marchio testuale (Alfa Slab One, corallo) che il sito mostra in
 *   Navbar.jsx, Footer.jsx e MobileLogoHeader.jsx. Prima era un'immagine SVG
 *   con un carattere e un rosso diversi da quelli del sito live.
 * - LogoLoader: Animated BI for loading states
 */

export function LogoFull({ height = 24, className = '', subtitle = true }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 0.92 }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
          fontSize: height,
          letterSpacing: '0.02em',
          color: 'var(--color-corallo)',
        }}
      >
        LA GUIDA DI BI
      </span>
      {subtitle && (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: Math.round(height * 0.44),
            letterSpacing: '0.15em',
            color: 'rgba(34,24,28,.4)',
            marginTop: Math.max(2, Math.round(height * 0.15)),
            textTransform: 'uppercase',
          }}
        >
          by Chiamami Bi
        </span>
      )}
    </span>
  )
}

export function LogoLoader({ size = 56, className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className="chiamami-logo-loader"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #E8453C 0%, #C6372F 100%)',
          boxShadow: '0 6px 16px rgba(232,69,60,.35)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <BiLogoMark style={{ width: '80%', height: '80%', color: '#fff' }} />
      </div>
      <style>{`
        .chiamami-logo-loader {
          animation: chiamami-pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes chiamami-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.92); }
        }
      `}</style>
    </div>
  )
}

export default LogoFull
