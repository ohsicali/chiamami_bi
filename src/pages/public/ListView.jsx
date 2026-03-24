import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useVirtualizer } from '@tanstack/react-virtual'
import SearchBar from '../../components/Layout/SearchBar'
import FilterChips from '../../components/Layout/FilterChips'
import Navbar from '../../components/Layout/Navbar'
import Footer from '../../components/Layout/Footer'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
import { SkeletonCard } from '../../components/UI/LoadingSpinner'
import { PRICE_LABELS, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import Badge from '../../components/UI/Badge'

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

const SORT_OPTIONS = [
  { value: 'distance', label: 'Vicinanza' },
  { value: 'name', label: 'Nome A-Z' },
  { value: 'newest', label: 'Più recenti' },
]

function SortChip({ label, active, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap select-none transition-colors"
      style={{
        backgroundColor: active ? '#FF5757' : 'rgba(255,255,255,0.85)',
        color: active ? '#fff' : '#4B5563',
        borderColor: active ? '#FF5757' : 'rgba(209,213,219,0.6)',
      }}
      type="button"
    >
      {label}
    </motion.button>
  )
}

function LargeRestaurantCard({ restaurant, userPosition, onClick }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(name => getCategoryInfo(name))
    .filter(Boolean)
  const category = categories[0]
  const photoUrl =
    Array.isArray(restaurant.photos) && restaurant.photos.length > 0
      ? typeof restaurant.photos[0] === 'string'
        ? restaurant.photos[0]
        : restaurant.photos[0]?.photo_url
      : null

  return (
    <motion.button
      className="w-full rounded-2xl bg-white shadow-md overflow-hidden text-left"
      whileHover={{
        y: -4,
        boxShadow: '0 8px 30px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.05)',
      }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick?.(restaurant)}
    >
      {/* Large photo */}
      <div className="relative h-44 w-full bg-gray-100">
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: category?.color
              ? `${category.color}15`
              : '#f3f4f6',
          }}
        />
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={restaurant.name}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl">
            {category?.emoji || '🍽️'}
          </div>
        )}
        {/* Price badge */}
        {restaurant.price_range != null && (
          <div className="absolute top-3 right-3 rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm">
            {PRICE_LABELS[restaurant.price_range] || ''}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3
          className="text-lg font-bold text-gray-900 mb-1"
          style={{ fontFamily: "'TAN Songbird', serif" }}
        >
          {restaurant.name}
        </h3>

        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {categories.map(cat => (
            <Badge key={cat.name} color={cat.color} className="text-[11px]">
              {cat.emoji} {cat.name}
            </Badge>
          ))}
        </div>

        {restaurant.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-2">
            {restaurant.description}
          </p>
        )}

        {restaurant.address && (
          <p className="text-xs text-gray-400 truncate">{restaurant.address}</p>
        )}
      </div>
    </motion.button>
  )
}

// Threshold above which virtual scrolling kicks in
const VIRTUAL_THRESHOLD = 20

function VirtualizedList({ restaurants, userPosition, onCardClick, parentRef }) {
  const virtualizer = useVirtualizer({
    count: restaurants.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 340,
    overscan: 3,
    gap: 16,
  })

  return (
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const restaurant = restaurants[virtualItem.index]
        return (
          <div
            key={restaurant.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <LargeRestaurantCard
              restaurant={restaurant}
              userPosition={userPosition}
              onClick={onCardClick}
            />
          </div>
        )
      })}
    </div>
  )
}

export default function ListView() {
  const navigate = useNavigate()
  const { position } = useGeolocation()
  const {
    restaurants,
    loading,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
  } = useRestaurants(position)

  const scrollContainerRef = useRef(null)

  const handleToggleView = useCallback(() => {
    navigate('/')
  }, [navigate])

  const handleCardClick = useCallback(
    (restaurant) => {
      navigate(`/restaurant/${slugify(restaurant.name)}`)
    },
    [navigate]
  )

  const handleSortChange = useCallback(
    (sortBy) => {
      setFilters((prev) => ({ ...prev, sortBy }))
    },
    [setFilters]
  )

  const useVirtual = restaurants.length >= VIRTUAL_THRESHOLD

  return (
    <div
      ref={scrollContainerRef}
      className="flex flex-col min-h-dvh bg-gray-50 overflow-y-auto"
    >
      {/* Navbar */}
      <Navbar view="list" onToggleView={handleToggleView} />

      {/* Content */}
      <div className="flex-1 pt-16 px-4 pb-8 max-w-screen-lg mx-auto">
        {/* Search */}
        <div className="mb-3">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Filters */}
        <div className="mb-3">
          <FilterChips filters={filters} onFilterChange={setFilters} />
        </div>

        {/* Sort options */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <span className="text-xs font-medium text-gray-400 mr-1 flex-shrink-0">
            Ordina:
          </span>
          {SORT_OPTIONS.map((opt) => (
            <SortChip
              key={opt.value}
              label={opt.label}
              active={filters.sortBy === opt.value}
              onClick={() => handleSortChange(opt.value)}
            />
          ))}
        </div>

        {/* Results count */}
        <div className="mb-4">
          {loading ? (
            <div className="skeleton h-4 w-24 rounded-md" />
          ) : (
            <p className="text-sm font-medium text-gray-500">
              {restaurants.length}{' '}
              {restaurants.length === 1 ? 'ristorante' : 'ristoranti'}
            </p>
          )}
        </div>

        {/* Restaurant list */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 text-4xl">🔍</div>
            <p className="text-base font-semibold text-gray-800">
              Nessun ristorante trovato
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Prova a cambiare i filtri o la ricerca
            </p>
          </div>
        ) : useVirtual ? (
          <VirtualizedList
            restaurants={restaurants}
            userPosition={position}
            onCardClick={handleCardClick}
            parentRef={scrollContainerRef}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
              {restaurants.map((restaurant, index) => (
                <div key={restaurant.id}>
                  <LargeRestaurantCard
                    restaurant={restaurant}
                    userPosition={position}
                    onClick={handleCardClick}
                  />
                </div>
              ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
