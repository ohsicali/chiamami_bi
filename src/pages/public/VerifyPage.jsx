import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { LogoFull } from '../../components/UI/Logo'

const RESTAURANT_COLS = 'id, name, slug, address, city, category, cuisine_type, restaurant_photos(photo_url, thumb_url, sort_order)'

function normalizeRestaurant(r) {
  if (!r) return null
  const photos = Array.isArray(r.restaurant_photos)
    ? [...r.restaurant_photos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : []
  const { restaurant_photos: _photos, ...rest } = r
  return { ...rest, photos }
}

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
/*  PIN Input — 6 cifre, auto-focus, shake                            */
/* ------------------------------------------------------------------ */
const PIN_LENGTH = 6

function PinInput({ value, onChange, onComplete, disabled, shake, desktop }) {
  const inputsRef = useRef([])

  const handleChange = (i, c) => {
    if (!/^\d?$/.test(c)) return
    const next = value.split('')
    next[i] = c
    const joined = next.join('').slice(0, PIN_LENGTH)
    onChange(joined)
    if (c && i < PIN_LENGTH - 1) inputsRef.current[i + 1]?.focus()
    if (i === PIN_LENGTH - 1 && c && joined.replace(/\s/g, '').length === PIN_LENGTH) {
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
    const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    onChange(d)
    if (d.length === PIN_LENGTH) {
      inputsRef.current[PIN_LENGTH - 1]?.focus()
      onComplete?.(d)
    }
  }

  const box = desktop
    ? { w: 48, h: 60, fs: 24, radius: 12, gap: 8 }
    : { w: 42, h: 54, fs: 22, radius: 10, gap: 6 }

  return (
    <div
      style={{
        display: 'flex',
        gap: box.gap,
        justifyContent: 'center',
        animation: shake ? 'verifyShake 0.4s' : 'none',
      }}
    >
      {Array.from({ length: PIN_LENGTH }, (_, i) => i).map((i) => {
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
          .select(`restaurant_id, restaurants:restaurants(${RESTAURANT_COLS})`)
          .eq('device_token', token)
          .maybeSingle()
        if (cancelled) return
        if (data?.restaurants) {
          setRestaurant(normalizeRestaurant(data.restaurants))
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
    if (pinToUse.length !== PIN_LENGTH || submitting) return
    if (!isSupabaseConfigured()) {
      setError('Servizio non disponibile')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      // 1) Match su restaurants.verify_pin (fonte primaria)
      let r = null
      const primary = await supabase
        .from('restaurants')
        .select(RESTAURANT_COLS)
        .eq('verify_pin', pinToUse)
        .eq('is_published', true)
        .limit(1)
      if (!primary.error && primary.data?.length) {
        r = primary.data[0]
      }

      // 2) Fallback: PIN storico in restaurant_partners.pin_code
      if (!r) {
        const { data: partners } = await supabase
          .from('restaurant_partners')
          .select(`restaurant_id, restaurants:restaurants(${RESTAURANT_COLS})`)
          .eq('pin_code', pinToUse)
          .eq('is_active', true)
          .limit(1)
        if (partners?.[0]?.restaurants?.is_published !== false && partners?.[0]?.restaurants) {
          r = partners[0].restaurants
        }
      }

      if (!r) {
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
      setRestaurant(normalizeRestaurant(r))
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
    body = (
      <AuthedView
        restaurant={restaurant}
        onLogout={handleLogout}
        deviceToken={getCookie(COOKIE_NAME)}
        onSessionExpired={handleLogout}
      />
    )
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
        @keyframes verifyFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes verifyPop {
          0% { transform: scale(0.6); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); }
        }
        .verify-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }
        @media (min-width: 768px) {
          .verify-stat-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
            margin-bottom: 20px;
          }
        }
        .verify-dashboard-main {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 900px) {
          .verify-dashboard-main {
            grid-template-columns: 1.1fr 1fr;
            gap: 20px;
            align-items: start;
          }
        }
        .verify-dashboard-col {
          display: flex;
          flex-direction: column;
          gap: 16px;
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
            disabled={pin.length !== PIN_LENGTH || submitting}
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
            disabled={pin.length !== PIN_LENGTH || submitting}
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
/*  AuthedView — header ristorante + tab bar + corpo tab              */
/* ------------------------------------------------------------------ */
function AuthedView({ restaurant, onLogout, deviceToken, onSessionExpired }) {
  const [tab, setTab] = useState('verify')

  return (
    <div style={{ minHeight: '100dvh', background: '#FAF7F2' }}>
      <RestaurantHeader restaurant={restaurant} onLogout={onLogout} />
      <TabBar tab={tab} onChange={setTab} />
      <div style={{ padding: 0 }}>
        {tab === 'verify' ? (
          <VerifyTab restaurant={restaurant} />
        ) : (
          <DashboardTab
            restaurant={restaurant}
            deviceToken={deviceToken}
            onSessionExpired={onSessionExpired}
          />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Header ristorante (barra scura, mobile + desktop)                 */
/* ------------------------------------------------------------------ */
function RestaurantHeader({ restaurant, onLogout }) {
  const firstPhoto = restaurant?.photos?.[0]
  const photoUrl = firstPhoto
    ? proxyImg(firstPhoto.thumb_url || firstPhoto.photo_url)
    : null

  const categoryName = (() => {
    const first = Array.isArray(restaurant?.category) && restaurant.category.length > 0
      ? restaurant.category[0]
      : restaurant?.cuisine_type
    if (!first) return null
    const info = getCategoryInfo(first)
    return info?.name || first
  })()

  const subtitle = [categoryName, restaurant?.address].filter(Boolean).join(' · ')

  return (
    <>
      {/* Brand bar — ChiamamiBi logo, shown above restaurant info on mobile.
          Desktop already has DesktopNavbar (see App.jsx via desktop-nav-offset). */}
      <div
        className="md:hidden"
        style={{
          background: '#22181C',
          padding: '10px 16px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <LogoFull height={18} />
      </div>

      {/* Mobile */}
      <div
        className="md:hidden"
        style={{
          background: '#22181C',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <RestaurantAvatar photoUrl={photoUrl} size={36} radius={10} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {restaurant?.name}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.3)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: 1,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <GuideBadge compact />
        <button
          onClick={onLogout}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 10,
            fontWeight: 500,
            padding: 6,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Esci
        </button>
      </div>

      {/* Desktop */}
      <div
        className="hidden md:flex desktop-nav-offset"
        style={{
          background: '#22181C',
          padding: '16px 32px',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <RestaurantAvatar photoUrl={photoUrl} size={48} radius={12} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              fontFamily: "'TAN Songbird', 'DM Sans', serif",
            }}
          >
            {restaurant?.name}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
        <GuideBadge />
        <button
          onClick={onLogout}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 12,
            fontWeight: 500,
            padding: '8px 16px',
            borderRadius: 10,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Esci
        </button>
      </div>
    </>
  )
}

function RestaurantAvatar({ photoUrl, size, radius }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: size * 0.42 }}>🍽️</span>
      )}
    </div>
  )
}

function GuideBadge({ compact }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: 'rgba(74,222,128,0.12)',
        color: '#4ADE80',
        borderRadius: 999,
        padding: compact ? '3px 8px' : '5px 12px',
        fontSize: compact ? 8 : 10,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: compact ? 4 : 6,
          height: compact ? 4 : 6,
          borderRadius: '50%',
          background: '#4ADE80',
        }}
      />
      Nella guida
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tab bar (Verifica QR / Dashboard)                                 */
/* ------------------------------------------------------------------ */
const TABS = [
  { key: 'verify', label: 'Verifica QR' },
  { key: 'dashboard', label: 'Dashboard' },
]

function TabBar({ tab, onChange }) {
  return (
    <div
      style={{
        background: '#22181C',
        display: 'flex',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {TABS.map((t) => {
        const active = tab === t.key
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              padding: '14px 8px',
              color: active ? '#fff' : 'rgba(255,255,255,0.35)',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              position: 'relative',
              fontFamily: 'inherit',
              transition: 'color 0.15s',
            }}
          >
            {t.label}
            {active && (
              <span
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bottom: 0,
                  width: 60,
                  height: 3,
                  background: '#E8453C',
                  borderRadius: '3px 3px 0 0',
                }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Placeholder tab (rimpiazzati in Step 4 e 5)                       */
/* ------------------------------------------------------------------ */
function TabPlaceholder({ title, description }) {
  return (
    <div
      style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: '#8A8680',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#22181C',
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>{description}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Verifica QR tab — camera scanner (primary) + manual input fallback */
/* ------------------------------------------------------------------ */
function VerifyTab({ restaurant }) {
  const [mode, setMode] = useState('camera') // 'camera' | 'manual'
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // { status, data }
  const inputRef = useRef(null)

  const reset = () => {
    setCode('')
    setResult(null)
  }

  // Extracted so it can be triggered by both the camera (on scan) and the
  // manual-input submit form.
  const verifyCode = async (rawCode) => {
    const trimmed = (rawCode || '').trim()
    if (!trimmed || loading) return
    setLoading(true)
    try {
      // 1) Find redemption by qr_code
      const { data: redemption, error: rErr } = await supabase
        .from('discount_redemptions')
        .select('*, discount:discounts(id, title, discount_value, discount_type, restaurant_id, valid_until)')
        .eq('qr_code', trimmed)
        .maybeSingle()

      if (rErr || !redemption) {
        setResult({ status: 'not_found' })
        return
      }

      // 2) Must belong to THIS restaurant
      if (redemption.discount?.restaurant_id !== restaurant.id) {
        setResult({ status: 'wrong_restaurant' })
        return
      }

      // 3) Already redeemed
      if (redemption.status === 'redeemed') {
        const userName = await fetchUserName(redemption.user_id)
        setResult({
          status: 'already_redeemed',
          data: { ...redemption, user_name: userName },
        })
        return
      }

      // 4) Expired
      const isExpired =
        redemption.status === 'expired' ||
        (redemption.discount?.valid_until &&
          new Date(redemption.discount.valid_until) < new Date())
      if (isExpired) {
        setResult({ status: 'expired', data: redemption })
        return
      }

      // 5) Mark as redeemed
      const userName = await fetchUserName(redemption.user_id)
      const { error: uErr } = await supabase
        .from('discount_redemptions')
        .update({
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
          redeemed_by_restaurant: true,
        })
        .eq('id', redemption.id)

      if (uErr) {
        setResult({ status: 'error', data: { message: 'Errore durante la validazione' } })
        return
      }

      // 6) Best-effort: increment total_redeemed
      const discountId = redemption.discount?.id || redemption.discount_id
      if (discountId) {
        await supabase.rpc('increment_discount_redeemed', { discount_uuid: discountId }).catch(() => {})
      }

      setResult({
        status: 'success',
        data: { ...redemption, user_name: userName },
      })
    } catch (err) {
      console.error('verify error:', err)
      setResult({ status: 'error', data: { message: 'Errore di rete, riprova' } })
    } finally {
      setLoading(false)
    }
  }

  const handleManualSubmit = (e) => {
    e?.preventDefault?.()
    verifyCode(code)
  }

  // Focus input when switching to manual mode
  useEffect(() => {
    if (mode === 'manual' && !result) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [mode, result])

  return (
    <div style={{ padding: '24px 16px 80px', maxWidth: 520, margin: '0 auto' }}>
      {!result && mode === 'camera' && (
        <QrCameraScanner
          loading={loading}
          onScan={(scanned) => verifyCode(scanned)}
          onSwitchToManual={() => setMode('manual')}
        />
      )}

      {!result && mode === 'manual' && (
        <form onSubmit={handleManualSubmit}>
          <div
            style={{
              fontSize: 13,
              color: '#8A8680',
              marginBottom: 10,
              textAlign: 'center',
            }}
          >
            Inserisci il codice mostrato dal cliente
          </div>

          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="BiSc-XXXXXXXX"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={loading}
            style={{
              width: '100%',
              padding: '18px 16px',
              fontSize: 18,
              fontWeight: 600,
              fontFamily: "'SF Mono', 'Menlo', monospace",
              letterSpacing: 1.5,
              textAlign: 'center',
              border: '2px solid #E8E0D4',
              borderRadius: 14,
              background: '#fff',
              color: '#22181C',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#E8453C')}
            onBlur={(e) => (e.target.style.borderColor = '#E8E0D4')}
          />

          <button
            type="submit"
            disabled={!code.trim() || loading}
            style={{
              width: '100%',
              marginTop: 14,
              padding: '16px',
              background: code.trim() && !loading ? '#E8453C' : '#E8E0D4',
              color: code.trim() && !loading ? '#fff' : '#8A8680',
              border: 'none',
              borderRadius: 14,
              fontSize: 15,
              fontWeight: 700,
              cursor: code.trim() && !loading ? 'pointer' : 'not-allowed',
              letterSpacing: 0.3,
              transition: 'all 0.15s',
            }}
          >
            {loading ? 'Verifica in corso…' : 'Verifica sconto'}
          </button>

          <button
            type="button"
            onClick={() => {
              setCode('')
              setMode('camera')
            }}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 14,
              padding: '10px',
              background: 'transparent',
              border: 'none',
              color: '#22181C',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            ← Usa la fotocamera
          </button>

          <p
            style={{
              marginTop: 16,
              fontSize: 11,
              color: '#8A8680',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            Il codice è nel formato <strong>BiSc-XXXXXXXX</strong> e si trova
            sotto il QR mostrato dal cliente.
          </p>
        </form>
      )}

      {result && <VerifyResult result={result} onReset={reset} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  QrCameraScanner — camera preview + live QR detection              */
/* ------------------------------------------------------------------ */
function QrCameraScanner({ loading, onScan, onSwitchToManual }) {
  const videoRef = useRef(null)
  const scannerRef = useRef(null)
  const lastScanRef = useRef({ code: null, at: 0 })
  const onScanRef = useRef(onScan)
  const [status, setStatus] = useState('starting') // 'starting' | 'running' | 'no-camera' | 'denied' | 'error'
  const [errorMsg, setErrorMsg] = useState(null)

  // Keep the ref pointing at the latest onScan without retriggering setup
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  // Pause the scanner while the verification request is in-flight to avoid
  // re-triggering the same code multiple times.
  useEffect(() => {
    const s = scannerRef.current
    if (!s) return
    if (loading) {
      try {
        s.stop()
      } catch {
        // ignore
      }
    } else if (status === 'running') {
      s.start().catch(() => {})
    }
  }, [loading, status])

  useEffect(() => {
    let cancelled = false
    let scanner = null

    async function start() {
      // Dynamic import keeps the scanner code out of the main bundle
      let QrScanner
      try {
        const mod = await import('qr-scanner')
        QrScanner = mod.default
      } catch (e) {
        console.error('Failed to load qr-scanner', e)
        if (!cancelled) {
          setStatus('error')
          setErrorMsg('Impossibile caricare lo scanner')
        }
        return
      }

      if (cancelled || !videoRef.current) return

      // Ensure a camera exists before asking for permission — nicer UX
      try {
        const hasCamera = await QrScanner.hasCamera()
        if (!hasCamera) {
          if (!cancelled) setStatus('no-camera')
          return
        }
      } catch {
        // hasCamera can throw on older browsers — proceed and let the real
        // start call decide
      }

      scanner = new QrScanner(
        videoRef.current,
        (res) => {
          const scanned = typeof res === 'string' ? res : res?.data
          if (!scanned) return
          // Debounce: ignore rapid-fire duplicates for 2.5s
          const now = Date.now()
          if (lastScanRef.current.code === scanned && now - lastScanRef.current.at < 2500) {
            return
          }
          lastScanRef.current = { code: scanned, at: now }
          onScanRef.current?.(scanned)
        },
        {
          preferredCamera: 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
        },
      )
      scannerRef.current = scanner

      try {
        await scanner.start()
        if (!cancelled) setStatus('running')
      } catch (e) {
        console.error('Camera start failed', e)
        if (cancelled) return
        const msg = String(e?.message || e?.name || '').toLowerCase()
        if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) {
          setStatus('denied')
        } else if (msg.includes('notfound') || msg.includes('no camera')) {
          setStatus('no-camera')
        } else {
          setStatus('error')
          setErrorMsg(e?.message || 'Impossibile avviare la fotocamera')
        }
      }
    }

    start()

    return () => {
      cancelled = true
      if (scannerRef.current) {
        try {
          scannerRef.current.stop()
          scannerRef.current.destroy()
        } catch {
          // ignore
        }
        scannerRef.current = null
      }
    }
    // Run setup only once per mount — onScan is accessed via ref
  }, [])

  const canShowVideo = status === 'starting' || status === 'running'

  return (
    <div>
      <div
        style={{
          fontSize: 13,
          color: '#8A8680',
          marginBottom: 10,
          textAlign: 'center',
        }}
      >
        Inquadra il QR code mostrato dal cliente
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          background: '#22181C',
          borderRadius: 14,
          overflow: 'hidden',
          border: '2px solid #E8E0D4',
        }}
      >
        {canShowVideo && (
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}

        {status === 'starting' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 12,
              background: 'rgba(34,24,28,0.85)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  border: '3px solid rgba(255,255,255,0.2)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  margin: '0 auto 8px',
                  animation: 'verifySpin 0.8s linear infinite',
                }}
              />
              Avvio fotocamera…
            </div>
          </div>
        )}

        {status === 'denied' && (
          <CameraFallbackMessage
            icon="🚫"
            title="Fotocamera bloccata"
            description="Autorizza l'accesso alla fotocamera nelle impostazioni del browser, oppure usa l'inserimento manuale."
          />
        )}

        {status === 'no-camera' && (
          <CameraFallbackMessage
            icon="📷"
            title="Nessuna fotocamera rilevata"
            description="Questo dispositivo non espone una fotocamera utilizzabile. Inserisci il codice manualmente."
          />
        )}

        {status === 'error' && (
          <CameraFallbackMessage
            icon="⚠️"
            title="Errore fotocamera"
            description={errorMsg || 'Impossibile avviare la fotocamera. Usa l\'inserimento manuale.'}
          />
        )}

        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(34,24,28,0.85)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  border: '3px solid rgba(255,255,255,0.2)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  margin: '0 auto 8px',
                  animation: 'verifySpin 0.8s linear infinite',
                }}
              />
              Verifica in corso…
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onSwitchToManual}
        style={{
          display: 'block',
          width: '100%',
          marginTop: 16,
          padding: '14px',
          background: 'transparent',
          border: '1px solid #E8E0D4',
          borderRadius: 14,
          color: '#22181C',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Inserisci il codice manualmente
      </button>

      <p
        style={{
          marginTop: 12,
          fontSize: 11,
          color: '#8A8680',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Il riconoscimento avviene automaticamente. Tieni il QR del cliente
        inquadrato e a fuoco.
      </p>
    </div>
  )
}

function CameraFallbackMessage({ icon, title, description }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#fff',
        textAlign: 'center',
        background: 'rgba(34,24,28,0.95)',
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
        {description}
      </div>
    </div>
  )
}

async function fetchUserName(userId) {
  if (!userId) return 'Utente'
  try {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
    return data?.full_name || 'Utente'
  } catch {
    return 'Utente'
  }
}

/* ------------------------------------------------------------------ */
/*  VerifyResult — stati successo / errore / già-usato                */
/* ------------------------------------------------------------------ */
function VerifyResult({ result, onReset }) {
  const { status, data } = result

  if (status === 'success') {
    return (
      <ResultCard
        tone="success"
        icon="✓"
        title="Sconto validato!"
        onReset={onReset}
        resetLabel="Nuova verifica"
      >
        <ResultRow label="Sconto" value={data.discount?.title} />
        <ResultRow label="Valore" value={formatDiscountValue(data.discount)} strong />
        <ResultRow label="Cliente" value={data.user_name} />
      </ResultCard>
    )
  }

  if (status === 'already_redeemed') {
    const date = data.redeemed_at
      ? new Date(data.redeemed_at).toLocaleString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null
    return (
      <ResultCard
        tone="warning"
        icon="!"
        title="Codice già utilizzato"
        onReset={onReset}
        resetLabel="Nuova verifica"
      >
        <ResultRow label="Sconto" value={data.discount?.title} />
        {date && <ResultRow label="Usato il" value={date} />}
        {data.user_name && <ResultRow label="Cliente" value={data.user_name} />}
      </ResultCard>
    )
  }

  if (status === 'expired') {
    return (
      <ResultCard
        tone="neutral"
        icon="⏱"
        title="Sconto scaduto"
        description="La data di validità di questo sconto è passata."
        onReset={onReset}
        resetLabel="Nuova verifica"
      />
    )
  }

  if (status === 'wrong_restaurant') {
    return (
      <ResultCard
        tone="error"
        icon="✕"
        title="Codice non valido per questo ristorante"
        description="Questo QR appartiene a uno sconto di un altro locale."
        onReset={onReset}
        resetLabel="Nuova verifica"
      />
    )
  }

  if (status === 'not_found') {
    return (
      <ResultCard
        tone="error"
        icon="✕"
        title="Codice non riconosciuto"
        description="Controlla che il codice sia scritto correttamente."
        onReset={onReset}
        resetLabel="Riprova"
      />
    )
  }

  // generic error
  return (
    <ResultCard
      tone="error"
      icon="✕"
      title="Errore"
      description={data?.message || 'Si è verificato un errore.'}
      onReset={onReset}
      resetLabel="Riprova"
    />
  )
}

function formatDiscountValue(discount) {
  if (!discount) return ''
  const v = discount.discount_value
  if (discount.discount_type === 'percentage') return `${v}%`
  if (discount.discount_type === 'fixed') return `€${v}`
  return v
}

const TONES = {
  success: {
    bg: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
    border: '#86EFAC',
    iconBg: '#10B981',
    iconColor: '#fff',
    titleColor: '#065F46',
  },
  warning: {
    bg: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
    border: '#FCD34D',
    iconBg: '#F59E0B',
    iconColor: '#fff',
    titleColor: '#78350F',
  },
  neutral: {
    bg: '#F5F1EA',
    border: '#E8E0D4',
    iconBg: '#8A8680',
    iconColor: '#fff',
    titleColor: '#22181C',
  },
  error: {
    bg: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
    border: '#FCA5A5',
    iconBg: '#E8453C',
    iconColor: '#fff',
    titleColor: '#7F1D1D',
  },
}

function ResultCard({ tone, icon, title, description, children, onReset, resetLabel }) {
  const t = TONES[tone] || TONES.neutral
  return (
    <div
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 18,
        padding: 24,
        animation: 'verifyFadeIn 0.25s ease-out',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: t.iconBg,
          color: t.iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          fontWeight: 700,
          margin: '0 auto 14px',
          animation: 'verifyPop 0.35s ease-out',
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: t.titleColor,
          textAlign: 'center',
          margin: '0 0 6px',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: 13,
            color: t.titleColor,
            opacity: 0.8,
            textAlign: 'center',
            margin: '0 0 16px',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {children && (
        <div
          style={{
            background: 'rgba(255,255,255,0.55)',
            borderRadius: 12,
            padding: '12px 14px',
            marginTop: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {children}
        </div>
      )}
      <button
        onClick={onReset}
        style={{
          width: '100%',
          marginTop: 18,
          padding: '13px',
          background: '#22181C',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: 0.2,
        }}
      >
        {resetLabel}
      </button>
    </div>
  )
}

function ResultRow({ label, value, strong }) {
  if (!value) return null
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontSize: 13,
        gap: 12,
      }}
    >
      <span style={{ color: '#8A8680', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color: '#22181C',
          fontWeight: strong ? 700 : 500,
          fontSize: strong ? 15 : 13,
          textAlign: 'right',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Dashboard tab — stats + sconto attivo + funnel + attivita         */
/* ------------------------------------------------------------------ */
function DashboardTab({ restaurant, deviceToken, onSessionExpired }) {
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(null)
  const [discount, setDiscount] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setStatsError(null)
      try {
        // 1) Stats via RPC
        const statsPromise = supabase.rpc('verify_dashboard_stats', {
          p_restaurant_id: restaurant.id,
          p_device_token: deviceToken,
        })

        // 2) Active discount (public read)
        const discountPromise = supabase
          .from('discounts')
          .select('id, title, description, discount_type, discount_value, valid_until, max_redemptions, total_redeemed, is_active')
          .eq('restaurant_id', restaurant.id)
          .eq('is_active', true)
          .gt('valid_until', new Date().toISOString())
          .order('valid_until', { ascending: true })
          .limit(1)
          .maybeSingle()

        // 3) Recent activity (discount_redemptions is public-read)
        const activityPromise = supabase
          .from('discount_redemptions')
          .select('id, qr_code, status, generated_at, redeemed_at, user_id, discount:discounts!inner(id, title, restaurant_id)')
          .eq('discount.restaurant_id', restaurant.id)
          .order('generated_at', { ascending: false })
          .limit(10)

        const [statsRes, discountRes, activityRes] = await Promise.allSettled([
          statsPromise,
          discountPromise,
          activityPromise,
        ])

        if (cancelled) return

        // Stats — resilient: if the RPC isn't deployed yet or errors out,
        // fall back to the subset we can compute client-side (redemptions)
        // so the dashboard still loads instead of showing a blocking error.
        const statsValue = statsRes.status === 'fulfilled' ? statsRes.value : null
        if (statsValue?.data?.error === 'unauthorized') {
          onSessionExpired?.()
          return
        }
        if (statsRes.status === 'fulfilled' && !statsValue?.error && statsValue?.data) {
          setStats(statsValue.data)
        } else {
          const reason = statsRes.status === 'rejected' ? statsRes.reason : statsValue?.error
          console.error('stats error', reason)
          setStatsError('Alcune statistiche non sono disponibili')
          // Fallback stats derived from activity + what we know
          setStats(buildFallbackStats(activityRes.status === 'fulfilled' ? activityRes.value?.data : null))
        }

        setDiscount(discountRes.status === 'fulfilled' ? (discountRes.value?.data || null) : null)
        setActivity(activityRes.status === 'fulfilled' ? (activityRes.value?.data || []) : [])
      } catch (e) {
        if (!cancelled) {
          console.error('dashboard load error', e)
          setStatsError('Errore di rete')
          setStats(buildFallbackStats(null))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [restaurant.id, deviceToken, reloadKey, onSessionExpired])

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#8A8680' }}>
        <div
          style={{
            width: 28,
            height: 28,
            border: '3px solid #E8E0D4',
            borderTopColor: '#E8453C',
            borderRadius: '50%',
            margin: '0 auto 12px',
            animation: 'verifySpin 0.8s linear infinite',
          }}
        />
        <div style={{ fontSize: 12 }}>Caricamento statistiche…</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 16px 80px', maxWidth: 1100, margin: '0 auto' }}>
      {statsError && (
        <div
          style={{
            background: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 12,
            color: '#92400E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>⚠ {statsError}</span>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            style={{
              background: 'transparent',
              border: '1px solid #FCD34D',
              color: '#92400E',
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Riprova
          </button>
        </div>
      )}
      <StatGrid stats={stats} />
      <div className="verify-dashboard-main">
        <div className="verify-dashboard-col">
          {discount && <ActiveDiscountCard discount={discount} />}
          <FunnelCard stats={stats} />
        </div>
        <div className="verify-dashboard-col">
          <ActivityList activity={activity} />
        </div>
      </div>
    </div>
  )
}

function buildFallbackStats(activityData) {
  const list = Array.isArray(activityData) ? activityData : []
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const gen30 = list.filter(
    (r) => r.generated_at && now - new Date(r.generated_at).getTime() <= 30 * dayMs,
  ).length
  const used30 = list.filter(
    (r) =>
      r.status === 'redeemed' &&
      r.redeemed_at &&
      now - new Date(r.redeemed_at).getTime() <= 30 * dayMs,
  ).length
  const usedTotal = list.filter((r) => r.status === 'redeemed').length
  return {
    views_30d: 0,
    views_7d: 0,
    views_today: 0,
    saves_total: 0,
    saves_30d: 0,
    redemptions_total: list.length,
    redemptions_generated_30d: gen30,
    redemptions_used_30d: used30,
    redemptions_used_total: usedTotal,
  }
}

function StatGrid({ stats }) {
  if (!stats) return null
  const cards = [
    {
      label: 'Visualizzazioni',
      value: stats.views_30d || 0,
      sublabel: `${stats.views_7d || 0} negli ultimi 7 gg`,
      icon: '👁',
      color: '#6366F1',
    },
    {
      label: 'Salvati',
      value: stats.saves_total || 0,
      sublabel: `+${stats.saves_30d || 0} negli ultimi 30 gg`,
      icon: '♥',
      color: '#EC4899',
    },
    {
      label: 'Sconti generati',
      value: stats.redemptions_generated_30d || 0,
      sublabel: 'Ultimi 30 giorni',
      icon: '✦',
      color: '#F59E0B',
    },
    {
      label: 'Sconti usati',
      value: stats.redemptions_used_30d || 0,
      sublabel: `${stats.redemptions_used_total || 0} in totale`,
      icon: '✓',
      color: '#10B981',
    },
  ]
  return (
    <div className="verify-stat-grid">
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            background: '#fff',
            borderRadius: 14,
            padding: '14px 14px 12px',
            border: '1px solid #F0EAE0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: c.color,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 13 }}>{c.icon}</span>
            <span>{c.label}</span>
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: '#22181C',
              lineHeight: 1,
              letterSpacing: -0.5,
            }}
          >
            {c.value.toLocaleString('it-IT')}
          </div>
          <div style={{ fontSize: 10, color: '#8A8680', marginTop: 4 }}>{c.sublabel}</div>
        </div>
      ))}
    </div>
  )
}

function daysUntil(isoDate) {
  if (!isoDate) return 0
  const diffMs = new Date(isoDate).getTime() - new Date().getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

function ActiveDiscountCard({ discount }) {
  const value =
    discount.discount_type === 'percentage'
      ? `${discount.discount_value}%`
      : discount.discount_type === 'fixed'
      ? `€${discount.discount_value}`
      : discount.discount_value
  const pct =
    discount.max_redemptions && discount.max_redemptions > 0
      ? Math.min(100, ((discount.total_redeemed || 0) / discount.max_redemptions) * 100)
      : null
  const days = daysUntil(discount.valid_until)
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #22181C 0%, #3A2A30 100%)',
        color: '#fff',
        borderRadius: 18,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#E8453C',
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        Sconto attivo
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{value}</div>
        <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.9 }}>{discount.title}</div>
      </div>
      {discount.description && (
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12, lineHeight: 1.4 }}>
          {discount.description}
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, fontSize: 11, opacity: 0.85 }}>
        <span>
          <strong style={{ color: '#fff' }}>{discount.total_redeemed || 0}</strong> usati
          {discount.max_redemptions ? ` / ${discount.max_redemptions}` : ''}
        </span>
        <span>·</span>
        <span>
          Scade in <strong style={{ color: '#fff' }}>{days}</strong> gg
        </span>
      </div>
      {pct != null && (
        <div
          style={{
            marginTop: 10,
            height: 4,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: '#E8453C',
              transition: 'width 0.4s',
            }}
          />
        </div>
      )}
    </div>
  )
}

function FunnelCard({ stats }) {
  if (!stats) return null
  const steps = [
    { label: 'Visualizzazioni', value: stats.views_30d || 0, color: '#6366F1' },
    { label: 'Salvati', value: stats.saves_30d || 0, color: '#EC4899' },
    { label: 'Sconti generati', value: stats.redemptions_generated_30d || 0, color: '#F59E0B' },
    { label: 'Sconti usati', value: stats.redemptions_used_30d || 0, color: '#10B981' },
  ]
  const max = Math.max(...steps.map((s) => s.value), 1)

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
        border: '1px solid #F0EAE0',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#8A8680',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Funnel ultimi 30 giorni
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((s) => {
          const pct = (s.value / max) * 100
          return (
            <div key={s.label}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: '#22181C', fontWeight: 500 }}>{s.label}</span>
                <span style={{ color: s.color, fontWeight: 700 }}>{s.value}</span>
              </div>
              <div style={{ height: 8, background: '#F5F1EA', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.max(2, pct)}%`,
                    height: '100%',
                    background: s.color,
                    borderRadius: 4,
                    transition: 'width 0.4s',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActivityList({ activity }) {
  if (!activity || activity.length === 0) {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '24px 18px',
          border: '1px solid #F0EAE0',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#8A8680',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Attività recente
        </div>
        <div style={{ fontSize: 13, color: '#8A8680' }}>
          Nessuno sconto ancora generato.
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #F0EAE0',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#8A8680',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          padding: '14px 16px 8px',
        }}
      >
        Attività recente
      </div>
      {activity.map((a) => (
        <ActivityRow key={a.id} item={a} />
      ))}
    </div>
  )
}

function ActivityRow({ item }) {
  const isRedeemed = item.status === 'redeemed'
  const date = isRedeemed ? item.redeemed_at : item.generated_at
  const when = date
    ? new Date(date).toLocaleString('it-IT', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderTop: '1px solid #F5F1EA',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isRedeemed ? '#10B981' : '#F59E0B',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {isRedeemed ? '✓' : '•'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#22181C',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {isRedeemed ? 'Usato' : 'Generato'} · {item.discount?.title || '—'}
        </div>
        <div style={{ fontSize: 11, color: '#8A8680', marginTop: 1 }}>
          {item.qr_code} · {when}
        </div>
      </div>
    </div>
  )
}
