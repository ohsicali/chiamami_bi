import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import MapView from '../../components/Map/MapView'
import MapControls from '../../components/Map/MapControls'
import SearchBar from '../../components/Layout/SearchBar'
import FilterChips from '../../components/Layout/FilterChips'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'
import Navbar from '../../components/Layout/Navbar'
import { useRestaurants, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { SkeletonCard } from '../../components/UI/LoadingSpinner'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return { sub: 'Buongiorno', main: 'Dove si mangia', em: 'oggi?' }
  if (h < 18) return { sub: 'Buon pomeriggio', main: 'Dove si mangia', em: 'oggi?' }
  return { sub: 'Buonasera', main: 'Dove si mangia', em: 'stasera?' }
}

const CAROUSEL_MAX = 4

// TheFork-style mini card for the map carousel
function CarouselCard({ restaurant, discountValue, onClick }) {
  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(name => getCategoryInfo(name))
  const category = categories[0]

  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0
    ? restaurant.photos[0] : null
  const photoUrl = firstPhoto
    ? typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url
    : null

  const priceStr = restaurant.price_range != null ? '€'.repeat(restaurant.price_range + 1) : null

  return (
    <button
      onClick={() => onClick?.(restaurant)}
      className="flex-shrink-0 flex text-left"
      style={{
        width: 280,
        scrollSnapAlign: 'start',
        borderRadius: 16,
        background: '#fff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        border: 'none',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Photo left */}
      <div style={{ width: 110, minHeight: 100, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={restaurant.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#E8E5DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
            {category?.emoji || '🍽️'}
          </div>
        )}
        {discountValue && (
          <span style={{
            position: 'absolute', top: 6, left: 6,
            background: '#E8453C', color: '#fff', fontSize: 9, fontWeight: 700,
            padding: '2px 6px', borderRadius: 6,
          }}>
            -{discountValue}%
          </span>
        )}
      </div>
      {/* Info right */}
      <div style={{ padding: '10px 12px', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{
          fontFamily: "'TAN Songbird', 'Cormorant Garamond', serif",
          fontSize: 13, fontWeight: 600, color: '#111',
          lineHeight: 1.2, marginBottom: 3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {restaurant.name}
        </p>
        <p style={{ fontSize: 11, color: '#8A8680', lineHeight: 1.3 }}>
          {category?.name || ''}
          {priceStr && ` · ${priceStr}`}
        </p>
      </div>
    </button>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const greeting = getGreeting()

  const [showList, setShowList] = useState(false)

  useEffect(() => {
    document.body.classList.add('map-fixed')
    return () => document.body.classList.remove('map-fixed')
  }, [])

  const { position, loading: geoLoading, locate } = useGeolocation()
  const { user } = useAuth()
  const { savedIds, isSaved, toggleSave } = useSavedRestaurants(user?.id)
  const { discounts: activeDiscounts } = useActiveDiscounts()
  const discountRestaurantIds = new Set(activeDiscounts.map(d => d.restaurant_id))
  const discountValueMap = Object.fromEntries(activeDiscounts.map(d => [d.restaurant_id, d.discount_value]))

  const {
    restaurants,
    allRestaurants,
    loading,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
  } = useRestaurants(position)

  const [showDealsOnly, setShowDealsOnly] = useState(false)
  const displayedRestaurants = showDealsOnly
    ? restaurants.filter((r) => discountRestaurantIds.has(r.id))
    : restaurants

  const [selectedId, setSelectedId] = useState(null)
  const [visibleIds, setVisibleIds] = useState(null)
  const [mapCenter, setMapCenter] = useState(null)
  const mapRef = useRef(null)

  const handleVisibleRestaurantsChange = useCallback((ids, center) => {
    setVisibleIds(new Set(ids))
    setMapCenter(center)
  }, [])

  const viewportRestaurants = (() => {
    if (!visibleIds || !mapCenter) return displayedRestaurants
    const inView = displayedRestaurants.filter((r) => visibleIds.has(r.id))
    const toRad = (d) => (d * Math.PI) / 180
    const dist = (r) => {
      const dLat = toRad(r.latitude - mapCenter.lat)
      const dLng = toRad(r.longitude - mapCenter.lng)
      return dLat * dLat + dLng * dLng
    }
    inView.sort((a, b) => dist(a) - dist(b))
    return inView
  })()

  const handleLocateMe = useCallback(() => {
    locate()
    setFilters((prev) => ({ ...prev, sortBy: 'distance' }))
  }, [locate, setFilters])

  useEffect(() => {
    if (position) {
      mapRef.current?.flyToUser(position)
    }
  }, [position])

  const handlePinSelect = useCallback((id) => {
    const r = allRestaurants.find((r) => r.id === id)
    if (r) navigate(`/restaurant/${r.slug || slugify(r.name)}`)
  }, [allRestaurants, navigate])

  const handleCardClick = useCallback((restaurant) => {
    navigate(`/restaurant/${restaurant.slug || slugify(restaurant.name)}`)
  }, [navigate])

  // Featured + carousel restaurants
  const featuredRestaurant = viewportRestaurants.find(r => discountRestaurantIds.has(r.id)) || viewportRestaurants[0]
  const carouselRestaurants = viewportRestaurants.slice(0, CAROUSEL_MAX)
  const regularRestaurants = viewportRestaurants.filter(r => r.id !== featuredRestaurant?.id)

  // Swipe up handler for "Mostra elenco" bar
  const handleBarDragEnd = useCallback((_, info) => {
    if (info.offset.y < -50) {
      setShowList(true)
    }
  }, [])

  // Height of carousel area + elenco bar
  const bottomAreaHeight = carouselRestaurants.length > 0 ? 160 : 50

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* Navbar */}
      <Navbar view={showList ? 'list' : 'map'} onToggleView={() => setShowList(v => !v)} />

      {/* Map */}
      <MapView
        ref={mapRef}
        restaurants={allRestaurants}
        selectedId={selectedId}
        onSelectRestaurant={handlePinSelect}
        onVisibleRestaurantsChange={handleVisibleRestaurantsChange}
        userPosition={position}
        savedIds={savedIds}
        className="absolute inset-0"
      />

      {/* Map Controls — positioned above the carousel area */}
      {!showList && (
        <MapControls
          onLocateMe={handleLocateMe}
          isLocating={geoLoading}
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          bottomOffset={TAB_BAR_HEIGHT + bottomAreaHeight + 16}
        />
      )}

      {/* === MAP VIEW: Carousel + Elenco bar === */}
      {!showList && (
        <div
          className="absolute left-0 right-0"
          style={{ bottom: TAB_BAR_HEIGHT, zIndex: 20 }}
        >
          {/* Horizontal carousel of cards */}
          {carouselRestaurants.length > 0 && (
            <div
              className="flex gap-3 px-4 pb-3 overflow-x-auto carousel-scroll"
              style={{
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              <style>{`.carousel-scroll::-webkit-scrollbar { display: none; }`}</style>
              {carouselRestaurants.map((restaurant) => (
                <CarouselCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  discountValue={discountValueMap[restaurant.id]}
                  onClick={handleCardClick}
                />
              ))}
              {/* "Vedi tutti" card */}
              {viewportRestaurants.length > CAROUSEL_MAX && (
                <button
                  onClick={() => setShowList(true)}
                  className="flex-shrink-0 flex flex-col items-center justify-center"
                  style={{
                    width: 100,
                    scrollSnapAlign: 'start',
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(12px)',
                    border: '1.5px solid #E8E5DE',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 18, marginBottom: 4 }}>📋</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#111' }}>Vedi tutti</span>
                  <span style={{ fontSize: 10, color: '#8A8680' }}>{viewportRestaurants.length}</span>
                </button>
              )}
            </div>
          )}

          {/* "Mostra elenco" bar — swipeable + tappable, rounded pill */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleBarDragEnd}
            onClick={() => setShowList(true)}
            style={{
              margin: '0 16px',
              padding: '14px 0',
              background: 'rgba(250,247,242,0.96)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 20,
              boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              touchAction: 'none',
              WebkitTapHighlightColor: 'transparent',
              marginBottom: 8,
            }}
          >
            {/* Drag handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.15)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#E8453C' }}>
              Mostra elenco di {viewportRestaurants.length} ristoranti
            </span>
          </motion.div>
        </div>
      )}

      {/* === LIST VIEW: Full screen overlay === */}
      <AnimatePresence>
        {showList && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            className="absolute inset-0"
            style={{
              zIndex: 30,
              background: '#FAF7F2',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 60px)',
              paddingBottom: TAB_BAR_HEIGHT + 60,
            }}
          >
            {/* List content — all scrolls together, nothing sticky */}
            <div className="px-5">
              {/* Greeting */}
              <div style={{ marginBottom: 16 }}>
                <p style={{
                  fontSize: 11, color: '#8A8680', fontWeight: 600,
                  letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2,
                }}>
                  {greeting.sub}
                </p>
                <h1 style={{
                  fontFamily: "'TAN Songbird', 'Cormorant Garamond', serif",
                  fontSize: 22, fontWeight: 600, color: '#111', lineHeight: 1.15,
                }}>
                  {greeting.main} <em style={{ fontStyle: 'italic', color: '#E8453C' }}>{greeting.em}</em>
                </h1>
              </div>

              {/* Search */}
              <div style={{ marginBottom: 14 }}>
                <SearchBar value={searchQuery} onChange={setSearchQuery} />
              </div>

              {/* Filters */}
              <div style={{ marginBottom: 14 }}>
                <FilterChips
                  filters={filters}
                  onFilterChange={setFilters}
                  onNearbyClick={handleLocateMe}
                  showDealsOnly={showDealsOnly}
                  onToggleDeals={() => setShowDealsOnly((v) => !v)}
                  dealsCount={discountRestaurantIds.size}
                />
              </div>

              {/* Results count */}
              <div style={{ marginBottom: 12 }}>
                {loading ? (
                  <div className="skeleton h-4 w-24 rounded-md" />
                ) : (
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680' }}>
                    {viewportRestaurants.length}{' '}
                    {viewportRestaurants.length === 1 ? t('home.restaurant') : t('home.restaurants')}
                    {visibleIds && viewportRestaurants.length < displayedRestaurants.length && (
                      <span style={{ fontWeight: 500, letterSpacing: 0 }}> in questa zona</span>
                    )}
                  </p>
                )}
              </div>

              {/* Restaurant list */}
              {loading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : viewportRestaurants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div style={{ marginBottom: 12, fontSize: 40 }}>🔍</div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{t('home.noResults')}</p>
                  <p style={{ marginTop: 4, fontSize: 14, color: '#8A8680' }}>{t('home.changeFilters')}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 pb-8">
                  {/* Hero card */}
                  {featuredRestaurant && (
                    <RestaurantCard
                      restaurant={featuredRestaurant}
                      index={0}
                      userPosition={position}
                      onClick={handleCardClick}
                      saved={isSaved(featuredRestaurant.id)}
                      onSaveToggle={user ? () => toggleSave(featuredRestaurant.id) : () => navigate('/login')}
                      hasDiscount={discountRestaurantIds.has(featuredRestaurant.id)}
                      discountValue={discountValueMap[featuredRestaurant.id]}
                      variant="hero"
                    />
                  )}

                  {/* Regular cards */}
                  {regularRestaurants.map((restaurant, index) => (
                    <RestaurantCard
                      key={restaurant.id}
                      restaurant={restaurant}
                      index={index + 1}
                      userPosition={position}
                      onClick={handleCardClick}
                      saved={isSaved(restaurant.id)}
                      onSaveToggle={user ? () => toggleSave(restaurant.id) : () => navigate('/login')}
                      hasDiscount={discountRestaurantIds.has(restaurant.id)}
                      discountValue={discountValueMap[restaurant.id]}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Floating "Vedi la mappa" button — gold/accent style */}
            <button
              onClick={() => setShowList(false)}
              style={{
                position: 'fixed',
                bottom: TAB_BAR_HEIGHT + 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 40,
                background: '#C4A265',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                padding: '12px 28px',
                borderRadius: 28,
                border: 'none',
                boxShadow: '0 4px 24px rgba(196,162,101,0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              Vedi la mappa
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
