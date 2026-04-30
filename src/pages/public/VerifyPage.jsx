import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import './VerifyPage.css'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'
import InvalidNowResult from '../../components/Verify/InvalidNowResult'
import SuccessResult from '../../components/Verify/SuccessResult'
import AlreadyUsedResult from '../../components/Verify/AlreadyUsedResult'

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
const LOCKOUT_KEY = 'cb_ristoratori_lockout'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 10 * 60 * 1000

function readLockout() {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY)
    if (!raw) return { attempts: 0, lockedUntil: 0 }
    const parsed = JSON.parse(raw)
    return {
      attempts: Number(parsed.attempts) || 0,
      lockedUntil: Number(parsed.lockedUntil) || 0,
    }
  } catch {
    return { attempts: 0, lockedUntil: 0 }
  }
}

function writeLockout(data) {
  try { localStorage.setItem(LOCKOUT_KEY, JSON.stringify(data)) } catch {}
}

function clearLockout() {
  try { localStorage.removeItem(LOCKOUT_KEY) } catch {}
}

/* ------------------------------------------------------------------ */
/*  PIN logo header shared across all 3 states                        */
/* ------------------------------------------------------------------ */
function PinLogo() {
  return (
    <div style={{ textAlign: 'center', marginTop: 16 }}>
      <div style={{ fontFamily: 'var(--font-mark)', fontSize: 18, letterSpacing: '.02em', lineHeight: 1 }}>
        LA GUIDA DI BI
      </div>
      <div style={{
        fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 10,
        letterSpacing: '.14em', color: 'var(--color-corallo)', marginTop: 4, textTransform: 'uppercase',
      }}>
        Area ristoratori
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  VerifyPage                                                         */
/* ------------------------------------------------------------------ */
export default function VerifyPage() {
  // 'loading' → controllo cookie iniziale
  // 'pin'     → mostra schermata PIN
  // 'authed'  → autenticato, mostra header + tab (step 3+)
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading')
  const [restaurant, setRestaurant] = useState(null)
  // Pre-popola il PIN dal query param ?pin= (es. dalla mail di benvenuto)
  const [pin, setPin] = useState(() => {
    const p = searchParams.get('pin') || ''
    return /^\d{1,6}$/.test(p) ? p : ''
  })
  const [error, setError] = useState(null)
  const [shake, setShake] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isPinWrong, setIsPinWrong] = useState(false)
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS)
  const [lockedUntil, setLockedUntil] = useState(() => readLockout().lockedUntil)
  const [nowTs, setNowTs] = useState(() => Date.now())

  useEffect(() => {
    if (!lockedUntil || lockedUntil <= Date.now()) return
    const id = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [lockedUntil])

  const isLocked = lockedUntil > nowTs
  const lockoutRemainingSec = isLocked ? Math.ceil((lockedUntil - nowTs) / 1000) : 0

  /* ---- Init: controlla cookie ---- */
  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!isSupabaseConfigured()) {
        setStatus('pin')
        return
      }
      const cookieToken = getCookie(COOKIE_NAME)
      if (!cookieToken) {
        // Magic-link auto-login: ?token=<uuid>&pin=<6digits> from email CTA
        const urlToken = searchParams.get('token')
        const urlPin = searchParams.get('pin')
        if (urlToken && urlPin && /^\d{6}$/.test(urlPin)) {
          try {
            const { data, error } = await supabase.rpc('verify_magic_token', {
              p_token: urlToken,
              p_pin: urlPin,
            })
            if (cancelled) return
            if (!error && data?.length > 0) {
              // Token valid — hand off to PIN login (creates device cookie, shows dashboard)
              setStatus('pin')
              handleSubmit(urlPin)
              return
            }
            if (!cancelled) {
              setError('Link scaduto o non valido. Inserisci il PIN manualmente.')
              setPin(urlPin)
            }
          } catch {
            if (!cancelled) setPin(urlPin)
          }
        }
        if (!cancelled) setStatus('pin')
        return
      }
      const token = cookieToken
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
    const current = readLockout()
    if (current.lockedUntil > Date.now()) {
      setLockedUntil(current.lockedUntil)
      return
    }
    if (!isSupabaseConfigured()) {
      setError('Non riesco a parlare con il server. Controlla la connessione e riprova.')
      return
    }
    setSubmitting(true)
    setError(null)
    setIsPinWrong(false)

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
        triggerError(true)
        return
      }

      const r = loginData.restaurant
      const token = loginData.device_token

      if (!r || !token) {
        triggerError(false)
        return
      }

      clearLockout()
      setLockedUntil(0)
      setIsPinWrong(false)
      setAttemptsRemaining(MAX_ATTEMPTS)
      setCookie(COOKIE_NAME, token, COOKIE_DAYS)
      setRestaurant(normalizeRestaurant(r))
      setPin('')
      setStatus('authed')
      setSubmitting(false)
    } catch (e) {
      console.error(e)
      triggerError(false)
    }
  }

  const triggerError = (isPin) => {
    const state = readLockout()
    const nextAttempts = state.attempts + 1
    if (nextAttempts >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_MS
      writeLockout({ attempts: nextAttempts, lockedUntil: until })
      setLockedUntil(until)
      setIsPinWrong(false)
      setError(null)
    } else {
      writeLockout({ attempts: nextAttempts, lockedUntil: 0 })
      const remaining = MAX_ATTEMPTS - nextAttempts
      setAttemptsRemaining(remaining)
      if (isPin) {
        setIsPinWrong(true)
        setError(null)
      } else {
        setIsPinWrong(false)
        setError('Non riesco a parlare con il server. Controlla la connessione e riprova.')
      }
    }
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
        isLocked={isLocked}
        lockoutRemainingSec={lockoutRemainingSec}
        isPinWrong={isPinWrong}
        attemptsRemaining={attemptsRemaining}
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
/*  PIN View — v4 reskin (CP1 · CP2 · CP3)                           */
/* ------------------------------------------------------------------ */
function PinView({
  pin, setPin, error, shake, submitting, onSubmit,
  isLocked = false, lockoutRemainingSec = 0,
  isPinWrong = false, attemptsRemaining = MAX_ATTEMPTS,
}) {
  const isDesktop = useIsDesktop()

  // "wrong" state: PIN was incorrect and user hasn't started typing again
  const isWrong = isPinWrong && pin.length === 0

  const bgNormal = 'linear-gradient(180deg,var(--color-page) 0%,var(--color-cream) 100%)'
  const bgWrong  = 'linear-gradient(180deg,var(--color-corallo-wash) 0%,var(--color-page) 100%)'
  const bgLocked = 'linear-gradient(180deg,var(--color-corallo-wash) 0%,var(--color-page) 60%)'
  const bg = isLocked ? bgLocked : isWrong ? bgWrong : bgNormal

  // Desktop keyboard support — digits + Backspace
  useEffect(() => {
    const onKey = (e) => {
      if (isLocked || submitting) return
      if (/^[0-9]$/.test(e.key)) {
        setPin(prev => (prev + e.key).slice(0, PIN_LENGTH))
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1))
      } else if (e.key === 'Enter') {
        // Submit only when 6 digits entered; access via callback ref to current pin
        // (handled by the dedicated submit button below; Enter mirrors that button)
        const evt = new Event('verify-pin-submit')
        window.dispatchEvent(evt)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLocked, submitting, setPin])

  // Submit when the dispatched event fires AND pin is complete
  useEffect(() => {
    const onSubmitEvent = () => {
      if (isLocked || submitting) return
      if (pin.length === PIN_LENGTH) onSubmit(pin)
    }
    window.addEventListener('verify-pin-submit', onSubmitEvent)
    return () => window.removeEventListener('verify-pin-submit', onSubmitEvent)
  }, [isLocked, submitting, pin, onSubmit])

  const onPad = (k) => {
    if (isLocked || submitting) return
    if (k === 'del') {
      setPin(p => p.slice(0, -1))
    } else {
      setPin(p => (p + k).slice(0, PIN_LENGTH))
    }
  }

  const handleSubmitClick = () => {
    if (isLocked || submitting) return
    if (pin.length === PIN_LENGTH) onSubmit(pin)
  }

  const mins = Math.floor(lockoutRemainingSec / 60)
  const secs = String(lockoutRemainingSec % 60).padStart(2, '0')

  /* ---- LOCKED state ---- */
  if (isLocked) {
    const lockedInner = (
      <div style={{
        background: bg,
        padding: `24px 28px ${isDesktop ? '28px' : 'max(24px, env(safe-area-inset-bottom))'}`,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        ...(isDesktop ? {} : { height: '100%', boxSizing: 'border-box' }),
      }}>
        <PinLogo />
        <div style={{
          margin: '40px auto 18px', width: 84, height: 84, borderRadius: 26,
          background: 'var(--color-corallo)', color: '#fff',
          display: 'grid', placeItems: 'center', fontSize: 34,
          boxShadow: '0 14px 32px rgba(232,69,60,.32)',
        }}>🔒</div>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em' }}>
            Accesso bloccato
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-ink-55)', fontWeight: 700, marginTop: 2 }}>
            Area ristoratori
          </div>
        </div>
        <div style={{
          textAlign: 'center', fontSize: 13, color: 'var(--color-ink)',
          fontWeight: 600, lineHeight: 1.5, margin: '18px 12px 0',
        }}>
          Troppi PIN sbagliati.<br />
          L&apos;accesso è bloccato per <b>15 minuti</b>,<br />
          oppure chiama Bi per ri-generare un PIN nuovo.
        </div>
        <a href="mailto:info@chiamamibi.com" style={{
          background: '#fff', border: '1px solid var(--color-line)', borderRadius: 16,
          padding: 14, margin: '22px 0 0',
          display: 'flex', alignItems: 'center', gap: 12,
          textDecoration: 'none', color: 'inherit',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--color-corallo)', color: '#fff',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-mark)', fontSize: 15, flexShrink: 0,
          }}>B</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Bi · Augusto</div>
            <div style={{ fontSize: 11, color: 'var(--color-ink-55)', fontWeight: 600 }}>
              info@chiamamibi.com
            </div>
          </div>
          <div style={{ background: '#E8F5D8', color: '#2C7A4A', borderRadius: 12, padding: '8px 10px', fontSize: 16 }}>
            ☎
          </div>
        </a>
        <div style={{
          textAlign: 'center', marginTop: 'auto', paddingTop: 20,
          fontSize: 12, color: 'var(--color-ink-55)', fontWeight: 600,
        }}>
          Sblocco automatico in <b style={{ color: 'var(--color-ink)' }}>{mins}:{secs}</b>
        </div>
      </div>
    )
    if (isDesktop) {
      return (
        <div style={{
          minHeight: '100dvh', background: 'var(--color-page)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            width: '100%', maxWidth: 420, borderRadius: 20, overflow: 'hidden',
            border: '1px solid var(--color-line)', boxShadow: '0 12px 32px rgba(34,24,28,.12)',
          }}>
            {lockedInner}
          </div>
        </div>
      )
    }
    return <div style={{ height: '100dvh', overflow: 'hidden' }}>{lockedInner}</div>
  }

  /* ---- NORMAL / WRONG state ---- */
  const normalInner = (
    <div style={{
      background: bg,
      padding: `24px 28px ${isDesktop ? '28px' : 'max(24px, env(safe-area-inset-bottom))'}`,
      display: 'flex', flexDirection: 'column',
      ...(isDesktop ? {} : { height: '100%', boxSizing: 'border-box' }),
    }}>
      <PinLogo />

      {/* Avatar — "B" placeholder (restaurant unknown pre-auth) */}
      <div style={{
        width: 76, height: 76, borderRadius: 22,
        background: 'var(--color-ink)', color: '#fff',
        display: 'grid', placeItems: 'center',
        fontFamily: 'var(--font-mark)', fontSize: 30,
        margin: '30px auto 14px',
        boxShadow: '0 14px 32px rgba(34,24,28,.2)',
      }}>B</div>

      {/* Name + zone */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em' }}>
          Area ristoratori
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-ink-55)', fontWeight: 700, marginTop: 2 }}>
          La Guida di Bi
        </div>
      </div>

      {/* Hint / wrong label */}
      <div style={{
        textAlign: 'center',
        color: isWrong ? 'var(--color-corallo)' : 'var(--color-ink-55)',
        fontSize: 12, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase',
        margin: '14px 0 18px',
      }}>
        {isWrong ? 'PIN errato · riprova' : 'inserisci le 6 cifre'}
      </div>

      {/* Dots */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 11, margin: '10px 0 18px',
        animation: shake ? 'pinShake .4s' : 'none',
      }}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < pin.length
          return (
            <div key={i} style={{
              width: 15, height: 15, borderRadius: '50%',
              border: `2px solid ${isWrong ? 'var(--color-corallo)' : filled ? 'var(--color-ink)' : 'var(--color-line)'}`,
              background: isWrong ? 'var(--color-corallo)' : filled ? 'var(--color-ink)' : 'transparent',
              transition: '.15s',
            }} />
          )
        })}
      </div>

      {/* Attempt counter (wrong state only) */}
      {isWrong && attemptsRemaining > 0 && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-ink-55)', fontWeight: 700, marginBottom: 14 }}>
          {attemptsRemaining} {attemptsRemaining === 1 ? 'tentativo rimasto' : 'tentativi rimasti'} prima del blocco temporaneo
        </div>
      )}

      {/* Network / generic error */}
      {error && !isWrong && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-corallo)', fontWeight: 600, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Keypad 3×4 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12,
        marginTop: isDesktop ? 8 : 'auto',
      }}>
        {['1','2','3','4','5','6','7','8','9','spc','0','del'].map((k, idx) => {
          if (k === 'spc') return <div key={idx} />
          const isDel = k === 'del'
          return (
            <button key={idx} type="button" onClick={() => onPad(isDel ? 'del' : k)} style={{
              background: isDel ? 'transparent' : '#fff',
              border: isDel ? 'none' : '1px solid var(--color-line)',
              borderRadius: 18, padding: 18, textAlign: 'center',
              fontFamily: 'var(--font-sans)', fontWeight: 800,
              fontSize: isDel ? 20 : 26, letterSpacing: '-0.02em',
              color: isDel ? 'var(--color-ink-55)' : 'var(--color-ink)',
              cursor: 'pointer', lineHeight: 1,
              boxShadow: isDel ? 'none' : '0 2px 6px rgba(0,0,0,.02)',
            }}>
              {isDel ? '⌫' : k}
            </button>
          )
        })}
      </div>

      {/* Submit button — Accedi */}
      <button
        type="button"
        onClick={handleSubmitClick}
        disabled={pin.length !== PIN_LENGTH || submitting}
        style={{
          width: '100%',
          marginTop: 14,
          padding: '15px 16px',
          border: 0,
          borderRadius: 14,
          background: pin.length === PIN_LENGTH && !submitting ? 'var(--color-corallo)' : 'var(--color-line)',
          color: pin.length === PIN_LENGTH && !submitting ? '#fff' : 'var(--color-ink-55)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: '-0.01em',
          cursor: pin.length === PIN_LENGTH && !submitting ? 'pointer' : 'not-allowed',
          boxShadow: pin.length === PIN_LENGTH && !submitting ? '0 8px 20px rgba(232,69,60,.28)' : 'none',
          transition: 'all 0.15s',
        }}
      >
        {submitting ? 'Verifica…' : 'Accedi'}
      </button>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--color-ink-55)', fontWeight: 600 }}>
        PIN dimenticato?{' '}
        <a href="mailto:info@chiamamibi.com" style={{ color: 'var(--color-ink)', fontWeight: 800, textDecoration: 'underline' }}>
          Chiama Bi
        </a>
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <div style={{
        minHeight: '100dvh', background: 'var(--color-page)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          width: '100%', maxWidth: 420, borderRadius: 20, overflow: 'hidden',
          border: '1px solid var(--color-line)', boxShadow: '0 12px 32px rgba(34,24,28,.12)',
        }}>
          {normalInner}
        </div>
      </div>
    )
  }
  return <div style={{ height: '100dvh', overflow: 'hidden' }}>{normalInner}</div>
}

