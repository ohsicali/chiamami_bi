import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'

const TAB_BAR_HEIGHT = 74

const CompassIcon = ({ color = '#B5B0AA', size = 20, sw = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
)

const TagIcon = ({ color = '#B5B0AA', size = 20, sw = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <circle cx="7" cy="7" r="1" />
  </svg>
)

const HeartIcon = ({ color = '#B5B0AA', size = 20, sw = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
)

const UserIcon = ({ color = '#B5B0AA', size = 20, sw = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export { TAB_BAR_HEIGHT }

export default function MobileTabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discounts } = useActiveDiscounts()

  const path = location.pathname
  const isExplore = path === '/' || path === '/list' || path.startsWith('/restaurant/')
  const isDeals = path === '/deals'
  const isSaved = path === '/saved'
  const isProfile = path === '/profile' || path === '/settings'

  const discountCount = discounts?.length || 0

  const tabs = [
    { key: 'esplora', label: 'Esplora', path: '/', Icon: CompassIcon, active: isExplore },
    { key: 'sconti', label: 'Sconti', path: '/deals', Icon: TagIcon, active: isDeals, badge: discountCount },
    { key: 'salvati', label: 'Salvati', path: '/saved', Icon: HeartIcon, active: isSaved },
    { key: 'profilo', label: 'Profilo', path: '/profile', Icon: UserIcon, active: isProfile },
  ]

  const handleTap = (tab) => {
    if ((tab.key === 'salvati' || tab.key === 'profilo') && !user) {
      navigate('/login')
    } else {
      navigate(tab.path)
    }
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 md:hidden"
      style={{
        height: TAB_BAR_HEIGHT,
        zIndex: 40,
        background: '#fff',
        borderTop: '1px solid rgba(0,0,0,0.05)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        height: TAB_BAR_HEIGHT, padding: '0 20px', maxWidth: 480, margin: '0 auto',
      }}>
        {tabs.map((tab) => {
          const { key, label, Icon, active, badge } = tab

          return (
            <button
              key={key}
              onClick={() => handleTap(tab)}
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: active ? '10px 18px' : '10px 14px',
                background: 'none', border: 'none', cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}
            >
              {/* Active pill background */}
              {active && (
                <motion.div
                  layoutId="tab-pill"
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'var(--color-primary)',
                    borderRadius: 20,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}

              {/* Content */}
              <div style={{
                position: 'relative', zIndex: 1,
                display: 'flex', alignItems: 'center', gap: active ? 8 : 0,
              }}>
                <Icon
                  color={active ? '#fff' : '#B5B0AA'}
                  size={active ? 18 : 20}
                  sw={active ? 1.8 : 1.5}
                />

                {/* Label — only when active */}
                {active && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    style={{
                      fontSize: 12, fontWeight: 600, color: '#fff',
                      fontFamily: "'DM Sans', sans-serif",
                      whiteSpace: 'nowrap', overflow: 'hidden',
                    }}
                  >
                    {label}
                  </motion.span>
                )}

                {/* Badge — active: number inside pill */}
                {active && badge > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9,
                    background: 'var(--color-accent)', color: '#fff',
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 5px',
                  }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>

              {/* Badge — inactive: red dot */}
              {!active && badge > 0 && (
                <span style={{
                  position: 'absolute', top: 7, right: 10,
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--color-accent)',
                }} />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
