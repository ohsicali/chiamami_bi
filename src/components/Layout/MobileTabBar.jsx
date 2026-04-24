import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'

const TAB_BAR_HEIGHT = 68

// Filled black SVG icons (fill: currentColor, stroke: none). Eccezione Sconti: stroke 2.4
// Copiate 1:1 da docs/v4-COMPONENT-SPECS.md §10 NAV LIQUID GLASS / LIBRERIA SVG ICONE
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V11z" />
  </svg>
)

const ExploreIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2c-4 0-7 3-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-4-3-7-7-7z" />
    <circle cx="12" cy="9" r="2.4" fill="#fff" />
  </svg>
)

const DealsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.2" fill="currentColor" />
    <circle cx="17.5" cy="17.5" r="2.2" fill="currentColor" />
  </svg>
)

const SavedIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
)

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.4 0-8 2.5-8 6v2h16v-2c0-3.5-3.6-6-8-6z" />
  </svg>
)

export { TAB_BAR_HEIGHT }

// iOS Safari has a known html2canvas bug with position:fixed elements — the
// snapshot fails silently, leaving the WebGL canvas blank. The CSS
// backdrop-filter fallback already looks native on iOS (WebKit renders it
// identically to UIKit blur), so we skip liquidGL entirely there.
function isIOSDevice() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

// Script loading is global + idempotent. Once loaded and initialized, liquidGL
// keeps a shared canvas across mounts/unmounts; cleanup per-instance is not
// strictly required, but we re-snapshot on route/scroll changes.
function ensureLiquidGLLoaded() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.__liquidGLReady) return Promise.resolve(true)
  if (window.__liquidGLLoading) return window.__liquidGLLoading

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      // Avoid double-injection
      const existing = document.querySelector(`script[src="${src}"]`)
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve()
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', reject)
        return
      }
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => {
        s.dataset.loaded = 'true'
        resolve()
      }
      s.onerror = reject
      document.head.appendChild(s)
    })

  window.__liquidGLLoading = (async () => {
    try {
      await loadScript('/vendor/html2canvas.min.js')
      await loadScript('/vendor/liquidGL.js')
      window.__liquidGLReady = typeof window.liquidGL === 'function'
      return window.__liquidGLReady
    } catch (err) {
      console.warn('[bottom-nav] liquidGL vendor script load failed:', err)
      window.__liquidGLReady = false
      return false
    }
  })()

  return window.__liquidGLLoading
}

function detectWebGL() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    return !!gl
  } catch {
    return false
  }
}

export default function MobileTabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discounts } = useActiveDiscounts()
  const navRef = useRef(null)
  const liquidGLInstanceRef = useRef(null)

  const path = location.pathname

  const isHome = path === '/'
  const isExplore = path === '/esplora' || path === '/list' || path.startsWith('/restaurant/')
  const isDeals = path === '/deals'
  const isSaved = path === '/saved'
  const isProfile = path === '/profile' || path === '/settings'

  const hasActiveDrop = Array.isArray(discounts) && discounts.length > 0

  const tabs = [
    { key: 'home', label: 'Home', Icon: HomeIcon, active: isHome, onClick: () => navigate('/') },
    { key: 'explore', label: 'Esplora', Icon: ExploreIcon, active: isExplore, onClick: () => navigate('/esplora') },
    { key: 'deals', label: 'Sconti', Icon: DealsIcon, active: isDeals, badge: hasActiveDrop, onClick: () => navigate('/deals') },
    { key: 'saved', label: 'Salvati', Icon: SavedIcon, active: isSaved, onClick: () => navigate(user ? '/saved' : '/login') },
    { key: 'profile', label: 'Profilo', Icon: ProfileIcon, active: isProfile, onClick: () => navigate(user ? '/profile' : '/login') },
  ]

  // Initialize liquidGL once on mount. Falls back gracefully to the CSS
  // backdrop-filter pill if WebGL is unavailable or the script fails to load.
  useEffect(() => {
    let cancelled = false
    if (isIOSDevice() || !detectWebGL()) return undefined

    ensureLiquidGLLoaded().then((ready) => {
      if (cancelled || !ready || typeof window.liquidGL !== 'function') return
      if (window.__liquidGLInstance) {
        liquidGLInstanceRef.current = window.__liquidGLInstance
        return
      }
      try {
        const instance = window.liquidGL({
          target: '.bottom-nav',
          snapshot: 'body',
          resolution: 2.0,
          refraction: 0.025,
          bevelDepth: 0.11,
          bevelWidth: 0.18,
          frost: 2,
          shadow: true,
          specular: true,
          reveal: 'fade',
          magnify: 1,
        })
        window.__liquidGLInstance = instance
        liquidGLInstanceRef.current = instance
      } catch (err) {
        console.warn('[bottom-nav] liquidGL init error:', err)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Re-snapshot on route change and throttled scroll so the refraction follows
  // the content underneath the nav.
  useEffect(() => {
    if (typeof window === 'undefined' || isIOSDevice()) return undefined
    if (typeof window.liquidGL?.syncWith !== 'function') return undefined

    let frame = 0
    const resync = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        try {
          window.liquidGL.syncWith()
        } catch {
          /* swallow — liquidGL may not be fully ready yet */
        }
      })
    }

    resync()
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        try {
          window.liquidGL.syncWith()
        } catch {
          /* noop */
        }
      })
    }

    let scrollTimer = null
    const throttledScroll = () => {
      if (scrollTimer) return
      scrollTimer = window.setTimeout(() => {
        scrollTimer = null
        onScroll()
      }, 100)
    }

    window.addEventListener('scroll', throttledScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', throttledScroll)
      if (scrollTimer) window.clearTimeout(scrollTimer)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [location.pathname])

  return (
    <nav
      ref={navRef}
      className="bottom-nav liquidGL md:hidden"
      data-liquid-ignore
      aria-label="Navigazione principale"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={tab.onClick}
          className={`nav-item${tab.active ? ' active' : ''}`}
          aria-label={tab.label}
          aria-current={tab.active ? 'page' : undefined}
          title={tab.label}
        >
          {tab.badge && <span className="nav-badge" aria-hidden="true" />}
          <tab.Icon />
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
