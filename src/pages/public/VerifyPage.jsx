import { useState, useEffect, useRef } from 'react'
import './VerifyPage.css'
import { Link } from 'react-router-dom'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
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
              color: 'var(--color-ink)',
              border: `2px solid ${filled ? 'var(--color-ink)' : 'var(--color-line)'}`,
              borderRadius: box.radius,
              background: filled ? 'var(--color-page)' : '#fff',
              outline: 'none',
              transition: 'border-color 0.15s, background 0.15s',
              caretColor: 'var(--color-corallo)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-corallo)')}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = filled ? 'var(--color-ink)' : 'var(--color-line)')
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
            background: 'var(--color-oro)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-ink)',
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
                background: 'var(--color-page)',
                color: 'var(--color-corallo)',
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
                color: 'var(--color-ink-55)',
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{s.title}</span>
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
        background: 'var(--color-page)',
        borderRadius: 8,
        padding: 12,
        fontSize: 11,
        color: 'var(--color-ink-55)',
        lineHeight: 1.5,
      }}
    >
      Non hai il PIN? Scrivici su{' '}
      <a
        href="https://instagram.com/chiamamibi"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--color-corallo)', fontWeight: 600, textDecoration: 'none' }}
      >
        @chiamamibi
      </a>{' '}
      o a{' '}
      <a
        href="mailto:info@chiamamibi.com"
        style={{ color: 'var(--color-corallo)', fontWeight: 600, textDecoration: 'none' }}
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
function LockIcon({ size = 22, color = 'var(--color-corallo)' }) {
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
          // Touch last_used_at in background via RPC (direct UPDATE on the
          // table is no longer allowed for anon/auth — see hardening SQL).
          supabase
            .rpc('verify_touch_device', { p_device_token: token })
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
      // Server-side PIN validation + device registration.
      // Uses the SECURITY DEFINER RPC verify_login which:
      //   • Validates the PIN against restaurants.verify_pin (and the legacy
      //     restaurant_partners.pin_code fallback).
      //   • Generates a device_token server-side and inserts it in
      //     verified_devices — anon no longer has direct INSERT access.
      //   • Strips verify_pin from the returned restaurant row.
      const { data: loginData, error: rpcErr } = await supabase.rpc('verify_login', {
        p_pin: pinToUse,
        p_user_agent: (navigator.userAgent || '').slice(0, 500),
      })

      if (rpcErr || !loginData || loginData.error) {
        triggerError('PIN non valido. Riprova o contattaci.')
        return
      }

      const r = loginData.restaurant
      const token = loginData.device_token

      if (!r || !token) {
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
          background: 'var(--color-page)',
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
            border: '3px solid var(--color-line)',
            borderTopColor: 'var(--color-corallo)',
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

  return body
}

/* ------------------------------------------------------------------ */
/*  PIN View (mobile + desktop responsive)                            */
/* ------------------------------------------------------------------ */
function PinView({ pin, setPin, error, shake, submitting, onSubmit }) {
  const isDesktop = useIsDesktop()
  return (
    <>
      {/* ---- MOBILE (< 768px) ---- */}
      {!isDesktop && (
      <div style={{ minHeight: '100dvh', background: 'var(--color-page)' }}>
        {/* Brand bar — ChiamamiBi logo + link to main site for people who
            stumbled onto /verify by mistake. Matches RestaurantHeader's
            brand bar style so the experience is consistent once logged in. */}
        <div
          style={{
            background: 'var(--color-ink)',
            padding: '18px 16px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Link
            to="/"
            aria-label="Torna al sito ChiamamiBi"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              textDecoration: 'none',
            }}
          >
            <LogoFull height={26} />
          </Link>
          <Link
            to="/"
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.7)',
              textDecoration: 'none',
              fontWeight: 500,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            ← Al sito
          </Link>
        </div>

        {/* Header scuro */}
        <div
          style={{
            background: 'var(--color-ink)',
            padding: '16px 20px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(232, 69, 60,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <LockIcon size={22} color="var(--color-corallo)" />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-sans)', fontWeight: 900, letterSpacing: '-0.02em',
              fontSize: 20,
              color: '#fff',
              marginBottom: 4,
            }}
          >
            Area Ristoratori
          </h1>
        </div>

        {/* PIN + submit */}
        <div style={{ padding: '24px 20px' }}>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--color-ink)',
              marginBottom: 14,
              textAlign: 'center',
            }}
          >
            Inserisci il PIN del tuo ristorante
          </p>
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
              background: 'var(--color-corallo)',
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
                color: 'var(--color-corallo)',
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
              color: 'var(--color-ink-55)',
              textAlign: 'center',
            }}
          >
            Il dispositivo verrà ricordato — non dovrai reinserire il PIN
          </p>
        </div>

        <InstructionsBlock desktop={false} />
        <ContactBox desktop={false} />

        {/* Footer — explicit way out for people who landed on /verify by
            mistake (e.g. clicked a link not meant for them). */}
        <div style={{ padding: '8px 20px 28px', textAlign: 'center' }}>
          <Link
            to="/"
            style={{
              display: 'inline-block',
              fontSize: 13,
              color: 'var(--color-ink-70)',
              textDecoration: 'none',
              fontWeight: 600,
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid var(--color-line)',
              background: 'var(--color-card)',
            }}
          >
            ← Torna al sito ChiamamiBi
          </Link>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-ink-55)' }}>
            Questa pagina è dedicata ai ristoranti partner
          </div>
        </div>
      </div>
      )}

      {/* ---- DESKTOP (≥ 768px) ---- */}
      {isDesktop && (
      <div
        className="desktop-nav-offset"
        style={{
          display: 'flex',
          minHeight: '100dvh',
          background: 'var(--color-page)',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '32px 24px 48px',
        }}
      >
        {/* Brand row — ChiamamiBi logo above the card for anyone who arrived
            here without going through the main site. */}
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <Link to="/" aria-label="Torna al sito ChiamamiBi" style={{ display: 'inline-flex', textDecoration: 'none' }}>
            <LogoFull height={28} />
          </Link>
          <Link
            to="/"
            style={{
              fontSize: 13,
              color: 'var(--color-ink-70)',
              textDecoration: 'none',
              fontWeight: 600,
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--color-line)',
              background: 'var(--color-card)',
            }}
          >
            ← Torna al sito
          </Link>
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: 440,
            background: 'var(--color-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-line)',
            padding: '36px 32px 28px',
            boxShadow: 'var(--shadow-md)',
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
                background: 'rgba(232, 69, 60,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <LockIcon size={24} color="var(--color-corallo)" />
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-sans)', fontWeight: 900, letterSpacing: '-0.02em',
                fontSize: 24,
                color: 'var(--color-ink)',
                marginBottom: 6,
              }}
            >
              Area Ristoratori
            </h1>
          </div>

          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--color-ink)',
              marginBottom: 14,
              textAlign: 'center',
            }}
          >
            Inserisci il PIN del tuo ristorante
          </p>
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
              background: 'var(--color-corallo)',
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
                color: 'var(--color-corallo)',
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
              color: 'var(--color-ink-55)',
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

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--color-ink-55)' }}>
          Questa pagina è dedicata ai ristoranti partner.{' '}
          <Link to="/" style={{ color: 'var(--color-ink-70)', fontWeight: 600, textDecoration: 'underline' }}>
            Torna al sito
          </Link>
        </div>
      </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  AuthedView — header ristorante + tab bar + corpo tab              */
