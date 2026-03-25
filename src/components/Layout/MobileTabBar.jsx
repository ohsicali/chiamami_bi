import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'

const TAB_BAR_HEIGHT = 78

const MapIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? '#FF5757' : 'none'} stroke={active ? '#FF5757' : '#bbb'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
)

const DealsIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? '#FF5757' : 'none'} stroke={active ? '#FF5757' : '#bbb'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
)

const HeartIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? '#FF5757' : 'none'} stroke={active ? '#FF5757' : '#bbb'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
)

const UserIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? '#FF5757' : 'none'} stroke={active ? '#FF5757' : '#bbb'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

  const path = location.pathname

  const isMap = path === '/' || path.startsWith('/restaurant/')
  const isDeals = path === '/deals'
  const isSaved = path === '/profile' && location.search?.includes('tab=saved')
  const isProfile = path === '/profile' && !isSaved

  const tabs = [
    {
      key: 'map',
      label: 'Mappa',
      icon: MapIcon,
      active: isMap,
      onClick: () => navigate('/'),
    },
    {
      key: 'deals',
      label: 'Sconti',
      icon: DealsIcon,
      active: isDeals,
      onClick: () => navigate('/deals'),
    },
    {
      key: 'saved',
      label: 'Salvati',
      icon: HeartIcon,
      active: isSaved,
      badge: user ? savedIds.size : 0,
      onClick: () => {
        if (user) {
          navigate('/profile?tab=saved')
        } else {
          navigate('/login')
        }
      },
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
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '0.5px solid #eae7e0',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-around h-full max-w-md mx-auto px-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={tab.onClick}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-2 relative"
            style={{
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <div className="relative">
              <tab.icon active={tab.active} />
              {tab.badge > 0 && (
                <span
                  className="absolute -top-1.5 -right-2.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-accent text-white text-[10px] font-bold px-1"
                >
                  {tab.badge}
                </span>
              )}
            </div>
            <span
              className="text-[10px] leading-none"
              style={{
                color: tab.active ? '#FF5757' : '#bbb',
                fontWeight: tab.active ? 700 : 400,
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
