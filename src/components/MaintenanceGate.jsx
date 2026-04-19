import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'

const BYPASS_PATHS = [
  '/admin',
  '/login',
  '/auth/callback',
  '/reset-password',
  '/privacy',
  '/terms',
  '/verify',
]

export default function MaintenanceGate({ children }) {
  const { isAdmin, loading } = useAuth()
  const location = useLocation()
  const maintenanceOn = import.meta.env.VITE_MAINTENANCE_MODE === 'true'
  const pathBypassed = BYPASS_PATHS.some((p) => location.pathname.startsWith(p))

  useEffect(() => {
    if (!maintenanceOn || isAdmin || pathBypassed) return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => { document.head.removeChild(meta) }
  }, [maintenanceOn, isAdmin, pathBypassed])

  if (!maintenanceOn) return children
  if (loading) return null
  if (isAdmin || pathBypassed) return children

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FFF8F6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        textAlign: 'center',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          background: '#E8604C',
          color: '#ffffff',
          padding: '20px 36px',
          borderRadius: '999px',
          fontFamily: 'Georgia, serif',
          fontSize: '22px',
          fontWeight: 800,
          letterSpacing: '3px',
          textTransform: 'uppercase',
          marginBottom: '40px',
        }}
      >
        Chiamami Bi
      </div>

      <h1
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(28px, 5vw, 44px)',
          fontWeight: 700,
          color: '#1a1a1a',
          margin: '0 0 16px',
          lineHeight: 1.2,
          maxWidth: 560,
        }}
      >
        Stiamo rifacendo il sito con amore.
      </h1>

      <p
        style={{
          fontSize: 'clamp(15px, 2.2vw, 17px)',
          color: '#4a4a4a',
          lineHeight: 1.6,
          maxWidth: 480,
          margin: '0 0 28px',
        }}
      >
        Torniamo presto con qualcosa di molto più bello.
      </p>

      <p
        style={{
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          fontSize: '16px',
          color: '#E8604C',
          margin: 0,
        }}
      >
        — Bi
      </p>

      <div
        style={{
          marginTop: '48px',
          paddingTop: '24px',
          borderTop: '1px solid #f0e6e3',
          fontSize: '12px',
          color: '#999',
        }}
      >
        <a href="/privacy" style={{ color: '#E8604C', textDecoration: 'none' }}>Privacy</a>
        &nbsp;·&nbsp;
        <a href="/terms" style={{ color: '#E8604C', textDecoration: 'none' }}>Termini</a>
      </div>
    </div>
  )
}
