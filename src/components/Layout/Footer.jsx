import { Link, useLocation, matchPath } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogoFull } from '../UI/Logo'

export default function Footer() {
  const { t } = useTranslation()
  const location = useLocation()

  // Mirror the visibility logic from App.jsx so the footer clears the mobile
  // tab bar on pages where it's shown.
  const isRestaurantDetail = matchPath('/restaurant/:slug', location.pathname)
  const isAdmin = location.pathname.startsWith('/admin')
  const isPartner = location.pathname === '/partner'
  const tabBarVisible = !isAdmin && !isRestaurantDetail && !isPartner

  return (
    <footer className="bg-white border-t border-gray-100 md:mt-12">
      <div
        className="max-w-screen-lg md:max-w-[960px] mx-auto px-5 pt-10 pb-10"
        style={
          tabBarVisible
            ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }
            : undefined
        }
      >
        {/* Top section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
          {/* Mobile: image logo; Desktop: red text logo */}
          <div className="md:hidden"><LogoFull height={28} /></div>
          <Link to="/" className="hidden md:block" style={{ textDecoration: 'none', lineHeight: 1 }}>
            <div style={{
              fontFamily: "'TAN Songbird', 'DM Sans', serif",
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--color-accent, #E8453C)',
              letterSpacing: 0.3,
              lineHeight: 1.1,
            }}>
              LA GUIDA DI BI
            </div>
            <div style={{
              fontSize: 9,
              color: 'var(--color-secondary, #8A8680)',
              letterSpacing: 1,
              fontWeight: 600,
              marginTop: 3,
            }}>
              BY CHIAMAMI BI
            </div>
          </Link>
          <div className="flex items-center gap-4">
            {/* TikTok */}
            <a
              href="https://www.tiktok.com/@chiamamibi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-900 hover:text-white transition-colors"
              aria-label="TikTok"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48V13a8.28 8.28 0 005.58 2.17v-3.44a4.85 4.85 0 01-3.77-1.64V6.69h3.77z"/>
              </svg>
            </a>
            {/* Instagram */}
            <a
              href="https://www.instagram.com/chiamamibi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-600 hover:bg-pink-500 hover:text-white transition-colors"
              aria-label="Instagram"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-8">
          <Link to="/about" className="text-sm text-secondary hover:text-primary transition-colors">
            Chi è Bi
          </Link>
          <Link to="/deals" className="text-sm text-secondary hover:text-primary transition-colors">
            Sconti
          </Link>
          <Link to="/partner" className="text-sm text-secondary hover:text-primary transition-colors">
            Per i ristoratori
          </Link>
          <Link to="/verify" className="text-sm text-secondary hover:text-primary transition-colors">
            Area ristoratori
          </Link>
          <Link to="/privacy" className="text-sm text-secondary hover:text-primary transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="text-sm text-secondary hover:text-primary transition-colors">
            Termini di Servizio
          </Link>
        </div>

        {/* Copyright */}
        <div className="pt-6 border-t border-gray-100">
          <p className="text-xs text-secondary">
            © {new Date().getFullYear()} ChiamamiBi. Tutti i diritti riservati.
          </p>
        </div>
      </div>
    </footer>
  )
}
