import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'

/* ------------------------------------------------------------------ */
/*  Small SVG icons                                                    */
/* ------------------------------------------------------------------ */
const ic = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

function ExploreIcon() {
  return (
    <svg {...ic} width={14} height={14} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}
function DealsIcon() {
  return (
    <svg {...ic} width={14} height={14} viewBox="0 0 24 24">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1" />
    </svg>
  )
}
function HeartIcon() {
  return (
    <svg {...ic} width={14} height={14} viewBox="0 0 24 24">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  )
}
function SearchIcon() {
  return (
    <svg {...ic} width={14} height={14} viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Nav items                                                          */
/* ------------------------------------------------------------------ */
const NAV_ITEMS = [
  { to: '/', label: 'Esplora', Icon: ExploreIcon, match: (p) => p === '/' || p === '/list' || p.startsWith('/restaurant/') },
  { to: '/deals', label: 'Sconti', Icon: DealsIcon, match: (p) => p === '/deals', hasDot: true },
  { to: '/saved', label: 'Salvati', Icon: HeartIcon, match: (p) => p === '/saved', requiresAuth: true },
]

/* ------------------------------------------------------------------ */
/*  DesktopNavbar                                                      */
/* ------------------------------------------------------------------ */
export default function DesktopNavbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discounts } = useActiveDiscounts()

  const hasDeals = (discounts?.length || 0) > 0
  const initials = user ? (user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase() : null

  return (
    <nav
      className="hidden md:flex"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        zIndex: 40,
        background: '#fff',
        borderBottom: '1px solid var(--color-bordo, #E8E5DE)',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        fontFamily: "'Satoshi', 'DM Sans', sans-serif",
      }}
    >
      {/* ─── LEFT: Logo + City ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Link to="/" style={{ textDecoration: 'none', lineHeight: 1 }}>
          <div style={{
            fontFamily: "'TAN Songbird', 'Satoshi', serif",
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--color-accent, #E8453C)',
            letterSpacing: 0.3,
            lineHeight: 1.1,
          }}>
            LA GUIDA DI BI
          </div>
          <div style={{
            fontSize: 8,
            color: 'var(--color-secondary, #8A8680)',
            letterSpacing: 1,
            fontWeight: 600,
            marginTop: 2,
          }}>
            BY CHIAMAMI BI
          </div>
        </Link>

        {/* City pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--color-bg, #FAF7F2)',
          border: '1px solid var(--color-bordo, #E8E5DE)',
          borderRadius: 20,
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-primary, #22181C)',
          cursor: 'default',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8453C', flexShrink: 0 }} />
          Torino
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* ─── CENTER: Navigation ─── */}
      <div style={{ display: 'flex', gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.match(location.pathname)
          const showDot = item.hasDot && hasDeals
          return (
            <button
              key={item.to}
              onClick={() => {
                if (item.requiresAuth && !user) {
                  navigate('/login')
                } else {
                  navigate(item.to)
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: active ? 'rgba(232, 69, 60,0.1)' : 'transparent',
                color: active ? 'var(--color-accent, #E8453C)' : 'var(--color-secondary, #8A8680)',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                position: 'relative',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <item.Icon />
              {item.label}
              {showDot && (
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#E8453C',
                  position: 'absolute',
                  top: 6,
                  right: 8,
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* ─── RIGHT: Search + Avatar ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Search bar */}
        <div
          onClick={() => navigate('/list')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--color-bg, #FAF7F2)',
            border: '1px solid var(--color-bordo, #E8E5DE)',
            borderRadius: 8,
            padding: '8px 14px',
            width: 200,
            cursor: 'pointer',
          }}
        >
          <SearchIcon />
          <span style={{ fontSize: 12, color: 'var(--color-secondary, #8A8680)' }}>
            Cerca ristoranti...
          </span>
        </div>

        {/* Avatar / Login */}
        {user ? (
          <Link
            to="/profile"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(232, 69, 60,0.1)',
              color: 'var(--color-accent, #E8453C)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            {initials}
          </Link>
        ) : (
          <Link
            to="/login"
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              background: 'var(--color-accent, #E8453C)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            Accedi
          </Link>
        )}
      </div>
    </nav>
  )
}
