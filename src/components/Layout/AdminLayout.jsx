import { useState, useEffect } from 'react'
import { Link, useLocation, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { LogoFull } from '../UI/Logo'

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */
function DashboardIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}
function RestaurantIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  )
}
function DiscountIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </svg>
  )
}
function PartnerIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}
function ReviewIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  )
}
function NewsletterIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}
function ApplicationIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
function SettingsIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function LogoutIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
    </svg>
  )
}
function ArrowLeftIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}
function MenuIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
function XIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function ChevronRightIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Sidebar navigation items                                           */
/* ------------------------------------------------------------------ */
function StatsIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: DashboardIcon, exact: true },
  { to: '/admin/stats', label: 'Statistiche', icon: StatsIcon },
  { to: '/admin?section=restaurants', label: 'Ristoranti', icon: RestaurantIcon },
  { to: '/admin/categories', label: 'Categorie', icon: ApplicationIcon },
  { to: '/admin/discounts', label: 'Sconti', icon: DiscountIcon },
  { to: '/admin/partners', label: 'Partner', icon: PartnerIcon },
  { to: '/admin/reviews', label: 'Recensioni', icon: ReviewIcon },
  { to: '/admin/newsletter', label: 'Newsletter', icon: NewsletterIcon },
  { to: '/admin/applications', label: 'Candidature', icon: ApplicationIcon },
  { to: '/admin/settings', label: 'Impostazioni', icon: SettingsIcon },
]

/* ------------------------------------------------------------------ */
/*  Sidebar content (shared between desktop and mobile)                */
/* ------------------------------------------------------------------ */
function SidebarContent({ user, onLogout, onNavClick }) {
  const location = useLocation()

  const isActive = (item) => {
    const itemPath = item.to.split('?')[0]
    const itemQuery = item.to.includes('?') ? '?' + item.to.split('?')[1] : ''
    if (item.exact) return location.pathname === itemPath && !location.search
    if (itemQuery) return location.pathname === itemPath && location.search === itemQuery
    return location.pathname === itemPath
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      {/* Logo + back arrow */}
      <div className="px-5 pt-6 pb-6 flex items-center gap-3">
        <Link
          to="/"
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          title="Torna al sito"
          onClick={onNavClick}
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <Link to="/admin" className="flex-1" onClick={onNavClick}>
          <LogoFull height={20} variant="light" />
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item)
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={onNavClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
              }`}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-5 py-4 border-t border-white/10 mt-2">
        <p className="text-xs text-white/40 truncate mb-2">{user?.email ?? 'Admin'}</p>
        <button
          onClick={() => { onLogout(); onNavClick?.() }}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-red-400 transition-colors"
        >
          <LogoutIcon className="w-4 h-4" />
          Esci
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Admin Mobile Tab Bar — 5 tabs + floating red "+" button            */
/* ------------------------------------------------------------------ */
const ADMIN_TABS = [
  { path: '/admin', label: 'Home', icon: DashboardIcon, exact: true },
  { path: '/admin?section=restaurants', label: 'Locali', icon: RestaurantIcon },
  { path: '/admin/discounts', label: 'Sconti', icon: DiscountIcon },
  { path: '/admin/reviews', label: 'Stelle', icon: ReviewIcon },
  { path: '/admin/settings', label: 'Altro', icon: SettingsIcon },
]

function AdminMobileTabBar() {
  const location = useLocation()

  const isTabActive = (tab) => {
    const tabPath = tab.path.split('?')[0]
    const tabQuery = tab.path.includes('?') ? '?' + tab.path.split('?')[1] : ''
    if (tab.exact) return location.pathname === tabPath && !location.search
    if (tabQuery) return location.pathname === tabPath && location.search === tabQuery
    return location.pathname === tabPath
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '0.5px solid #eae7e0',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2 relative">
        {ADMIN_TABS.map((tab, i) => {
          const active = isTabActive(tab)
          const Icon = tab.icon
          return (
            <Link
              key={tab.label}
              to={tab.path}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 relative"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-accent' : 'text-gray-400'}`} />
              <span
                className="text-[10px] leading-none"
                style={{
                  color: active ? '#FF5757' : '#bbb',
                  fontWeight: active ? 700 : 400,
                }}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Floating red "+" button — centered above tab bar */}
      <Link
        to="/admin/restaurant/new"
        className="absolute left-1/2 -translate-x-1/2 -top-7 flex items-center justify-center w-14 h-14 rounded-full bg-accent shadow-lg shadow-accent/30"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Link>
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/*  Main AdminLayout component                                         */
/* ------------------------------------------------------------------ */
export default function AdminLayout({ children, title }) {
  const { user, loading: authLoading, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile menu on route change
  const location = useLocation()
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const closeMobile = () => setMobileOpen(false)

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }
  if (!user) return <Navigate to="/admin/login" replace />

  const adminLocation = useLocation()

  return (
    <div className="min-h-screen bg-bg flex" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' }}>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-60 bg-[#1a1a1a] shrink-0 fixed inset-y-0 left-0 z-30">
        <SidebarContent user={user} onLogout={signOut} onNavClick={() => {}} />
      </aside>

      {/* ── Mobile overlay sidebar ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              onClick={closeMobile}
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 w-72 bg-[#1a1a1a] z-50 shadow-xl md:hidden"
            >
              {/* Close button */}
              <button
                onClick={closeMobile}
                className="absolute top-4 right-4 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <SidebarContent user={user} onLogout={signOut} onNavClick={closeMobile} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content area ── */}
      <div className="flex-1 md:ml-60 min-w-0 flex flex-col">
        {/* Mobile top bar — simplified */}
        <div className="md:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-xl text-secondary hover:text-primary hover:bg-gray-100 transition-colors"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-secondary">
              <HomeIcon className="w-3 h-3 flex-shrink-0" />
              <ChevronRightIcon className="w-3 h-3 flex-shrink-0" />
              <span className="truncate font-medium text-primary">{title}</span>
            </div>
          </div>
        </div>

        {/* Desktop breadcrumb bar */}
        <div className="hidden md:block px-8 pt-6 pb-0">
          <div className="flex items-center gap-1.5 text-sm text-secondary">
            <Link to="/admin" className="hover:text-primary transition-colors">Admin</Link>
            <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-medium text-primary">{title}</span>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 min-w-0 md:px-8 md:py-6 px-4 py-4 pb-24 md:pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {children}
        </main>

        {/* ── Mobile Admin Tab Bar — 5 tabs with floating red "+" ── */}
        <AdminMobileTabBar />
      </div>
    </div>
  )
}
