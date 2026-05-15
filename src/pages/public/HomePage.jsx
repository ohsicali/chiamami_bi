import DesktopExplorePage from './DesktopExplorePage'
import { useState, useCallback, useRef, useEffect, useMemo, memo, lazy, Suspense } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useDrag } from '@use-gesture/react'
// Mapbox-gl is ~600KB gzipped — defer until the map actually mounts so the
// initial JS payload for list-first users stays small.
const MapView = lazy(() => import('../../components/Map/MapView'))
import SearchBar from '../../components/Layout/SearchBar'
import MobileFilterBar from '../../components/Layout/MobileFilterBar'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'
import SaveButton from '../../components/Restaurant/SaveButton'
import Navbar from '../../components/Layout/Navbar'
import { getDistance, formatDistance } from '../../lib/utils/distance'
import { useRestaurants, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { getPublicCategoryNames } from '../../lib/hooks/useCategories'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
import { SkeletonCard } from '../../components/UI/LoadingSpinner'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import { proxyImg, proxyImgSrcSet } from '../../lib/supabase'
import SuggestRestaurantSheet from '../../components/Restaurant/SuggestRestaurantSheet'
import { formatDiscountValue } from '../../lib/utils/discountFormat'

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


const CAROUSEL_INITIAL = 4
const CAROUSEL_STEP = 4

function MiniCard({ restaurant, index = 0, userPosition, discountTitle, saved, onSave, onClick, style }) {
  const categories = getPublicCategoryNames(restaurant).map(name => getCategoryInfo(name))
  const category = categories[0]
  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0
    ? restaurant.photos[0] : null
  // 68×68 CSS slot. A single 200w variant covers DPR 3 — no srcset needed
  // for such a small slot, which avoids extra cold cache transforms on /api/img.
  const photoRaw = firstPhoto
    ? typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url
    : null
  const photoUrl = proxyImg(photoRaw, { w: 200 })
  const isAboveFold = index < 2
  const priceStr = restaurant.price_range != null ? '€'.repeat(restaurant.price_range) : null
  const distance = userPosition && restaurant.latitude && restaurant.longitude
    ? getDistance(userPosition.lat, userPosition.lng, restaurant.latitude, restaurant.longitude)
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(restaurant)}
      className="flex-shrink-0"
      style={{
        width: 215,
        scrollSnapAlign: 'start',
        borderRadius: 14,
        background: '#FAF7F2',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
        ...style,
      }}
    >
      <div style={{ display: 'flex', gap: 10, padding: 10, position: 'relative' }}>
        <div style={{ width: 68, height: 68, borderRadius: 10, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
          {photoUrl ? (
            <img
              src={photoUrl}
              width={68}
              height={68}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading={isAboveFold ? 'eager' : 'lazy'}
              fetchpriority={isAboveFold ? 'high' : 'auto'}
              decoding="async"
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#E8E5DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {category?.emoji || '🍽️'}
            </div>
          )}
          {discountTitle && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(135deg, #A3E635, #4ADE80)', color: '#1a4731',
              fontSize: 8, fontWeight: 800, textAlign: 'center',
              padding: '2px 0',
            }}>
              {discountTitle}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 20 }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 800,
            fontSize: 15, letterSpacing: '-0.015em',
            color: 'var(--color-ink)',
            lineHeight: 1.15, marginBottom: 3,
            whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}>
            {restaurant.name}
          </div>
          {restaurant.tagline && (
            <div style={{ fontSize: 9, color: '#8A8680', fontWeight: 500, marginBottom: 2, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {restaurant.tagline}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, flexWrap: 'nowrap', overflow: 'hidden' }}>
            {category && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                backgroundColor: `${category.color}20`,
                color: category.color,
                fontSize: 9, fontWeight: 600,
                padding: '1px 6px', borderRadius: 12,
                whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
              }}>
                {category.emoji} {category.name}
              </span>
            )}
            {priceStr && <span style={{ fontSize: 10, color: '#555', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{priceStr}</span>}
          </div>
          {distance != null && (
            <div style={{ fontSize: 10, color: '#8A8680', fontWeight: 500 }}>
              {formatDistance(distance)}
            </div>
          )}
        </div>
        {onSave && (
          <div style={{ position: 'absolute', top: 6, right: 6 }}>
            <SaveButton saved={saved} onClick={onSave} size="xs" />
          </div>
        )}
      </div>
    </div>
  )
}


