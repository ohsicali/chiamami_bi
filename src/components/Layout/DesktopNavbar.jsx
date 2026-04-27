import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'

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

        {/* RIGHT: Search + City pill + Avatar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => navigate('/list?search=open')}
            aria-label="Cerca"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--color-ink-05)',
              display: 'grid',
              placeItems: 'center',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

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
