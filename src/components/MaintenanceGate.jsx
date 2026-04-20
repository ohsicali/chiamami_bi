import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'

const BYPASS_PATHS = [
  '/admin',
  '/auth/callback',
  '/reset-password',
  '/privacy',
  '/terms',
  '/verify',
]

export default function MaintenanceGate({ children }) {
  const { user, isAdmin, loading, signIn, signOut } = useAuth()
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

  return <GateLogin user={user} signIn={signIn} signOut={signOut} />
}

function GateLogin({ user, signIn, signOut }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(email, password)
      // After successful signIn, useAuth will re-evaluate and MaintenanceGate
      // will re-render; if admin, bypass. If not admin, fallthrough.
    } catch (err) {
      setError(err.message || 'Credenziali non valide')
    } finally {
      setSubmitting(false)
    }
  }

  const loggedInNotAdmin = !!user

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FFF8F6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#ffffff',
          borderRadius: 20,
          padding: '36px 32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-block',
              background: '#E8604C',
              color: '#ffffff',
              padding: '10px 22px',
              borderRadius: 999,
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Chiamami Bi
          </div>
        </div>

        {loggedInNotAdmin ? (
          <>
            <p style={{ textAlign: 'center', color: '#4a4a4a', fontSize: 15, lineHeight: 1.5, marginBottom: 20 }}>
              Account senza accesso.<br />Prova con un altro account.
            </p>
            <button
              onClick={signOut}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e5e5',
                borderRadius: 12,
                background: '#ffffff',
                color: '#4a4a4a',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Esci
            </button>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#22181C', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />

            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#22181C', marginBottom: 6, marginTop: 16 }}>
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                marginTop: 24,
                padding: '13px',
                background: '#E8604C',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Accesso in corso…' : 'Accedi'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #e5e5e5',
  borderRadius: 10,
  fontSize: 14,
  color: '#22181C',
  background: '#ffffff',
  boxSizing: 'border-box',
  outline: 'none',
}
