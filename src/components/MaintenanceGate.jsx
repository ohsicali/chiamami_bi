import { useEffect, useRef, useState } from 'react'
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

const MAINTENANCE_PIN = '4321'
const PIN_STORAGE_KEY = 'cb_maintenance_unlocked'

export default function MaintenanceGate({ children }) {
  const { isAdmin, loading } = useAuth()
  const location = useLocation()
  const maintenanceOn = import.meta.env.VITE_MAINTENANCE_MODE === 'true'
  const pathBypassed = BYPASS_PATHS.some((p) => location.pathname.startsWith(p))

  const [pinUnlocked, setPinUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(PIN_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

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
  if (isAdmin || pathBypassed || pinUnlocked) return children

  return <PinGate onUnlock={() => {
    try { sessionStorage.setItem(PIN_STORAGE_KEY, '1') } catch { /* noop */ }
    setPinUnlocked(true)
  }} />
}

function PinGate({ onUnlock }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const inputsRef = useRef([])

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const submitPin = (value) => {
    if (value === MAINTENANCE_PIN) {
      onUnlock()
    } else {
      setError('PIN errato')
      setDigits(['', '', '', ''])
      setTimeout(() => inputsRef.current[0]?.focus(), 0)
    }
  }

  const handleChange = (idx, raw) => {
    const v = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = v
    setDigits(next)
    setError('')
    if (v && idx < 3) {
      inputsRef.current[idx + 1]?.focus()
    }
    if (next.every((d) => d !== '')) {
      submitPin(next.join(''))
    }
  }

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (!pasted) return
    e.preventDefault()
    const next = ['', '', '', '']
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)
    setError('')
    const lastIdx = Math.min(pasted.length, 4) - 1
    inputsRef.current[lastIdx]?.focus()
    if (pasted.length === 4) submitPin(pasted)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FFF8F6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans)',
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
              background: 'var(--color-cta)',
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

        <p style={{ textAlign: 'center', color: '#4a4a4a', fontSize: 15, lineHeight: 1.5, marginBottom: 20 }}>
          Sito in manutenzione.<br />Inserisci il PIN per continuare.
        </p>

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
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            marginTop: 8,
          }}
          onPaste={handlePaste}
        >
          {digits.map((d, idx) => (
            <input
              key={idx}
              ref={(el) => (inputsRef.current[idx] = el)}
              type="tel"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              style={{
                width: 56,
                height: 64,
                textAlign: 'center',
                fontSize: 28,
                fontWeight: 600,
                color: '#22181C',
                border: '1px solid #e5e5e5',
                borderRadius: 12,
                background: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
