import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { supabase } from '../../lib/supabase'
import { getDistance } from '../../lib/utils/distance'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import Footer from '../../components/Layout/Footer'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'
import FilterChips from '../../components/Layout/FilterChips'

function slugify(name) {
  return name.toLowerCase().replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { savedIds, isSaved, toggleSave } = useSavedRestaurants(user?.id)
  const [restaurants, setRestaurants] = useState([])
  const [activeDiscounts, setActiveDiscounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ category: null, priceRange: null, sortBy: null })
  const [showDealsOnly, setShowDealsOnly] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [filtersStuck, setFiltersStuck] = useState(false)
  const headerRef = useRef(null)
  const [headerH, setHeaderH] = useState(0)

  // Measure header height for sticky top offset
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setHeaderH(el.offsetHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Detect when filters are stuck (only for border visual — no layout effect)
  useEffect(() => {
    if (!headerH) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setFiltersStuck(window.scrollY > headerH + 70)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [headerH])

  useEffect(() => {
    if (!user?.id || savedIds.size === 0) {
      setRestaurants([])
      setLoading(false)
      return
    }

    const ids = [...savedIds]
    setLoading(true)

    Promise.all([
      supabase
        .from('restaurants')
        .select('*, photos:restaurant_photos(id, photo_url, thumb_url, sort_order)')
        .in('id', ids),
      supabase
        .from('discounts')
        .select('id, title, discount_value, discount_type, restaurant_id')
        .in('restaurant_id', ids)
        .eq('is_active', true)
        .lte('valid_from', new Date().toISOString())
        .gte('valid_until', new Date().toISOString()),
    ]).then(([resResult, discResult]) => {
      if (resResult.data) setRestaurants(resResult.data)
      if (discResult.data) {
        const map = {}
        discResult.data.forEach(d => { map[d.restaurant_id] = d })
        setActiveDiscounts(map)
      }
      setLoading(false)
    })
  }, [user?.id, savedIds])

  const dealsCount = useMemo(() => restaurants.filter(r => activeDiscounts[r.id]).length, [restaurants, activeDiscounts])

  const displayList = useMemo(() => {
    let list = [...restaurants]

    if (filters.category) {
      const selected = Array.isArray(filters.category) ? filters.category : [filters.category]
      list = list.filter(r => {
        const cats = r.category || (r.cuisine_type ? [r.cuisine_type] : [])
        return selected.some(s => cats.includes(s))
      })
    }

    if (filters.priceRange) {
      list = list.filter(r => r.price_range === filters.priceRange)
    }

    if (showDealsOnly) {
      list = list.filter(r => activeDiscounts[r.id])
    }

    if (filters.sortBy === 'distance' && userLocation) {
      list.sort((a, b) => {
        const dA = a.latitude ? getDistance(userLocation.lat, userLocation.lng, a.latitude, a.longitude) : Infinity
        const dB = b.latitude ? getDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude) : Infinity
        return dA - dB
      })
    }

    return list
  }, [restaurants, filters, showDealsOnly, activeDiscounts, userLocation])

  if (!authLoading && !user) return <Navigate to="/login" replace />

  const handleClick = (restaurant) => {
    navigate(`/restaurant/${restaurant.slug || slugify(restaurant.name || '')}`)
  }

  const handleSave = (id) => {
    if (!user) { navigate('/login'); return }
    toggleSave(id)
  }

  const handleNearbyClick = () => {
    if (userLocation) {
      setFilters(f => ({ ...f, sortBy: 'distance' }))
    } else if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setFilters(f => ({ ...f, sortBy: 'distance' }))
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }
  }

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-bg)' }}>
      {/* Sticky Header — logo + border only */}
      <div ref={headerRef} style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 22px 0',
        background: '#FAF7F2',
      }}>
        <div className="flex items-center justify-between" style={{ paddingBottom: 14 }}>
          <Link to="/" className="flex flex-col items-start" style={{ gap: 1 }}>
            <img src="/logo-guida-bi.png" alt="La Guida di Bi" style={{ height: 22, width: 'auto' }} />
            <span style={{ fontSize: 9, color: 'var(--color-secondary)', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' }}>by Chiamami Bi</span>
          </Link>
          <button className="flex items-center gap-1.5" style={{
            fontSize: 12, color: '#555', fontWeight: 600, padding: '6px 12px', borderRadius: 20,
            background: 'rgba(0,0,0,0.04)', border: '1px solid var(--color-bordo)',
          }}>
            <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--color-success)' }} />
              <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: 'var(--color-success)', opacity: 0.4, animation: 'cityPulse 2s ease-in-out infinite' }} />
            </span>
            Torino
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <div style={{ height: 1, background: 'var(--color-bordo)', margin: '0 -22px' }} />
      </div>


      {/* FilterChips — CSS sticky, sticks below header naturally */}
      {restaurants.length > 0 && (
        <div style={{
          position: 'sticky',
          top: headerH,
          zIndex: 49,
          padding: '14px 16px 14px',
          background: 'rgba(250,247,242,0.75)',
          backdropFilter: 'blur(20px) saturate(1.6)', WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        }}>
          <FilterChips
            filters={filters}
            onFilterChange={setFilters}
            onNearbyClick={handleNearbyClick}
            showDealsOnly={showDealsOnly}
            onToggleDeals={() => setShowDealsOnly(v => !v)}
            dealsCount={dealsCount}
          />
          {/* Gradient fade below filters */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: -16,
            height: 16, pointerEvents: 'none',
            background: 'linear-gradient(to bottom, rgba(250,247,242,0.7), transparent)',
          }} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1" style={{ padding: '8px 16px', paddingBottom: TAB_BAR_HEIGHT + 16 }}>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[120, 120, 120].map((h, i) => (
              <div key={i} className="shimmer" style={{ height: h, borderRadius: 18 }} />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 40px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-bordo)" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto' }}>
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            <h2 style={{ fontFamily: "'TAN Songbird', serif", fontSize: 18, color: 'var(--color-primary)', marginTop: 16 }}>
              Non hai ancora salvato nessun posto
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 8, lineHeight: 1.5 }}>
              Esplora la mappa e salva i ristoranti che ti incuriosiscono
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'var(--color-accent)', color: '#fff', borderRadius: 14,
                padding: '14px 28px', fontSize: 14, fontWeight: 600, marginTop: 20,
                border: 'none', cursor: 'pointer',
              }}
            >
              Esplora la mappa
            </button>
          </div>
        ) : displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span style={{ fontSize: 28, marginBottom: 8 }}>🔍</span>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}>Nessun salvato in questa categoria</p>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 4, lineHeight: 1.5 }}>
              Scopri tutti i ristoranti di questa categoria nell'elenco
            </p>
            <button
              onClick={() => {
                const cat = filters.category
                  ? (Array.isArray(filters.category) ? filters.category : [filters.category])
                  : null
                navigate('/', { state: { initialCategory: cat } })
              }}
              style={{
                background: 'var(--color-accent)', color: '#fff', borderRadius: 14,
                padding: '12px 24px', fontSize: 13, fontWeight: 600, marginTop: 16,
                border: 'none', cursor: 'pointer',
              }}
            >
              Vedi tutti i ristoranti
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {displayList.map((r, i) => {
              const discount = activeDiscounts[r.id]
              return (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  index={i}
                  userPosition={userLocation}
                  onClick={handleClick}
                  saved={isSaved(r.id)}
                  onSaveToggle={() => handleSave(r.id)}
                  hasDiscount={!!discount}
                  discountTitle={discount?.title || discount?.discount_value}
                />
              )
            })}
          </div>
        )}
      </div>

      <div style={{ paddingBottom: TAB_BAR_HEIGHT }}>
        <Footer />
      </div>
    </div>
  )
}
