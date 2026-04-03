import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'

const TAB_BAR_HEIGHT = 74

const CompassIcon = ({ color, size, sw }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
)

const TagIcon = ({ color, size, sw }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <circle cx="7" cy="7" r="1" />
  </svg>
)

const HeartIcon = ({ color, size, sw }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
)

const UserIcon = ({ color, size, sw }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export { TAB_BAR_HEIGHT }

const TABS = [
  { key: 'esplora', label: 'Esplora', path: '/', Icon: CompassIcon },
  { key: 'sconti', label: 'Sconti', path: '/deals', Icon: TagIcon, hasBadge: true },
  { key: 'salvati', label: 'Salvati', path: '/saved', Icon: HeartIcon },
  { key: 'profilo', label: 'Profilo', path: '/profile', Icon: UserIcon },
]

function getActiveIndex(pathname) {
  if (pathname === '/deals') return 1
  if (pathname === '/saved') return 2
  if (pathname === '/profile' || pathname === '/settings') return 3
  return 0
}

export default function MobileTabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discounts } = useActiveDiscounts()
  const discountCount = discounts?.length || 0

  const activeIndex = getActiveIndex(location.pathname)
  const containerRef = useRef(null)
  const tabRefs = useRef([])
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 })

  // Measure active tab position for the pill
  const measure = useCallback(() => {
    const el = tabRefs.current[activeIndex]
    const container = containerRef.current
    if (!el || !container) return
    const cRect = container.getBoundingClientRect()
    const tRect = el.getBoundingClientRect()
    setPillStyle({
      left: tRect.left - cRect.left,
      width: tRect.width,
    })
  }, [activeIndex])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  // Re-measure after fonts load (can shift widths)
  useEffect(() => {
    const t = setTimeout(measure, 100)
    return () => clearTimeout(t)
  }, [measure])

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
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          height: TAB_BAR_HEIGHT, padding: '0 16px', maxWidth: 480, margin: '0 auto',
        }}
      >
        {/* Animated pill background */}
        <motion.div
          animate={{
            left: pillStyle.left,
            width: pillStyle.width,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            height: 40,
            background: 'var(--color-primary)',
            borderRadius: 20,
            zIndex: 0,
          }}
        />

        {/* Tabs */}
        {TABS.map((tab, i) => {
          const isActive = i === activeIndex
          const showBadge = tab.hasBadge && discountCount > 0

          return (
            <button
              key={tab.key}
              ref={el => tabRefs.current[i] = el}
              onClick={() => handleTap(tab)}
              style={{
                position: 'relative', zIndex: 1,
                display: 'flex', alignItems: 'center', gap: isActive ? 8 : 0,
                padding: isActive ? '10px 18px' : '10px 14px',
                background: 'none', border: 'none', cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              <tab.Icon
                color={isActive ? '#fff' : '#B5B0AA'}
                size={isActive ? 18 : 20}
                sw={isActive ? 1.8 : 1.5}
              />

              {/* Label — only active */}
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: isActive ? '#fff' : 'transparent',
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: 'nowrap',
                width: isActive ? 'auto' : 0,
                overflow: 'hidden',
                transition: 'none',
              }}>
                {isActive ? tab.label : ''}
              </span>

              {/* Badge inside pill when active */}
              {isActive && showBadge && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: 'var(--color-accent)', color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 5px',
                }}>
                  {discountCount > 99 ? '99+' : discountCount}
                </span>
              )}

              {/* Red dot when inactive */}
              {!isActive && showBadge && (
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
