import { Link, useLocation, matchPath } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/about', label: 'Chi è Bi' },
  { to: '/deals', label: 'Sconti' },
  { to: '/partner', label: 'Per i ristoratori' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Termini' },
]

export default function Footer() {
  const location = useLocation()
  const isRestaurantDetail = matchPath('/restaurant/:slug', location.pathname)
  const isAdmin = location.pathname.startsWith('/admin')
  const isPartner = location.pathname === '/partner'
  const tabBarVisible = !isAdmin && !isRestaurantDetail && !isPartner

  return (
    <footer className="border-t border-gray-100 md:mt-8">

      {/* ── MOBILE ── */}
      <div className={`md:hidden px-5 pt-10 pb-10${tabBarVisible ? ' footer-tab-offset' : ''}`}>
        <div className="flex items-center justify-between mb-8">
          <Link to="/" style={{ textDecoration: 'none', lineHeight: 0.92, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: "var(--font-mark, 'Alfa Slab One', serif)", fontSize: 15, letterSpacing: '0.02em', color: 'var(--color-corallo, #E8453C)' }}>
              LA GUIDA DI BI
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 8, letterSpacing: '0.15em', color: 'rgba(34,24,28,.4)', marginTop: 3, textTransform: 'uppercase' }}>
              by Chiamami Bi
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="https://www.tiktok.com/@chiamamibi" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-900 hover:text-white transition-colors"
              aria-label="TikTok">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48V13a8.28 8.28 0 005.58 2.17v-3.44a4.85 4.85 0 01-3.77-1.64V6.69h3.77z"/>
              </svg>
            </a>
            <a href="https://www.instagram.com/chiamamibi" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-600 hover:bg-pink-500 hover:text-white transition-colors"
              aria-label="Instagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-8">
          {NAV_LINKS.map(l => (
            <Link key={l.to} to={l.to} className="text-sm text-secondary hover:text-primary transition-colors">{l.label}</Link>
          ))}
          <Link to="/verify" className="text-sm text-secondary hover:text-primary transition-colors">Area ristoratori</Link>
        </div>

        <div className="pt-6 border-t border-gray-100">
          <p className="text-xs text-secondary">© {new Date().getFullYear()} ChiamamiBi. Tutti i diritti riservati.</p>
        </div>
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden md:flex" style={{
        padding: '24px 40px',
        justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: 'var(--color-ink-70)', flexWrap: 'wrap', gap: 18,
        maxWidth: 1280, margin: '0 auto',
      }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-mark, "Alfa Slab One", serif)', color: 'var(--color-corallo)', fontSize: 16, letterSpacing: '.02em' }}>
            CHIAMAMI BI
          </span>
        </Link>
        <nav style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {NAV_LINKS.map(l => (
            <Link key={l.to} to={l.to} style={{ color: 'var(--color-ink-70)', textDecoration: 'none' }}>{l.label}</Link>
          ))}
        </nav>
        <span>© {new Date().getFullYear()} · ChiamamiBi</span>
      </div>

    </footer>
  )
}
