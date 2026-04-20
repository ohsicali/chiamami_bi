import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'

const TAB_BAR_HEIGHT = 64

const HomeIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V11z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
  </svg>
)

const ExploreIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

const DealsIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 0 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2zM13 5v2M13 11v2M13 17v2" />
  </svg>
)

const HeartIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
)

const UserIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)

export { TAB_BAR_HEIGHT }

export default function MobileTabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discounts } = useActiveDiscounts()

  const path = location.pathname

  const isHome = path === '/'
  const isExplore = path === '/esplora' || path === '/list' || path.startsWith('/restaurant/')
  const isDeals = path === '/deals'
  const isSaved = path === '/saved'
  const isProfile = path === '/profile' || path === '/settings'

  const tabs = [
    { key: 'home', label: 'Home', icon: HomeIcon, active: isHome, onClick: () => navigate('/') },
    { key: 'explore', label: 'Esplora', icon: ExploreIcon, active: isExplore, onClick: () => navigate('/esplora') },
    { key: 'deals', label: 'Sconti', icon: DealsIcon, active: isDeals, badge: discounts?.length || 0, onClick: () => navigate('/deals') },
    { key: 'saved', label: 'Salvati', icon: HeartIcon, active: isSaved, onClick: () => navigate(user ? '/saved' : '/login') },
    { key: 'profile', label: 'Profilo', icon: UserIcon, active: isProfile, onClick: () => navigate(user ? '/profile' : '/login') },
  ]

  return (
    <nav
      className="fixed md:hidden glass-pill-v4"
      style={{
        left: 12,
        right: 12,
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        height: TAB_BAR_HEIGHT,
        zIndex: 50,
        borderRadius: 999,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          height: '100%',
          padding: '0 8px',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={tab.onClick}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: tab.active ? 'var(--color-ink)' : 'rgba(34,24,28,.4)',
              position: 'relative',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <div style={{ position: 'relative' }}>
              {tab.active && (
                <span
                  style={{
                    position: 'absolute',
                    top: -5,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--color-corallo-soft)',
                    zIndex: -1,
                  }}
                />
              )}
              <tab.icon active={tab.active} />
              {tab.badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -8,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--color-corallo)',
                    border: '1.5px solid rgba(255,255,255,.9)',
                  }}
                />
              )}
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.2,
              }}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
