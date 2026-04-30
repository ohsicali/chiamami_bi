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

/* Stub Storico — usa il DashboardTab esistente per ora; visual proper nel commit successivo */
function StoricoTab({ restaurant, deviceToken, onSessionExpired }) {
  return (
    <DashboardTab
      restaurant={restaurant}
      deviceToken={deviceToken}
      onSessionExpired={onSessionExpired}
    />
  )
}

/* Stub Scanner overlay — wrappa VerifyTab in overlay nero con close.
   Sostituito con versione full-bleed black + corner brackets nel commit successivo. */
function ScannerOverlay({ restaurant, onClose }) {
  // Lock body scroll while overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="v4-scan-overlay" role="dialog" aria-label="Scansiona QR">
      <div className="v4-scan-top">
        <button
          type="button"
          className="v4-scan-icon-btn"
          onClick={onClose}
          aria-label="Chiudi scanner"
        >
          ✕
        </button>
        <div className="v4-scan-title">Scansiona QR</div>
        <span style={{ width: 40, height: 40, flex: '0 0 auto' }} aria-hidden="true" />
      </div>
      <div style={{
        position: 'absolute',
        inset: 'max(80px, env(safe-area-inset-top)) 16px max(120px, env(safe-area-inset-bottom)) 16px',
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <VerifyTab restaurant={restaurant} onResultDone={onClose} />
        </div>
      </div>
    </div>
  )
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

      setResult({ status: resp.status, reason: resp.reason, data: normalized })
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
    return <SuccessResult data={data} onReset={onReset} />
  }

  if (status === 'invalid_now') {
    return <InvalidNowResult data={data} reason={result?.reason || data?.reason} onReset={onReset} />
  }

  if (status === 'already_redeemed') {
    return <AlreadyUsedResult data={data} onReset={onReset} />
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

