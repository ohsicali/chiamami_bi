import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'

const TAB_BAR_HEIGHT = 60

const ExploreIcon = ({ active }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? '#E8453C' : '#B5B0A8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" fill={active ? 'rgba(232,69,60,0.12)' : 'none'} />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={active ? '#E8453C' : 'none'} />
  </svg>
)

const DealsIcon = ({ active }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? '#E8453C' : '#B5B0A8'} strokeWidth="1.8" strokeLinecap="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" fill={active ? 'rgba(232,69,60,0.12)' : 'none'} />
    <circle cx="7" cy="7" r="1" fill={active ? '#E8453C' : '#B5B0A8'} />
  </svg>
)

const HeartIcon = ({ active }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill={active ? 'rgba(232,69,60,0.12)' : 'none'} stroke={active ? '#E8453C' : '#B5B0A8'} strokeWidth="1.8" strokeLinecap="round">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
)

const UserIcon = ({ active }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? '#E8453C' : '#B5B0A8'} strokeWidth="1.8" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export { TAB_BAR_HEIGHT }

export default function MobileTabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { savedIds } = useSavedRestaurants(user?.id)
  const { discounts } = useActiveDiscounts()

  const path = location.pathname

  const isExplore = path === '/' || path === '/list' || path.startsWith('/restaurant/')
  const isDeals = path === '/deals'
  const isSaved = path === '/saved'
  const isProfile = path === '/profile' || path === '/settings'

  const tabs = [
    {
      key: 'explore',
      label: 'Esplora',
      icon: ExploreIcon,
      active: isExplore,
      onClick: () => navigate('/'),
    },
    {
      key: 'deals',
      label: 'Sconti',
      icon: DealsIcon,
      active: isDeals,
      badge: discounts?.length || 0,
      onClick: () => navigate('/deals'),
    },
    {
      key: 'saved',
      label: 'Salvati',
      icon: HeartIcon,
      active: isSaved,
      onClick: () => navigate(user ? '/saved' : '/login'),
    },
    {
      key: 'profile',
      label: 'Profilo',
      icon: UserIcon,
      active: isProfile,
      onClick: () => navigate(user ? '/profile' : '/login'),
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 md:hidden"
      style={{
        height: TAB_BAR_HEIGHT,
        zIndex: 50,
        background: '#FAF7F2',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-start justify-around pt-1.5 px-3 max-w-md mx-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={tab.onClick}
            className="flex flex-col items-center gap-1 flex-1 relative"
            style={{
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            {tab.active && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 20,
                  height: 3,
                  borderRadius: '0 0 3px 3px',
                  background: '#E8453C',
                }}
              />
            )}

            <div className="relative">
              <tab.icon active={tab.active} />
              {tab.badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -6,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#E8453C',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(232,69,60,0.4)',
                  }}
                >
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: tab.active ? 700 : 500,
                color: tab.active ? '#E8453C' : '#B5B0A8',
                letterSpacing: 0.3,
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
