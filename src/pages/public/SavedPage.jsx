import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import CityPickerSheet from '../../components/UI/CityPickerSheet'
import { useCity } from '../../lib/CityContext'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { supabase, proxyImg } from '../../lib/supabase'
import { getDistance } from '../../lib/utils/distance'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import Footer from '../../components/Layout/Footer'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'
import SaveButton from '../../components/Restaurant/SaveButton'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import FilterChips from '../../components/Layout/FilterChips'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'

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
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const { city: currentCity } = useCity()
  const isDesktop = useIsDesktop()

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

  const cityRestaurants = useMemo(() => {
    if (!currentCity.name) return restaurants
    return restaurants.filter(r => r.city?.toLowerCase() === currentCity.name.toLowerCase())
  }, [restaurants, currentCity.name])

  const dealsCount = useMemo(() => cityRestaurants.filter(r => activeDiscounts[r.id]).length, [cityRestaurants, activeDiscounts])

  const displayList = useMemo(() => {
    let list = [...restaurants]

    // Filter by selected city
    if (currentCity.name) {
      list = list.filter(r => r.city?.toLowerCase() === currentCity.name.toLowerCase())
    }

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
      {/* Sticky Header — logo + border only (mobile only) */}
      <div ref={headerRef} className="md:hidden" style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 22px 0',
        background: '#FAF7F2',
      }}>
        <div className="flex items-center justify-between" style={{ paddingBottom: 14 }}>
          <Link to="/" className="flex flex-col items-start" style={{ gap: 1 }}>
            <img src="/logo-guida-bi.png" alt="La Guida di Bi" style={{ height: 22, width: 'auto' }} />
            <span style={{ fontSize: 9, color: 'var(--color-secondary)', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' }}>by Chiamami Bi</span>
          </Link>
          <button onClick={() => setCityPickerOpen(true)} className="flex items-center gap-1.5" style={{
            fontSize: 12, color: '#555', fontWeight: 600, padding: '6px 12px', borderRadius: 20,
            background: 'rgba(0,0,0,0.04)', border: '1px solid var(--color-bordo)', cursor: 'pointer',
          }}>
            <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--color-success)' }} />
              <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: 'var(--color-success)', opacity: 0.4, animation: 'cityPulse 2s ease-in-out infinite' }} />
            </span>
            {currentCity.name}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <div style={{ height: 1, background: 'var(--color-bordo)', margin: '0 -22px' }} />
      </div>


      {/* Desktop-only page header — title + chip filters on the right */}
      <div className="hidden md:flex md:max-w-[940px] md:mx-auto md:w-full" style={{
        padding: '32px 16px 18px',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--color-primary)',
            letterSpacing: -0.3,
            marginBottom: 4,
          }}>
            I miei salvati
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
            {cityRestaurants.length} {cityRestaurants.length === 1 ? 'ristorante salvato' : 'ristoranti salvati'}
          </p>
        </div>
        {restaurants.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'all', label: `Tutti (${cityRestaurants.length})`, active: !showDealsOnly && filters.sortBy !== 'distance', onClick: () => { setShowDealsOnly(false); setFilters(f => ({ ...f, sortBy: null })) } },
              { key: 'deals', label: `Scontati${dealsCount ? ` (${dealsCount})` : ''}`, active: showDealsOnly, onClick: () => { setShowDealsOnly(v => !v); setFilters(f => ({ ...f, sortBy: null })) } },
              { key: 'near', label: 'Vicino a me', active: filters.sortBy === 'distance', onClick: () => { setShowDealsOnly(false); handleNearbyClick() } },
            ].map(chip => (
              <button
                key={chip.key}
                onClick={chip.onClick}
                style={{
                  padding: '7px 14px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 999,
                  border: `1px solid ${chip.active ? '#22181C' : '#E8E5DE'}`,
                  background: chip.active ? '#22181C' : '#ffffff',
                  color: chip.active ? '#ffffff' : '#22181C',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* FilterChips — CSS sticky, sticks below header naturally (hidden on desktop) */}
      {restaurants.length > 0 && (
        <div className="md:hidden" style={{
          position: 'sticky',
          top: headerH,
          zIndex: 49,
          padding: '14px 16px 14px',
          background: 'rgba(250,247,242,0.75)',
          backdropFilter: 'blur(20px) saturate(1.6)', WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
          boxShadow: filtersStuck ? '0 1px 0 0 var(--color-bordo)' : 'none',
        }}>
          <div className="md:max-w-[940px] md:mx-auto">
            <FilterChips
              filters={filters}
              onFilterChange={setFilters}
              onNearbyClick={handleNearbyClick}
              showDealsOnly={showDealsOnly}
              onToggleDeals={() => setShowDealsOnly(v => !v)}
              dealsCount={dealsCount}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 md:max-w-[940px] md:mx-auto md:w-full" style={{ padding: '8px 16px', paddingBottom: TAB_BAR_HEIGHT + 16 }}>
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
        ) : cityRestaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span style={{ fontSize: 28, marginBottom: 8 }}>📍</span>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}>Nessun locale salvato a {currentCity.name}</p>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 4, lineHeight: 1.5 }}>
              Prova a selezionare un'altra città
            </p>
            <button
              onClick={() => setCityPickerOpen(true)}
              style={{
                background: 'var(--color-accent)', color: '#fff', borderRadius: 14,
                padding: '12px 24px', fontSize: 13, fontWeight: 600, marginTop: 16,
                border: 'none', cursor: 'pointer',
              }}
            >
              Cambia città
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
          <>
            {/* Mobile: horizontal RestaurantCard list — renderizzato SOLO su mobile
                per evitare duplicazione delle card nel DOM (prima convivevano con
                la grid desktop, moltiplicando il numero di nodi per 2). */}
            {!isDesktop && (
            <div className="flex flex-col gap-3">
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

            {/* Desktop: vertical photo cards grid (3-col) — renderizzato SOLO su desktop */}
            {isDesktop && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
              {displayList.map((r) => {
                const discount = activeDiscounts[r.id]
                const categories = (r.category || (r.cuisine_type ? [r.cuisine_type] : [])).map(name => getCategoryInfo(name)).filter(Boolean)
                const category = categories[0]
                const firstPhoto = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos[0] : null
                const photoUrl = proxyImg(firstPhoto ? (typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url) : null)
                const priceStr = r.price_range != null ? '€'.repeat(r.price_range) : null

                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(r)}
                    className="relative overflow-hidden cursor-pointer group"
                    style={{ height: 250, borderRadius: 16 }}
                  >
                    {/* Photo background */}
                    {photoUrl ? (
                      <img src={photoUrl} alt={r.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: category?.color ? `linear-gradient(135deg, ${category.color}40, ${category.color}20)` : '#E8E5DE', fontSize: 40, opacity: 0.6 }}>
                        {category?.emoji || '🍽️'}
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 45%, transparent 100%)' }} />
                    {/* Discount badge */}
                    {discount && (
                      <div style={{
                        position: 'absolute', top: 10, left: 10, zIndex: 2,
                        background: 'linear-gradient(135deg, #FFE5E3 0%, #EE5C55 100%)', color: '#000',
                        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                      }}>
                        {discount.title || discount.discount_value}
                      </div>
                    )}
                    {/* Save button */}
                    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }} onClick={(e) => { e.stopPropagation(); handleSave(r.id) }}>
                      <SaveButton saved={isSaved(r.id)} onClick={() => {}} size="sm" />
                    </div>
                    {/* Info at bottom */}
                    <div className="absolute bottom-0 left-0 right-0" style={{ padding: '14px 16px', zIndex: 2 }}>
                      <h3 style={{ fontFamily: "'TAN Songbird', serif", fontSize: 15, fontWeight: 600, color: '#fff', lineHeight: 1.4, marginBottom: 4 }}>
                        {r.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                        {category && <span>{category.emoji} {category.name}</span>}
                        {category && priceStr && <span style={{ opacity: 0.5 }}>·</span>}
                        {priceStr && <span>{priceStr}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
              {/* Placeholder "Esplora la mappa" when fewer than 3 saved — fills the row */}
              {displayList.length > 0 && displayList.length < 3 && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/')}
                  className="saved-empty-card"
                  style={{
                    height: 250,
                    borderRadius: 16,
                    border: '2px dashed #E8E5DE',
                    background: '#FAF7F2',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#D1CDC6'; e.currentTarget.style.background = '#fff' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E8E5DE'; e.currentTarget.style.background = '#FAF7F2' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1CDC6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#8A8680' }}>Esplora la mappa</span>
                  <span style={{ fontSize: 11, color: '#B5B0AA', marginTop: 3 }}>per salvare altri ristoranti</span>
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>

      <div style={{ paddingBottom: TAB_BAR_HEIGHT }}>
        <Footer />
      </div>

      <CityPickerSheet open={cityPickerOpen} onClose={() => setCityPickerOpen(false)} />
    </div>
  )
}
