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
        setPin(prev => {
          const next = (prev + e.key).slice(0, PIN_LENGTH)
          if (next.length === PIN_LENGTH) setTimeout(() => onSubmit(next), 0)
          return next
        })
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLocked, submitting, setPin, onSubmit])

  const onPad = (k) => {
    if (isLocked || submitting) return
    if (k === 'del') {
      setPin(p => p.slice(0, -1))
    } else {
      setPin(p => {
        const next = (p + k).slice(0, PIN_LENGTH)
        if (next.length === PIN_LENGTH) setTimeout(() => onSubmit(next), 0)
        return next
      })
    }
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
  const [scanning, setScanning] = useState(false)
  const isDesktop = useIsDesktop()

  const openScanner = () => setScanning(true)
  const closeScanner = () => setScanning(false)

  if (isDesktop) {
    return (
      <DesktopShell
        restaurant={restaurant}
        onLogout={onLogout}
        deviceToken={deviceToken}
        onSessionExpired={onSessionExpired}
        tab={tab}
        onTabChange={setTab}
        scanning={scanning}
        onOpenScanner={openScanner}
        onCloseScanner={closeScanner}
      />
    )
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
            onJumpToStorico={() => setTab('storico')}
          />
        )}
        {tab === 'storico' && (
          <StoricoTab
            restaurant={restaurant}
            deviceToken={deviceToken}
            onSessionExpired={onSessionExpired}
          />
        )}
        {tab === 'impostazioni' && (
          <ImpostazioniTab restaurant={restaurant} onLogout={onLogout} />
        )}
      </div>
      {tab !== 'impostazioni' && <FloatingScanCTA onClick={openScanner} />}
      {scanning && (
        <ScannerOverlay
          restaurant={restaurant}
          onClose={closeScanner}
        />
      )}
    </div>
  )
}

/* Mobile top bar (cream) — wordmark + ristorante + avatar + logout */
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
      <button
        type="button"
        onClick={onLogout}
        className="v4-top-logout"
        aria-label="Esci"
      >
        Esci
      </button>
      <div className="v4-top-av" aria-hidden="true">
        {photoUrl ? <img src={photoUrl} alt="" loading="lazy" /> : initial}
      </div>
    </div>
  )
}

/* Pill tab bar — 3 tab (Dashboard / Storico / Impostazioni) */
const V4_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'storico', label: 'Storico' },
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
      <span className="ic" aria-hidden="true">⌑</span>
      <span className="body">
        <span className="t">Scansiona QR</span>
        <span className="s">Verifica lo sconto del cliente</span>
      </span>
      <span className="arr" aria-hidden="true">›</span>
    </button>
  )
}

/* Stub Impostazioni — sostituito con versione completa nel commit successivo */
function ImpostazioniTab({ restaurant, onLogout }) {
  return (
    <div style={{ paddingTop: 8 }}>
      <div className="v4-set-card">
        <a className="v4-set-row" href="mailto:info@chiamamibi.com">
          <span className="ic">B</span>
          <span className="body">
            <span className="t">Bi · Augusto</span>
            <span className="s">info@chiamamibi.com</span>
          </span>
          <span className="arr">›</span>
        </a>
        <div className="v4-set-row">
          <span className="ic">🏷</span>
          <span className="body">
            <span className="t">{restaurant?.name || '—'}</span>
            <span className="s">{restaurant?.address || ''}</span>
          </span>
        </div>
      </div>
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
  )
}

