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
import { Link } from 'react-router-dom'

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
  const { position, loading: geoLoading, locate } = useGeolocation()
  const { user } = useAuth()
  const { savedIds, isSaved, toggleSave } = useSavedRestaurants(user?.id)
  const { discounts: activeDiscounts } = useActiveDiscounts()
  const discountRestaurantIds = new Set(activeDiscounts.map(d => d.restaurant_id))
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
  const mapRef = useRef(null)
  const sheetRef = useRef(null)

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

        {/* Filter Chips (categories) */}
        <div className="mb-4">
          <FilterChips
            filters={filters}
            onFilterChange={setFilters}
            onNearbyClick={handleLocateMe}
            user={user}
            showSavedOnly={showSavedOnly}
            onToggleSaved={() => { setShowSavedOnly((v) => !v); setShowDealsOnly(false) }}
            savedCount={savedIds.size}
            showDealsOnly={showDealsOnly}
            onToggleDeals={() => { setShowDealsOnly((v) => !v); setShowSavedOnly(false) }}
            dealsCount={discountRestaurantIds.size}
          />
        </div>

        {/* Bi intro — minimal single-line */}
        <Link
          to="/about"
          className="flex items-center gap-2.5 mb-3 px-1 group"
        >
          <div className="w-8 h-8 rounded-full bg-accent flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            Bi
          </div>
          <p
            className="text-sm text-secondary group-hover:text-primary transition-colors italic"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            I posti che amo davvero
          </p>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>

        {/* Results count */}
        <div className="mb-3 px-1">
          {loading ? (
            <div className="skeleton h-4 w-24 rounded-md" />
          ) : (
            <p className="text-sm font-medium text-secondary">
              {displayedRestaurants.length}{' '}
              {displayedRestaurants.length === 1 ? t('home.restaurant') : t('home.restaurants')}
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
        ) : displayedRestaurants.length === 0 ? (
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
            {displayedRestaurants.map((restaurant, index) => (
              <div key={restaurant.id}>
                <RestaurantCard
                  restaurant={restaurant}
                  index={index}
                  userPosition={position}
                  onClick={handleCardClick}
                  saved={isSaved(restaurant.id)}
                  onSaveToggle={user ? () => toggleSave(restaurant.id) : () => navigate('/login')}
                  hasDiscount={discountRestaurantIds.has(restaurant.id)}
                />
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
