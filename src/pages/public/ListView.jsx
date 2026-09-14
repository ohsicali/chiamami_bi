import { useState, useCallback, useRef, useMemo, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import SearchBar from '../../components/Layout/SearchBar'
import MobileFilterBar from '../../components/Layout/MobileFilterBar'
import Navbar from '../../components/Layout/Navbar'
import MobileTabBar from '../../components/Layout/MobileTabBar'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useAuth } from '../../lib/hooks/useAuth'
import { SkeletonCard } from '../../components/UI/LoadingSpinner'
import { getDistance } from '../../lib/utils/distance'
import { sortByActiveCity } from '../../components/UI/CityBadge'
import { useCity } from '../../lib/CityContext'
import MetaTags from '../../components/SEO/MetaTags'
import { slugify } from '../../lib/utils/slug'
import AdSlot from '../../components/Ads/AdBanner'
import SaveAuthGate from '../../components/Restaurant/SaveAuthGate'
import { useSaveGate } from '../../lib/hooks/useSaveGate'
import { useAdSlot } from '../../lib/hooks/useAds'
import { LIST_AD_AFTER } from '../../lib/adSlots'

/* ============================================
   VIRTUALIZED LIST — uses window scroll
   Stessa card `RestaurantCard` (variante "default") usata dalla lista di
   /esplora: prima qui c'era una card scritta da zero (HorizontalCard), e le
   due liste avevano un aspetto completamente diverso pur mostrando gli
   stessi locali.
   ============================================ */