/* ------------------------------------------------------------------ */
/*  AuthedView — shell mobile (v4-verify) + scanner overlay          */
/* ------------------------------------------------------------------ */
function AuthedView({ restaurant, onLogout, deviceToken, onSessionExpired }) {
  const [tab, setTab] = useState('dashboard')
  const isDesktop = useIsDesktop()

  // Quando l'utente chiude il scanner, torna alla dashboard
  const closeScanner = () => setTab('dashboard')
  const openScanner = () => setTab('scan')

  if (isDesktop) {
    return (
      <DesktopShell
        restaurant={restaurant}
        onLogout={onLogout}
        deviceToken={deviceToken}
        onSessionExpired={onSessionExpired}
        tab={tab}
        onTabChange={setTab}
        onOpenScanner={openScanner}
        onCloseScanner={closeScanner}
      />
    )
  }

  // Quando si è nel tab Scansiona, mostra l'overlay full-bleed
  if (tab === 'scan') {
    return <ScannerOverlay restaurant={restaurant} onClose={closeScanner} />
  }

  return (
    <div className="v4-shell">
      <VerifyTopBar restaurant={restaurant} onLogout={onLogout} />
      <VerifyPillTabs tab={tab} onChange={setTab} />
      <div className="v4-content">
        {tab === 'dashboard' && (
          <DashboardTab
            restaurant={restaurant}
            deviceToken={deviceToken}
            onSessionExpired={onSessionExpired}
            onOpenScanner={openScanner}
          />
        )}
        {tab === 'impostazioni' && (
          <ImpostazioniTab
            restaurant={restaurant}
            deviceToken={deviceToken}
            onLogout={onLogout}
            onSessionExpired={onSessionExpired}
          />
        )}
      </div>
      {tab === 'dashboard' && <FloatingScanCTA onClick={openScanner} />}
    </div>
  )
}

