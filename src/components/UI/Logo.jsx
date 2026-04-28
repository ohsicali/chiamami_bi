import BiLogoMark from './BiLogoMark'

/**
 * ChiamamiBi logo components — uses the real brand SVGs
 * - LogoFull: "CHIAMAMI BI" wordmark for navbar/headers
 * - LogoLoader: Animated BI for loading states
 */

export function LogoFull({ height = 24, className = '' }) {
  return (
    <img
      src="/logo-full.svg"
      alt="Chiamami Bi"
      height={height}
      className={className}
      style={{ height, width: 'auto' }}
      draggable={false}
    />
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
