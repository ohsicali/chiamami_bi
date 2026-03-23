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

export function LogoLoader({ size = 48, className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src="/logo-bi.svg"
        alt="Caricamento..."
        width={size}
        height={size}
        className="chiamami-logo-loader"
        style={{ width: size, height: size }}
        draggable={false}
      />
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
