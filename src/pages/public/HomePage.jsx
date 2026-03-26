import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MapView from '../../components/Map/MapView'
import MapControls from '../../components/Map/MapControls'
import BottomSheet, { SNAP_PEEK, SNAP_HALF, SNAP_FULL } from '../../components/Layout/BottomSheet'
import SearchBar from '../../components/Layout/SearchBar'
import FilterChips from '../../components/Layout/FilterChips'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'
import Navbar from '../../components/Layout/Navbar'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { SkeletonCard } from '../../components/UI/LoadingSpinner'

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
  const [sheetSnap, setSheetSnap] = useState(SNAP_HALF)
  const [visibleIds, setVisibleIds] = useState(null)
  const [mapCenter, setMapCenter] = useState(null)
  const mapRef = useRef(null)
  const sheetRef = useRef(null)

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

  const handleToggleView = useCallback(() => {
    const current = sheetRef.current?.getSnapIndex() ?? SNAP_PEEK
    if (current === SNAP_FULL) {
      sheetRef.current?.snapTo(SNAP_PEEK)
    } else {
      sheetRef.current?.snapTo(SNAP_FULL)
    }
  }, [])

  const handleSnapChange = useCallback((snap) => {
    setSheetSnap(snap)
  }, [])

  const handleSearchFocus = useCallback(() => {
    sheetRef.current?.snapTo(SNAP_HALF)
  }, [])

  // Find a featured restaurant (first one with a discount, or just first)
  const featuredRestaurant = viewportRestaurants.find(r => discountRestaurantIds.has(r.id)) || viewportRestaurants[0]
  const regularRestaurants = viewportRestaurants.filter(r => r.id !== featuredRestaurant?.id)

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* Navbar — dark gradient over map */}
      <Navbar view={sheetSnap === SNAP_FULL ? 'list' : 'map'} onToggleView={handleToggleView} />

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

      {/* Warm overlay on map edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background: `
            radial-gradient(ellipse at center, transparent 40%, rgba(250,247,242,0.25) 100%),
            linear-gradient(180deg, rgba(250,247,242,0.4) 0%, transparent 12%),
            linear-gradient(0deg, rgba(250,247,242,0.3) 0%, transparent 8%)
          `,
        }}
      />

      {/* Map Controls */}
      <MapControls
        onLocateMe={handleLocateMe}
        isLocating={geoLoading}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        sheetSnap={sheetSnap}
      />

      {/* Floating "Elenco" button when sheet is collapsed */}
      {sheetSnap === SNAP_PEEK && (
        <button
          onClick={() => sheetRef.current?.snapTo(SNAP_HALF)}
          style={{
            position: 'absolute',
            bottom: 110,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            background: '#111',
            color: '#FAF7F2',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 24px',
            borderRadius: 24,
            border: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            letterSpacing: 0.5,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          Elenco
        </button>
      )}

      {/* Bottom Sheet */}
      <BottomSheet ref={sheetRef} onSnapChange={handleSnapChange}>
        {/* Greeting */}
        <div style={{ marginBottom: 16 }}>
          <p style={{
            fontSize: 12, color: '#8A8680', fontWeight: 500,
            letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2,
          }}>
            {greeting.sub}
          </p>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 26, fontWeight: 600, color: '#111', lineHeight: 1.1,
          }}>
            {greeting.main} <em style={{ fontStyle: 'italic', color: '#E8453C' }}>{greeting.em}</em>
          </h1>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onFocus={handleSearchFocus}
          />
        </div>

        {/* Filters */}
        <div style={{ marginBottom: 16 }}>
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
        <div style={{ marginBottom: 12, paddingLeft: 6 }}>
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
            {/* Hero card — first featured restaurant */}
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
      </BottomSheet>
    </div>
  )
}
