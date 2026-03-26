import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useDrag } from '@use-gesture/react'
import MapView from '../../components/Map/MapView'
import MapControls from '../../components/Map/MapControls'
import SearchBar from '../../components/Layout/SearchBar'
import FilterChips from '../../components/Layout/FilterChips'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'
import SaveButton from '../../components/Restaurant/SaveButton'
import Navbar from '../../components/Layout/Navbar'
import { useRestaurants, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { getDistance, formatDistance } from '../../lib/utils/distance'
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

// Compact card floating on map — no fixed height, text wraps freely
function MiniCard({ restaurant, userPosition, discountValue, saved, onSave, onClick }) {
  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(name => getCategoryInfo(name))
  const category = categories[0]
  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0
    ? restaurant.photos[0] : null
  const photoUrl = firstPhoto
    ? typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url
    : null
  const priceStr = restaurant.price_range != null ? '€'.repeat(restaurant.price_range + 1) : null
  const distance = userPosition && restaurant.latitude && restaurant.longitude
    ? getDistance(userPosition.lat, userPosition.lng, restaurant.latitude, restaurant.longitude)
    : null

  return (
    <button
      onClick={() => onClick?.(restaurant)}
      className="flex-shrink-0 flex text-left relative"
      style={{
        width: 260,
        scrollSnapAlign: 'start',
        borderRadius: 14,
        background: '#fff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        border: 'none',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        padding: 10,
        gap: 10,
      }}
    >
      <div style={{ width: 68, height: 68, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
        {photoUrl ? (
          <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#E8E5DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            {category?.emoji || '🍽️'}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 20 }}>
        <p style={{
          fontFamily: "'TAN Songbird', 'Cormorant Garamond', serif",
          fontSize: 12, fontWeight: 600, color: '#111', lineHeight: 1.5, marginBottom: 2,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {restaurant.name}
        </p>
        <p style={{ fontSize: 10, color: '#8A8680', lineHeight: 1.3, marginBottom: 2 }}>
          {category?.name || ''}
          {restaurant.recommended_for && ` · ${restaurant.recommended_for}`}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
          {priceStr && <span style={{ color: '#555', fontWeight: 600 }}>{priceStr}</span>}
          {distance != null && <span style={{ color: '#8A8680' }}>{formatDistance(distance)}</span>}
          {discountValue && (
            <span style={{ background: 'rgba(232,69,60,0.1)', color: '#E8453C', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>
              -{discountValue}%
            </span>
          )}
        </div>
      </div>
      {onSave && (
        <div style={{ position: 'absolute', top: 8, right: 8 }} onClick={(e) => { e.stopPropagation(); onSave() }}>
          <SaveButton saved={saved} size="sm" />
        </div>
      )}
    </button>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const greeting = getGreeting()

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

  const featuredRestaurant = viewportRestaurants.find(r => discountRestaurantIds.has(r.id)) || viewportRestaurants[0]
  const carouselRestaurants = viewportRestaurants.slice(0, CAROUSEL_MAX)
  const regularRestaurants = viewportRestaurants.filter(r => r.id !== featuredRestaurant?.id)

  // --- Sheet system ---
  // sheetY represents how many px the sheet top is from screen top
  // sheetY = windowH = fully closed (off screen bottom)
  // sheetY = 0 = fully open
  const windowH = typeof window !== 'undefined' ? window.innerHeight : 800
  const sheetY = useMotionValue(windowH)
  const [isSheetVisible, setIsSheetVisible] = useState(false)
  const sheetContentRef = useRef(null)

  // Derive showList from sheet position for hiding map controls
  const showList = isSheetVisible

  // Opacity of sheet based on position (fade in as it slides up)
  const sheetOpacity = useTransform(sheetY, [windowH, windowH * 0.5, 0], [0, 1, 1])

  const openSheet = useCallback(() => {
    setIsSheetVisible(true)
    animate(sheetY, 0, { type: 'spring', stiffness: 300, damping: 35 })
  }, [sheetY])

  const closeSheet = useCallback(() => {
    animate(sheetY, windowH, { type: 'spring', stiffness: 300, damping: 35 })
    // Delay hiding to let animation finish
    setTimeout(() => setIsSheetVisible(false), 400)
  }, [sheetY, windowH])

  // Drag on "Mostra elenco" bar — makes sheet follow finger
  const barBind = useDrag(({ movement: [, my], velocity: [, vy], direction: [, dy], active, first }) => {
    if (first) {
      // Make sheet visible as soon as drag starts
      setIsSheetVisible(true)
    }
    if (active) {
      // my is negative when dragging up. Sheet starts at windowH.
      // newY = windowH + my (my is negative so sheet moves up)
      const newY = Math.max(0, Math.min(windowH, windowH + my))
      sheetY.set(newY)
    } else {
      const current = sheetY.get()
      // If dragged past 40% of screen OR fast swipe up
      if (current < windowH * 0.6 || (vy > 0.4 && dy < 0)) {
        openSheet()
      } else {
        closeSheet()
      }
    }
  }, { axis: 'y', filterTaps: true })

  // Drag on sheet handle to close
  const sheetHandleBind = useDrag(({ movement: [, my], velocity: [, vy], direction: [, dy], active }) => {
    if (active) {
      const newY = Math.max(0, my)
      sheetY.set(newY)
    } else {
      if (sheetY.get() > windowH * 0.25 || (vy > 0.4 && dy > 0)) {
        closeSheet()
      } else {
        animate(sheetY, 0, { type: 'spring', stiffness: 300, damping: 35 })
      }
    }
  }, { axis: 'y', from: () => [0, 0], filterTaps: true })

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* Navbar */}
      <Navbar view={showList ? 'list' : 'map'} onToggleView={() => showList ? closeSheet() : openSheet()} />

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

      {/* Map Controls — above carousel + bar. Bar ~50px, carousel ~96px, some padding */}
      {!showList && (
        <MapControls
          onLocateMe={handleLocateMe}
          isLocating={geoLoading}
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          bottomOffset={TAB_BAR_HEIGHT + 50 + 96 + 24}
        />
      )}

      {/* === BOTTOM AREA on map: floating cards + elenco bar === */}
      {!showList && (
        <div
          className="absolute left-0 right-0"
          style={{ bottom: TAB_BAR_HEIGHT, zIndex: 20, pointerEvents: 'none' }}
        >
          {/* Floating carousel */}
          {carouselRestaurants.length > 0 && (
            <div
              className="flex gap-2.5 px-4 pb-3 overflow-x-auto carousel-scroll"
              style={{
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                pointerEvents: 'auto',
              }}
            >
              <style>{`.carousel-scroll::-webkit-scrollbar { display: none; }`}</style>
              {carouselRestaurants.map((restaurant) => (
                <MiniCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  userPosition={position}
                  discountValue={discountValueMap[restaurant.id]}
                  saved={isSaved(restaurant.id)}
                  onSave={user ? () => toggleSave(restaurant.id) : () => navigate('/login')}
                  onClick={handleCardClick}
                />
              ))}
              {viewportRestaurants.length > CAROUSEL_MAX && (
                <button
                  onClick={openSheet}
                  className="flex-shrink-0 flex flex-col items-center justify-center"
                  style={{
                    width: 80,
                    scrollSnapAlign: 'start',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(12px)',
                    border: '1.5px dashed #E8E5DE',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#8A8680' }}>Vedi</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#8A8680' }}>tutti</span>
                  <span style={{ fontSize: 10, color: '#B5B0A8', marginTop: 2 }}>{viewportRestaurants.length}</span>
                </button>
              )}
            </div>
          )}

          {/* "Mostra elenco" bar — drags sheet up as you pull */}
          <div
            {...barBind()}
            onClick={openSheet}
            style={{
              background: 'rgba(250,247,242,0.96)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -2px 16px rgba(0,0,0,0.06)',
              padding: '10px 0 12px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              touchAction: 'none',
              WebkitTapHighlightColor: 'transparent',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.12)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#E8453C' }}>
              Mostra elenco di {viewportRestaurants.length} ristoranti
            </span>
          </div>
        </div>
      )}

      {/* === SHEET OVERLAY — always in DOM, follows sheetY with finger === */}
      <motion.div
        style={{
          y: sheetY,
          opacity: sheetOpacity,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: isSheetVisible ? 35 : -1,
          background: '#FAF7F2',
          borderRadius: '20px 20px 0 0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: isSheetVisible ? 'auto' : 'none',
        }}
      >
        {/* Drag handle to close — with safe area padding */}
        <div
          {...sheetHandleBind()}
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            paddingBottom: 8,
            display: 'flex',
            justifyContent: 'center',
            cursor: 'grab',
            touchAction: 'none',
            flexShrink: 0,
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.15)' }} />
        </div>

        {/* Scrollable list content */}
        <div
          ref={sheetContentRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: TAB_BAR_HEIGHT + 70,
          }}
        >
          <div className="px-5">
            {/* Greeting */}
            <div style={{ marginBottom: 16 }}>
              <p style={{
                fontSize: 11, color: '#8A8680', fontWeight: 600,
                letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
              }}>
                {greeting.sub}
              </p>
              <h1 style={{
                fontFamily: "'TAN Songbird', 'Cormorant Garamond', serif",
                fontSize: 22, fontWeight: 600, color: '#111', lineHeight: 1.5,
              }}>
                {greeting.main}{' '}
                <em style={{ fontStyle: 'italic', color: '#E8453C' }}>{greeting.em}</em>
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
        </div>

        {/* Floating "Vedi la mappa" button */}
        <button
          onClick={closeSheet}
          style={{
            position: 'absolute',
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
    </div>
  )
}
