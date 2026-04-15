import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

/* ------------------------------------------------------------------ */
/*  Token helper — hoisted per non violare react-hooks/purity         */
/* ------------------------------------------------------------------ */
function generateDeviceToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  const rand = Math.random().toString(36).slice(2)
  const time = Date.now().toString(36)
  return `dev-${rand}-${time}`
}

/* ------------------------------------------------------------------ */
/*  Cookie helpers                                                    */
/* ------------------------------------------------------------------ */
const COOKIE_NAME = 'verify_device_token'
const COOKIE_DAYS = 365

function setCookie(name, value, days) {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie =
    `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/verify;SameSite=Lax`
}
function getCookie(name) {
  const prefix = name + '='
  const parts = document.cookie.split(';')
  for (const p of parts) {
    const t = p.trim()
    if (t.startsWith(prefix)) return decodeURIComponent(t.slice(prefix.length))
  }
  return null
}
function deleteCookie(name) {
  document.cookie =
    `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/verify;SameSite=Lax`
}

/* ------------------------------------------------------------------ */
/*  PIN Input — 4 cifre, auto-focus, shake                            */
/* ------------------------------------------------------------------ */
function PinInput({ value, onChange, onComplete, disabled, shake, desktop }) {
  const inputsRef = useRef([])

  const handleChange = (i, c) => {
    if (!/^\d?$/.test(c)) return
    const next = value.split('')
    next[i] = c
    const joined = next.join('').slice(0, 4)
    onChange(joined)
    if (c && i < 3) inputsRef.current[i + 1]?.focus()
    if (i === 3 && c && joined.replace(/\s/g, '').length === 4) {
      onComplete?.(joined)
    }
  }
  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      inputsRef.current[i - 1]?.focus()
    }
  }
  const handlePaste = (e) => {
    e.preventDefault()
    const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    onChange(d)
    if (d.length === 4) {
      inputsRef.current[3]?.focus()
      onComplete?.(d)
    }
  }

  const box = desktop
    ? { w: 56, h: 64, fs: 26, radius: 14 }
    : { w: 52, h: 58, fs: 24, radius: 12 }

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        animation: shake ? 'verifyShake 0.4s' : 'none',
      }}
    >
      {[0, 1, 2, 3].map((i) => {
        const filled = Boolean(value[i])
        return (
          <input
            key={i}
            ref={(el) => (inputsRef.current[i] = el)}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={value[i] || ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            disabled={disabled}
            style={{
              width: box.w,
              height: box.h,
              textAlign: 'center',
              fontSize: box.fs,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: '#22181C',
              border: `2px solid ${filled ? '#22181C' : '#E8E5DE'}`,
              borderRadius: box.radius,
              background: filled ? '#fafafa' : '#fff',
              outline: 'none',
              transition: 'border-color 0.15s, background 0.15s',
              caretColor: '#E8453C',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#E8453C')}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = filled ? '#22181C' : '#E8E5DE')
            }
          />
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sezione istruzioni (mobile & desktop)                             */
/* ------------------------------------------------------------------ */
const INSTRUCTIONS = [
  { n: 1, title: 'Il PIN lo hai ricevuto da noi', body: 'quando ti abbiamo inserito nella Guida di Bi.' },
  { n: 2, title: 'Un cliente mostra il telefono?', body: 'Accedi e inserisci il codice che vedi sotto il suo QR.' },
  { n: 3, title: 'Dopo la verifica', body: 'lo sconto risulta usato e non può essere riutilizzato.' },
  { n: 4, title: 'Nella tab Dashboard', body: 'vedi le statistiche del tuo ristorante.' },
]

function InstructionsBlock({ desktop }) {
  return (
    <div style={{ padding: desktop ? '0 0 24px' : '0 20px 20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#D4AF37',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#22181C',
            letterSpacing: 0.2,
          }}
        >
          Istruzioni per il ristoratore
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {INSTRUCTIONS.map((s) => (
          <div key={s.n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                background: '#FAF7F2',
                color: '#E8453C',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {s.n}
            </span>
            <div
              style={{
                fontSize: desktop ? 12 : 11,
                color: '#8A8680',
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontWeight: 600, color: '#22181C' }}>{s.title}</span>
              {' — '}
              {s.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ContactBox({ desktop }) {
  return (
    <div
      style={{
        margin: desktop ? '0 0 12px' : '10px 20px 20px',
        background: '#FAF7F2',
        borderRadius: 8,
        padding: 12,
        fontSize: 11,
        color: '#8A8680',
        lineHeight: 1.5,
      }}
    >
      Non hai il PIN? Scrivici su{' '}
      <a
        href="https://instagram.com/chiamamibi"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#E8453C', fontWeight: 600, textDecoration: 'none' }}
      >
        @chiamamibi
      </a>{' '}
      o a{' '}
      <a
        href="mailto:info@chiamamibi.com"
        style={{ color: '#E8453C', fontWeight: 600, textDecoration: 'none' }}
      >
        info@chiamamibi.com
      </a>
      .
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Icone                                                             */
/* ------------------------------------------------------------------ */
function LockIcon({ size = 22, color = '#E8453C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="10" width="16" height="11" rx="2.5" stroke={color} strokeWidth="1.8" />
      <path
        d="M8 10V7a4 4 0 1 1 8 0v3"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15.5" r="1.5" fill={color} />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  VerifyPage                                                         */
/* ------------------------------------------------------------------ */
export default function VerifyPage() {
  // 'loading' → controllo cookie iniziale
  // 'pin'     → mostra schermata PIN
  // 'authed'  → autenticato, mostra header + tab (step 3+)
  const [status, setStatus] = useState('loading')
  const [restaurant, setRestaurant] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [shake, setShake] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  /* ---- Init: controlla cookie ---- */
  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!isSupabaseConfigured()) {
        setStatus('pin')
        return
      }
      const token = getCookie(COOKIE_NAME)
      if (!token) {
        setStatus('pin')
        return
      }
      try {
        const { data } = await supabase
          .from('verified_devices')
          .select('restaurant_id, restaurants:restaurants(id, name, slug)')
          .eq('device_token', token)
          .maybeSingle()
        if (cancelled) return
        if (data?.restaurants) {
          setRestaurant(data.restaurants)
          setStatus('authed')
          // Touch last_used_at in background
          supabase
            .from('verified_devices')
            .update({ last_used_at: new Date().toISOString() })
            .eq('device_token', token)
            .then(() => {}, () => {})
        } else {
          deleteCookie(COOKIE_NAME)
          setStatus('pin')
        }
      } catch {
        if (!cancelled) setStatus('pin')
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  /* ---- Submit PIN ---- */
  const handleSubmit = async (overridePin) => {
    const pinToUse = (overridePin ?? pin).trim()
    if (pinToUse.length !== 4 || submitting) return
    if (!isSupabaseConfigured()) {
      setError('Servizio non disponibile')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const { data: r, error: rErr } = await supabase
        .from('restaurants')
        .select('id, name, slug')
        .eq('verify_pin', pinToUse)
        .eq('is_published', true)
        .maybeSingle()

      if (rErr || !r) {
        triggerError('PIN non valido. Riprova o contattaci.')
        return
      }

      const token = generateDeviceToken()

      const { error: iErr } = await supabase.from('verified_devices').insert({
        device_token: token,
        restaurant_id: r.id,
        user_agent: (navigator.userAgent || '').slice(0, 500),
      })

      if (iErr) {
        console.error('verified_devices insert failed', iErr)
        triggerError("Errore durante l'accesso. Riprova.")
        return
      }

      setCookie(COOKIE_NAME, token, COOKIE_DAYS)
      setRestaurant(r)
      setPin('')
      setStatus('authed')
      setSubmitting(false)
    } catch (e) {
      console.error(e)
      triggerError('Errore di connessione. Riprova.')
    }
  }

  const triggerError = (msg) => {
    setError(msg)
    setShake(true)
    setPin('')
    setSubmitting(false)
    setTimeout(() => setShake(false), 400)
  }

  /* ---- Logout ---- */
  const handleLogout = () => {
    const token = getCookie(COOKIE_NAME)
    deleteCookie(COOKIE_NAME)
    if (token && isSupabaseConfigured()) {
      supabase
        .from('verified_devices')
        .delete()
        .eq('device_token', token)
        .then(() => {}, () => {})
    }
    setRestaurant(null)
    setPin('')
    setError(null)
    setStatus('pin')
  }

  /* ---- Render ---- */
  let body
  if (status === 'loading') {
    body = (
      <div
        style={{
          minHeight: '100dvh',
          background: '#FAF7F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '3px solid #E8E5DE',
            borderTopColor: '#E8453C',
            animation: 'verifySpin 0.8s linear infinite',
          }}
        />
      </div>
    )
  } else if (status === 'pin') {
    body = (
      <PinView
        pin={pin}
        setPin={setPin}
        error={error}
        shake={shake}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    )
  } else {
    // status === 'authed' — placeholder per step 2, rimpiazzato in step 3
    body = <AuthedPlaceholder restaurant={restaurant} onLogout={handleLogout} />
  }

  return (
    <>
      <style>{`
        @keyframes verifySpin { to { transform: rotate(360deg); } }
        @keyframes verifyShake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
      {body}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  PIN View (mobile + desktop responsive)                            */
/* ------------------------------------------------------------------ */
function PinView({ pin, setPin, error, shake, submitting, onSubmit }) {
  return (
    <>
      {/* ---- MOBILE (< 768px) ---- */}
      <div className="md:hidden" style={{ minHeight: '100dvh', background: '#FAF7F2' }}>
        {/* Header scuro */}
        <div
          style={{
            background: '#22181C',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(232,69,60,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <LockIcon size={22} color="#E8453C" />
          </div>
          <h1
            style={{
              fontFamily: "'TAN Songbird', 'DM Sans', serif",
              fontSize: 20,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 4,
            }}
          >
            Area Ristoratori
          </h1>
          <p
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            Inserisci il PIN del tuo ristorante
          </p>
        </div>

        {/* PIN + submit */}
        <div style={{ padding: '24px 20px' }}>
          <PinInput
            value={pin}
            onChange={setPin}
            onComplete={(v) => onSubmit(v)}
            disabled={submitting}
            shake={shake}
            desktop={false}
          />

          <button
            onClick={() => onSubmit()}
            disabled={pin.length !== 4 || submitting}
            style={{
              width: '100%',
              marginTop: 16,
              background: '#E8453C',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '14px',
              fontSize: 14,
              fontWeight: 600,
              cursor: pin.length === 4 && !submitting ? 'pointer' : 'default',
              opacity: pin.length === 4 && !submitting ? 1 : 0.5,
              transition: 'opacity 0.15s',
            }}
          >
            {submitting ? 'Verifica…' : 'Accedi'}
          </button>

          {error && (
            <p
              style={{
                marginTop: 10,
                fontSize: 11,
                color: '#E8453C',
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              {error}
            </p>
          )}

          <p
            style={{
              marginTop: 12,
              fontSize: 10,
              color: '#B5B0AA',
              textAlign: 'center',
            }}
          >
            Il dispositivo verrà ricordato — non dovrai reinserire il PIN
          </p>
        </div>

        <InstructionsBlock desktop={false} />
        <ContactBox desktop={false} />

        {/* Footer */}
        <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
          <Link
            to="/"
            style={{
              fontSize: 11,
              color: '#8A8680',
              textDecoration: 'none',
            }}
          >
            ← Torna alla guida
          </Link>
        </div>
      </div>

      {/* ---- DESKTOP (≥ 768px) ---- */}
      <div
        className="hidden md:flex desktop-nav-offset"
        style={{
          minHeight: '100dvh',
          background: '#FAF7F2',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '56px 24px 48px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            background: '#fff',
            borderRadius: 20,
            border: '1px solid #E8E5DE',
            padding: '36px 32px 28px',
            boxShadow: '0 2px 20px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: 'rgba(232,69,60,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <LockIcon size={24} color="#E8453C" />
            </div>
            <h1
              style={{
                fontFamily: "'TAN Songbird', 'DM Sans', serif",
                fontSize: 24,
                fontWeight: 700,
                color: '#22181C',
                marginBottom: 6,
              }}
            >
              Area Ristoratori
            </h1>
            <p style={{ fontSize: 13, color: '#8A8680' }}>
              Inserisci il PIN del tuo ristorante
            </p>
          </div>

          <PinInput
            value={pin}
            onChange={setPin}
            onComplete={(v) => onSubmit(v)}
            disabled={submitting}
            shake={shake}
            desktop
          />

          <button
            onClick={() => onSubmit()}
            disabled={pin.length !== 4 || submitting}
            style={{
              width: '100%',
              marginTop: 20,
              background: '#E8453C',
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              padding: '16px',
              fontSize: 15,
              fontWeight: 600,
              cursor: pin.length === 4 && !submitting ? 'pointer' : 'default',
              opacity: pin.length === 4 && !submitting ? 1 : 0.5,
              transition: 'opacity 0.15s',
            }}
          >
            {submitting ? 'Verifica…' : 'Accedi'}
          </button>

          {error && (
            <p
              style={{
                marginTop: 12,
                fontSize: 12,
                color: '#E8453C',
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              {error}
            </p>
          )}

          <p
            style={{
              marginTop: 14,
              fontSize: 11,
              color: '#B5B0AA',
              textAlign: 'center',
            }}
          >
            Il dispositivo verrà ricordato — non dovrai reinserire il PIN
          </p>
        </div>

        <div style={{ width: '100%', maxWidth: 440, marginTop: 32 }}>
          <InstructionsBlock desktop />
          <ContactBox desktop />
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Placeholder autenticato (sostituito dallo Step 3)                 */
/* ------------------------------------------------------------------ */
function AuthedPlaceholder({ restaurant, onLogout }) {
  return (
    <div
      className="desktop-nav-offset"
      style={{
        minHeight: '100dvh',
        background: '#FAF7F2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'rgba(74,222,128,0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12l5 5L20 7"
            stroke="#22C55E"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1
        style={{
          fontFamily: "'TAN Songbird', 'DM Sans', serif",
          fontSize: 22,
          fontWeight: 700,
          color: '#22181C',
          marginBottom: 6,
        }}
      >
        Accesso effettuato
      </h1>
      <p style={{ fontSize: 13, color: '#8A8680', marginBottom: 4 }}>
        Ristorante: <strong style={{ color: '#22181C' }}>{restaurant?.name}</strong>
      </p>
      <p style={{ fontSize: 11, color: '#B5B0AA', maxWidth: 320, lineHeight: 1.5, marginBottom: 24 }}>
        Area riservata in allestimento: nei prossimi rilasci troverai qui la verifica QR e la
        dashboard statistiche.
      </p>
      <button
        onClick={onLogout}
        style={{
          background: '#22181C',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          padding: '12px 28px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Esci
      </button>
    </div>
  )
}
