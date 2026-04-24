import DesktopExplorePage from './DesktopExplorePage'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MapView from '../../components/Map/MapView'
import SearchBar from '../../components/Layout/SearchBar'
import FilterChips from '../../components/Layout/FilterChips'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'
import MiniCard from '../../components/Restaurant/MiniCard'
import Navbar from '../../components/Layout/Navbar'
import { useRestaurants, getCategoryInfo, CUISINE_CATEGORIES } from '../../lib/hooks/useRestaurants'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
import { SkeletonCard } from '../../components/UI/LoadingSpinner'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import SuggestRestaurantSheet from '../../components/Restaurant/SuggestRestaurantSheet'
import FilterPillsRow from '../../components/Esplora/FilterPillsRow'
import FloatingToggle from '../../components/Esplora/FloatingToggle'
import EsploraListPanel from '../../components/Esplora/EsploraListPanel'
import FilterSheet from '../../components/Esplora/FilterSheet'
import { useEsploraFilters, applyEsploraFilters } from '../../lib/hooks/useEsploraFilters'
import { groupByDistance } from '../../lib/utils/esploraGroups'

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


const CAROUSEL_MAX = 4


export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const prev = window.scrollY
    window.scrollTo(0, 1)
    document.body.classList.add('map-fixed')
    window.scrollTo(0, prev)
    return () => document.body.classList.remove('map-fixed')
  }, [])

  const { position, loading: geoLoading, locate } = useGeolocation()
  const { user } = useAuth()
  const isDesktop = useIsDesktop()
  const { savedIds, isSaved, toggleSave } = useSavedRestaurants(user?.id)
  const { discounts: activeDiscounts } = useActiveDiscounts()
  const discountRestaurantIds = new Set(activeDiscounts.map(d => d.restaurant_id))
  const discountValueMap = Object.fromEntries(activeDiscounts.map(d => [d.restaurant_id, d.discount_value]))
  const discountTitleMap = Object.fromEntries(activeDiscounts.map(d => [d.restaurant_id, d.title]))
  const discountLabelMap = Object.fromEntries(activeDiscounts.map(d => {
    const v = String(d.discount_value).replace(/[%€]/g, '')
    const isNumeric = /^\d+(\.\d+)?$/.test(v)
    const label = !isNumeric ? v : d.discount_type === 'percentage' ? `-${v}%` : `-${v}€`
    return [d.restaurant_id, label]
  }))

  const {
    restaurants,
    allRestaurants,
    loading,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
  } = useRestaurants(position)

  // Esplora filter state (URL query params)
  const esplora = useEsploraFilters()

  // Multi-select price, diet, sconti toggle, area → applyEsploraFilters (oltre al base useRestaurants)
  const displayedRestaurants = useMemo(
    () => applyEsploraFilters(restaurants, esplora.filters, position, discountRestaurantIds),
    [restaurants, esplora.filters, position, discountRestaurantIds],
  )

  const [selectedId, setSelectedId] = useState(null)
  const [visibleIds, setVisibleIds] = useState(null)
  const [mapCenter, setMapCenter] = useState(null)
  const mapRef = useRef(null)

  const handleVisibleRestaurantsChange = useCallback((ids, center) => {
    setVisibleIds(new Set(ids))
    setMapCenter(center)
  }, [])

  const WIDE_RADIUS_KM = 5
  const viewportRestaurants = (() => {
    if (!mapCenter) return displayedRestaurants
    const toRad = (d) => (d * Math.PI) / 180
    const haversine = (r) => {
      const dLat = toRad(r.latitude - mapCenter.lat)
      const dLng = toRad(r.longitude - mapCenter.lng)
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(mapCenter.lat)) * Math.cos(toRad(r.latitude)) * Math.sin(dLng / 2) ** 2
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }
    const nearby = displayedRestaurants.filter(r => r.latitude && r.longitude && haversine(r) <= WIDE_RADIUS_KM)
    nearby.sort((a, b) => haversine(a) - haversine(b))
    return nearby
  })()

  const handleLocateMe = useCallback(() => {
    locate()
    setFilters((prev) => ({ ...prev, sortBy: 'distance' }))
  }, [locate, setFilters])

  useEffect(() => {
    if (position) mapRef.current?.flyToUser(position)
  }, [position])

  const handlePinSelect = useCallback((id) => {
    const r = allRestaurants.find((r) => r.id === id)
    if (r) navigate(`/restaurant/${r.slug || slugify(r.name)}`)
  }, [allRestaurants, navigate])

  const handleCardClick = useCallback((restaurant) => {
    navigate(`/restaurant/${restaurant.slug || slugify(restaurant.name)}`)
  }, [navigate])

  const handleCityChange = useCallback(({ lng, lat }) => {
    mapRef.current?.flyToCity(lng, lat)
  }, [])

  const featuredRestaurantId = (viewportRestaurants.find(r => discountRestaurantIds.has(r.id)) || viewportRestaurants[0])?.id
  const carouselRestaurants = viewportRestaurants.slice(0, CAROUSEL_MAX)

  // Filter sheet (Step 6) — mobile: Filtri / Categorie pill lo aprono
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [filterSheetFocus, setFilterSheetFocus] = useState(null) // 'categories' | null
  const [showSuggest, setShowSuggest] = useState(false)

  const openFilterSheet = useCallback((section = null) => {
    setFilterSheetFocus(section)
    setFilterSheetOpen(true)
  }, [])
  const closeFilterSheet = useCallback(() => setFilterSheetOpen(false), [])

  // Deep-link: category pre-selezionata (da SavedPage navigation) → setta URL cat
  useEffect(() => {
    if (location.state?.initialCategory) {
      esplora.applyBulk({ cat: [location.state.initialCategory] })
      window.history.replaceState({}, '')
    }
    // Fly to city selected from another page's CityPickerSheet
    if (location.state?.city) {
      const { lng, lat } = location.state.city
      mapRef.current?.flyToCity(lng, lat)
      window.history.replaceState({}, '')
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  // URL → useRestaurants.filters sync (one-way). useEsploraFilters è source of truth,
  // useRestaurants riceve una forma "legacy" compat (category, priceRange, moment).
  // sortBy resta gestito localmente (handleLocateMe lo imposta a 'distance').
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      category: esplora.legacyFilters.category,
      priceRange: esplora.legacyFilters.priceRange,
      moment: esplora.legacyFilters.moment,
    }))
  }, [esplora.legacyFilters.category, esplora.legacyFilters.priceRange, esplora.legacyFilters.moment, setFilters])

  // ── Desktop: delegate entirely to split-view layout ──
  if (isDesktop) return <DesktopExplorePage />

  /* Shared list content — used by mobile sheet */
  const listContent = (
    <>
      <div className="md:hidden" style={{ marginBottom: 14 }}>
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: '14px 0',
        margin: '0 -20px', paddingLeft: 20, paddingRight: 20,
        background: '#FAF7F2',
      }}>
        <FilterChips
          filters={filters}
          onFilterChange={setFilters}
          onNearbyClick={handleLocateMe}
          showDealsOnly={esplora.filters.disc}
          onToggleDeals={esplora.toggleDisc}
          dealsCount={discountRestaurantIds.size}
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : viewportRestaurants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div style={{ marginBottom: 12, fontSize: 40 }}>🔍</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#22181C' }}>{t('home.noResults')}</p>
          <p style={{ marginTop: 4, fontSize: 14, color: '#8A8680' }}>{t('home.changeFilters')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 md:gap-0 pb-8">
          {viewportRestaurants.map((restaurant, index) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              index={index}
              userPosition={position}
              onClick={handleCardClick}
              saved={isSaved(restaurant.id)}
              onSaveToggle={user ? () => toggleSave(restaurant.id) : () => navigate('/login')}
              hasDiscount={discountRestaurantIds.has(restaurant.id)}
              discountTitle={discountTitleMap[restaurant.id]}
              isFeatured={restaurant.id === featuredRestaurantId}
            />
          ))}

          {/* CTA: suggerisci un ristorante mancante */}
          <button
            onClick={() => setShowSuggest(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              padding: '16px 4px', textAlign: 'left',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: 'rgba(176,137,84,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B08954" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#22181C', margin: 0, lineHeight: 1.4 }}>
                Manca un ristorante?
              </p>
              <p style={{ fontSize: 12, color: '#8A8680', margin: 0, lineHeight: 1.4 }}>
                Consiglialo in 30 secondi →
              </p>
            </div>
          </button>
        </div>
      )}
    </>
  )

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh', overflow: 'hidden' }}>
      {/* Mobile Navbar (hidden on desktop) */}
      <Navbar
        view={esplora.filters.view}
        onToggleView={() => esplora.setView(esplora.filters.view === 'list' ? 'map' : 'list')}
        restaurants={allRestaurants}
        onCityChange={handleCityChange}
        onLocateMe={handleLocateMe}
      />

      {/* Single MapView — repositioned via CSS for desktop vs mobile */}
      <div className="absolute inset-0 md:top-[56px] md:left-[360px] lg:left-[420px]">
        <MapView
          ref={mapRef}
          restaurants={allRestaurants}
          selectedId={selectedId}
          onSelectRestaurant={handlePinSelect}
          onVisibleRestaurantsChange={handleVisibleRestaurantsChange}
          userPosition={position}
          savedIds={savedIds}
          discountMap={discountValueMap}
          className="absolute inset-0"
        />
      </div>

      {/* ═══ DESKTOP LIST PANEL (≥768px) — renderizzato SOLO su desktop per evitare
           duplicazione delle card ristorante nel DOM ═══ */}
      {isDesktop && (
        <div
          className="md:w-[360px] lg:w-[420px]"
          style={{
            position: 'absolute',
            top: 56,
            left: 0,
            bottom: 0,
            overflowY: 'auto',
            borderRight: '1px solid var(--color-bordo, #E8E5DE)',
            background: '#fff',
            zIndex: 2,
          }}
        >
          <div className="px-5 pt-4">
            {listContent}
          </div>
        </div>
      )}

      {/* ═══ MOBILE · VISTA LISTA (view=list) — panel full-screen sopra la mappa ═══ */}
      {!isDesktop && esplora.filters.view === 'list' && (
        <EsploraListPanel
          restaurants={displayedRestaurants}
          userPosition={position}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          esplora={esplora}
          discountIds={discountRestaurantIds}
          discountLabels={discountLabelMap}
          isSaved={isSaved}
          onToggleSave={(id) => (user ? toggleSave(id) : navigate('/login'))}
          onCardClick={handleCardClick}
          onToggleView={() => esplora.setView('map')}
          onOpenFilters={() => openFilterSheet(null)}
          onOpenCategories={() => openFilterSheet('categories')}
          groups={groupByDistance(displayedRestaurants, position, esplora.filters.moment)}
        />
      )}

      {/* ═══ MOBILE-ONLY OVERLAYS — renderizzati SOLO su mobile per evitare
           duplicazione delle card ristorante, degli effetti React e della sheet
           animata ═══ */}
      {!isDesktop && esplora.filters.view !== 'list' && (
      <div>

        {/* === Esplora filter band (Filtri · Categorie · Sconti + count/Azzera) === */}
        {(
          <div style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 56px)',
            left: 0, right: 0,
            zIndex: 25,
            background: 'var(--color-page, #FAF7F2)',
          }}>
            <FilterPillsRow
              activeCount={esplora.activeCount}
              activeFiltersTotal={
                esplora.activeCount
                + (esplora.filters.cat.length > 0 ? 1 : 0)
                + (esplora.filters.disc ? 1 : 0)
              }
              discActive={esplora.filters.disc}
              catActive={esplora.filters.cat.length > 0}
              count={displayedRestaurants.length}
              onOpenFilters={() => openFilterSheet(null)}
              onOpenCategories={() => openFilterSheet('categories')}
              onToggleDisc={esplora.toggleDisc}
              onReset={esplora.reset}
            />
          </div>
        )}

        {/* === Empty state mappa · 0 risultati con filtri attivi === */}
        {!loading && displayedRestaurants.length === 0 && (esplora.activeCount > 0 || esplora.filters.cat.length > 0 || esplora.filters.disc) && (
          <div style={{
            position: 'absolute', left: 0, right: 0,
            bottom: TAB_BAR_HEIGHT + 24,
            zIndex: 30, display: 'flex', justifyContent: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              pointerEvents: 'auto',
              width: 'calc(100% - 32px)', maxWidth: 360,
              background: '#fff',
              border: '1px solid rgba(34,24,28,0.08)',
              borderRadius: 20,
              boxShadow: '0 14px 32px rgba(34,24,28,0.12)',
              padding: '18px 20px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>🔍</div>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-ink)', margin: 0 }}>
                Nessun posto con questi filtri
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--color-ink-70)', margin: 0, lineHeight: 1.45 }}>
                Prova a togliere una categoria o ad allargare la fascia prezzo.
              </p>
              <button
                type="button"
                onClick={esplora.reset}
                style={{
                  marginTop: 6,
                  padding: '10px 22px',
                  background: 'var(--color-corallo, #E8453C)',
                  color: '#fff', border: 'none', borderRadius: 999,
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 8px 18px rgba(232,69,60,0.28)',
                }}
              >
                Azzera filtri
              </button>
            </div>
          </div>
        )}

        {/* === esp-bottom: Lista pill + carousel === */}
        {(viewportRestaurants.length > 0 || carouselRestaurants.length > 0) && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0,
              bottom: TAB_BAR_HEIGHT + 8,
              zIndex: 35, pointerEvents: 'none',
            }}
          >
            {/* Floating toggle Mappa → Lista (pill ink, sopra il carousel) */}
            {viewportRestaurants.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 10px', pointerEvents: 'auto' }}>
                <FloatingToggle view="map" onClick={() => esplora.setView('list')} />
              </div>
            )}

            {/* Carousel */}
            {carouselRestaurants.length > 0 && (
              <div style={{ pointerEvents: 'auto' }}>
                <div
                  style={{
                    display: 'flex', gap: 10, overflowX: 'auto',
                    padding: '0 20px 6px',
                    WebkitOverflowScrolling: 'touch',
                    scrollSnapType: 'x mandatory',
                    scrollbarWidth: 'none', msOverflowStyle: 'none',
                  }}
                >
                  <style>{`.esp-caro-scroll::-webkit-scrollbar{display:none}`}</style>
                  {carouselRestaurants.map((r) => (
                    <MiniCard
                      key={r.id}
                      restaurant={r}
                      userPosition={position}
                      discountTitle={discountLabelMap[r.id]}
                      saved={isSaved(r.id)}
                      onSave={user ? () => toggleSave(r.id) : () => navigate('/login')}
                      onClick={handleCardClick}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
      )}

      {/* === Filter sheet mobile (Step 6) === */}
      {!isDesktop && (
        <FilterSheet
          open={filterSheetOpen}
          onClose={closeFilterSheet}
          filters={esplora.filters}
          allRestaurants={allRestaurants}
          userPosition={position}
          discountIds={discountRestaurantIds}
          focusSection={filterSheetFocus}
          onApply={esplora.applyBulk}
        />
      )}

      {/* Suggest restaurant sheet — works for logged-in and anonymous users */}
      {showSuggest && (
        <SuggestRestaurantSheet
          userId={user?.id ?? null}
          userEmail={user?.email ?? null}
          userName={user?.user_metadata?.full_name ?? null}
          onClose={() => setShowSuggest(false)}
        />
      )}
    </div>
  )
}