/* ------------------------------------------------------------------ */
function AuthedView({ restaurant, onLogout, deviceToken, onSessionExpired }) {
  const [tab, setTab] = useState('verify')

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-page)' }}>
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
  const isDesktop = useIsDesktop()

  return (
    <>
      {/* Brand bar — ChiamamiBi logo, taller with centered mark on mobile.
          Desktop already has DesktopNavbar (see App.jsx via desktop-nav-offset). */}
      {!isDesktop && (
      <div
        style={{
          background: 'var(--color-ink)',
          padding: '20px 16px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <LogoFull height={28} />
      </div>
      )}

      {/* Mobile */}
      {!isDesktop && (
      <div
        style={{
          background: 'var(--color-ink)',
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
      )}

      {/* Desktop */}
      {isDesktop && (
      <div
        className="desktop-nav-offset"
        style={{
          background: 'var(--color-ink)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <RestaurantAvatar photoUrl={photoUrl} size={48} radius={12} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              color: '#fff',
              fontFamily: 'var(--font-sans)', fontWeight: 900, letterSpacing: '-0.02em',
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
      )}
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
        color: 'var(--color-success)',
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
          background: 'var(--color-success)',
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
        background: 'var(--color-ink)',
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
                  background: 'var(--color-corallo)',
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
        color: 'var(--color-ink-55)',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-ink)',
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
/*  extractQrCode — normalizza il payload scansionato                  */
/* ------------------------------------------------------------------ */
// Il QR generato lato cliente codifica l'URL completo
// (es. "https://chiamamibi.com/verify?code=BiSc-XXXXXXXX"), non il solo
// qr_code. Questa funzione estrae il parametro `code` quando presente e
// ritorna la stringa pulita da usare nella query Supabase.
// Funziona anche se l'utente incolla direttamente il codice nel form
// manuale (es. "BiSc-XXXXXXXX").
function extractQrCode(raw) {
  if (!raw) return ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''

  // Prova a parsare come URL e leggere il query param ?code=
  try {
    const url = new URL(trimmed)
    const code = url.searchParams.get('code')
    if (code) return code.trim()
  } catch {
    // Not a URL — fall through
  }

  // Fallback regex: estrae ?code=... anche da stringhe che non sono URL
  // completi (es. "/verify?code=BiSc-XXXX")
  const match = trimmed.match(/[?&]code=([^&\s]+)/)
  if (match) return decodeURIComponent(match[1]).trim()

  // Altrimenti assume che sia già il qr_code nudo (es. inserimento manuale)
  return trimmed
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
  //
  // SECURITY: All validation + redemption logic runs server-side in the
  // SECURITY DEFINER RPC `verify_redeem_qr`, which:
  //   • Authenticates the device via verify_device_token cookie
  //   • Checks the QR belongs to *this* restaurant
  //   • Atomically marks redeemed + increments counter
  // The client only forwards the token and displays the outcome.
  const verifyCode = async (rawCode) => {
    const trimmed = extractQrCode(rawCode)
    if (!trimmed || loading) return
    setLoading(true)
    try {
      const token = getCookie(COOKIE_NAME)
      if (!token) {
        setResult({
          status: 'error',
          data: { message: 'Sessione scaduta, rientra con il PIN.' },
        })
        return
      }

      const { data: resp, error: rpcErr } = await supabase.rpc('verify_redeem_qr', {
        p_device_token: token,
        p_qr_code: trimmed,
      })

      if (rpcErr || !resp) {
        setResult({
          status: 'error',
          data: { message: rpcErr?.message || 'Errore di rete, riprova' },
        })
        return
      }

      // Normalize RPC response to the shape VerifyResult expects:
      //   { status, data: { ..., discount: { title, discount_value, discount_type } } }
      const payload = resp.data || {}
      const normalized = {
        ...payload,
        discount: {
          title: payload.discount_title ?? null,
          discount_value: payload.discount_value ?? null,
          discount_type: payload.discount_type ?? null,
        },
      }

      if (resp.status === 'success') {
        try {
          navigator.vibrate?.([40, 60, 40])
        } catch {
          /* no-op */
        }
      }

      if (resp.status === 'unauthorized') {
        deleteCookie(COOKIE_NAME)
        setResult({
          status: 'error',
          data: { message: 'Sessione non valida, rientra con il PIN.' },
        })
        return
      }

      setResult({ status: resp.status, data: normalized })
    } catch (err) {
      console.error('verify error:', err)
      setResult({
        status: 'error',
        data: { message: err?.message || 'Errore di rete, riprova' },
      })
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
              color: 'var(--color-ink-55)',
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
              border: '2px solid var(--color-line)',
              borderRadius: 14,
              background: 'var(--color-card)',
              color: 'var(--color-ink)',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-corallo)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--color-line)')}
          />

          <button
            type="submit"
            disabled={!code.trim() || loading}
            style={{
              width: '100%',
              marginTop: 14,
              padding: '16px',
              background: code.trim() && !loading ? 'var(--color-corallo)' : 'var(--color-line)',
              color: code.trim() && !loading ? '#fff' : 'var(--color-ink-55)',
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
              color: 'var(--color-ink)',
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
              color: 'var(--color-ink-55)',
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
  // Start as 'running' when the browser has already granted camera permission
  // for this origin — skips the "Avvio fotocamera…" flash on subsequent visits.
  // Browsers persist mediaDevices permissions per-site automatically, so once
  // granted the user won't be prompted again on return visits.
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

      // Pre-check permission state. When it's already 'denied' we can skip
      // the failing getUserMedia attempt and show the fallback immediately.
      // When it's 'granted' we know the camera will start instantly, so we
      // don't need to show the spinner either. Not supported on Safari < 16,
      // so we fall through to the normal flow on failure.
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        try {
          const perm = await navigator.permissions.query({ name: 'camera' })
          if (!cancelled && perm.state === 'denied') {
            setStatus('denied')
            return
          }
        } catch {
          // Not supported (e.g. older Safari) — proceed with normal flow
        }
      }

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
          color: 'var(--color-ink-55)',
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
          background: 'var(--color-ink)',
          borderRadius: 14,
          overflow: 'hidden',
          border: '2px solid var(--color-line)',
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
          border: '1px solid var(--color-line)',
          borderRadius: 14,
          color: 'var(--color-ink)',
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
          color: 'var(--color-ink-55)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Il riconoscimento avviene automaticamente. Tieni il QR del cliente
        inquadrato e a fuoco.
      </p>

      <CameraPermanentAllowHint />
    </div>
  )
}

/* Detect iOS: the hint is only useful on iOS because Chrome/Android already
 * persist camera permission automatically after first grant. iOS Safari
 * re-asks on every page load unless the user explicitly sets the site to
 * "Consenti" in Impostazioni > Safari, or installs it as a PWA. */
function isIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''
  // iPhone/iPad/iPod, plus iPadOS that reports as MacIntel with touch.
  return /iP(hone|ad|od)/.test(platform)
    || /iP(hone|ad|od)/.test(ua)
    || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function CameraPermanentAllowHint() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      return localStorage.getItem('verify_camera_hint_dismissed') === '1'
    } catch { return false }
  })
  const [expanded, setExpanded] = useState(false)
  if (dismissed) return null
  if (!isIOS()) return null

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem('verify_camera_hint_dismissed', '1') } catch {}
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: '10px 12px',
        background: '#FFF8E6',
        border: '1px solid #F3DDA1',
        borderRadius: 10,
        fontSize: 11.5,
        color: '#7A5A00',
        lineHeight: 1.5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>💡</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            Evitare di autorizzare la fotocamera ogni volta
          </div>
          <div style={{ opacity: 0.9 }}>
            Su iPhone Safari chiede il permesso ad ogni visita.{' '}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#7A5A00',
                textDecoration: 'underline',
                fontSize: 'inherit',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {expanded ? 'Nascondi' : 'Come risolvere?'}
            </button>
          </div>
          {expanded && (
            <ol style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
              <li>
                <strong>Più rapido</strong> — tocca l'icona «aA» nella barra
                URL, poi «Impostazioni sito web» → «Fotocamera» → «Consenti».
              </li>
              <li style={{ marginTop: 4 }}>
                <strong>Permanente</strong> — apri l'app Impostazioni → Safari
                → Fotocamera → chiamamibi.com → «Consenti».
              </li>
              <li style={{ marginTop: 4 }}>
                <strong>Come app</strong> — in Safari tocca «Condividi» →
                «Aggiungi alla schermata Home»: il permesso viene ricordato.
              </li>
            </ol>
          )}
        </div>
        <button
          type="button"
          aria-label="Chiudi"
          onClick={dismiss}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 16,
            color: '#7A5A00',
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
            marginTop: -2,
          }}
        >
          ×
        </button>
      </div>
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
    return <SuccessCelebration data={data} onReset={onReset} />
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

