import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import BiLogoMark from '../UI/BiLogoMark'

const NAV_ITEMS = [
  { to: '/', label: 'Home', match: (p) => p === '/' },
  { to: '/esplora', label: 'Esplora', match: (p) => p === '/esplora' || p === '/list' || p.startsWith('/restaurant/') },
  { to: '/deals', label: 'Sconti', match: (p) => p === '/deals', hasDot: true },
  { to: '/saved', label: 'Salvati', match: (p) => p === '/saved', requiresAuth: true },
]

export default function DesktopNavbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discounts } = useActiveDiscounts()

  const hasDeals = (discounts?.length || 0) > 0
  const initials = user ? (user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase() : null
  const isChiediActive = location.pathname === '/chiedi' || location.pathname.startsWith('/chiedi/')
  // City pill: solo nelle pagine Esplora (mappa + scheda ristorante). Altrove
  // non porta valore — la guida è Torino-only oggi.
  const showCityPill =
    location.pathname === '/esplora' ||
    location.pathname === '/list' ||
    location.pathname.startsWith('/restaurant/')

  return (
    <div
      className="hidden md:block"
      style={{
        position: 'sticky',
        top: 16,
        zIndex: 55,
        padding: '0 40px',
      }}
    >
      <nav
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          height: 68,
          background: 'rgba(255,255,255,.66)',
          backdropFilter: 'blur(22px) saturate(160%)',
          WebkitBackdropFilter: 'blur(22px) saturate(160%)',
          border: '1px solid rgba(255,255,255,.5)',
          borderRadius: 999,
          boxShadow: '0 8px 24px rgba(34,24,28,.08)',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 18,
          padding: '0 10px 0 22px',
        }}
      >
        {/* LEFT: Logo */}
        <Link to="/" style={{ display: 'flex', flexDirection: 'column', lineHeight: 0.92, textDecoration: 'none' }}>
          <span
            style={{
              fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
              fontSize: 18,
              letterSpacing: '0.02em',
              color: 'var(--color-corallo)',
            }}
          >
            LA GUIDA DI BI
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 9,
              letterSpacing: '0.18em',
              color: 'rgba(34,24,28,.4)',
              marginTop: 4,
              textTransform: 'uppercase',
            }}
          >
            by Chiamami Bi
          </span>
        </Link>

        {/* CENTER: Navigation links */}
        <div style={{ display: 'flex', gap: 2, justifySelf: 'center' }}>
          {NAV_ITEMS.map((item) => {
            const active = item.match(location.pathname)
            const showDot = item.hasDot && hasDeals
            return (
              <button
                key={item.to}
                onClick={() => {
                  if (item.requiresAuth && !user) navigate('/login')
                  else navigate(item.to)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  borderRadius: 999,
                  border: 'none',
                  background: active ? 'var(--color-ink-05)' : 'transparent',
                  color: active ? 'var(--color-ink)' : 'rgba(34,24,28,.7)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  position: 'relative',
                  transition: 'color .2s, background .2s',
                }}
              >
                {item.label}
                {showDot && (
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--color-corallo)',
                    position: 'absolute',
                    top: 8,
                    right: 8,
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* RIGHT: Chiedi a Bi + City pill + Avatar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* PR20b §2 — bottone "Chiedi a Bi" al posto della vecchia lente */}
          <button
            type="button"
            onClick={() => navigate('/chiedi')}
            aria-label="Chiedi a Bi"
            title="Chiedi a Bi"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 14px 5px 5px',
              borderRadius: 999,
              border: `1px solid ${isChiediActive ? 'var(--color-corallo)' : 'rgba(232,69,60,.22)'}`,
              background: isChiediActive ? 'rgba(232,69,60,.08)' : 'var(--color-ink-05)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'transform .15s ease, border-color .15s ease, background .15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <span
              style={{
                position: 'relative',
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-corallo) 0%, var(--color-corallo-ink, #B92E26) 100%)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 10px rgba(232,69,60,.3)',
                flexShrink: 0,
                overflow: 'visible',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                }}
              >
                <BiLogoMark style={{ width: '78%', height: '78%' }} />
              </span>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  width: 11,
                  height: 11,
                  background: 'var(--color-oro, #B08954)',
                  borderRadius: '50%',
                  border: '1.5px solid #fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 6,
                  color: '#fff',
                  fontWeight: 700,
                  lineHeight: 1,
                  zIndex: 2,
                }}
              >
                ✦
              </span>
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color-ink)',
                whiteSpace: 'nowrap',
              }}
            >
              Chiedi a Bi
            </span>
          </button>

          {showCityPill && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 14px',
                background: 'var(--color-ink-05)',
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-corallo)' }} />
              Torino
              <svg viewBox="0 0 10 10" width="10" height="10">
                <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {user ? (
            <Link
              to="/profile"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--color-ink)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
                fontSize: 18,
                textDecoration: 'none',
                marginLeft: 2,
              }}
            >
              {initials}
            </Link>
          ) : (
            <Link
              to="/login"
              style={{
                padding: '10px 18px',
                borderRadius: 999,
                background: 'var(--color-ink)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Accedi
            </Link>
          )}
        </div>
      </nav>
    </div>
  )
}
