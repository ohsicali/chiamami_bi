import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
// Mapbox-gl is ~600KB gzipped — load only when this page actually mounts so
// users that never open the map don't pay the bytes upfront.
const MapView = lazy(() => import('../../components/Map/MapView'))
import { useRestaurants, getCategoryInfo, CUISINE_CATEGORIES } from '../../lib/hooks/useRestaurants'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { getDistance, formatDistance } from '../../lib/utils/distance'
import { proxyImg } from '../../lib/supabase'
import MobileFilterBar from '../../components/Layout/MobileFilterBar'
import { formatDiscountValue } from '../../lib/utils/discountFormat'

function slugify(name) {
  return name.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const PIN_SVG = (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

const HEART_PATH = "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"

function LCard({ restaurant, isActive, isSaved, hasDiscount, discountLabel, userPosition, onSelect, onSave }) {
  const cats = restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : [])
  const catInfo = getCategoryInfo(cats[0])
  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0 ? restaurant.photos[0] : null
  const photoUrl = proxyImg(firstPhoto
    ? typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url
    : null, { w: 800 })
  const priceStr = restaurant.price_range ? '€'.repeat(restaurant.price_range) : null
  const dist = userPosition && restaurant.latitude && restaurant.longitude
    ? getDistance(userPosition.lat, userPosition.lng, restaurant.latitude, restaurant.longitude) : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(restaurant)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(restaurant)}
      style={{
        display: 'grid', gridTemplateColumns: '118px 1fr', gap: 14,
        padding: 12, background: '#fff',
        border: `1px solid ${isActive ? 'var(--color-corallo)' : 'var(--color-ink-05)'}`,
        borderRadius: 16,
        cursor: 'pointer', position: 'relative',
        transition: 'transform .18s ease, box-shadow .2s ease, border-color .18s ease',
        boxShadow: isActive ? '0 0 0 3px rgba(232,69,60,.12), 0 10px 22px rgba(34,24,28,.07)' : undefined,
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 22px rgba(34,24,28,.07)'; e.currentTarget.style.borderColor = 'var(--color-ink-15)' } }}
      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--color-ink-05)' } }}
    >
      {/* Photo */}
      <div style={{ aspectRatio: '1/1', background: '#ddd', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
        {photoUrl
          ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          : <div style={{ width: '100%', height: '100%', background: '#E8E5DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>{catInfo.emoji}</div>
        }
        {/* Heart */}
        <button
          aria-label={isSaved ? 'Rimuovi dai salvati' : 'Salva'}
          onClick={(e) => { e.stopPropagation(); onSave(restaurant.id) }}
          style={{
            position: 'absolute', top: 6, right: 6,
            width: 30, height: 30, borderRadius: '50%',
            background: isSaved ? 'var(--color-corallo)' : 'rgba(255,255,255,.94)',
            backdropFilter: 'saturate(140%) blur(6px)', WebkitBackdropFilter: 'saturate(140%) blur(6px)',
            border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer',
            color: isSaved ? '#fff' : 'var(--color-ink)', zIndex: 2,
            boxShadow: '0 2px 6px rgba(0,0,0,.12)',
            transition: 'background .15s ease, transform .15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = '' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? '#fff' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d={HEART_PATH} />
          </svg>
        </button>
        {/* Discount badge */}
        {hasDiscount && discountLabel && (
          <span style={{
            position: 'absolute', bottom: 6, left: 6,
            background: 'linear-gradient(135deg,#A3E635,#4ADE80)', color: 'var(--color-ink)',
            fontWeight: 800, fontSize: 10, letterSpacing: '-0.01em',
            padding: '3px 7px', borderRadius: 999, boxShadow: '0 2px 6px rgba(0,0,0,.14)',
          }}>{discountLabel}</span>
        )}
      </div>

      {/* Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, justifyContent: 'center' }}>
        {/* Nome + distanza */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 17,
            letterSpacing: '-0.025em', lineHeight: 1.15, color: 'var(--color-ink)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>{restaurant.name}</div>
          {dist != null && (
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: 'var(--color-ink-70)',
              padding: '3px 7px', background: 'var(--color-ink-05)', borderRadius: 999,
              display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
            }}>
              {PIN_SVG}{formatDistance(dist)}
            </span>
          )}
        </div>
        {/* Breve descrizione */}
        {restaurant.tagline && (
          <div style={{
            fontSize: 11.5, color: 'var(--color-ink-70)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{restaurant.tagline}</div>
        )}
        {/* Categoria colorata + prezzo */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
            background: `${catInfo.color}20`, color: catInfo.color,
          }}>{catInfo.emoji} {catInfo.name}</span>
          {priceStr && <span style={{ fontWeight: 800, fontSize: 10.5, color: 'var(--color-ink-70)' }}>{priceStr}</span>}
        </div>
        {/* Via */}
        <div style={{
          fontSize: 11.5, color: 'var(--color-ink-70)',
          display: 'flex', alignItems: 'center', gap: 5,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          {restaurant.address}
        </div>
      </div>
    </div>
  )
}

function MapPopup({ restaurant, hasDiscount, discountLabel, onClose, onNavigate }) {
  const cats = restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : [])
  const catInfo = getCategoryInfo(cats[0])
  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0 ? restaurant.photos[0] : null
  const photoUrl = proxyImg(firstPhoto
    ? typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url
    : null, { w: 800 })

  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 30, transform: 'translateX(-50%)',
      background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(34,24,28,.12)',
      padding: 14, display: 'grid', gridTemplateColumns: '96px 1fr', gap: 14,
      width: 360, border: '1px solid var(--color-ink-05)', zIndex: 10,
    }}>
      <div style={{ aspectRatio: '1/1', background: '#ddd', borderRadius: 12, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
        {photoUrl
          ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: '#E8E5DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>{catInfo.emoji}</div>
        }
        {hasDiscount && discountLabel && (
          <span style={{
            position: 'absolute', top: 5, left: 5,
            background: 'linear-gradient(135deg,#A3E635,#4ADE80)', color: 'var(--color-ink)',
            fontWeight: 800, fontSize: 9, padding: '2px 6px', borderRadius: 999,
          }}>{discountLabel}</span>
        )}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {restaurant.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 3 }}>
          📍 {restaurant.address}
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ padding: '3px 8px', background: 'var(--color-corallo-soft)', color: 'var(--color-corallo-ink)', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
            {catInfo.emoji} {catInfo.name}
          </span>
          {restaurant.price_range && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ink-70)' }}>{'€'.repeat(restaurant.price_range)}</span>
          )}
        </div>
        <button
          onClick={() => onNavigate(restaurant)}
          style={{
            marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
            fontWeight: 800, color: 'var(--color-corallo-ink)', fontSize: 12,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontFamily: 'inherit',
          }}
        >
          Vai alla scheda →
        </button>
      </div>
      <button
        onClick={onClose}
        aria-label="Chiudi"
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 24, height: 24, borderRadius: '50%',
          background: 'var(--color-ink-05)', border: 'none',
          cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 14, color: 'var(--color-ink)',
        }}
      >×</button>
    </div>
  )
}

export default function DesktopExplorePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { position, locate } = useGeolocation()
  const { user } = useAuth()
  const { savedIds, toggleSave } = useSavedRestaurants(user?.id)
  const { discounts: activeDiscounts } = useActiveDiscounts()

  const discountRestaurantIds = new Set(activeDiscounts.map(d => d.restaurant_id))
  const discountLabelMap = Object.fromEntries(
    activeDiscounts.map(d => [d.restaurant_id, formatDiscountValue(d)])
  )
  const discountMap = Object.fromEntries(activeDiscounts.map(d => [d.restaurant_id, d]))

  const {
    restaurants,
    allRestaurants,
    loading,
    filters,
    setFilters,
  } = useRestaurants(position)

  const [activeCat, setActiveCat] = useState(() => location.state?.initialCategory || null)
  const [selectedId, setSelectedId] = useState(null)
  const [showDealsOnly, setShowDealsOnly] = useState(false)
  const [extraFilters, setExtraFilters] = useState({ dietary: [], radiusKm: null })

  // Clear location state so refreshing doesn't re-apply the filter
  useEffect(() => {
    if (location.state?.initialCategory) window.history.replaceState({}, '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const mapRef = useRef(null)
  const listRef = useRef(null)
  const cardRefs = useRef({})

  let filteredRestaurants = activeCat
    ? restaurants.filter(r => {
        const cats = r.category || (r.cuisine_type ? [r.cuisine_type] : [])
        return cats.some(c => c.toLowerCase().includes(activeCat.toLowerCase()))
      })
    : restaurants
  if (showDealsOnly) {
    filteredRestaurants = filteredRestaurants.filter(r => discountRestaurantIds.has(r.id))
  }

  const selectedRestaurant = selectedId ? allRestaurants.find(r => r.id === selectedId) : null

  const handlePinSelect = useCallback((id) => {
    setSelectedId(id)
    // Scroll the card into view
    setTimeout(() => {
      const el = cardRefs.current[id]
      if (el && listRef.current) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 50)
  }, [])

  const handleCardSelect = useCallback((restaurant) => {
    setSelectedId(restaurant.id)
    if (restaurant.latitude && restaurant.longitude) {
      mapRef.current?.flyToCity(restaurant.longitude, restaurant.latitude, 15)
    }
  }, [])

  const handleNavigate = useCallback((restaurant) => {
    navigate(`/restaurant/${restaurant.slug || slugify(restaurant.name)}`)
  }, [navigate])

  useEffect(() => {
    if (position) mapRef.current?.flyToUser(position)
  }, [position])

  return (
    <div style={{
      display: 'none',
    }} className="esp-split-desktop">
      <style>{`
        @media (min-width: 768px) {
          .esp-split-desktop {
            display: grid !important;
            grid-template-columns: 440px 1fr;
            height: calc(100vh - 84px);
            overflow: hidden;
          }
        }
      `}</style>

      {/* LEFT — List */}
      <div style={{
        background: 'var(--color-bg)',
        borderRight: '1px solid var(--color-ink-05)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Filter bar — same as mobile */}
        <div style={{ padding: '28px 22px 0', flexShrink: 0 }}>
          <MobileFilterBar
            filters={filters}
            onFilterChange={(next) => {
              setFilters(next)
              setActiveCat(null)
            }}
            showDealsOnly={showDealsOnly}
            onToggleDeals={() => setShowDealsOnly(v => !v)}
            restaurantCount={filteredRestaurants.length}
            extraFilters={extraFilters}
            onExtraFilterChange={setExtraFilters}
          />
        </div>

        {/* Count row */}
        <div style={{ padding: '8px 22px 14px', borderBottom: '1px solid var(--color-ink-05)', flexShrink: 0 }}>
          <h2 style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', margin: 0 }}>
            {loading ? '…' : `${filteredRestaurants.length} locali a Torino`}
          </h2>
          <div style={{ color: 'var(--color-ink-70)', fontSize: 12.5, marginTop: 4 }}>
            Ordinati per distanza
          </div>
        </div>

        {/* Scrollable list */}
        <div
          ref={listRef}
          style={{
            flex: 1, overflowY: 'auto', padding: '14px 16px 22px',
            display: 'flex', flexDirection: 'column', gap: 10,
            scrollbarWidth: 'none',
          }}
        >
          {filteredRestaurants.map(r => (
            <div key={r.id} ref={el => { cardRefs.current[r.id] = el }}>
              <LCard
                restaurant={r}
                isActive={selectedId === r.id}
                isSaved={savedIds.has(r.id)}
                hasDiscount={discountRestaurantIds.has(r.id)}
                discountLabel={discountLabelMap[r.id]}
                userPosition={position}
                onSelect={handleCardSelect}
                onSave={(id) => user ? toggleSave(id) : navigate('/login')}
              />
            </div>
          ))}
          {!loading && filteredRestaurants.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-ink-70)', fontSize: 14 }}>
              Nessun locale trovato per questa categoria.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Map */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: '#F5F5F3' }} />}>
          <MapView
            ref={mapRef}
            restaurants={filteredRestaurants}
            selectedId={selectedId}
            onSelectRestaurant={handlePinSelect}
            userPosition={position}
            savedIds={savedIds}
            discountMap={discountLabelMap}
          />
        </Suspense>

        {/* Map controls */}
        <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 5 }}>
          <button
            onClick={() => mapRef.current?.zoomIn()}
            style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(10px)',
              border: '1px solid var(--color-ink-15)', display: 'grid', placeItems: 'center',
              cursor: 'pointer', color: 'var(--color-ink)', fontSize: 20, fontWeight: 700,
              boxShadow: '0 2px 8px rgba(34,24,28,.08)',
            }}
          >+</button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(10px)',
              border: '1px solid var(--color-ink-15)', display: 'grid', placeItems: 'center',
              cursor: 'pointer', color: 'var(--color-ink)', fontSize: 20, fontWeight: 700,
              boxShadow: '0 2px 8px rgba(34,24,28,.08)',
            }}
          >−</button>
          <button
            onClick={() => { locate(); mapRef.current?.flyToUser(position) }}
            title="Posizione"
            style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(10px)',
              border: '1px solid var(--color-ink-15)', display: 'grid', placeItems: 'center',
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(34,24,28,.08)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </button>
        </div>

        {/* Popup */}
        {selectedRestaurant && (
          <MapPopup
            restaurant={selectedRestaurant}
            hasDiscount={discountRestaurantIds.has(selectedRestaurant.id)}
            discountLabel={discountLabelMap[selectedRestaurant.id]}
            onClose={() => setSelectedId(null)}
            onNavigate={handleNavigate}
          />
        )}
      </div>
    </div>
  )
}
