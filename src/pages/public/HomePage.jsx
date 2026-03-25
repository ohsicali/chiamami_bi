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

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Lock body scroll for map page
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

  // Filter for saved / deals
  const [showSavedOnly, setShowSavedOnly] = useState(false)
  const [showDealsOnly, setShowDealsOnly] = useState(false)
  const displayedRestaurants = showSavedOnly
    ? restaurants.filter((r) => savedIds.has(r.id))
    : showDealsOnly
    ? restaurants.filter((r) => discountRestaurantIds.has(r.id))
    : restaurants

  const [selectedId, setSelectedId] = useState(null)
  const [sheetSnap, setSheetSnap] = useState(SNAP_PEEK)
  const [visibleIds, setVisibleIds] = useState(null) // null = show all (initial state)
  const [mapCenter, setMapCenter] = useState(null)
  const mapRef = useRef(null)
  const sheetRef = useRef(null)

  // Callback from MapView: visible restaurant IDs + map center
  const handleVisibleRestaurantsChange = useCallback((ids, center) => {
    setVisibleIds(new Set(ids))
    setMapCenter(center)
  }, [])

  // Sort displayed restaurants by distance to map center, filter to viewport
  const viewportRestaurants = (() => {
    if (!visibleIds || !mapCenter) return displayedRestaurants

    const inView = displayedRestaurants.filter((r) => visibleIds.has(r.id))

    // Sort by distance to map center
    const toRad = (d) => (d * Math.PI) / 180
    const dist = (r) => {
      const dLat = toRad(r.latitude - mapCenter.lat)
      const dLng = toRad(r.longitude - mapCenter.lng)
      return dLat * dLat + dLng * dLng // no need for exact distance, just relative order
    }
    inView.sort((a, b) => dist(a) - dist(b))
    return inView
  })()

  const handleLocateMe = useCallback(() => {
    locate()
    setFilters((prev) => ({ ...prev, sortBy: 'distance' }))
  }, [locate, setFilters])

  // Fly to user position when geolocation completes
  useEffect(() => {
    if (position) {
      mapRef.current?.flyToUser(position)
    }
  }, [position])

  const handlePinSelect = useCallback((id) => {
    const r = allRestaurants.find((r) => r.id === id)
    if (r) {
      navigate(`/restaurant/${r.slug || slugify(r.name)}`)
    }
  }, [allRestaurants, navigate])

  const handleCardClick = useCallback(
    (restaurant) => {
      navigate(`/restaurant/${restaurant.slug || slugify(restaurant.name)}`)
    },
    [navigate]
  )

  const handleToggleView = useCallback(() => {
    // Toggle between peek and full via the bottom sheet
    const current = sheetRef.current?.getSnapIndex() ?? SNAP_PEEK
    if (current === SNAP_FULL) {
      sheetRef.current?.snapTo(SNAP_PEEK)
    } else {
      sheetRef.current?.snapTo(SNAP_FULL)
    }
  }, [])

  const handleSnapChange = useCallback((snap) => {
    setSheetSnap(snap)
    // Update map padding so markers/center stay visible above the sheet
    if (mapRef.current?.setPadding) {
      const sheetH = snap === SNAP_FULL ? window.innerHeight * 0.8
        : snap === SNAP_HALF ? window.innerHeight * 0.55
        : 130
      mapRef.current.setPadding(sheetH)
    }
  }, [])

  const handleSearchFocus = useCallback(() => {
    // When search bar is focused, expand sheet to half
    sheetRef.current?.snapTo(SNAP_HALF)
  }, [])

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* Navbar - fixed top */}
      <Navbar view={sheetSnap === SNAP_FULL ? 'list' : 'map'} onToggleView={handleToggleView} />

      {/* Map - full screen background */}
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

      {/* Map Controls - bottom right, above the bottom sheet */}
      <MapControls
        onLocateMe={handleLocateMe}
        isLocating={geoLoading}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
      />

      {/* Floating Lista/Mappa toggle — ON the map, above BottomSheet */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-40 md:hidden"
        style={{
          bottom: sheetSnap === SNAP_FULL
            ? 'calc(100dvh - 70px - env(safe-area-inset-bottom, 0px))'
            : sheetSnap === SNAP_HALF
            ? 'calc(55dvh + 8px)'
            : 'calc(86px + 78px + 12px)',
          transition: 'bottom 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <button
          onClick={handleToggleView}
          style={{
            background: '#1a1a1a',
            color: '#fff',
            borderRadius: 24,
            padding: '8px 22px',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
            WebkitTapHighlightColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {sheetSnap === SNAP_FULL ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              Mappa
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Lista
            </>
          )}
        </button>
      </div>

      {/* Bottom Sheet — Apple Maps style */}
      <BottomSheet ref={sheetRef} onSnapChange={handleSnapChange}>
        {/* Search Bar */}
        <div className="mb-3">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onFocus={handleSearchFocus}
          />
        </div>

        {/* Filter Chips — 2 rows: categories + action chips */}
        <div className="mb-4">
          <FilterChips
            filters={filters}
            onFilterChange={setFilters}
            onNearbyClick={handleLocateMe}
            showDealsOnly={showDealsOnly}
            onToggleDeals={() => { setShowDealsOnly((v) => !v); setShowSavedOnly(false) }}
            dealsCount={discountRestaurantIds.size}
          />
        </div>

        {/* Results count */}
        <div className="mb-3 px-1">
          {loading ? (
            <div className="skeleton h-4 w-24 rounded-md" />
          ) : (
            <p className="text-sm font-medium text-secondary">
              {viewportRestaurants.length}{' '}
              {viewportRestaurants.length === 1 ? t('home.restaurant') : t('home.restaurants')}
              {visibleIds && viewportRestaurants.length < displayedRestaurants.length && (
                <span className="text-xs text-secondary/60"> {t('home.inThisArea', 'in questa zona')}</span>
              )}
            </p>
          )}
        </div>

        {/* Restaurant list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} className="!shadow-sm" />
            ))}
          </div>
        ) : viewportRestaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 text-4xl">🔍</div>
            <p className="text-base font-semibold text-primary">
              {t('home.noResults')}
            </p>
            <p className="mt-1 text-sm text-secondary">
              {t('home.changeFilters')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-8">
            {viewportRestaurants.map((restaurant, index) => (
              <div key={restaurant.id}>
                <RestaurantCard
                  restaurant={restaurant}
                  index={index}
                  userPosition={position}
                  onClick={handleCardClick}
                  saved={isSaved(restaurant.id)}
                  onSaveToggle={user ? () => toggleSave(restaurant.id) : () => navigate('/login')}
                  hasDiscount={discountRestaurantIds.has(restaurant.id)}
                  discountValue={discountValueMap[restaurant.id]}
                />
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