export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

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
  const discountLabelMap = Object.fromEntries(
    activeDiscounts.map(d => [d.restaurant_id, formatDiscountValue(d)])
  )

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
  const [extraFilters, setExtraFilters] = useState({ dietary: [], radiusKm: null })
  const [sheetFiltersSticky, setSheetFiltersSticky] = useState(false)
  const sheetFiltersRef = useRef(null)

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

  // Any user-selected filter (deal toggle, category, price, moment, search,
  // dietary, radius) means the map should mirror the filtered list. With no
  // filter active the map shows every published restaurant.
  const hasActiveFilters = (
    showDealsOnly ||
    !!filters.category ||
    !!filters.priceRange ||
    !!filters.moment ||
    !!searchQuery.trim() ||
    (extraFilters.dietary?.length || 0) > 0 ||
    extraFilters.radiusKm != null
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

  const [carouselLimit, setCarouselLimit] = useState(CAROUSEL_INITIAL)
  useEffect(() => { setCarouselLimit(CAROUSEL_INITIAL) }, [filters, showDealsOnly])
  const carouselRestaurants = viewportRestaurants.slice(0, carouselLimit)
  const hasMoreCarousel = viewportRestaurants.length > carouselLimit

  // --- Sheet ---
  const windowH = typeof window !== 'undefined' ? window.innerHeight : 800
  const sheetY = useMotionValue(windowH)
  const [isSheetActive, setIsSheetActive] = useState(false)
  const [showSuggest, setShowSuggest] = useState(false)
  const sheetOpacity = useTransform(sheetY, [windowH, windowH * 0.4, 0], [0, 1, 1])
  const hideBottomPanel = isSheetActive

  const openSheet = useCallback(() => {

    setIsSheetActive(true)
    animate(sheetY, 0, { type: 'spring', stiffness: 300, damping: 35 })
  }, [sheetY])

  const closeSheet = useCallback(() => {

    animate(sheetY, windowH, { type: 'spring', stiffness: 300, damping: 35 })
    setTimeout(() => setIsSheetActive(false), 500)
  }, [sheetY, windowH])

  // Open sheet with category pre-selected (from SavedPage navigation)
  useEffect(() => {
    if (location.state?.initialCategory) {
      setFilters(f => ({ ...f, category: location.state.initialCategory }))
      openSheet()
      window.history.replaceState({}, '')
    }
    // Fly to city selected from another page's CityPickerSheet
    if (location.state?.city) {
      const { lng, lat } = location.state.city
      mapRef.current?.flyToCity(lng, lat)
      window.history.replaceState({}, '')
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  // URL params ⟷ filters sync — coerenza con home (card "+" → /esplora?moment=…)
  // Leggi all'avvio, poi aggiorna la URL quando cambiano i filtri.
  useEffect(() => {
    const urlMoment = searchParams.get('moment')
    const urlCategory = searchParams.get('category')
    const urlPrice = searchParams.get('price')
    const next = {}
    if (urlMoment) next.moment = urlMoment
    if (urlCategory) next.category = urlCategory
    if (urlPrice) next.priceRange = Number(urlPrice) || null
    if (Object.keys(next).length > 0) {
      setFilters(f => ({ ...f, ...next }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // read once on mount

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.moment) params.set('moment', filters.moment)
    if (filters.category) {
      const v = Array.isArray(filters.category) ? filters.category.join(',') : filters.category
      if (v) params.set('category', v)
    }
    if (filters.priceRange) params.set('price', String(filters.priceRange))
    const current = searchParams.toString()
    const next = params.toString()
    if (current !== next) setSearchParams(params, { replace: true })
  }, [filters.moment, filters.category, filters.priceRange]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll-based sticky detection for sheet filters
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setSheetFiltersSticky(root.scrollTop > 50)
        ticking = false
      })
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [isSheetActive])

  // Sheet handle drag: pull down to close
  const handleBind = useDrag(({ movement: [, my], velocity: [, vy], direction: [, dy], active }) => {
    if (active) {
      sheetY.set(Math.max(0, my))
    } else {
      if (sheetY.get() > windowH * 0.2 || (vy > 0.3 && dy > 0)) {
        closeSheet()
      } else {
        animate(sheetY, 0, { type: 'spring', stiffness: 300, damping: 35 })
      }
    }
  }, { axis: 'y', from: () => [0, 0], filterTaps: true, pointer: { touch: true } })

  // Content drag: when scrolled to top and dragging down, dismiss the sheet
  const scrollRef = useRef(null)
  const isDismissing = useRef(false)
  const [dismissing, setDismissing] = useState(false)
  const contentBind = useDrag(({ movement: [, my], velocity: [, vy], direction: [, dy], active, first }) => {
    const atTop = !scrollRef.current || scrollRef.current.scrollTop <= 0
    if (first) {
      const shouldDismiss = atTop && dy > 0
      isDismissing.current = shouldDismiss
      if (shouldDismiss) setDismissing(true)
    }
    if (!isDismissing.current) return
    if (active) {
      sheetY.set(Math.max(0, my))
    } else {
      setDismissing(false)
      isDismissing.current = false
      if (sheetY.get() > windowH * 0.15 || (vy > 0.3 && dy > 0)) {
        closeSheet()
      } else {
        animate(sheetY, 0, { type: 'spring', stiffness: 300, damping: 35 })
      }
    }
  }, { axis: 'y', from: () => [0, 0], filterTaps: true, pointer: { touch: true } })

  // ── Desktop: delegate entirely to split-view layout ──
  if (isDesktop) return <DesktopExplorePage />

  /* Shared list content — used by mobile sheet */
  const listContent = (
    <>
      <div style={{ marginBottom: 4 }}>
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: '4px 0 12px',
        margin: '0 -20px', paddingLeft: 20, paddingRight: 20,
        background: '#FAF7F2',
      }}>
        <MobileFilterBar
          filters={filters}
          onFilterChange={setFilters}
          showDealsOnly={showDealsOnly}
          onToggleDeals={() => setShowDealsOnly(v => !v)}
          restaurantCount={viewportRestaurants.length}
          extraFilters={extraFilters}
          onExtraFilterChange={setExtraFilters}
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
        view={isSheetActive ? 'list' : 'map'}
        onToggleView={() => isSheetActive ? closeSheet() : openSheet()}
        restaurants={allRestaurants}
        onCityChange={handleCityChange}
        onLocateMe={handleLocateMe}
      />

      {/* Single MapView — repositioned via CSS for desktop vs mobile.
         When filters/sconti/categorie are active, mirror them on the map
         so only matching pins render. Falls back to allRestaurants when
         no filter is set so the default view shows everything. */}
      <div className="absolute inset-0 md:top-[56px] md:left-[360px] lg:left-[420px]">
        <Suspense fallback={<div className="absolute inset-0" style={{ background: '#F5F5F3' }} />}>
          <MapView
            ref={mapRef}
            restaurants={hasActiveFilters ? displayedRestaurants : allRestaurants}
            selectedId={selectedId}
            onSelectRestaurant={handlePinSelect}
            onVisibleRestaurantsChange={handleVisibleRestaurantsChange}
            userPosition={position}
            savedIds={savedIds}
            discountMap={discountLabelMap}
            className="absolute inset-0"
          />
        </Suspense>
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

      {/* ═══ MOBILE-ONLY OVERLAYS — renderizzati SOLO su mobile per evitare
           duplicazione delle card ristorante, degli effetti React e della sheet
           animata ═══ */}
      {!isDesktop && (
      <div>

        {/* ─ Filter bar sopra la mappa (panel crema) ─ */}
        {!hideBottomPanel && (
          <div style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
            left: 0, right: 0,
            zIndex: 25,
            padding: '10px 16px',
            background: '#FAF7F2',
          }}>
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
        )}

        {/* === esp-bottom: Lista pill + carousel === */}
        {!hideBottomPanel && (viewportRestaurants.length > 0 || carouselRestaurants.length > 0) && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0,
              bottom: TAB_BAR_HEIGHT + 24,
              zIndex: 55, pointerEvents: 'none',
            }}
          >
            {/* Lista pill */}
            {viewportRestaurants.length > 0 && (
              <button
                onClick={openSheet}
                style={{
                  display: 'flex', margin: '0 auto 10px', pointerEvents: 'auto',
                  background: '#22181C', color: '#fff',
                  fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em',
                  padding: '10px 18px', borderRadius: 999, border: 0,
                  cursor: 'pointer', boxShadow: '0 4px 16px rgba(34,24,28,.28)',
                  alignItems: 'center', gap: 8,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
                Lista
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  background: 'rgba(255,255,255,.18)',
                  padding: '2px 7px', borderRadius: 999, letterSpacing: '0.02em',
                }}>{viewportRestaurants.length}</span>
              </button>
            )}

            {/* Carousel */}
            {carouselRestaurants.length > 0 && (
              <>
                <style>{`.esp-caro-scroll::-webkit-scrollbar{display:none}`}</style>
                <div
                  className="esp-caro-scroll"
                  style={{
                    pointerEvents: 'auto',
                    display: 'flex', gap: 10, overflowX: 'auto',
                    padding: '0 20px 6px 20px',
                    WebkitOverflowScrolling: 'touch',
                    scrollSnapType: 'x mandatory',
                    scrollPaddingLeft: 20,
                    scrollPaddingRight: 20,
                    scrollbarWidth: 'none', msOverflowStyle: 'none',
                  }}
                >
                  {carouselRestaurants.map((r, i) => (
                    <MiniCard
                      key={r.id}
                      restaurant={r}
                      index={i}
                      userPosition={position}
                      discountTitle={discountLabelMap[r.id]}
                      saved={isSaved(r.id)}
                      onSave={user ? () => toggleSave(r.id) : () => navigate('/login')}
                      onClick={handleCardClick}
                    />
                  ))}
                  {hasMoreCarousel && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setCarouselLimit(c => c + CAROUSEL_STEP) }}
                      className="flex-shrink-0"
                      style={{
                        width: 110, scrollSnapAlign: 'start',
                        borderRadius: 14,
                        background: '#FAF7F2',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                        border: '1.5px dashed rgba(34,24,28,0.18)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 6, cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                        fontFamily: 'inherit', color: '#22181C',
                      }}
                    >
                      <span style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: '#22181C', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, fontWeight: 700, lineHeight: 1,
                      }}>+</span>
                      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '-0.01em' }}>Altro</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* === SHEET — mobile only === */}
        <motion.div
          style={{
            y: sheetY,
            opacity: sheetOpacity,
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: isSheetActive ? 35 : -1,
            background: '#FAF7F2',
            display: 'flex', flexDirection: 'column',
            pointerEvents: isSheetActive ? 'auto' : 'none',
            willChange: 'transform',
            overflow: 'hidden',
          }}
        >
          {/* Handle */}
          <div style={{ flexShrink: 0, background: '#FAF7F2' }}>
            <div
              {...handleBind()}
              style={{
                paddingTop: 'max(env(safe-area-inset-top, 16px), 56px)',
                paddingBottom: 10,
                display: 'flex', justifyContent: 'center',
                cursor: 'grab', touchAction: 'none',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.15)' }} />
            </div>
          </div>

          {/* Scrollable content */}
          <div
            ref={scrollRef}
            {...contentBind()}
            style={{
              flex: 1, overflowY: dismissing ? 'hidden' : 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: TAB_BAR_HEIGHT + 70,
              touchAction: 'pan-y',
            }}
          >
            <div className="px-5">
              <div ref={sheetFiltersRef}>
                {listContent}
              </div>
            </div>
          </div>

          {/* "Vedi la mappa" */}
          <button
            onClick={closeSheet}
            style={{
              position: 'absolute',
              bottom: `calc(env(safe-area-inset-bottom, 0px) + ${TAB_BAR_HEIGHT + 28}px)`,
              left: '50%', transform: 'translateX(-50%)', zIndex: 40,
              background: '#22181C', color: '#fff',
              fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em',
              padding: '10px 22px',
              borderRadius: 999, border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 16px rgba(34,24,28,.28)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            Vedi la mappa
          </button>
        </motion.div>
      </div>
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