/* Mobile top bar (cream) — wordmark + ristorante + avatar+esci */
function VerifyTopBar({ restaurant, onLogout }) {
  const firstPhoto = restaurant?.photos?.[0]
  const photoUrl = firstPhoto
    ? proxyImg(firstPhoto.thumb_url || firstPhoto.photo_url)
    : null
  const initial = (restaurant?.name || 'B').trim().charAt(0).toUpperCase()

  return (
    <div className="v4-top">
      <div className="v4-top-logo">
        LA GUIDA DI BI
        <small>{restaurant?.name || 'Area ristoratori'}</small>
      </div>
      <div className="v4-top-avgroup">
        <div className="v4-top-av" aria-hidden="true">
          {photoUrl ? <img src={photoUrl} alt="" loading="lazy" /> : initial}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="v4-top-exit"
          aria-label="Esci"
          title="Esci dall'area ristoratori"
        >
          Esci
        </button>
      </div>
    </div>
  )
}

/* Camera icon (SVG) — usato in CTA, tab bar, e desktop sidebar */
function CameraIcon({ size = 22, color = 'currentColor' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

/* Pill tab bar — 3 tab (Dashboard / Scansiona / Impostazioni) */
const V4_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'scan', label: 'Scansiona' },
  { key: 'impostazioni', label: 'Impostazioni' },
]

