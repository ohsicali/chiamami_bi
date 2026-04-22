import { useState, useEffect } from 'react'
import { Link, useLocation, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */
const IC = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function DashboardIcon(p) {
  return (
    <svg {...IC} {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}
function RestaurantIcon(p) {
  return (
    <svg {...IC} {...p}>
      <path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 002-2V2" />
      <path d="M5 2v20" />
      <path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zM16 15v7" />
    </svg>
  )
}
function DiscountIcon(p) {
  return (
    <svg {...IC} {...p}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}
function CategoryIcon(p) {
  return (
    <svg {...IC} {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
function ApplicationIcon(p) {
  return (
    <svg {...IC} {...p}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}
function SuggestionIcon(p) {
  return (
    <svg {...IC} {...p}>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  )
}
function UsersIcon(p) {
  return (
    <svg {...IC} {...p}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}
function PartnerIcon(p) {
  return (
    <svg {...IC} {...p}>
      <path d="M20 21v-2a4 4 0 00-3-3.87" />
      <path d="M4 21v-2a4 4 0 013-3.87" />
      <circle cx="12" cy="7" r="4" />
      <path d="M16 3.13a4 4 0 010 7.75" />
      <path d="M8 3.13a4 4 0 000 7.75" />
    </svg>
  )
}
function NewsletterIcon(p) {
  return (
    <svg {...IC} {...p}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}
function AnalyticsIcon(p) {
  return (
    <svg {...IC} {...p}>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-5" />
    </svg>
  )
}
function SettingsIcon(p) {
  return (
    <svg {...IC} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}
function MenuIcon({ w = 18 }) {
  return (
    <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="14" y2="15" />
    </svg>
  )
}
function XIcon({ w = 18 }) {
  return (
    <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
/* Bottom nav icons */
function HomeIcon({ w = 20 }) {
  return (
    <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
function TagIcon({ w = 20 }) {
  return (
    <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}
function MailIcon({ w = 20 }) {
  return (
    <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}
function DotsIcon({ w = 20 }) {
  return (
    <svg width={w} height={w} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Menu structure — Desktop sidebar (4 groups, all routes)           */
/* ------------------------------------------------------------------ */
const DESKTOP_MENU = [
  {
    label: 'CATALOGO',
    items: [
      { to: '/admin', label: 'Dashboard', icon: DashboardIcon, exact: true },
      { to: '/admin/restaurants', label: 'Ristoranti', icon: RestaurantIcon, counterKey: 'restaurants' },
      { to: '/admin/discounts', label: 'Sconti & Drop', icon: DiscountIcon },
      { to: '/admin/categories', label: 'Categorie', icon: CategoryIcon },
    ],
  },
  {
    label: 'CURATELA',
    items: [
      { to: '/admin/applications', label: 'Candidature', icon: ApplicationIcon, counterKey: 'applications' },
      { to: '/admin/suggestions', label: 'Segnalazioni', icon: SuggestionIcon, dotKey: 'suggestions', dotColor: '#E8453C' },
    ],
  },
  {
    label: 'CRESCITA',
    items: [
      { to: '/admin/users', label: 'Utenti', icon: UsersIcon },
      { to: '/admin/partners', label: 'Partner', icon: PartnerIcon },
      { to: '/admin/newsletter', label: 'Newsletter', icon: NewsletterIcon },
    ],
  },
  {
    label: 'NUMERI',
    items: [
      { to: '/admin/analytics', label: 'Analytics', icon: AnalyticsIcon },
    ],
  },
]

/* Mobile side panel — simplified (Catalogo, Curatela, Numeri, Sistema) */
const MOBILE_MENU = [
  {
    label: 'CATALOGO',
    items: [
      { to: '/admin', label: 'Dashboard', icon: DashboardIcon, exact: true },
      { to: '/admin/restaurants', label: 'Ristoranti', icon: RestaurantIcon, counterKey: 'restaurants' },
      { to: '/admin/discounts', label: 'Sconti & Drop', icon: DiscountIcon },
    ],
  },
  {
    label: 'CURATELA',
    items: [
      { to: '/admin/applications', label: 'Candidature', icon: ApplicationIcon, counterKey: 'applications' },
      { to: '/admin/suggestions', label: 'Segnalazioni', icon: SuggestionIcon, dotKey: 'suggestions', dotColor: '#E8453C' },
    ],
  },
  {
    label: 'NUMERI',
    items: [
      { to: '/admin/analytics', label: 'Analytics', icon: AnalyticsIcon },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      { to: '/admin/settings', label: 'Impostazioni', icon: SettingsIcon },
    ],
  },
]

/* Bottom nav items (mobile) */
const BOTTOM_NAV = [
  { to: '/admin', label: 'Dashboard', icon: DashboardIcon, exact: true },
  { to: '/admin/restaurants', label: 'Locali', icon: HomeIcon },
  { to: '/admin/discounts', label: 'Sconti', icon: TagIcon },
  { to: '/admin/applications', label: 'Candidature', icon: MailIcon, badgeKey: 'applications' },
  { label: 'Altro', icon: DotsIcon, action: 'menu' },
]

/* ------------------------------------------------------------------ */
/*  Sidebar content (shared between desktop + mobile panel)           */
/* ------------------------------------------------------------------ */
function SidebarContent({ user, location, counts, menuSections, onNavClick, onClose }) {
  const isActive = (item) =>
    item.exact ? location.pathname === item.to : location.pathname === item.to

  const initials = (user?.email || 'A')[0].toUpperCase()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-ink)',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
      }}
    >
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            zIndex: 2,
          }}
        >
          <XIcon w={16} />
        </button>
      )}

      {/* Wordmark */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link
          to="/admin"
          onClick={onNavClick}
          style={{ display: 'block', textDecoration: 'none', lineHeight: 1.1, paddingBottom: 4 }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mark)',
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

      {/* Nav sections */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {menuSections.map((section, sIdx) => (
          <div key={sIdx}>
            {section.label && (
              <div
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: 1.5,
                  padding: '14px 10px 6px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const active = isActive(item)
              const Icon = item.icon
              const count = item.counterKey ? counts[item.counterKey] : null
              const showDot = item.dotKey && counts[item.dotKey] > 0
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={onNavClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: active ? 700 : 600,
                    color: active ? '#fff' : 'rgba(255,255,255,0.78)',
                    background: active ? 'var(--color-corallo)' : 'transparent',
                    boxShadow: active ? '0 6px 14px rgba(232,69,60,0.35)' : 'none',
                    marginBottom: 2,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  <Icon
                    width={16}
                    height={16}
                    style={{ color: active ? '#fff' : 'rgba(255,255,255,0.5)', flexShrink: 0 }}
                  />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {count != null && count > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: active ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.15)',
                        color: active ? '#fff' : 'rgba(255,255,255,0.9)',
                        flexShrink: 0,
                      }}
                    >
                      {count}
                    </span>
                  )}
                  {showDot && !count && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: item.dotColor,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer — user */}
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
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--color-corallo)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mark)',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Augusto
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginTop: 1 }}>
            Super admin
          </div>
        </div>
        <Link
          to="/admin/settings"
          onClick={onNavClick}
          style={{
            color: 'rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
          }}
        >
          <SettingsIcon width={14} height={14} />
        </Link>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile bottom nav                                                  */
/* ------------------------------------------------------------------ */
function BottomNav({ location, counts, onMenuOpen }) {
  const isActive = (item) =>
    item.exact ? location.pathname === item.to : location.pathname === item.to

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: `calc(16px + var(--safe-bottom, 0px))`,
        background: 'rgba(34,24,28,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 28,
        padding: '10px 8px',
        display: 'flex',
        justifyContent: 'space-around',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        zIndex: 20,
      }}
    >
      {BOTTOM_NAV.map((item) => {
        const active = item.to ? isActive(item) : false
        const Icon = item.icon
        const badge = item.badgeKey ? counts[item.badgeKey] : null
        const isMenu = item.action === 'menu'

        const inner = (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '8px 10px',
              borderRadius: 18,
              color: active ? '#fff' : 'rgba(255,255,255,0.6)',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              minWidth: 56,
              background: active ? 'var(--color-corallo)' : 'transparent',
              boxShadow: active ? '0 6px 14px rgba(232,69,60,0.35)' : 'none',
              position: 'relative',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Icon w={18} />
            {item.label}
            {badge > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  background: active ? '#fff' : 'var(--color-corallo)',
                  color: active ? 'var(--color-corallo)' : '#fff',
                  fontSize: 9,
                  fontWeight: 800,
                  padding: '2px 5px',
                  borderRadius: 8,
                  minWidth: 18,
                  textAlign: 'center',
                  border: '2px solid rgba(34,24,28,0.92)',
                }}
              >
                {badge}
              </span>
            )}
          </div>
        )

        if (isMenu) {
          return (
            <button
              key="altro"
              onClick={onMenuOpen}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              {inner}
            </button>
          )
        }
        return (
          <Link key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
            {inner}
          </Link>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main AdminLayout                                                   */
/* ------------------------------------------------------------------ */
export default function AdminLayout({ children }) {
  const { user, loading: authLoading } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [counts, setCounts] = useState({ restaurants: 0, suggestions: 0, applications: 0 })
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false

    async function fetchCounts() {
      try {
        const [restRes, suggRes, appRes] = await Promise.all([
          supabase.from('restaurants').select('id', { count: 'exact', head: true }),
          supabase.from('restaurant_suggestions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('partner_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ])
        if (cancelled) return
        setCounts({
          restaurants: restRes.count || 0,
          suggestions: suggRes.count || 0,
          applications: appRes.count || 0,
        })
      } catch (err) {
        if (!cancelled) console.warn('AdminLayout counts error:', err.message)
      }
    }

    fetchCounts()
    return () => { cancelled = true }
  }, [user, location.pathname])

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--color-corallo)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
        background: 'var(--color-page)',
        display: 'flex',
        fontFamily: 'var(--font-sans)',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside
        className="hidden md:flex"
        style={{
          flexDirection: 'column',
          width: 250,
          flexShrink: 0,
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 30,
        }}
      >
        <SidebarContent
          user={user}
          location={location}
          counts={counts}
          menuSections={DESKTOP_MENU}
          onNavClick={() => {}}
        />
      </aside>

      {/* ── Mobile top header ───────────────────────────────── */}
      <div
        className="flex md:hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 52,
          background: 'var(--color-page)',
          zIndex: 20,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--color-line)',
        }}
      >
        {/* Burger */}
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: '#fff',
            border: '1px solid var(--color-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Apri menu"
        >
          <MenuIcon w={18} />
        </button>

        {/* Wordmark */}
        <Link to="/admin" style={{ textDecoration: 'none', textAlign: 'center', lineHeight: 1 }}>
          <div style={{ fontFamily: 'var(--font-mark)', fontSize: 14, color: 'var(--color-ink)', letterSpacing: '0.01em', lineHeight: 1 }}>
            LA GUIDA DI BI
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 9, letterSpacing: '0.14em', color: 'rgba(34,24,28,0.5)', marginTop: 3, textTransform: 'uppercase' }}>
            ADMIN
          </div>
        </Link>

        {/* Avatar */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'var(--color-corallo)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mark)',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
      </div>

      {/* ── Mobile overlay backdrop ─────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(34,24,28,0.5)', zIndex: 40 }}
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
                width: 300,
                zIndex: 50,
                boxShadow: '20px 0 60px rgba(0,0,0,0.3)',
              }}
              className="md:hidden"
            >
              <SidebarContent
                user={user}
                location={location}
                counts={counts}
                menuSections={MOBILE_MENU}
                onNavClick={() => setMobileOpen(false)}
                onClose={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Mobile bottom nav ───────────────────────────────── */}
      <div className="md:hidden">
        <BottomNav location={location} counts={counts} onMenuOpen={() => setMobileOpen(true)} />
      </div>

      {/* ── Main content ────────────────────────────────────── */}
      <div
        style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-page)' }}
        className="md:ml-[250px] pt-[52px] md:pt-0"
      >
        <main
          style={{ flex: 1, minWidth: 0 }}
          className="pb-[100px] md:pb-0"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