function VirtualizedRestaurantList({ items, userPosition, discountRestaurantIds, discountTitleMap, isSaved, onSave, onClick, activeCity = 'Torino' }) {
  const parentRef = useRef(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  // L'annuncio non si può infilare nel DOM a mano: la lista è virtualizzata,
  // quindi deve essere un elemento della sequenza come le schede, altrimenti
  // il calcolo delle posizioni si sfalsa e lo scroll salta.
  const { ad: listAd } = useAdSlot('list_inline')
  const rows = useMemo(() => {
    const cards = items.map((r) => ({ kind: 'card', key: r.id, restaurant: r }))
    if (!listAd || cards.length <= LIST_AD_AFTER) return cards
    cards.splice(LIST_AD_AFTER, 0, { kind: 'ad', key: `ad-${listAd.id}` })
    return cards
  }, [items, listAd])

  useLayoutEffect(() => {
    if (!parentRef.current) return
    const update = () => {
      const rect = parentRef.current.getBoundingClientRect()
      setScrollMargin(rect.top + window.scrollY)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 140,
    overscan: 6,
    scrollMargin,
  })

  return (
    <div
      ref={parentRef}
      style={{ position: 'relative', height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((vi) => {
        const row = rows[vi.index]
        if (!row) return null
        const r = row.restaurant
        return (
          <div
            key={row.key}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vi.start - scrollMargin}px)`,
            }}
          >
            {row.kind === 'ad' ? (
              <div style={{ paddingBottom: 16 }}>
                <AdSlot slot="list_inline" />
              </div>
            ) : (
              <div style={{ paddingBottom: 12 }}>
                <RestaurantCard
                  restaurant={r}
                  index={vi.index}
                  userPosition={userPosition}
                  onClick={onClick}
                  saved={isSaved(r.id)}
                  onSaveToggle={() => onSave(r.id)}
                  hasDiscount={discountRestaurantIds.has(r.id)}
                  discountTitle={discountTitleMap[r.id]}
                  activeCity={activeCity}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ============================================
   MAIN LIST VIEW
   ============================================ */
export default function ListView() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { city } = useCity()
  const activeCity = city?.name || 'Torino'
  const { position } = useGeolocation()
  const {
    restaurants,
    loading,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
  } = useRestaurants(position)

  const [showDealsOnly, setShowDealsOnly] = useState(false)
  const [extraFilters, setExtraFilters] = useState({ dietary: [], radiusKm: null })

  const { discounts: activeDiscounts, allFeatured: featuredDiscounts } = useActiveDiscounts()
  const { isSaved, toggleSave, addSave } = useSavedRestaurants(user?.id)
  const { saveGateFor, openSaveGate, closeSaveGate } = useSaveGate({ user, addSave })

  // Stessa forma dati di /esplora (HomePage): un Set per "ha uno sconto" e
  // una mappa col titolo grezzo dello sconto, che `RestaurantCard` mostra
  // nella fascia in cima alla card.
  const discountRestaurantIds = useMemo(
    () => new Set(activeDiscounts.map(d => d.restaurant_id)),
    [activeDiscounts]
  )
  const discountTitleMap = useMemo(
    () => Object.fromEntries(activeDiscounts.map(d => [d.restaurant_id, d.title])),
    [activeDiscounts]
  )

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

  // Mandare via dall'elenco costava la ricerca appena fatta: filtri, ordine e
  // posizione nella lista sparivano, e chi non voleva registrarsi non aveva
  // modo di tornare indietro se non rifacendo tutto. Ora il riquadro si apre
  // sopra l'elenco e chi annulla è ancora esattamente dov'era.
  const handleSave = useCallback((id) => {
    if (!user) {
      openSaveGate(id)
      return
    }
    toggleSave(id)
  }, [user, openSaveGate, toggleSave])

  // Apply extra client-side filters (deals, dietary, radius)
  const displayedRestaurants = useMemo(() => {
    let result = showDealsOnly
      ? restaurants.filter(r => discountRestaurantIds.has(r.id))
      : restaurants

    if (extraFilters.dietary?.length > 0) {
      const fieldMap = {
        vegano: 'is_vegan', vegetariano: 'is_vegetarian',
        salutare: 'is_healthy', senza_glutine: 'is_gluten_free',
      }
      result = result.filter(r =>
        extraFilters.dietary.every(key => r[fieldMap[key]] === true)
      )
    }

    if (extraFilters.radiusKm !== null && position) {
      result = result.filter(r => {
        if (!r.latitude || !r.longitude) return true
        return getDistance(position.lat, position.lng, r.latitude, r.longitude) <= extraFilters.radiusKm
      })
    }

    return result
  }, [restaurants, showDealsOnly, extraFilters, position, discountRestaurantIds])

  // Random restaurant with discount as hero — excludes restaurants with featured discounts
  // (those are shown in DealsPage "In evidenza") so the two pages differ
  const [heroSeed] = useState(() => Math.floor(Math.random() * 1000))
  const featuredDiscountRestaurantIds = new Set((featuredDiscounts || []).map(d => d.restaurant_id))
  const restaurantsWithDiscount = displayedRestaurants.filter(r => discountRestaurantIds.has(r.id) && !featuredDiscountRestaurantIds.has(r.id))
  const featuredRestaurant = restaurantsWithDiscount.length > 0
    ? restaurantsWithDiscount[heroSeed % restaurantsWithDiscount.length]
    : displayedRestaurants.filter(r => !featuredDiscountRestaurantIds.has(r.id))[0] || displayedRestaurants[0]
  // Locali della città attiva prima, poi gli altri (ordine interno invariato).
  const otherRestaurants = sortByActiveCity(
    displayedRestaurants.filter(r => r.id !== featuredRestaurant?.id),
    activeCity,
  )

  return (
    <div
      ref={scrollContainerRef}
      style={{
        minHeight: '100dvh', background: '#FAF7F2',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 80,
      }}
    >
      <MetaTags
        title="Tutti i ristoranti di Torino consigliati da Bi — ChiamamiBi"
        description="Esplora la lista completa dei ristoranti, bar e locali consigliati da Bi a Torino. Filtra per categoria, fascia di prezzo, momento della giornata."
        url="https://chiamamibi.com/list"
        canonical="https://chiamamibi.com/list"
        type="website"
      />
      {/* Navbar */}
      <Navbar view="list" onToggleView={handleToggleView} restaurants={restaurants} />

      {/* Content */}
      <div style={{ flex: 1, paddingTop: 100, paddingLeft: 16, paddingRight: 16, maxWidth: 600, margin: '0 auto', width: '100%' }}>
        {/* Search */}
        <div style={{ marginBottom: 12 }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Filters */}
        <div style={{ marginBottom: 16 }}>
          <MobileFilterBar
            filters={filters}
            onFilterChange={setFilters}
            showDealsOnly={showDealsOnly}
            onToggleDeals={() => setShowDealsOnly(v => !v)}
            restaurantCount={displayedRestaurants.length}
            extraFilters={extraFilters}
            onExtraFilterChange={setExtraFilters}
          />
        </div>

        {/* Restaurant list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#22181C' }}>Nessun ristorante trovato</p>
            <p style={{ fontSize: 14, color: '#8A8680', marginTop: 4 }}>Prova a cambiare i filtri o la ricerca</p>
          </div>
        ) : (
          <>
            {/* Featured / Hero card — stessa variante "hero" di RestaurantCard
                usata nel resto del sito, non più una card scritta a parte. */}
            {featuredRestaurant && (
              <div style={{ marginBottom: 16 }}>
                <RestaurantCard
                  restaurant={featuredRestaurant}
                  index={0}
                  userPosition={position}
                  onClick={handleCardClick}
                  saved={isSaved(featuredRestaurant.id)}
                  onSaveToggle={() => handleSave(featuredRestaurant.id)}
                  hasDiscount={discountRestaurantIds.has(featuredRestaurant.id)}
                  discountTitle={discountTitleMap[featuredRestaurant.id]}
                  activeCity={activeCity}
                  variant="hero"
                />
              </div>
            )}

            {/* All restaurants (windowed) */}
            {otherRestaurants.length > 0 && (
              <VirtualizedRestaurantList
                items={otherRestaurants}
                userPosition={position}
                discountRestaurantIds={discountRestaurantIds}
                discountTitleMap={discountTitleMap}
                isSaved={isSaved}
                onSave={handleSave}
                onClick={handleCardClick}
                activeCity={activeCity}
              />
            )}
          </>
        )}
      </div>

      {/* Floating "Mappa" button */}
      <button
        onClick={handleToggleView}
        style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, background: '#22181C', color: '#FAF7F2',
          border: 'none', borderRadius: 28,
          padding: '12px 26px',
          fontFamily: "var(--font-sans)",
          fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        Mappa
      </button>

      {/* Tab bar */}
      <MobileTabBar />

      {saveGateFor && <SaveAuthGate onClose={closeSaveGate} />}
    </div>
  )
}
