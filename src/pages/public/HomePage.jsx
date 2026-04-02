import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useDrag } from '@use-gesture/react'
import MapView from '../../components/Map/MapView'
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
import { proxyImg } from '../../lib/supabase'

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

/*
 * MiniCard — uses <div role="button"> not <button> to avoid
 * the implicit overflow:hidden that buttons have in some browsers.
 * Title uses Cormorant Garamond (not TAN Songbird) at small size
 * to avoid ascender/descender clipping.
 */
function MiniCard({ restaurant, userPosition, discountTitle, saved, onSave, onClick }) {
  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(name => getCategoryInfo(name))
  const category = categories[0]
  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0
    ? restaurant.photos[0] : null
  const photoUrl = proxyImg(firstPhoto
    ? typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url
    : null)
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
        width: 260,
        scrollSnapAlign: 'start',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.35)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        boxShadow: '0 6px 6px rgba(0,0,0,0.15), 0 0 20px rgba(0,0,0,0.06), inset 2px 2px 1px rgba(255,255,255,0.5), inset -1px -1px 1px rgba(255,255,255,0.4)',
        border: '1px solid rgba(255,255,255,0.45)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Green discount strip on top */}
      {discountTitle && (
        <div style={{
          background: 'linear-gradient(135deg, #a3e635, #4ade80)', color: '#000',
          fontSize: 12, fontWeight: 700,
          padding: '5px 10px',
          textAlign: 'center',
          letterSpacing: 0.5,
        }}>
          {discountTitle}
        </div>
      )}

      {/* Main content row */}
      <div style={{ display: 'flex', gap: 10, padding: 10, position: 'relative' }}>
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
        <div style={{
          fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
          fontSize: 11, fontWeight: 600, color: '#22181C',
          lineHeight: 1.6, marginBottom: 2,
          whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          overflow: 'hidden', padding: '2px 0',
        }}>
          {restaurant.name}
        </div>
        {/* Tagline */}
        {restaurant.tagline && (
          <div style={{ fontSize: 9, color: '#8A8680', fontWeight: 500, marginBottom: 2, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {restaurant.tagline}
          </div>
        )}
        {/* Category + price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          {category && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              backgroundColor: `${category.color}20`,
              color: category.color,
              fontSize: 9, fontWeight: 600,
              padding: '1px 6px', borderRadius: 12,
              whiteSpace: 'nowrap',
            }}>
              {category.emoji} {category.name}
            </span>
          )}
          {priceStr && <span style={{ fontSize: 10, color: '#555', fontWeight: 600 }}>{priceStr}</span>}
        </div>
        {/* Distance */}
        {distance != null && (
          <span style={{ fontSize: 10, color: '#8A8680' }}>{formatDistance(distance)}</span>
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

/*
 * Inline map controls — rendered here directly instead of a separate component
 * so we have full control over positioning without prop-passing issues.
 */
function InlineMapControls({ onLocateMe, isLocating, onZoomIn, onZoomOut, bottom, hidden }) {
  const btnStyle = {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(20,20,20,0.55)',
    backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#fff',
    WebkitTapHighlightColor: 'transparent',
  }
  return (
    <div style={{ position: 'absolute', right: 16, bottom, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 15, opacity: hidden ? 0 : 1, visibility: hidden ? 'hidden' : 'visible', transition: 'opacity 0.2s, visibility 0.2s' }}>
      <button onClick={onLocateMe} style={{ ...btnStyle, color: isLocating ? '#3B82F6' : '#fff' }} aria-label="Posizione">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      </button>
      <button onClick={onZoomIn} style={btnStyle} aria-label="Zoom +">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>
      <button onClick={onZoomOut} style={btnStyle} aria-label="Zoom -">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>
    </div>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

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
  const discountTitleMap = Object.fromEntries(activeDiscounts.map(d => [d.restaurant_id, d.title]))

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
  const [sheetFiltersSticky, setSheetFiltersSticky] = useState(false)
  const sheetFiltersRef = useRef(null)
  const displayedRestaurants = showDealsOnly
    ? restaurants.filter((r) => discountRestaurantIds.has(r.id))
    : restaurants

  const [selectedId, setSelectedId] = useState(null)
  const [visibleIds, setVisibleIds] = useState(null)
  const [mapCenter, setMapCenter] = useState(null)
  const mapRef = useRef(null)
  const bottomPanelRef = useRef(null)
  const [bottomPanelH, setBottomPanelH] = useState(160)

  // Measure actual bottom panel height with ResizeObserver (no render loops)
  useEffect(() => {
    const el = bottomPanelRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height
      if (h > 0) setBottomPanelH(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  const featuredRestaurant = viewportRestaurants.find(r => discountRestaurantIds.has(r.id)) || viewportRestaurants[0]
  const carouselRestaurants = viewportRestaurants.slice(0, CAROUSEL_MAX)
  const regularRestaurants = viewportRestaurants.filter(r => r.id !== featuredRestaurant?.id)

  // --- Sheet ---
  const windowH = typeof window !== 'undefined' ? window.innerHeight : 800
  const sheetY = useMotionValue(windowH)
  const [isSheetActive, setIsSheetActive] = useState(false)
  const [isDraggingBar, setIsDraggingBar] = useState(false)
  const sheetOpacity = useTransform(sheetY, [windowH, windowH * 0.4, 0], [0, 1, 1])

  // Show sheet = fully open; hide bottom panel only when sheet is open AND not mid-drag
  const hideBottomPanel = isSheetActive && !isDraggingBar

  const openSheet = useCallback(() => {
    setIsDraggingBar(false)
    setIsSheetActive(true)
    animate(sheetY, 0, { type: 'spring', stiffness: 300, damping: 35 })
  }, [sheetY])

  const closeSheet = useCallback(() => {
    setIsDraggingBar(false)
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
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Bar drag: pull up to reveal sheet
  const barBind = useDrag(({ movement: [, my], velocity: [, vy], direction: [, dy], active, first, tap }) => {
    if (tap) return // let onClick handle taps
    if (first) {
      setIsDraggingBar(true)
      setIsSheetActive(true) // make sheet z-index visible
    }
    if (active) {
      // my < 0 when dragging up. Map windowH+my so sheet slides in.
      sheetY.set(Math.max(0, Math.min(windowH, windowH + my)))
    } else {
      setIsDraggingBar(false)
      if (sheetY.get() < windowH * 0.6 || (vy > 0.3 && dy < 0)) {
        openSheet()
      } else {
        closeSheet()
      }
    }
  }, { axis: 'y', filterTaps: true, pointer: { touch: true } })

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

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <Navbar
        view={isSheetActive ? 'list' : 'map'}
        onToggleView={() => isSheetActive ? closeSheet() : openSheet()}
        restaurants={allRestaurants}
        onCityChange={handleCityChange}
      />

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

      {/* Map controls — use measured bottom panel height */}
      <InlineMapControls
        onLocateMe={handleLocateMe}
        isLocating={geoLoading}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        bottom={TAB_BAR_HEIGHT + 200}
        hidden={hideBottomPanel}
      />

      {/* === Bottom panel on map — never unmount, hide with CSS so drag stays alive === */}
      <div
        ref={bottomPanelRef}
        className="absolute left-0 right-0"
        style={{
          bottom: TAB_BAR_HEIGHT, zIndex: 20, pointerEvents: 'none',
          opacity: hideBottomPanel ? 0 : 1,
          visibility: hideBottomPanel ? 'hidden' : 'visible',
          transition: 'opacity 0.2s, visibility 0.2s',
        }}
      >
          {/* Floating cards */}
          {carouselRestaurants.length > 0 && (
            <div
              className="flex items-end gap-2.5 pb-3 overflow-x-auto carousel-scroll"
              style={{
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none', msOverflowStyle: 'none',
                pointerEvents: 'auto',
              }}
            >
              <style>{`.carousel-scroll::-webkit-scrollbar{display:none}`}</style>
              {carouselRestaurants.map((r, i) => (
                <div key={r.id} className="flex-shrink-0" style={i === 0 ? { marginLeft: 16 } : undefined}>
                  <MiniCard
                    restaurant={r}
                    userPosition={position}
                    discountTitle={discountTitleMap[r.id]}
                    saved={isSaved(r.id)}
                    onSave={user ? () => toggleSave(r.id) : () => navigate('/login')}
                    onClick={handleCardClick}
                  />
                </div>
              ))}
              {viewportRestaurants.length > CAROUSEL_MAX && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={openSheet}
                  className="flex-shrink-0 flex flex-col items-center justify-center"
                  style={{
                    width: 72, height: 88, scrollSnapAlign: 'start', borderRadius: 14,
                    marginRight: 16,
                    background: 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(20px) saturate(1.6)',
                    WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    cursor: 'pointer',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.25), inset 1px 1px 0 rgba(255,255,255,0.1)',
                    gap: 6,
                  }}
                >
                  <span style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 }}>
                    {viewportRestaurants.length} locali
                  </span>
                </div>
              )}
            </div>
          )}

          {/* "Mostra elenco" bar */}
          <div
            {...barBind()}
            onClick={openSheet}
            style={{
              background: 'rgba(250,247,242,0.96)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -2px 16px rgba(0,0,0,0.06)',
              padding: '10px 0 14px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              touchAction: 'none', cursor: 'pointer',
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

      {/* === SHEET — always in DOM, translated off-screen when closed === */}
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
        {/* Handle + sticky filters area */}
        <div
          style={{ flexShrink: 0, background: '#FAF7F2' }}
        >
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
            WebkitOverflowScrolling: 'touch',
            paddingBottom: TAB_BAR_HEIGHT + 70,
            touchAction: 'pan-y',
          }}
        >
          <div className="px-5">
            <div style={{ marginBottom: 14 }}>
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>

            <div ref={sheetFiltersRef} style={{
              position: 'sticky', top: 0, zIndex: 10,
              padding: '14px 0',
              margin: '0 -20px', paddingLeft: 20, paddingRight: 20,
              background: '#FAF7F2',
              boxShadow: sheetFiltersSticky ? '0 1px 0 0 var(--color-bordo)' : 'none',
            }}>
              <FilterChips
                filters={filters}
                onFilterChange={setFilters}
                onNearbyClick={handleLocateMe}
                showDealsOnly={showDealsOnly}
                onToggleDeals={() => setShowDealsOnly((v) => !v)}
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
              <div className="flex flex-col gap-3 pb-8">
                {/* IN EVIDENZA section */}
                {featuredRestaurant && (
                  <>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680', paddingLeft: 4 }}>
                      In evidenza
                    </p>
                    <RestaurantCard
                      restaurant={featuredRestaurant}
                      index={0}
                      userPosition={position}
                      onClick={handleCardClick}
                      saved={isSaved(featuredRestaurant.id)}
                      onSaveToggle={user ? () => toggleSave(featuredRestaurant.id) : () => navigate('/login')}
                      hasDiscount={discountRestaurantIds.has(featuredRestaurant.id)}
                      discountTitle={discountTitleMap[featuredRestaurant.id]}
                      variant="hero"
                    />
                  </>
                )}

                {/* TUTTI I RISTORANTI section */}
                {regularRestaurants.length > 0 && (
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680', paddingLeft: 4, marginTop: 4 }}>
                    Tutti i ristoranti
                    <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', marginLeft: 6 }}>
                      · {viewportRestaurants.length} {viewportRestaurants.length === 1 ? 'ristorante' : 'ristoranti'} in questa zona
                    </span>
                  </p>
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
                    discountTitle={discountTitleMap[restaurant.id]}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* "Vedi la mappa" */}
        <button
          onClick={closeSheet}
          style={{
            position: 'absolute', bottom: TAB_BAR_HEIGHT + 16,
            left: '50%', transform: 'translateX(-50%)', zIndex: 40,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(20px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
            color: '#fff',
            fontSize: 14, fontWeight: 600, padding: '12px 28px',
            borderRadius: 28, border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
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
  )
}
