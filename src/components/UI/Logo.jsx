/**
 * La Guida di Bi — logo components
 * - LogoFull: text logo for navbar/headers ("La Guida" in accent, "di Bi" in dark)
 * - LogoSmall: compact version for tight spaces
 * - LogoLoader: Animated BI icon for loading states
 */

export function LogoFull({ height = 24, className = '' }) {
  const fontSize = height * 0.85
  return (
    <div className={`flex flex-col leading-none ${className}`}>
      <span
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontWeight: 700,
          fontSize,
          letterSpacing: '-0.02em',
        }}
      >
        <span style={{ color: '#FF5757' }}>La Guida</span>
        <span style={{ color: '#1a1a1a' }}> di Bi</span>
      </span>
      <span
        style={{
          fontSize: Math.max(8, fontSize * 0.4),
          color: '#bbb',
          fontWeight: 400,
          letterSpacing: '0.02em',
          marginTop: 1,
        }}
      >
        by ChiamamiBi
      </span>
    </div>
  )
}

export function LogoSmall({ size = 20, className = '' }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontWeight: 700,
        fontSize: size,
        letterSpacing: '-0.02em',
      }}
    >
      <span style={{ color: '#FF5757' }}>La Guida</span>
      <span style={{ color: '#1a1a1a' }}> di Bi</span>
    </span>
  )
}

export function LogoLoader({ size = 48, className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src="/logo-bi.svg"
        alt="Caricamento..."
        width={size}
        height={size}
        className="guida-logo-loader"
        style={{ width: size, height: size }}
        draggable={false}
      />
      <style>{`
        .guida-logo-loader {
          animation: guida-pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes guida-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.92); }
        }
      `}</style>
    </div>
  )
}

export default LogoFull