/* ------------------------------------------------------------------ */
/*  SuccessCelebration — full-screen green celebration on QR validation */
/* ------------------------------------------------------------------ */
function SuccessCelebration({ data, onReset }) {
  // Burst phase: full green splash + huge check (~1.6s), then settle to
  // the detailed summary card. Keep the state local so the component
  // re-celebrates every time a new code is validated.
  const [phase, setPhase] = useState('burst')

  useEffect(() => {
    const t = setTimeout(() => setPhase('settled'), 1600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      {phase === 'burst' && <SuccessBurst />}
      {phase === 'settled' && (
        <div style={{ animation: 'verifySuccessSlide 0.35s ease-out both' }}>
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
        </div>
      )}
    </div>
  )
}

function SuccessBurst() {
  // Confetti-like bits scattering outward
  const confetti = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2
    const dist = 120 + (i % 3) * 30
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist
    const rot = (i * 47) % 360
    const colors = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#FBBF24', '#F87171']
    const color = colors[i % colors.length]
    const delay = (i % 5) * 30
    return { i, dx, dy, rot, color, delay }
  })

  return (
    <div
      style={{
        borderRadius: 18,
        padding: '60px 24px',
        background: '#10B981',
        animation: 'verifySuccessBg 1.6s ease-out forwards',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 340,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Expanding ring pulses */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 120,
          height: 120,
          marginLeft: -60,
          marginTop: -60,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.35)',
          animation: 'verifyRingPulse 1.1s ease-out forwards',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 120,
          height: 120,
          marginLeft: -60,
          marginTop: -60,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)',
          animation: 'verifyRingPulse 1.3s 0.2s ease-out forwards',
        }}
      />

      {/* Checkmark SVG with stroke-draw animation */}
      <div
        style={{
          position: 'relative',
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'var(--color-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'verifyCheckPop 0.55s cubic-bezier(0.22, 1.2, 0.36, 1) both',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25)',
          zIndex: 2,
        }}
      >
        <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
          <path
            d="M14 33 L27 46 L50 21"
            stroke="#10B981"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="60"
            style={{ animation: 'verifyCheckDraw 0.45s 0.35s ease-out forwards' }}
          />
        </svg>
      </div>

      {/* Confetti bits */}
      {confetti.map((c) => (
        <span
          key={c.i}
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 10,
            height: 14,
            marginLeft: -5,
            marginTop: -7,
            background: c.color,
            borderRadius: 2,
            animation: `verifyConfetti 1.1s ${c.delay}ms ease-out forwards`,
            '--dx': `${c.dx}px`,
            '--dy': `${c.dy}px`,
            '--rot': `${c.rot}deg`,
            zIndex: 1,
          }}
        />
      ))}

      <div
        style={{
          marginTop: 28,
          fontSize: 20,
          fontWeight: 800,
          color: '#fff',
          letterSpacing: 0.3,
          animation: 'verifySuccessSlide 0.45s 0.3s ease-out both',
          textShadow: '0 2px 12px rgba(0,0,0,0.15)',
        }}
      >
        Sconto validato!
      </div>
    </div>
  )
}

