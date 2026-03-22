/**
 * ChiamamiBi logo components
 * - LogoFull: "CHIAMAMI BI" wordmark for navbar/headers
 * - LogoIcon: "BI" mark for favicon/loading
 * - LogoLoader: Animated BI for loading states
 */

const BRAND_COLOR = '#F06B5D'

export function LogoFull({ height = 24, className = '' }) {
  return (
    <svg
      viewBox="0 0 280 40"
      height={height}
      className={className}
      aria-label="Chiamami Bi"
      role="img"
    >
      <text
        x="0"
        y="34"
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        fontWeight="900"
        fontSize="36"
        fill={BRAND_COLOR}
        letterSpacing="-0.5"
      >
        CHIAMAMI BI
      </text>
    </svg>
  )
}

export function LogoIcon({ size = 40, className = '' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-label="Bi"
      role="img"
    >
      <text
        x="32"
        y="50"
        textAnchor="middle"
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        fontWeight="900"
        fontSize="48"
        fill={BRAND_COLOR}
        letterSpacing="-2"
      >
        BI
      </text>
    </svg>
  )
}

export function LogoLoader({ size = 48, className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        aria-label="Caricamento..."
        role="img"
        className="chiamami-logo-loader"
      >
        <text
          x="32"
          y="50"
          textAnchor="middle"
          fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
          fontWeight="900"
          fontSize="48"
          fill={BRAND_COLOR}
          letterSpacing="-2"
        >
          BI
        </text>
      </svg>
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
