import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MapView from '../../components/Map/MapView'
import MapControls from '../../components/Map/MapControls'
import BottomSheet, { SNAP_PEEK, SNAP_HALF, SNAP_FULL } from '../../components/Layout/BottomSheet'
import SearchBar from '../../components/Layout/SearchBar'
import FilterChips from '../../components/Layout/FilterChips'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'
import Navbar from '../../components/Layout/Navbar'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
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
  const navigate = useNavigate()
  const { position, loading: geoLoading, locate } = useGeolocation()
  const {
    restaurants,
    allRestaurants,
    loading,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
  } = useRestaurants(position)

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
          <FilterChips filters={filters} onFilterChange={setFilters} onNearbyClick={handleLocateMe} />
        </div>

        {/* Results count */}
        <div className="mb-3 px-1">
          {loading ? (
            <div className="skeleton h-4 w-24 rounded-md" />
          ) : (
            <p className="text-sm font-medium text-secondary">
              {restaurants.length}{' '}
              {restaurants.length === 1 ? 'ristorante' : 'ristoranti'}
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
        ) : restaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 text-4xl">🔍</div>
            <p className="text-base font-semibold text-primary">
              Nessun ristorante trovato
            </p>
            <p className="mt-1 text-sm text-secondary">
              Prova a cambiare i filtri o la ricerca
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-8">
            {restaurants.map((restaurant, index) => (
              <div key={restaurant.id}>
                <RestaurantCard
                  restaurant={restaurant}
                  index={index}
                  userPosition={position}
                  onClick={handleCardClick}
                />
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