function formatDiscountValue(discount) {
  if (!discount) return ''
  const v = String(discount.discount_value ?? '').trim()
  if (!v) return ''
  if (discount.discount_type === 'percentage') {
    return v.includes('%') ? v : `${v}%`
  }
  if (discount.discount_type === 'fixed') {
    return v.includes('€') ? v : `€${v}`
  }
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
    bg: 'var(--color-cream)',
    border: 'var(--color-line)',
    iconBg: 'var(--color-ink-55)',
    iconColor: '#fff',
    titleColor: 'var(--color-ink)',
  },
  error: {
    bg: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
    border: '#FCA5A5',
    iconBg: 'var(--color-corallo)',
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
          background: 'var(--color-ink)',
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
      <span style={{ color: 'var(--color-ink-55)', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color: 'var(--color-ink)',
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
/*  Range picker — 7g / 30g / 365g / Personalizzato                    */
/* ------------------------------------------------------------------ */
function buildPresetRange(kind) {
  const to = new Date()
  const from = new Date()
  if (kind === '7d') {
    from.setDate(from.getDate() - 7)
    from.setHours(0, 0, 0, 0)
    return { kind, from, to, label: 'Ultimi 7 giorni' }
  }
  if (kind === '30d') {
    from.setDate(from.getDate() - 30)
    from.setHours(0, 0, 0, 0)
    return { kind, from, to, label: 'Ultimi 30 giorni' }
  }
  if (kind === '365d') {
    from.setDate(from.getDate() - 365)
    from.setHours(0, 0, 0, 0)
    return { kind, from, to, label: 'Ultimi 12 mesi' }
  }
  return null
}

function formatShortDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function RangePicker({ range, onChange }) {
  const [showCalendar, setShowCalendar] = useState(false)
  const presets = [
    { kind: '7d', label: '7 giorni' },
    { kind: '30d', label: '30 giorni' },
    { kind: '365d', label: '12 mesi' },
  ]
  const isCustom = range?.kind === 'custom'
  const customDates = isCustom
    ? `${formatShortDate(range.from)} – ${formatShortDate(range.to)}`
    : null

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 8,
          marginBottom: 14,
          width: '100%',
        }}
      >
        <div
          role="tablist"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 4,
            padding: 4,
            background: 'var(--color-cream)',
            borderRadius: 12,
            border: '1px solid var(--color-line)',
            flex: 1,
            minWidth: 0,
          }}
        >
          {presets.map((p) => {
            const active = range?.kind === p.kind
            return (
              <button
                key={p.kind}
                role="tab"
                aria-selected={active}
                onClick={() => onChange(buildPresetRange(p.kind))}
                style={{
                  padding: '10px 6px',
                  borderRadius: 9,
                  border: 'none',
                  background: active ? 'var(--color-ink)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-ink-70)',
                  fontSize: 14,
                  fontWeight: active ? 700 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  whiteSpace: 'nowrap',
                  boxShadow: active ? '0 2px 6px rgba(34,24,28,0.18)' : 'none',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowCalendar(true)}
          aria-label="Scegli periodo personalizzato"
          title="Personalizzato"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '0 14px',
            minWidth: 52,
            borderRadius: 12,
            border: isCustom ? '1px solid var(--color-ink)' : '1px solid var(--color-line)',
            background: isCustom ? 'var(--color-ink)' : 'var(--color-card)',
            color: isCustom ? '#fff' : 'var(--color-ink)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            transition: 'all 0.18s ease',
            boxShadow: isCustom ? '0 2px 6px rgba(34,24,28,0.18)' : 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>

      {isCustom && (
        <button
          type="button"
          onClick={() => setShowCalendar(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '10px 14px',
            marginBottom: 14,
            borderRadius: 10,
            border: '1px solid var(--color-line)',
            background: 'var(--color-card)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-ink)',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--color-ink-55)', fontWeight: 500 }}>
            Periodo selezionato
          </span>
          <span>{customDates}</span>
        </button>
      )}

      {showCalendar && (
        <CalendarRangeModal
          initialFrom={range?.from}
          initialTo={range?.to}
          onClose={() => setShowCalendar(false)}
          onApply={(from, to) => {
            const f = new Date(from); f.setHours(0, 0, 0, 0)
            const t = new Date(to); t.setHours(23, 59, 59, 999)
            onChange({
              kind: 'custom',
              from: f,
              to: t,
              label: `${formatShortDate(f)} – ${formatShortDate(t)}`,
            })
            setShowCalendar(false)
          }}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Calendar modal — two-month range picker                            */
/* ------------------------------------------------------------------ */
const WEEKDAYS_IT = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

function startOfMonth(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  return x
}
function sameDay(a, b) {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function dayTs(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function MonthView({ monthDate, from, to, hover, onPick, onHover }) {
  const first = startOfMonth(monthDate)
  // Monday as first day of week
  const jsDay = first.getDay() // 0=Sun..6=Sat
  const lead = jsDay === 0 ? 6 : jsDay - 1
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(first.getFullYear(), first.getMonth(), d))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const fromTs = from ? dayTs(from) : null
  const toTs = to ? dayTs(to) : null
  const hoverTs = hover ? dayTs(hover) : null
  const rangeEnd = toTs ?? (fromTs && hoverTs && hoverTs > fromTs ? hoverTs : null)
  const rangeStart = fromTs && rangeEnd ? Math.min(fromTs, rangeEnd) : fromTs
  const rangeStop = fromTs && rangeEnd ? Math.max(fromTs, rangeEnd) : null

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
        {WEEKDAYS_IT.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-ink-55)', fontWeight: 600 }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((c, i) => {
          if (!c) return <div key={i} />
          const ts = dayTs(c)
          const isFrom = fromTs === ts
          const isTo = toTs === ts
          const inRange = rangeStart && rangeStop && ts >= rangeStart && ts <= rangeStop
          const isFuture = ts > dayTs(new Date())
          const isEdge = isFrom || isTo
          const bg = isEdge ? 'var(--color-ink)' : inRange ? 'var(--color-corallo-soft)' : 'transparent'
          const color = isEdge ? '#fff' : isFuture ? 'var(--color-ink-15)' : 'var(--color-ink)'
          return (
            <button
              key={i}
              disabled={isFuture}
              onClick={() => onPick(c)}
              onMouseEnter={() => onHover(c)}
              style={{
                aspectRatio: '1',
                minHeight: 40,
                border: 'none',
                background: bg,
                color,
                fontSize: 15,
                fontWeight: isEdge ? 700 : 500,
                borderRadius: 10,
                cursor: isFuture ? 'not-allowed' : 'pointer',
                opacity: isFuture ? 0.5 : 1,
                transition: 'background 0.12s ease',
              }}
            >
              {c.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CalendarRangeModal({ initialFrom, initialTo, onClose, onApply }) {
  const [month, setMonth] = useState(() => {
    const base = initialFrom ? new Date(initialFrom) : new Date()
    base.setDate(1)
    return base
  })
  const [from, setFrom] = useState(initialFrom ? new Date(initialFrom) : null)
  const [to, setTo] = useState(initialTo ? new Date(initialTo) : null)
  const [hover, setHover] = useState(null)

  function handlePick(d) {
    if (!from || (from && to)) {
      setFrom(d)
      setTo(null)
      return
    }
    if (d < from) {
      setTo(from)
      setFrom(d)
    } else {
      setTo(d)
    }
  }

  const canApply = from && to

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 150,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 0,
        animation: 'verifyFadeIn 0.18s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-card)',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85dvh',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.25)',
          animation: 'verifyFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header — bigger X, bigger title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 14px',
            borderBottom: '1px solid #F0EAE0',
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-ink)' }}>Seleziona periodo</div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--color-cream)',
              border: 'none',
              width: 40,
              height: 40,
              borderRadius: 12,
              cursor: 'pointer',
              color: 'var(--color-ink)',
              fontSize: 24,
              fontWeight: 400,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        {/* Body — scrollable if needed */}
        <div style={{ padding: '16px 20px', overflow: 'auto', flex: 1 }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              style={{ background: 'var(--color-cream)', border: 'none', width: 40, height: 40, borderRadius: 10, cursor: 'pointer', fontSize: 20, color: 'var(--color-ink)' }}
              aria-label="Mese precedente"
            >
              ‹
            </button>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink)' }}>
              {MONTHS_IT[month.getMonth()]} {month.getFullYear()}
            </div>
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              style={{ background: 'var(--color-cream)', border: 'none', width: 40, height: 40, borderRadius: 10, cursor: 'pointer', fontSize: 20, color: 'var(--color-ink)' }}
              aria-label="Mese successivo"
            >
              ›
            </button>
          </div>

          {/* Selected range summary */}
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-ink-55)',
              fontWeight: 600,
              textAlign: 'center',
              marginBottom: 14,
              padding: '8px 12px',
              background: 'var(--color-cream)',
              borderRadius: 10,
            }}
          >
            {from ? formatShortDate(from) : '—'} → {to ? formatShortDate(to) : '—'}
          </div>

          <MonthView monthDate={month} from={from} to={to} hover={hover} onPick={handlePick} onHover={setHover} />
        </div>

        {/* Footer — always visible */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '14px 20px',
            paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
            borderTop: '1px solid #F0EAE0',
            background: 'var(--color-card)',
          }}
        >
          <button
            onClick={() => { setFrom(null); setTo(null); setHover(null) }}
            style={{
              padding: '13px 16px',
              borderRadius: 12,
              border: '1px solid var(--color-line)',
              background: 'var(--color-card)',
              color: 'var(--color-ink)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Azzera
          </button>
          <button
            disabled={!canApply}
            onClick={() => onApply(from, to)}
            style={{
              flex: 1,
              padding: '13px 20px',
              borderRadius: 12,
              border: 'none',
              background: canApply ? 'var(--color-corallo)' : 'var(--color-cream)',
              color: canApply ? '#fff' : 'var(--color-ink-55)',
              fontSize: 15,
              fontWeight: 700,
              cursor: canApply ? 'pointer' : 'not-allowed',
              transition: 'background 0.18s ease',
            }}
          >
            Applica
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Dashboard tab — stats + sconto attivo + funnel + attivita         */
/* ------------------------------------------------------------------ */
function defaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  from.setHours(0, 0, 0, 0)
  return { kind: '30d', from, to, label: 'Ultimi 30 giorni' }
}

function DashboardTab({ restaurant, deviceToken, onSessionExpired }) {
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(null)
  const [discount, setDiscount] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [range, setRange] = useState(defaultRange)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setStatsError(null)
      try {
        // 1) Stats via ranged RPC
        const statsPromise = supabase.rpc('verify_dashboard_stats_range', {
          p_restaurant_id: restaurant.id,
          p_device_token: deviceToken,
          p_from: range.from.toISOString(),
          p_to: range.to.toISOString(),
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

        // 3) Recent activity via SECURITY DEFINER RPC — after the 2026-04
        //    security hardening, anon users can no longer SELECT foreign
        //    redemptions directly. The RPC authenticates the device token
        //    and returns only rows belonging to this restaurant.
        const activityPromise = supabase.rpc('verify_activity_list', {
          p_restaurant_id: restaurant.id,
          p_device_token: deviceToken,
          p_limit: 10,
        })

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
          // Surface the underlying error detail on-screen so the issue is
          // diagnosable without opening the browser console (useful on
          // mobile). Formats: { code, message, details } for postgrest errors.
          const detail =
            reason?.code
              ? `${reason.code}${reason.message ? ' — ' + reason.message : ''}`
              : reason?.message || (typeof reason === 'string' ? reason : 'errore sconosciuto')
          setStatsError(`Statistiche non disponibili: ${detail}`)
          // Fallback stats derived from activity within the selected range
          // Fallback stats derived from activity rows within the selected range
          const actValue = activityRes.status === 'fulfilled' ? activityRes.value?.data : null
          setStats(buildFallbackStats(actValue?.items || null, range))
        }

        setDiscount(discountRes.status === 'fulfilled' ? (discountRes.value?.data || null) : null)

        // Activity feed — the RPC already joins profiles server-side and
        // falls back to discount_redemptions.user_name when profiles is
        // unreadable, so no client-side enrichment is needed.
        let activityRows = []
        if (activityRes.status === 'fulfilled') {
          const val = activityRes.value?.data
          if (val?.error === 'unauthorized') {
            onSessionExpired?.()
            return
          }
          activityRows = Array.isArray(val?.items) ? val.items : []
        }
        if (!cancelled) setActivity(activityRows)
      } catch (e) {
        if (!cancelled) {
          console.error('dashboard load error', e)
          setStatsError('Errore di rete')
          setStats(buildFallbackStats(null, range))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [restaurant.id, deviceToken, reloadKey, onSessionExpired, range])

  return (
    <div style={{ padding: '20px 16px 80px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Range picker always visible, even while loading */}
      <RangePicker range={range} onChange={setRange} />

      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-ink-55)' }}>
          <div
            style={{
              width: 28,
              height: 28,
              border: '3px solid var(--color-line)',
              borderTopColor: 'var(--color-corallo)',
              borderRadius: '50%',
              margin: '0 auto 12px',
              animation: 'verifySpin 0.8s linear infinite',
            }}
          />
          <div style={{ fontSize: 12 }}>Caricamento statistiche…</div>
        </div>
      ) : (
        <>
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
          <StatGrid stats={stats} range={range} />
          <div className="verify-dashboard-main">
            <div className="verify-dashboard-col">
              {discount && <ActiveDiscountCard discount={discount} />}
              <FunnelCard stats={stats} range={range} />
            </div>
            <div className="verify-dashboard-col">
              <ActivityList activity={activity} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function buildFallbackStats(activityData, range) {
  const list = Array.isArray(activityData) ? activityData : []
  const fromTs = range?.from ? new Date(range.from).getTime() : 0
  const toTs = range?.to ? new Date(range.to).getTime() : Date.now()
  const inRange = (iso) => {
    if (!iso) return false
    const t = new Date(iso).getTime()
    return t >= fromTs && t <= toTs
  }
  const gen = list.filter((r) => inRange(r.generated_at)).length
  const used = list.filter((r) => r.status === 'redeemed' && inRange(r.redeemed_at)).length
  const usedTotal = list.filter((r) => r.status === 'redeemed').length
  return {
    views: 0,
    saves: 0,
    redemptions_generated: gen,
    redemptions_used: used,
    views_total: 0,
    saves_total: 0,
    redemptions_total: list.length,
    redemptions_used_total: usedTotal,
  }
}

function StatGrid({ stats, range }) {
  if (!stats) return null
  const rangeLabel = range?.label || 'Periodo selezionato'
  const cards = [
    {
      label: 'Visualizzazioni',
      value: stats.views || 0,
      sublabel: `${stats.views_total || 0} in totale`,
      icon: '👁',
      color: '#6366F1',
    },
    {
      label: 'Salvati',
      value: stats.saves || 0,
      sublabel: `${stats.saves_total || 0} in totale`,
      icon: '♥',
      color: '#EC4899',
    },
    {
      label: 'Sconti generati',
      value: stats.redemptions_generated || 0,
      sublabel: rangeLabel,
      icon: '✦',
      color: '#F59E0B',
    },
    {
      label: 'Sconti usati',
      value: stats.redemptions_used || 0,
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
            background: 'var(--color-card)',
            borderRadius: 14,
            padding: '16px 16px 14px',
            border: '1px solid #F0EAE0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: c.color,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>{c.icon}</span>
            <span>{c.label}</span>
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--color-ink)',
              lineHeight: 1,
              letterSpacing: -0.5,
            }}
          >
            {c.value.toLocaleString('it-IT')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-ink-55)', marginTop: 6 }}>{c.sublabel}</div>
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
  const value = formatDiscountValue(discount)
  const pct =
    discount.max_redemptions && discount.max_redemptions > 0
      ? Math.min(100, ((discount.total_redeemed || 0) / discount.max_redemptions) * 100)
      : null
  const days = daysUntil(discount.valid_until)
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--color-ink) 0%, #3A2A30 100%)',
        color: '#fff',
        borderRadius: 'var(--radius-lg)',
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-corallo)',
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Sconto attivo
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{value}</div>
        <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.9 }}>{discount.title}</div>
      </div>
      {discount.description && (
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 14, lineHeight: 1.45 }}>
          {discount.description}
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, fontSize: 12, opacity: 0.9 }}>
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
              background: 'var(--color-corallo)',
              transition: 'width 0.4s',
            }}
          />
        </div>
      )}
    </div>
  )
}

function FunnelCard({ stats, range }) {
  if (!stats) return null
  const steps = [
    { label: 'Visualizzazioni', value: stats.views || 0, color: '#6366F1' },
    { label: 'Salvati', value: stats.saves || 0, color: '#EC4899' },
    { label: 'Sconti generati', value: stats.redemptions_generated || 0, color: '#F59E0B' },
    { label: 'Sconti usati', value: stats.redemptions_used || 0, color: '#10B981' },
  ]
  const max = Math.max(...steps.map((s) => s.value), 1)
  const funnelLabel = range?.label ? `Andamento — ${range.label}` : 'Andamento'

  return (
    <div
      style={{
        background: 'var(--color-card)',
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
        border: '1px solid #F0EAE0',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--color-ink-55)',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        {funnelLabel}
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
                  fontSize: 13,
                  marginBottom: 5,
                }}
              >
                <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{s.label}</span>
                <span style={{ color: s.color, fontWeight: 700 }}>{s.value}</span>
              </div>
              <div style={{ height: 8, background: 'var(--color-cream)', borderRadius: 4, overflow: 'hidden' }}>
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
          background: 'var(--color-card)',
          borderRadius: 16,
          padding: '24px 18px',
          border: '1px solid #F0EAE0',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-ink-55)',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Attività recente
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-ink-55)' }}>
          Nessuno sconto ancora generato.
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--color-card)',
        borderRadius: 16,
        border: '1px solid #F0EAE0',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--color-ink-55)',
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
  const actionLabel = isRedeemed ? 'Validato sconto' : 'Generato sconto'
  const userName = (item.user_name || '').trim()
  const discountTitle = item.discount?.title || ''
  // Primary line: prefer the person's name since that's what the restaurant
  // owner wants to see at a glance (e.g. "Validato sconto — Beatrice")
  const primary = userName
    ? `${actionLabel} — ${userName}`
    : `${actionLabel}${discountTitle ? ' · ' + discountTitle : ''}`
  // Secondary line: discount title when we already showed the name, plus time.
  const secondaryParts = []
  if (userName && discountTitle) secondaryParts.push(discountTitle)
  if (when) secondaryParts.push(when)
  const secondary = secondaryParts.join(' · ')
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '10px 16px',
        borderTop: '1px solid #F5F1EA',
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: isRedeemed ? '#10B981' : '#F59E0B',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {isRedeemed ? '✓' : '•'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-ink)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {primary}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-ink-55)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {secondary}
        </div>
      </div>
    </div>
  )
}
