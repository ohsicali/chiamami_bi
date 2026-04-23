import { useState, useEffect } from 'react'
import { Link, useLocation, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */
const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function DashboardIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}
function AnalyticsIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-5" />
    </svg>
  )
}
function RestaurantIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 002-2V2" />
      <path d="M5 2v20" />
      <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zM16 15v7" />
    </svg>
  )
}
function DiscountIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}
function CategoryIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
function UsersIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}
function SuggestionIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  )
}
function ApplicationIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}
function PartnerIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M20 21v-2a4 4 0 00-3-3.87" />
      <path d="M4 21v-2a4 4 0 013-3.87" />
      <circle cx="12" cy="7" r="4" />
      <path d="M16 3.13a4 4 0 010 7.75" />
      <path d="M8 3.13a4 4 0 000 7.75" />
    </svg>
  )
}
function NewsletterIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}
function SettingsIcon(props) {
  return (
    <svg {...iconProps} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}
function MenuIcon({ width = 18 }) {
  return (
    <svg width={width} height={width} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="14" y2="15" />
    </svg>
  )
}
function XIcon({ width = 18 }) {
  return (
    <svg width={width} height={width} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Menu structure                                                     */
/* ------------------------------------------------------------------ */
const MENU_SECTIONS = [
  {
    label: null,
    items: [
      { to: '/admin', label: 'Dashboard', icon: DashboardIcon, exact: true },
      { to: '/admin/analytics', label: 'Analytics', icon: AnalyticsIcon },
    ],
  },
  {
    label: 'GESTIONE',
    items: [
      { to: '/admin/restaurants', label: 'Ristoranti', icon: RestaurantIcon, counterKey: 'restaurants' },
      { to: '/admin/discounts', label: 'Sconti & Drop', icon: DiscountIcon, counterKey: 'discounts' },
      { to: '/admin/categories', label: 'Categorie', icon: CategoryIcon },
    ],
  },
  {
    label: 'COMMUNITY',
    items: [
      { to: '/admin/users', label: 'Utenti', icon: UsersIcon },
      { to: '/admin/suggestions', label: 'Suggerimenti', icon: SuggestionIcon, counterKey: 'suggestions' },
    ],
  },
  {
    label: 'BUSINESS',
    items: [
      { to: '/admin/applications', label: 'Candidature', icon: ApplicationIcon, counterKey: 'applications' },
      { to: '/admin/partners', label: 'Partner', icon: PartnerIcon },
      { to: '/admin/newsletter', label: 'Newsletter', icon: NewsletterIcon },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Sidebar content                                                    */
/* ------------------------------------------------------------------ */
function SidebarContent({ user, location, counts, onNavClick, onClose }) {
  const isActive = (item) => {
    if (item.exact) return location.pathname === item.to
    return location.pathname === item.to
  }

  const initials = (user?.email || 'A')[0].toUpperCase()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-ink)',
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Close button mobile */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            padding: 4,
            zIndex: 2,
          }}
        >
          <XIcon width={18} />
        </button>
      )}

      {/* Logo */}
      <div style={{ padding: '20px 16px 16px' }}>
        <Link
          to="/admin"
          onClick={onNavClick}
          style={{
            display: 'block',
            textDecoration: 'none',
            lineHeight: 1.1,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mark)",
              fontSize: 15,
              color: '#fff',
              letterSpacing: '0.02em',
              lineHeight: 1.1,
            }}
          >
            LA GUIDA<br />DI BI
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.14em',
              marginTop: 6,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            Admin
          </div>
        </Link>
      </div>

      {/* Menu */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 10px',
        }}
      >
        {MENU_SECTIONS.map((section, sIdx) => (
          <div key={sIdx}>
            {section.label && (
              <div
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.25)',
                  letterSpacing: 1.5,
                  padding: '14px 10px 6px',
                  fontWeight: 600,
                }}
              >
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const active = isActive(item)
              const Icon = item.icon
              const count = item.counterKey ? counts[item.counterKey] : null
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={onNavClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '9px 12px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: active ? 700 : 600,
                    color: active ? '#fff' : 'rgba(255,255,255,0.78)',
                    background: active ? '#E8453C' : 'transparent',
                    boxShadow: active ? '0 6px 14px rgba(232,69,60,0.35)' : 'none',
                    marginBottom: 2,
                    transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    if (!active) e.currentTarget.style.color = '#fff'
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = 'transparent'
                    if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.78)'
                  }}
                >
                  <Icon
                    width={18}
                    height={18}
                    style={{
                      color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {count != null && count > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: active ? '#fff' : 'rgba(255,255,255,0.75)',
                        background: active ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.12)',
                        padding: '2px 8px',
                        borderRadius: 10,
                        minWidth: 22,
                        textAlign: 'center',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer with user */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(232, 69, 60,0.15)',
            color: '#E8453C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.6)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {user?.email || 'Admin'}
        </div>
        <Link
          to="/admin/settings"
          onClick={onNavClick}
          style={{
            color: 'rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
          }}
        >
          <SettingsIcon width={16} height={16} />
        </Link>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Desktop top bar — search + date pill + "+ Nuovo" + avatar          */
/* ------------------------------------------------------------------ */
function AdminTopBar({ userInitial }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Sync search input with URL ?q= when on the restaurants page
  const isRestaurantsPage = location.pathname === '/admin/restaurants'
  const urlQ = isRestaurantsPage ? (searchParams.get('q') || '') : ''
  const [query, setQuery] = useState(urlQ)

  useEffect(() => {
    setQuery(urlQ)
  }, [urlQ])

  function onSubmit(e) {
    e.preventDefault()
    const q = query.trim()
    if (q) navigate(`/admin/restaurants?q=${encodeURIComponent(q)}`)
    else navigate('/admin/restaurants')
  }

  function clearSearch() {
    setQuery('')
    if (isRestaurantsPage) navigate('/admin/restaurants')
  }

  return (
    <div
      className="hidden md:flex"
      style={{
        alignItems: 'center',
        gap: 16,
        padding: '14px 28px',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--color-line, #EAE3D7)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          flex: 1,
          maxWidth: 440,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#fff',
          border: `1px solid ${query ? 'var(--color-ink,#22181C)' : 'var(--color-line,#EAE3D7)'}`,
          borderRadius: 999,
          padding: '8px 14px',
          transition: 'border-color 0.15s',
        }}
      >
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#9a8e84" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx={11} cy={11} r={8} />
          <line x1={21} y1={21} x2={16.65} y2={16.65} />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca ristoranti…"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--color-ink, #22181C)',
            padding: 0,
          }}
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
              color: '#aaa',
              fontSize: 16,
              flexShrink: 0,
            }}
            aria-label="Cancella ricerca"
          >
            ×
          </button>
        )}
      </form>

      <div style={{ flex: 1 }} />

      <Link
        to="/admin/restaurant/new"
        style={{
          background: '#E8453C',
          border: '1px solid #E8453C',
          borderRadius: 999,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 800,
          color: '#fff',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        + Nuovo
      </Link>

      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#E8453C',
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          fontFamily: 'var(--font-wordmark, "Alfa Slab One")',
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {userInitial}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main AdminLayout                                                   */
/* ------------------------------------------------------------------ */
export default function AdminLayout({ children, title }) {
  const { user, loading: authLoading } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [counts, setCounts] = useState({ restaurants: 0, discounts: 0, suggestions: 0, applications: 0 })
  const location = useLocation()

  // Close mobile menu + scroll to top on route change
  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  // Fetch sidebar counts
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false

    async function fetchCounts() {
      try {
        const nowIso = new Date().toISOString()
        const [restRes, discRes, suggRes, appRes] = await Promise.all([
          supabase.from('restaurants').select('id', { count: 'exact', head: true }),
          supabase
            .from('discounts')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true)
            .gt('valid_until', nowIso),
          supabase
            .from('restaurant_suggestions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('partner_applications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
        ])
        if (cancelled) return
        setCounts({
          restaurants: restRes.count || 0,
          discounts: discRes.count || 0,
          suggestions: suggRes.count || 0,
          applications: appRes.count || 0,
        })
      } catch (err) {
        // Silent fail — some tables may not exist yet
        if (!cancelled) console.warn('AdminLayout counts error:', err.message)
      }
    }

    fetchCounts()
    return () => {
      cancelled = true
    }
  }, [user, location.pathname])

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid #E8453C',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return <Navigate to="/admin/login" replace />

  const initials = (user?.email || 'A')[0].toUpperCase()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fafafa',
        display: 'flex',
        fontFamily: "var(--font-sans)",
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex"
        style={{
          flexDirection: 'column',
          width: 240,
          flexShrink: 0,
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 30,
        }}
      >
        <SidebarContent user={user} location={location} counts={counts} onNavClick={() => {}} />
      </aside>

      {/* ── Mobile top header ── */}
      <div
        className="flex md:hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 48,
          background: 'var(--color-ink)',
          zIndex: 20,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            padding: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Apri menu"
        >
          <MenuIcon width={18} />
        </button>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#E8453C',
            letterSpacing: 1,
          }}
        >
          ADMIN
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(232, 69, 60,0.15)',
            color: '#E8453C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {initials}
        </div>
      </div>

      {/* ── Mobile overlay sidebar ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 40,
              }}
              className="md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: 0,
                width: 260,
                zIndex: 50,
                boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
              }}
              className="md:hidden"
            >
              <SidebarContent
                user={user}
                location={location}
                counts={counts}
                onNavClick={() => setMobileOpen(false)}
                onClose={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#fafafa',
        }}
        className="md:ml-[240px] pt-[48px] md:pt-0"
      >
        <AdminTopBar userInitial={initials} />
        <main
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