/* Storico tab — riepilogo + filtri + log raggruppato per data */
function StoricoTab({ restaurant, deviceToken, onSessionExpired }) {
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
        if (data?.error === 'unauthorized') {
          onSessionExpired?.()
          return
        }
        setActivity(Array.isArray(data?.items) ? data.items : [])
      } catch (e) {
        console.error('storico load error', e)
        if (!cancelled) setActivity([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [restaurant.id, deviceToken, reloadKey, onSessionExpired])

  // Riepilogo: tutti i record (no filtro applicato)
  const totalCount = activity.length
  const okCount = activity.filter((a) => a.status === 'redeemed').length
  const pendingCount = activity.filter((a) => a.status !== 'redeemed').length

  // Applico filtro periodo / problemi
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - 7)
  const filteredActivity = activity.filter((a) => {
    const date = a.status === 'redeemed' ? a.redeemed_at : a.generated_at
    const ts = date ? new Date(date).getTime() : 0
    if (filter === 'today') return ts >= startOfToday.getTime()
    if (filter === 'week') return ts >= startOfWeek.getTime()
    if (filter === 'problems') return a.status !== 'redeemed'
    return true
  })

  // Raggruppo per data (yyyy-mm-dd)
  const groups = {}
  filteredActivity.forEach((a) => {
    const date = a.status === 'redeemed' ? a.redeemed_at : a.generated_at
    if (!date) return
    const d = new Date(date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!groups[key]) groups[key] = []
    groups[key].push(a)
  })
  const sortedKeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1))
  const todayKey = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const yesterdayKey = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const labelForKey = (k) => {
    if (k === todayKey) return 'Oggi'
    if (k === yesterdayKey) return 'Ieri'
    const [y, m, d] = k.split('-')
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 20px 100px', textAlign: 'center', color: 'var(--color-ink-55)' }}>
        <div style={{
          width: 28, height: 28,
          border: '3px solid var(--color-line)',
          borderTopColor: 'var(--color-corallo)',
          borderRadius: '50%',
          margin: '0 auto 12px',
          animation: 'verifySpin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 12 }}>Caricamento storico…</div>
      </div>
    )
  }

  return (
    <>
      <div className="v4-rate-card" style={{ padding: 18 }}>
        <div className="v4-rate-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 28,
              letterSpacing: '-0.03em', lineHeight: 1,
            }}>{totalCount}</div>
            <div style={{
              fontSize: 11, color: 'var(--color-ink-55)', fontWeight: 700, marginTop: 4,
            }}>verifiche · ultime 100</div>
          </div>
        </div>
        <div className="v4-rate-tiles">
          <div className="v4-rate-tile">
            <div className="v">{okCount}</div>
            <div className="l">OK</div>
          </div>
          <div className="v4-rate-tile">
            <div className="v" style={{ color: 'var(--color-corallo)' }}>{pendingCount}</div>
            <div className="l">in attesa</div>
          </div>
          <div className="v4-rate-tile">
            <div className="v">
              {totalCount > 0 ? Math.round((okCount / totalCount) * 100) : 0}%
            </div>
            <div className="l">tasso ok</div>
          </div>
        </div>
      </div>

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
        <div className="v4-scan-title">{mode === 'manual' ? 'Inserisci codice' : 'Scansiona QR'}</div>
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
                  ⌨︎ Inserisci codice
                </button>
                <a className="v4-scan-btn" href="mailto:info@chiamamibi.com" style={{ textDecoration: 'none' }}>
                  ? Aiuto
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
          <h2>Inserisci codice</h2>
          <p>Scrivi il codice <code style={{ color: '#fff', fontWeight: 700 }}>BiSc-XXXXXXXX</code> mostrato sotto il QR del cliente</p>
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
  tab, onTabChange, scanning, onOpenScanner, onCloseScanner,
}) {
  return (
    <div className="v4-shell">
      <VerifyTopBar restaurant={restaurant} onLogout={onLogout} />
      <VerifyPillTabs tab={tab} onChange={onTabChange} />
      <div className="v4-content" style={{ maxWidth: 720 }}>
        {tab === 'dashboard' && (
          <DashboardTab
            restaurant={restaurant}
            deviceToken={deviceToken}
            onSessionExpired={onSessionExpired}
            onOpenScanner={onOpenScanner}
            onJumpToStorico={() => onTabChange('storico')}
          />
        )}
        {tab === 'storico' && (
          <StoricoTab
            restaurant={restaurant}
            deviceToken={deviceToken}
            onSessionExpired={onSessionExpired}
          />
        )}
        {tab === 'impostazioni' && (
          <ImpostazioniTab restaurant={restaurant} onLogout={onLogout} />
        )}
      </div>
      {tab !== 'impostazioni' && <FloatingScanCTA onClick={onOpenScanner} />}
      {scanning && (
        <ScannerOverlay restaurant={restaurant} onClose={onCloseScanner} />
      )}
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

function DashboardTab({ restaurant, deviceToken, onSessionExpired, onJumpToStorico }) {
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(null)
  const [discount, setDiscount] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  // Dashboard (v4) usa sempre 30 giorni: range picker spostato in Storico tab
  const [range] = useState(defaultRange)

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

      <ScontoHero discount={discount} />
      <StatPair activity={activity} stats={stats} />
      <RateCard stats={stats} />

      <div className="v4-section-lbl">
        Ultime verifiche
        {onJumpToStorico && (
          <button type="button" className="all" onClick={onJumpToStorico}>
            Storico →
          </button>
        )}
      </div>
      <V4ActivityLog items={(activity || []).slice(0, 5)} emptyLabel="Nessuna verifica ancora." />
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
  const cond = [discount.title, discount.description].filter(Boolean).join(' · ')
  return (
    <div className="v4-sconto-hero">
      <div className="lab">● SCONTO ATTIVO</div>
      <div className="val">{value}</div>
      {cond && <div className="cond">{cond}</div>}
    </div>
  )
}

function StatPair({ activity, stats }) {
  // "Oggi" deriva dalle attività riscattate oggi
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const startTs = startOfToday.getTime()
  const todayCount = (activity || []).filter((a) => {
    if (a.status !== 'redeemed') return false
    const ts = a.redeemed_at ? new Date(a.redeemed_at).getTime() : 0
    return ts >= startTs
  }).length

  // "30 giorni" arriva dalle stats range RPC
  const monthCount = stats?.redemptions_used || 0

  return (
    <div className="v4-stat-grid">
      <div className="v4-stat featured">
        <div className="lab">Oggi</div>
        <div className="val">{todayCount}</div>
        <div className="sub">{todayCount === 1 ? 'verifica OK' : 'verifiche OK'}</div>
      </div>
      <div className="v4-stat">
        <div className="lab">30 giorni</div>
        <div className="val">{monthCount}</div>
        <div className="sub">{monthCount === 1 ? 'verifica OK' : 'verifiche OK'}</div>
      </div>
    </div>
  )
}

function RateCard({ stats }) {
  if (!stats) return null
  const tiles = [
    { v: stats.views || 0, l: 'visite scheda' },
    { v: stats.saves || 0, l: 'salvataggi' },
    { v: stats.redemptions_used || 0, l: 'sconti usati' },
  ]
  return (
    <div className="v4-rate-card">
      <div className="v4-rate-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="v4-rate-title">Quanto ti cercano</div>
          <div className="v4-rate-sub">Attività sulla tua scheda · ultimi 30 giorni</div>
        </div>
      </div>
      <div className="v4-rate-tiles">
        {tiles.map((t) => (
          <div key={t.l} className="v4-rate-tile">
            <div className="v">{Number(t.v).toLocaleString('it-IT')}</div>
            <div className="l">{t.l}</div>
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
    return `${h}h fa`
  }
  if (diffSec < 86400 * 2) return 'ieri'
  const d = Math.floor(diffSec / 86400)
  if (d < 7) return `${d}g fa`
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