function VerifyPillTabs({ tab, onChange }) {
  return (
    <div className="v4-tabs" role="tablist">
      {V4_TABS.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={tab === t.key}
          className={`v4-tab ${tab === t.key ? 'on' : ''}`}
          onClick={() => onChange(t.key)}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* Floating scan CTA — corallo, fixed at bottom */
function FloatingScanCTA({ onClick }) {
  return (
    <button
      type="button"
      className="v4-scan-cta"
      onClick={onClick}
      aria-label="Scansiona QR"
    >
      <span className="ic" aria-hidden="true">
        <CameraIcon size={22} color="#fff" />
      </span>
      <span className="body">
        <span className="t">Scansiona il QR</span>
        <span className="s">Verifica lo sconto del cliente</span>
      </span>
      <span className="arr" aria-hidden="true">›</span>
    </button>
  )
}

/* Impostazioni — dati locale (email + orari), cambio PIN, contatto Bi, logout */
function ImpostazioniTab({ restaurant, deviceToken, onLogout, onSessionExpired }) {
  const [email, setEmail] = useState('')
  const [hours, setHours] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [metaMsg, setMetaMsg] = useState(null) // { kind, text }
  const [loadingMeta, setLoadingMeta] = useState(true)

  const [pinCur, setPinCur] = useState('')
  const [pinNew, setPinNew] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  const [pinMsg, setPinMsg] = useState(null) // { kind, text }

  // Carica email + orari attuali
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('email, opening_hours')
          .eq('id', restaurant.id)
          .maybeSingle()
        if (cancelled) return
        if (error) {
          console.warn('load meta error', error)
        }
        setEmail(data?.email || '')
        // opening_hours puรฒ essere stringa o JSON: lo mostriamo come testo
        if (data?.opening_hours) {
          setHours(typeof data.opening_hours === 'string' ? data.opening_hours : JSON.stringify(data.opening_hours, null, 2))
        }
      } catch (e) {
        console.warn('load meta failed', e)
      } finally {
        if (!cancelled) setLoadingMeta(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [restaurant.id])

  const handleSaveMeta = async () => {
    setSavingMeta(true)
    setMetaMsg(null)
    try {
      const { data, error } = await supabase.rpc('verify_update_restaurant_meta', {
        p_device_token: deviceToken,
        p_email: email || null,
        p_opening_hours: hours || null,
      })
      if (error) {
        if (String(error.message || '').match(/function .* does not exist/i)) {
          setMetaMsg({ kind: 'warn', text: 'Funzione in arrivo: contatta Bi per aggiornare i dati.' })
        } else {
          setMetaMsg({ kind: 'err', text: error.message || 'Errore nel salvataggio' })
        }
        return
      }
      if (data?.error === 'unauthorized') { onSessionExpired?.(); return }
      if (data?.error) {
        setMetaMsg({ kind: 'err', text: data.error })
        return
      }
      setMetaMsg({ kind: 'ok', text: 'Modifiche salvate' })
    } catch (e) {
      console.error('save meta error', e)
      setMetaMsg({ kind: 'err', text: e?.message || 'Errore di rete' })
    } finally {
      setSavingMeta(false)
    }
  }

  const handleChangePin = async () => {
    setPinMsg(null)
    if (!/^\d{6}$/.test(pinCur)) {
      setPinMsg({ kind: 'err', text: 'Il PIN attuale deve essere di 6 cifre' })
      return
    }
    if (!/^\d{6}$/.test(pinNew)) {
      setPinMsg({ kind: 'err', text: 'Il nuovo PIN deve essere di 6 cifre' })
      return
    }
    if (pinNew !== pinConfirm) {
      setPinMsg({ kind: 'err', text: 'Il nuovo PIN e la conferma non coincidono' })
      return
    }
    if (pinNew === pinCur) {
      setPinMsg({ kind: 'err', text: 'Il nuovo PIN deve essere diverso da quello attuale' })
      return
    }
    setSavingPin(true)
    try {
      const { data, error } = await supabase.rpc('verify_change_pin', {
        p_device_token: deviceToken,
        p_current_pin: pinCur,
        p_new_pin: pinNew,
      })
      if (error) {
        if (String(error.message || '').match(/function .* does not exist/i)) {
          setPinMsg({ kind: 'warn', text: 'Funzione in arrivo: contatta Bi per cambiare il PIN.' })
        } else {
          setPinMsg({ kind: 'err', text: error.message || 'Errore nel cambio PIN' })
        }
        return
      }
      if (data?.error === 'unauthorized') { onSessionExpired?.(); return }
      if (data?.error === 'wrong_pin') {
        setPinMsg({ kind: 'err', text: 'Il PIN attuale non è corretto' })
        return
      }
      if (data?.error) {
        setPinMsg({ kind: 'err', text: data.error })
        return
      }
      setPinMsg({ kind: 'ok', text: 'PIN aggiornato. Usalo dal prossimo accesso.' })
      setPinCur(''); setPinNew(''); setPinConfirm('')
    } catch (e) {
      console.error('change pin error', e)
      setPinMsg({ kind: 'err', text: e?.message || 'Errore di rete' })
    } finally {
      setSavingPin(false)
    }
  }

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Dati locale */}
      <div className="v4-set-section">
        <div className="v4-set-section-head">Dati locale</div>
        <div className="v4-set-card v4-set-form">
          <label className="v4-set-field">
            <span className="lab">Nome</span>
            <input className="inp" value={restaurant?.name || ''} disabled />
          </label>
          <label className="v4-set-field">
            <span className="lab">Indirizzo</span>
            <input className="inp" value={restaurant?.address || ''} disabled />
          </label>
          <label className="v4-set-field">
            <span className="lab">Email del locale</span>
            <input
              className="inp"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@nomeristorante.it"
              disabled={loadingMeta || savingMeta}
            />
          </label>
          <label className="v4-set-field">
            <span className="lab">Orari di apertura</span>
            <textarea
              className="inp"
              rows={4}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder={'Es: Lun–Ven 19:30–23:30 · Sab/Dom anche pranzo 12:30–14:30'}
              disabled={loadingMeta || savingMeta}
            />
          </label>
          {metaMsg && (
            <div className={`v4-set-msg ${metaMsg.kind}`}>{metaMsg.text}</div>
          )}
          <button
            type="button"
            className="v4-set-save"
            onClick={handleSaveMeta}
            disabled={loadingMeta || savingMeta}
          >
            {savingMeta ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </div>

      {/* Cambio PIN */}
      <div className="v4-set-section">
        <div className="v4-set-section-head">Cambia il PIN di accesso</div>
        <div className="v4-set-card v4-set-form">
          <label className="v4-set-field">
            <span className="lab">PIN attuale</span>
            <input
              className="inp v4-pin-inp"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              value={pinCur}
              onChange={(e) => setPinCur(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
            />
          </label>
          <label className="v4-set-field">
            <span className="lab">Nuovo PIN</span>
            <input
              className="inp v4-pin-inp"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={pinNew}
              onChange={(e) => setPinNew(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 cifre"
            />
          </label>
          <label className="v4-set-field">
            <span className="lab">Conferma nuovo PIN</span>
            <input
              className="inp v4-pin-inp"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="ripeti il nuovo PIN"
            />
          </label>
          {pinMsg && (
            <div className={`v4-set-msg ${pinMsg.kind}`}>{pinMsg.text}</div>
          )}
          <button
            type="button"
            className="v4-set-save"
            onClick={handleChangePin}
            disabled={savingPin}
          >
            {savingPin ? 'Aggiornamento…' : 'Aggiorna PIN'}
          </button>
        </div>
      </div>

      {/* Contatto Bi */}
      <div className="v4-set-section">
        <div className="v4-set-section-head">Hai bisogno di aiuto?</div>
        <div className="v4-set-card">
          <a className="v4-set-row" href="mailto:info@chiamamibi.com">
            <span className="ic">B</span>
            <span className="body">
              <span className="t">Bi · Augusto</span>
              <span className="s">info@chiamamibi.com</span>
            </span>
            <span className="arr">›</span>
          </a>
        </div>
      </div>

      {/* Esci */}
      <div className="v4-set-section">
        <div className="v4-set-card">
          <button className="v4-set-row danger" type="button" onClick={onLogout}>
            <span className="ic">⏻</span>
            <span className="body">
              <span className="t">Esci da quest&apos;area</span>
              <span className="s">Dovrai re-inserire il PIN per rientrare</span>
            </span>
            <span className="arr">›</span>
          </button>
        </div>
      </div>
    </div>
  )
}


/* Stub Scanner overlay — wrappa VerifyTab in overlay nero con close.
   Sostituito con versione full-bleed black + corner brackets nel commit successivo. */
function ScannerOverlay({ restaurant, onClose }) {
  const [mode, setMode] = useState('camera') // 'camera' | 'manual'
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // { status, reason, data }
  const [camStatus, setCamStatus] = useState('starting') // 'starting' | 'running' | 'no-camera' | 'denied' | 'error'
  const [camError, setCamError] = useState(null)
  const [torchOn, setTorchOn] = useState(false)
  const videoRef = useRef(null)
  const scannerRef = useRef(null)
  const lastScanRef = useRef({ code: null, at: 0 })
  const inputRef = useRef(null)

  // Lock body scroll while overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const verifyCode = async (rawCode) => {
    const trimmed = extractQrCode(rawCode)
    if (!trimmed || loading) return
    setLoading(true)
    try {
      const token = getCookie(COOKIE_NAME)
      if (!token) {
        setResult({ status: 'error', data: { message: 'Sessione scaduta, rientra con il PIN.' } })
        return
      }
      const { data: resp, error: rpcErr } = await supabase.rpc('verify_redeem_qr', {
        p_device_token: token,
        p_qr_code: trimmed,
      })
      if (rpcErr || !resp) {
        setResult({ status: 'error', data: { message: rpcErr?.message || 'Errore di rete, riprova' } })
        return
      }
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
        try { navigator.vibrate?.([40, 60, 40]) } catch { /* no-op */ }
      }
      if (resp.status === 'unauthorized') {
        deleteCookie(COOKIE_NAME)
        setResult({ status: 'error', data: { message: 'Sessione non valida, rientra con il PIN.' } })
        return
      }
      setResult({ status: resp.status, reason: resp.reason, data: normalized })
    } catch (err) {
      console.error('verify error:', err)
      setResult({ status: 'error', data: { message: err?.message || 'Errore di rete, riprova' } })
    } finally {
      setLoading(false)
    }
  }

  // Camera scanner setup — runs only when camera mode is active and no result is showing
  useEffect(() => {
    if (mode !== 'camera' || result) return undefined
    let cancelled = false
    let scanner = null

    async function start() {
      let QrScanner
      try {
        const mod = await import('qr-scanner')
        QrScanner = mod.default
      } catch (e) {
        console.error('Failed to load qr-scanner', e)
        if (!cancelled) {
          setCamStatus('error')
          setCamError('Impossibile caricare lo scanner')
        }
        return
      }
      if (cancelled || !videoRef.current) return

      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        try {
          const perm = await navigator.permissions.query({ name: 'camera' })
          if (!cancelled && perm.state === 'denied') {
            setCamStatus('denied')
            return
          }
        } catch { /* not supported, continue */ }
      }
      try {
        const hasCamera = await QrScanner.hasCamera()
        if (!hasCamera) { if (!cancelled) setCamStatus('no-camera'); return }
      } catch { /* continue */ }

      scanner = new QrScanner(
        videoRef.current,
        (res) => {
          const scanned = typeof res === 'string' ? res : res?.data
          if (!scanned) return
          const now = Date.now()
          if (lastScanRef.current.code === scanned && now - lastScanRef.current.at < 2500) return
          lastScanRef.current = { code: scanned, at: now }
          verifyCode(scanned)
        },
        { preferredCamera: 'environment', highlightScanRegion: false, highlightCodeOutline: false, maxScansPerSecond: 5 },
      )
      scannerRef.current = scanner
      try {
        await scanner.start()
        if (!cancelled) setCamStatus('running')
      } catch (e) {
        console.error('Camera start failed', e)
        if (cancelled) return
        const msg = String(e?.message || e?.name || '').toLowerCase()
        if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) setCamStatus('denied')
        else if (msg.includes('notfound') || msg.includes('no camera')) setCamStatus('no-camera')
        else { setCamStatus('error'); setCamError(e?.message || 'Impossibile avviare la fotocamera') }
      }
    }
    start()
    return () => {
      cancelled = true
      if (scannerRef.current) {
        try { scannerRef.current.stop(); scannerRef.current.destroy() } catch { /* no-op */ }
        scannerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, result])

  // Pause scanner during loading verify
  useEffect(() => {
    const s = scannerRef.current
    if (!s) return
    if (loading) {
      try { s.stop() } catch { /* no-op */ }
    } else if (camStatus === 'running' && mode === 'camera' && !result) {
      s.start().catch(() => {})
    }
  }, [loading, camStatus, mode, result])

  // Toggle torch (flashlight) — supported on mobile cameras with track capabilities
  const toggleTorch = async () => {
    const s = scannerRef.current
    if (!s) return
    try {
      const next = !torchOn
      if (s.hasFlash && (await s.hasFlash())) {
        if (next) await s.turnFlashOn(); else await s.turnFlashOff()
        setTorchOn(next)
      }
    } catch (e) {
      console.warn('torch toggle failed', e)
    }
  }

  // Auto-focus manual input when switching to manual mode
  useEffect(() => {
    if (mode === 'manual' && !result) setTimeout(() => inputRef.current?.focus(), 50)
  }, [mode, result])

  const resetForNextScan = () => {
    setCode('')
    setResult(null)
    lastScanRef.current = { code: null, at: 0 }
    setMode('camera')
  }

  const handleManualSubmit = (e) => {
    e?.preventDefault?.()
    verifyCode(code)
  }

  // ============ RESULT MODE ============
  if (result) {
    return (
      <div className="v4-scan-overlay" role="dialog" aria-label="Esito verifica">
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          overflow: 'auto', padding: 0,
        }}>
          <ScanResultView
            result={result}
            onReset={resetForNextScan}
            onClose={onClose}
          />
        </div>
      </div>
    )
  }

  // ============ CAMERA / MANUAL MODE ============
  return (
    <div className="v4-scan-overlay" role="dialog" aria-label="Scansiona QR">
      <div className="v4-scan-cam">
        {mode === 'camera' && (camStatus === 'starting' || camStatus === 'running') && (
          <video ref={videoRef} playsInline muted />
        )}
      </div>

      {/* Top bar — close + title + flash */}
      <div className="v4-scan-top">
        <button
          type="button"
          className="v4-scan-icon-btn"
          onClick={onClose}
          aria-label="Chiudi scanner"
        >
          ✕
        </button>
        <div className="v4-scan-title">{mode === 'manual' ? 'Inserisci il codice' : 'Scansiona il QR'}</div>
        {mode === 'camera' && camStatus === 'running' ? (
          <button
            type="button"
            className={`v4-scan-icon-btn ${torchOn ? 'on' : ''}`}
            onClick={toggleTorch}
            aria-label="Torcia"
          >
            ⚡
          </button>
        ) : (
          <span style={{ width: 40, height: 40, flex: '0 0 auto' }} aria-hidden="true" />
        )}
      </div>

      {/* CAMERA mode: scan window + hint + bottom buttons */}
      {mode === 'camera' && (
        <>
          {(camStatus === 'starting' || camStatus === 'running') && (
            <>
              <div className="v4-scan-window">
                <div className="v4-scan-corner tl" />
                <div className="v4-scan-corner tr" />
                <div className="v4-scan-corner bl" />
                <div className="v4-scan-corner br" />
                <div className="v4-scan-line" />
              </div>
              <div className="v4-scan-hint">
                <div className="h1">Inquadra il QR del cliente</div>
                <div className="h2">Il codice è nella sua app, dentro la scheda del tuo ristorante</div>
              </div>
              <div className="v4-scan-bottom">
                <button type="button" className="v4-scan-btn" onClick={() => setMode('manual')}>
                  ⌨︎  Inserisci codice
                </button>
                <a className="v4-scan-btn" href="mailto:info@chiamamibi.com" style={{ textDecoration: 'none' }}>
                  ?  Aiuto
                </a>
              </div>
              {camStatus === 'starting' && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 4, background: 'rgba(0,0,0,0.4)', color: '#fff',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 28, height: 28, border: '3px solid rgba(255,255,255,0.2)',
                      borderTopColor: '#fff', borderRadius: '50%', margin: '0 auto 8px',
                      animation: 'verifySpin 0.8s linear infinite',
                    }} />
                    Avvio fotocamera…
                  </div>
                </div>
              )}
              {loading && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 4, background: 'rgba(0,0,0,0.65)', color: '#fff',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 28, height: 28, border: '3px solid rgba(255,255,255,0.2)',
                      borderTopColor: '#fff', borderRadius: '50%', margin: '0 auto 10px',
                      animation: 'verifySpin 0.8s linear infinite',
                    }} />
                    <div style={{ fontWeight: 700 }}>Verifica in corso…</div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Camera fallbacks: denied / no-camera / error */}
          {(camStatus === 'denied' || camStatus === 'no-camera' || camStatus === 'error') && (
            <div className="v4-scan-fallback">
              <div className="ic">
                {camStatus === 'denied' && '🚫'}
                {camStatus === 'no-camera' && '📷'}
                {camStatus === 'error' && '⚠️'}
              </div>
              <div className="t">
                {camStatus === 'denied' && 'Fotocamera bloccata'}
                {camStatus === 'no-camera' && 'Nessuna fotocamera'}
                {camStatus === 'error' && 'Errore fotocamera'}
              </div>
              <div className="d">
                {camStatus === 'denied' && 'Autorizza l\'accesso alla fotocamera nelle impostazioni del browser, oppure usa l\'inserimento manuale.'}
                {camStatus === 'no-camera' && 'Questo dispositivo non espone una fotocamera utilizzabile. Inserisci il codice manualmente.'}
                {camStatus === 'error' && (camError || 'Impossibile avviare la fotocamera. Usa l\'inserimento manuale.')}
              </div>
              <button
                type="button"
                onClick={() => setMode('manual')}
                style={{
                  marginTop: 18, padding: '14px 22px', borderRadius: 14,
                  background: 'var(--color-corallo)', color: '#fff', border: 0,
                  fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 14,
                  letterSpacing: '-0.01em', cursor: 'pointer',
                }}
              >
                Inserisci codice manualmente
              </button>
            </div>
          )}
        </>
      )}

      {/* MANUAL mode: full-screen black input form */}
      {mode === 'manual' && (
        <form className="v4-scan-manual" onSubmit={handleManualSubmit}>
          <h2>Inserisci il codice</h2>
          <p>
            Scrivi il codice{' '}
            <code style={{ color: '#fff', fontWeight: 700 }}>BiSc-XXXXXXXX</code>
            {' '}mostrato sotto il QR del cliente.
          </p>
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
          />
          <button
            type="submit"
            className="submit"
            disabled={!code.trim() || loading}
          >
            {loading ? 'Verifica…' : 'Verifica sconto'}
          </button>
          <button
            type="button"
            onClick={() => { setCode(''); setMode('camera') }}
            style={{
              marginTop: 14, padding: 12, background: 'transparent', border: 0,
              color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            ← Torna alla fotocamera
          </button>
        </form>
      )}
    </div>
  )
}

/* ScanResultView — wrapper sui componenti Result esistenti, con close-on-success */
function ScanResultView({ result, onReset, onClose }) {
  const { status, data } = result
  const handleReset = () => {
    if (status === 'success') {
      // Su successo, dopo "Fatto" chiudo direttamente l'overlay invece di tornare a scansionare
      onClose?.()
    } else {
      onReset?.()
    }
  }
  if (status === 'success') return <SuccessResult data={data} onReset={handleReset} />
  if (status === 'invalid_now') return <InvalidNowResult data={data} reason={result?.reason || data?.reason} onReset={handleReset} />
  if (status === 'already_redeemed') return <AlreadyUsedResult data={data} onReset={handleReset} />
  if (status === 'expired') {
    return <ResultCard tone="neutral" icon="⏱" title="Sconto scaduto"
      description="La data di validità di questo sconto è passata."
      onReset={handleReset} resetLabel="Nuova verifica" />
  }
  if (status === 'wrong_restaurant') {
    return <ResultCard tone="error" icon="✕" title="Codice non valido per questo ristorante"
      description="Questo QR appartiene a uno sconto di un altro locale."
      onReset={handleReset} resetLabel="Nuova verifica" />
  }
  if (status === 'not_found') {
    return <ResultCard tone="error" icon="✕" title="Codice non riconosciuto"
      description="Controlla che il codice sia scritto correttamente."
      onReset={handleReset} resetLabel="Riprova" />
  }
  return <ResultCard tone="error" icon="✕" title="Errore"
    description={data?.message || 'Si è verificato un errore.'}
    onReset={handleReset} resetLabel="Riprova" />
}

/* Desktop placeholder shell — usa la stessa struttura mobile per ora.
   Sostituito con sidebar back-office nel commit successivo. */
function DesktopShell({
  restaurant, onLogout, deviceToken, onSessionExpired,
  tab, onTabChange, onOpenScanner, onCloseScanner,
}) {
  const firstPhoto = restaurant?.photos?.[0]
  const photoUrl = firstPhoto ? proxyImg(firstPhoto.thumb_url || firstPhoto.photo_url) : null
  const initial = (restaurant?.name || 'B').trim().charAt(0).toUpperCase()

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '◈' },
    { key: 'scan', label: 'Scansiona', iconNode: <CameraIcon size={16} />, action: onOpenScanner },
    { key: 'impostazioni', label: 'Impostazioni', icon: '⚙' },
  ]

  return (
    <div className="v4-dsk-shell">
      <aside className="v4-dsk-side">
        <div className="v4-dsk-wm">
          LA GUIDA<br />DI BI
          <small>Area ristoratori</small>
        </div>
        {navItems.map((n) => (
          <button
            key={n.key}
            type="button"
            className={`v4-dsk-ni ${tab === n.key ? 'on' : ''}`}
            onClick={() => (n.action ? n.action() : onTabChange(n.key))}
          >
            <span className="ic">{n.iconNode || n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
        <div className="v4-dsk-user">
          <div className="av" aria-hidden="true">
            {photoUrl ? <img src={photoUrl} alt="" loading="lazy" /> : initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="u" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {restaurant?.name || '—'}
            </div>
            <button
              type="button"
              onClick={onLogout}
              style={{
                background: 'transparent', border: 0, padding: 0, marginTop: 2,
                color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', textAlign: 'left', textDecoration: 'underline',
              }}
            >
              Esci
            </button>
          </div>
        </div>
      </aside>

      <main className="v4-dsk-main">
        {tab === 'dashboard' && (
          <DesktopDashboard
            restaurant={restaurant}
            deviceToken={deviceToken}
            onSessionExpired={onSessionExpired}
            onOpenScanner={onOpenScanner}
          />
        )}
        {tab === 'impostazioni' && (
          <>
            <div className="v4-dsk-crumb">{restaurant?.name || '—'}</div>
            <h1 className="v4-dsk-title">Impostazioni</h1>
            <div className="v4-dsk-sub">
              <span className="meta">Dati locale, PIN, contatto Bi</span>
            </div>
            <div style={{ maxWidth: 560 }}>
              <ImpostazioniTab
                restaurant={restaurant}
                deviceToken={deviceToken}
                onLogout={onLogout}
                onSessionExpired={onSessionExpired}
              />
            </div>
          </>
        )}
      </main>

      {tab === 'scan' && (
        <ScannerOverlay restaurant={restaurant} onClose={onCloseScanner} />
      )}
    </div>
  )
}

/* Desktop Dashboard — hero verde + scan tile + 4-col stats + storico expandable */
function DesktopDashboard({ restaurant, deviceToken, onSessionExpired, onOpenScanner }) {
  const [stats, setStats] = useState(null)
  const [discount, setDiscount] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [statsError, setStatsError] = useState(null)
  const [range, setRange] = useState(defaultRange)
  const [storicoOpen, setStoricoOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const statsPromise = supabase.rpc('verify_dashboard_stats_range', {
          p_restaurant_id: restaurant.id,
          p_device_token: deviceToken,
          p_from: range.from.toISOString(),
          p_to: range.to.toISOString(),
        })
        const discountPromise = supabase
          .from('discounts')
          .select('id, title, description, discount_type, discount_value, valid_from, valid_until, max_redemptions, total_redeemed, is_active, is_drop, drop_starts_at, drop_ends_at, max_quantity, claimed_count, valid_days, valid_meal_slots, valid_time_from, valid_time_to, conditions')
          .eq('restaurant_id', restaurant.id)
          .eq('is_active', true)
          .gt('valid_until', new Date().toISOString())
          .order('valid_until', { ascending: true })
          .limit(1)
          .maybeSingle()
        const activityPromise = supabase.rpc('verify_activity_list', {
          p_restaurant_id: restaurant.id,
          p_device_token: deviceToken,
          p_limit: 10,
        })
        const [statsRes, discountRes, activityRes] = await Promise.allSettled([
          statsPromise, discountPromise, activityPromise,
        ])
        if (cancelled) return
        const statsValue = statsRes.status === 'fulfilled' ? statsRes.value : null
        if (statsValue?.data?.error === 'unauthorized') { onSessionExpired?.(); return }
        if (statsRes.status === 'fulfilled' && !statsValue?.error && statsValue?.data) {
          setStats(statsValue.data)
        } else {
          setStatsError('Statistiche non disponibili')
          const actVal = activityRes.status === 'fulfilled' ? activityRes.value?.data : null
          setStats(buildFallbackStats(actVal?.items || null, range))
        }
        setDiscount(discountRes.status === 'fulfilled' ? (discountRes.value?.data || null) : null)
        let activityRows = []
        if (activityRes.status === 'fulfilled') {
          const val = activityRes.value?.data
          if (val?.error === 'unauthorized') { onSessionExpired?.(); return }
          activityRows = Array.isArray(val?.items) ? val.items : []
        }
        if (!cancelled) setActivity(activityRows)
      } catch (e) {
        if (!cancelled) console.error('desktop dashboard load error', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id, deviceToken, range])

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-ink-55)' }}>
        <div style={{
          width: 36, height: 36,
          border: '3px solid var(--color-line)', borderTopColor: 'var(--color-corallo)',
          borderRadius: '50%', margin: '0 auto 14px',
          animation: 'verifySpin 0.8s linear infinite',
        }} />
        Caricamento dashboard…
      </div>
    )
  }

  const discountValue = discount ? formatDiscountValue(discount) : null
  const today = new Date()
  const dayLabel = today.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const todayCount = (activity || []).filter((a) => {
    if (a.status !== 'redeemed') return false
    const ts = a.redeemed_at ? new Date(a.redeemed_at).getTime() : 0
    return ts >= startOfToday.getTime()
  }).length

  return (
    <>
      <div className="v4-dsk-crumb">
        {restaurant?.name || '—'}{restaurant?.address ? ` · ${restaurant.address}` : ''}
      </div>
      <h1 className="v4-dsk-title">Ciao 👋</h1>
      <div className="v4-dsk-sub">
        <span>{dayLabel}</span>
        <span className="dot" />
        <span className="meta">
          {todayCount} {todayCount === 1 ? 'verifica OK oggi' : 'verifiche OK oggi'}
        </span>
      </div>

      <div style={{ maxWidth: 480, marginBottom: 18 }}>
        <RangePicker range={range} onChange={setRange} />
      </div>

      {statsError && (
        <div style={{
          background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10,
          padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400E',
        }}>⚠ {statsError}</div>
      )}

      <div className="v4-dsk-grid">
        {discount ? (
          <div className="v4-dsk-hero">
            <div className="lab">● SCONTO ATTIVO</div>
            <div className="val">{discountValue}</div>
            <div className="cond">{[discount.title, discount.description].filter(Boolean).join(' · ')}</div>
          </div>
        ) : (
          <div className="v4-dsk-hero" style={{ background: 'linear-gradient(135deg, var(--color-cream-deep), var(--color-cream))', color: 'var(--color-ink)' }}>
            <div className="lab" style={{ color: 'var(--color-ink-55)' }}>● NESSUNO SCONTO ATTIVO</div>
            <div className="val">—</div>
            <div className="cond">Quando Bi attiva uno sconto sulla tua scheda lo vedi qui.</div>
          </div>
        )}

        <button type="button" className="v4-dsk-scan-tile" onClick={onOpenScanner}>
          <div className="l">Azione principale</div>
          <h3>Scansiona il QR</h3>
          <div className="p">Il cliente ti mostra il QR dalla sua app, tu lo scansioni dal tuo telefono.</div>
          <div className="btn">Apri scanner →</div>
        </button>
      </div>

      <Stats4 stats={stats} range={range} />

      <div className="v4-dsk-card" style={{ marginTop: 8 }}>
        <h4>
          Ultime verifiche
          <button
            type="button"
            className="all"
            onClick={() => setStoricoOpen((v) => !v)}
          >
            {storicoOpen ? 'Riduci ↑' : 'Mostra tutto ↓'}
          </button>
        </h4>
        {storicoOpen ? (
          <ExpandableStorico
            restaurant={restaurant}
            deviceToken={deviceToken}
            onSessionExpired={onSessionExpired}
          />
        ) : (
          <V4ActivityLog items={(activity || []).slice(0, 6)} emptyLabel="Nessuna verifica ancora." />
        )}
      </div>
    </>
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
  const [storicoOpen, setStoricoOpen] = useState(false)

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
          .select('id, title, description, discount_type, discount_value, valid_from, valid_until, max_redemptions, total_redeemed, is_active, is_drop, drop_starts_at, drop_ends_at, max_quantity, claimed_count, valid_days, valid_meal_slots, valid_time_from, valid_time_to, conditions')
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

  if (loading) {
    return (
      <div style={{ padding: '40px 20px 100px', textAlign: 'center', color: 'var(--color-ink-55)' }}>
        <div
          style={{
            width: 28, height: 28,
            border: '3px solid var(--color-line)',
            borderTopColor: 'var(--color-corallo)',
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
    <>
      {statsError && (
        <div
          style={{
            background: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 12,
            fontSize: 12,
            color: '#92400E',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}
        >
          <span>⚠ {statsError}</span>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            style={{
              background: 'transparent', border: '1px solid #FCD34D', color: '#92400E',
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
            }}
          >
            Riprova
          </button>
        </div>
      )}

      <RangePicker range={range} onChange={setRange} />
      <ScontoHero discount={discount} />
      <Stats4 stats={stats} range={range} />

      <div className="v4-section-lbl">
        Ultime verifiche
        <button
          type="button"
          className="all"
          onClick={() => setStoricoOpen((v) => !v)}
        >
          {storicoOpen ? 'Riduci ↑' : 'Mostra tutto ↓'}
        </button>
      </div>

      {storicoOpen ? (
        <ExpandableStorico
          restaurant={restaurant}
          deviceToken={deviceToken}
          onSessionExpired={onSessionExpired}
        />
      ) : (
        <V4ActivityLog
          items={(activity || []).slice(0, 5)}
          emptyLabel="Nessuna verifica ancora."
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  v4 — Dashboard presentational components                          */
/* ------------------------------------------------------------------ */
function ScontoHero({ discount }) {
  if (!discount) {
    return (
      <div className="v4-sconto-hero" style={{ background: 'linear-gradient(135deg, var(--color-cream-deep), var(--color-cream))', color: 'var(--color-ink)' }}>
        <div className="lab" style={{ color: 'var(--color-ink-55)' }}>● NESSUNO SCONTO ATTIVO</div>
        <div className="val" style={{ fontSize: 24, marginTop: 8 }}>—</div>
        <div className="cond" style={{ color: 'var(--color-ink-55)' }}>
          Quando Bi attiva uno sconto sulla tua scheda, lo vedi qui.
        </div>
      </div>
    )
  }
  const value = formatDiscountValue(discount)
  const isDrop = !!discount.is_drop
  const typeLabel = isDrop ? 'DROP · TEMPO LIMITATO' : 'SCONTO ATTIVO'

  const limit = isDrop ? discount.max_quantity : discount.max_redemptions
  const used  = isDrop ? (discount.claimed_count || 0) : (discount.total_redeemed || 0)
  const hasProgress = limit && limit > 0
  const pct = hasProgress ? Math.min(100, Math.round((used / limit) * 100)) : null

  const startIso = isDrop ? discount.drop_starts_at : discount.valid_from
  const endIso   = isDrop ? discount.drop_ends_at   : discount.valid_until
  const validityLine = formatValidity(startIso, endIso)
  const daysLine = formatValidDays(discount.valid_days)
  const slotLine = formatTimeSlots(discount.valid_time_from, discount.valid_time_to, discount.valid_meal_slots)

  const conditionsList = (discount.conditions || '')
    .split(/\n+/).map((s) => s.trim()).filter(Boolean)

  return (
    <div className={`v4-sconto-hero v4-sconto-hero--rich ${isDrop ? 'is-drop' : ''}`}>
      <div className="lab">{isDrop ? '◉' : '●'} {typeLabel}</div>
      <div className="val">{value}</div>
      {discount.title && <div className="ttl">{discount.title}</div>}
      {discount.description && <div className="cond">{discount.description}</div>}

      {(validityLine || daysLine || slotLine) && (
        <div className="v4-sconto-meta">
          {validityLine && (
            <div className="v4-sconto-metarow">
              <CalIcon /><span>{validityLine}</span>
            </div>
          )}
          {daysLine && (
            <div className="v4-sconto-metarow">
              <DaysIcon /><span>{daysLine}</span>
            </div>
          )}
          {slotLine && (
            <div className="v4-sconto-metarow">
              <ClockIcon /><span>{slotLine}</span>
            </div>
          )}
        </div>
      )}

      {hasProgress && (
        <div className="v4-sconto-progress">
          <div className="v4-sconto-progress-head">
            <span>{isDrop ? 'Posti rimasti' : 'Utilizzi'}</span>
            <span>
              <b>{isDrop ? Math.max(0, limit - used) : used}</b>
              {isDrop ? ` / ${limit}` : ` / ${limit}`}
            </span>
          </div>
          <div className="v4-sconto-progress-track">
            <div className="v4-sconto-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {conditionsList.length > 0 && (
        <ul className="v4-sconto-conditions">
          {conditionsList.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
    </div>
  )
}

/* ScontoHero icons (small inline SVG) */
function CalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
function DaysIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <line x1="2" y1="11" x2="22" y2="11" />
      <line x1="7" y1="6" x2="7" y2="20" />
      <line x1="12" y1="6" x2="12" y2="20" />
      <line x1="17" y1="6" x2="17" y2="20" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

/* ScontoHero formatting helpers */
function formatValidity(startIso, endIso) {
  const fmt = (iso) => iso
    ? new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const start = fmt(startIso)
  const end = fmt(endIso)
  if (start && end) return `Dal ${start} al ${end}`
  if (end) return `Valido fino al ${end}`
  if (start) return `Valido dal ${start}`
  return null
}

const SCONTO_DAY_NAMES_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
function formatValidDays(days) {
  if (!Array.isArray(days) || days.length === 0 || days.length === 7) return null
  // valid_days schema: 1=Mon..7=Sun. Convert to JS Date getDay() (0=Sun..6=Sat).
  const idxs = days.map((d) => (d === 7 ? 0 : d)).sort((a, b) => a - b)
  const isContig = idxs.every((v, i) => i === 0 || v - idxs[i - 1] === 1)
  if (isContig && idxs.length > 1) {
    return `${SCONTO_DAY_NAMES_IT[idxs[0]]}–${SCONTO_DAY_NAMES_IT[idxs[idxs.length - 1]]}`
  }
  return idxs.map((d) => SCONTO_DAY_NAMES_IT[d]).join(' · ')
}

const SCONTO_MEAL_LABELS_IT = {
  colazione: 'Colazione',
  brunch: 'Brunch',
  pranzo: 'Pranzo',
  aperitivo: 'Aperitivo',
  cena: 'Cena',
}
function formatTimeSlots(from, to, mealSlots) {
  if (from && to) {
    const trim = (t) => String(t).slice(0, 5)
    return `${trim(from)}–${trim(to)}`
  }
  if (Array.isArray(mealSlots) && mealSlots.length > 0) {
    return mealSlots.map((s) => SCONTO_MEAL_LABELS_IT[s] || s).join(' · ')
  }
  return null
}

/* 4 KPI tiles — visite pagina / salvataggi / sconti presi / sconti usati */
function Stats4({ stats, range }) {
  const periodLabel = range?.label || 'Periodo selezionato'
  const tiles = [
    { v: stats?.views || 0,                 l: 'Visite pagina',  featured: false },
    { v: stats?.saves || 0,                 l: 'Salvataggi',     featured: false },
    { v: stats?.redemptions_generated || 0, l: 'Sconti presi',   featured: false },
    { v: stats?.redemptions_used || 0,      l: 'Sconti usati',   featured: true  },
  ]
  return (
    <div className="v4-stats4">
      <div className="v4-stats4-head">{periodLabel}</div>
      <div className="v4-stats4-grid">
        {tiles.map((t) => (
          <div key={t.l} className={`v4-stat ${t.featured ? 'featured' : ''}`}>
            <div className="lab">{t.l}</div>
            <div className="val">{Number(t.v).toLocaleString('it-IT')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function relativeTimeIt(iso) {
  if (!iso) return ''
  const ts = new Date(iso).getTime()
  if (!ts) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (diffSec < 60) return 'adesso'
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60)
    return `${m} min fa`
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600)
    return `${h} h fa`
  }
  if (diffSec < 86400 * 2) return 'ieri'
  const d = Math.floor(diffSec / 86400)
  if (d < 7) return `${d} giorni fa`
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function V4ActivityRow({ item }) {
  const isRedeemed = item.status === 'redeemed'
  const date = isRedeemed ? item.redeemed_at : item.generated_at
  const time = date
    ? new Date(date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : ''
  const ago = relativeTimeIt(date)
  const userName = (item.user_name || '').trim() || 'Utente'
  const discountValue = formatDiscountValue(item.discount)
  const discountTitle = item.discount?.title || ''
  const primary = discountValue ? `${userName} · ${discountValue}` : userName
  const secondary = isRedeemed
    ? (discountTitle || 'Sconto riscattato')
    : (discountTitle ? `In attesa · ${discountTitle}` : 'In attesa')
  const icClass = isRedeemed ? '' : 'pending'
  const ic = isRedeemed ? '✓' : '•'
  return (
    <div className="v4-log-row">
      <div className={`v4-log-ic ${icClass}`}>{ic}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="n" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primary}</div>
        <div className="m" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary}</div>
      </div>
      <div className="t">
        {time}
        {ago && (<><br /><span style={{ color: '#9a8e84' }}>{ago}</span></>)}
      </div>
    </div>
  )
}

function V4ActivityLog({ items, emptyLabel = 'Nessuna attività' }) {
  if (!items || items.length === 0) {
    return (
      <div className="v4-log" style={{ padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--color-ink-55)', fontWeight: 600 }}>
          {emptyLabel}
        </div>
      </div>
    )
  }
  return (
    <div className="v4-log">
      {items.map((it) => <V4ActivityRow key={it.id} item={it} />)}
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


/* ------------------------------------------------------------------ */
/*  RangePicker — 7g / 30g / 12 mesi + custom calendar                */
/* ------------------------------------------------------------------ */
function buildPresetRange(kind) {
  const to = new Date()
  const from = new Date()
  if (kind === '7d') {
    from.setDate(from.getDate() - 7); from.setHours(0, 0, 0, 0)
    return { kind, from, to, label: 'Ultimi 7 giorni' }
  }
  if (kind === '30d') {
    from.setDate(from.getDate() - 30); from.setHours(0, 0, 0, 0)
    return { kind, from, to, label: 'Ultimi 30 giorni' }
  }
  if (kind === '365d') {
    from.setDate(from.getDate() - 365); from.setHours(0, 0, 0, 0)
    return { kind, from, to, label: 'Ultimi 12 mesi' }
  }
  return null
}

function formatShortDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function RangePicker({ range, onChange }) {
  const [showCal, setShowCal] = useState(false)
  const presets = [
    { kind: '7d', label: '7 giorni' },
    { kind: '30d', label: '30 giorni' },
    { kind: '365d', label: '12 mesi' },
  ]
  const isCustom = range?.kind === 'custom'
  return (
    <>
      <div className="v4-range">
        <div className="v4-range-presets" role="tablist">
          {presets.map((p) => (
            <button
              key={p.kind}
              type="button"
              role="tab"
              aria-selected={range?.kind === p.kind}
              className={`v4-range-preset ${range?.kind === p.kind ? 'on' : ''}`}
              onClick={() => onChange(buildPresetRange(p.kind))}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`v4-range-cal ${isCustom ? 'on' : ''}`}
          onClick={() => setShowCal(true)}
          aria-label="Periodo personalizzato"
          title="Periodo personalizzato"
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
          className="v4-range-custom-bar"
          onClick={() => setShowCal(true)}
        >
          <span className="l">Periodo selezionato</span>
          <span>{formatShortDate(range.from)} – {formatShortDate(range.to)}</span>
        </button>
      )}
      {showCal && (
        <CalendarRangeModal
          initialFrom={range?.from}
          initialTo={range?.to}
          onClose={() => setShowCal(false)}
          onApply={(from, to) => {
            const f = new Date(from); f.setHours(0, 0, 0, 0)
            const t = new Date(to); t.setHours(23, 59, 59, 999)
            onChange({
              kind: 'custom',
              from: f,
              to: t,
              label: `${formatShortDate(f)} – ${formatShortDate(t)}`,
            })
            setShowCal(false)
          }}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  CalendarRangeModal — compact one-month calendar bottom sheet      */
/* ------------------------------------------------------------------ */
const V4_WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const V4_MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

function v4DayTs(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function CalendarRangeModal({ initialFrom, initialTo, onClose, onApply }) {
  const [month, setMonth] = useState(() => {
    const base = initialFrom ? new Date(initialFrom) : new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const [from, setFrom] = useState(initialFrom ? new Date(initialFrom) : null)
  const [to, setTo] = useState(initialTo ? new Date(initialTo) : null)

  const handlePick = (d) => {
    if (!from || (from && to)) {
      setFrom(d); setTo(null); return
    }
    if (d < from) { setTo(from); setFrom(d) }
    else { setTo(d) }
  }

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const jsDay = first.getDay()
  const lead = jsDay === 0 ? 6 : jsDay - 1
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(first.getFullYear(), first.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)

  const fromTs = from ? v4DayTs(from) : null
  const toTs = to ? v4DayTs(to) : null
  const todayTs = v4DayTs(new Date())

  return (
    <div className="v4-cal-backdrop" onClick={onClose}>
      <div className="v4-cal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="v4-cal-head">
          <div className="t">Seleziona periodo</div>
          <button type="button" className="v4-cal-close" onClick={onClose} aria-label="Chiudi">×</button>
        </div>
        <div className="v4-cal-body">
          <div className="v4-cal-monthnav">
            <button
              type="button"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              aria-label="Mese precedente"
            >‹</button>
            <div className="lbl">{V4_MONTHS[month.getMonth()]} {month.getFullYear()}</div>
            <button
              type="button"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              aria-label="Mese successivo"
            >›</button>
          </div>
          <div className="v4-cal-summary">
            {from ? formatShortDate(from) : '—'} → {to ? formatShortDate(to) : '—'}
          </div>
          <div className="v4-cal-weekdays">
            {V4_WEEKDAYS.map((w, i) => <div key={i}>{w}</div>)}
          </div>
          <div className="v4-cal-grid">
            {cells.map((c, i) => {
              if (!c) return <button key={i} className="v4-cal-day empty" disabled />
              const ts = v4DayTs(c)
              const isFrom = fromTs === ts
              const isTo = toTs === ts
              const inRange = fromTs && toTs && ts >= Math.min(fromTs, toTs) && ts <= Math.max(fromTs, toTs)
              const isFuture = ts > todayTs
              const cls = isFrom || isTo ? 'edge' : (inRange ? 'in-range' : '')
              return (
                <button
                  key={i}
                  type="button"
                  className={`v4-cal-day ${cls}`}
                  onClick={() => handlePick(c)}
                  disabled={isFuture}
                >
                  {c.getDate()}
                </button>
              )
            })}
          </div>
        </div>
        <div className="v4-cal-foot">
          <button
            type="button"
            className="clear"
            onClick={() => { setFrom(null); setTo(null) }}
          >
            Azzera
          </button>
          <button
            type="button"
            className="apply"
            disabled={!(from && to)}
            onClick={() => onApply(from, to)}
          >
            Applica
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ExpandableStorico — versione inline della tab Storico            */
/* ------------------------------------------------------------------ */
function ExpandableStorico({ restaurant, deviceToken, onSessionExpired }) {
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | today | week | problems
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await supabase.rpc('verify_activity_list', {
          p_restaurant_id: restaurant.id,
          p_device_token: deviceToken,
          p_limit: 100,
        })
        if (cancelled) return
        if (data?.error === 'unauthorized') { onSessionExpired?.(); return }
        setActivity(Array.isArray(data?.items) ? data.items : [])
      } catch (e) {
        console.error('expandable storico load error', e)
        if (!cancelled) setActivity([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [restaurant.id, deviceToken, reloadKey, onSessionExpired])

  if (loading) {
    return (
      <div className="v4-log" style={{ padding: '20px 16px', textAlign: 'center' }}>
        <div style={{
          width: 22, height: 22,
          border: '2px solid var(--color-line)', borderTopColor: 'var(--color-corallo)',
          borderRadius: '50%', margin: '0 auto 8px',
          animation: 'verifySpin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 12, color: 'var(--color-ink-55)' }}>Caricamento storico…</div>
      </div>
    )
  }

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - 7)
  const filtered = activity.filter((a) => {
    const date = a.status === 'redeemed' ? a.redeemed_at : a.generated_at
    const ts = date ? new Date(date).getTime() : 0
    if (filter === 'today') return ts >= startOfToday.getTime()
    if (filter === 'week') return ts >= startOfWeek.getTime()
    if (filter === 'problems') return a.status !== 'redeemed'
    return true
  })

  const groups = {}
  filtered.forEach((a) => {
    const date = a.status === 'redeemed' ? a.redeemed_at : a.generated_at
    if (!date) return
    const d = new Date(date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!groups[key]) groups[key] = []
    groups[key].push(a)
  })
  const sortedKeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1))
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const yest = new Date(today); yest.setDate(yest.getDate() - 1)
  const yestKey = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`
  const labelForKey = (k) => {
    if (k === todayKey) return 'Oggi'
    if (k === yestKey) return 'Ieri'
    const [y, m, d] = k.split('-')
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
  }

  return (
    <>
      <div className="v4-chip-row">
        {[
          { k: 'all', l: 'Tutti' },
          { k: 'today', l: 'Oggi' },
          { k: 'week', l: '7 giorni' },
          { k: 'problems', l: 'Problemi' },
        ].map((c) => (
          <button
            key={c.k}
            type="button"
            className={`v4-chip ${filter === c.k ? 'on' : ''}`}
            onClick={() => setFilter(c.k)}
          >
            {c.l}
          </button>
        ))}
        <button
          type="button"
          className="v4-chip"
          onClick={() => setReloadKey((k) => k + 1)}
          aria-label="Aggiorna"
          title="Aggiorna"
          style={{ marginLeft: 'auto' }}
        >
          ↻
        </button>
      </div>
      {sortedKeys.length === 0 ? (
        <div className="v4-log" style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--color-ink-55)', fontWeight: 600 }}>
            Nessuna verifica nel filtro selezionato.
          </div>
        </div>
      ) : (
        sortedKeys.map((k) => (
          <div key={k}>
            <div className="v4-section-lbl">{labelForKey(k)}</div>
            <V4ActivityLog items={groups[k]} />
          </div>
        ))
      )}
    </>
  )
}
