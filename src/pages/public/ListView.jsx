import { useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchBar from '../../components/Layout/SearchBar'
import MobileFilterBar from '../../components/Layout/MobileFilterBar'
import Navbar from '../../components/Layout/Navbar'
import MobileTabBar from '../../components/Layout/MobileTabBar'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useAuth } from '../../lib/hooks/useAuth'
import { SkeletonCard } from '../../components/UI/LoadingSpinner'
import { PRICE_LABELS, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { getDistance, formatDistance } from '../../lib/utils/distance'
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

/* ── Heart SVG ── */
const HeartIcon = ({ filled, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? '#E8453C' : 'none'}
    stroke={filled ? '#E8453C' : 'currentColor'}
    strokeWidth="2"
  >
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
)

/* ── Distance icon ── */
const DistanceIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </svg>
)

/* ── Price display (€€€ style) ── */
function PriceDisplay({ level }) {
  if (!level) return null
  return (
    <span style={{ fontSize: 11, color: '#8A8680', fontWeight: 600 }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{ color: i <= level ? '#22181C' : '#D1CDC6' }}>€</span>
      ))}
    </span>
  )
}

/* ── Photo helper ── */
function getPhotoUrl(restaurant) {
  if (Array.isArray(restaurant.photos) && restaurant.photos.length > 0) {
    const p = restaurant.photos[0]
    return proxyImg(typeof p === 'string' ? p : (p?.thumb_url || p?.photo_url))
  }
  return null
}

/* ============================================
   HERO CARD — Featured restaurant (first one)
   ============================================ */
function HeroCard({ restaurant, userPosition, discountValue, saved, onSave, onClick }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const photoUrl = getPhotoUrl(restaurant)
  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(n => getCategoryInfo(n)).filter(Boolean)
  const category = categories[0]

  const dist = userPosition && restaurant.latitude
    ? formatDistance(getDistance(userPosition.lat, userPosition.lng, restaurant.latitude, restaurant.longitude))
    : null

  return (
    <button
      onClick={() => onClick?.(restaurant)}
      style={{
        width: '100%', borderRadius: 22, overflow: 'hidden',
        position: 'relative', height: 200, marginBottom: 16,
        cursor: 'pointer', border: 'none', padding: 0,
        display: 'block', textAlign: 'left',
      }}
    >
      {/* Background image or fallback */}
      <div style={{ position: 'absolute', inset: 0, background: '#2a1f18' }}>
        {photoUrl && (
          <img
            src={photoUrl} alt={restaurant.name} loading="lazy"
            onLoad={() => setImgLoaded(true)}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.4s',
            }}
          />
        )}
        {!photoUrl && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 56, opacity: 0.4, background: `linear-gradient(135deg, ${category?.color || '#8A8680'}33, ${category?.color || '#8A8680'}11)`,
          }}>
            {category?.emoji || '🍽️'}
          </div>
        )}
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)',
        }} />
      </div>

      {/* Discount badge */}
      {discountValue && (
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 3,
          background: 'linear-gradient(135deg, #A3E635, #4ADE80)', color: '#1a4731',
          fontSize: 11, fontWeight: 800,
          padding: '5px 12px', borderRadius: 10,
          boxShadow: '0 2px 10px rgba(74,222,128,0.35)',
        }}>
          -{discountValue}%
        </div>
      )}

      {/* Heart button */}
      <div
        onClick={(e) => { e.stopPropagation(); onSave?.() }}
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 3,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
        }}
      >
        <HeartIcon filled={saved} size={18} />
      </div>

      {/* Content */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, zIndex: 2 }}>
        {restaurant.our_rating >= 4.5 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            background: 'var(--color-corallo)', color: '#fff',
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            textTransform: 'uppercase',
            padding: '4px 10px', borderRadius: 999, marginBottom: 10,
          }}>
            Top di Bi
          </div>
        )}
        <div style={{
          fontFamily: "var(--font-sans)", fontWeight: 800,
          fontSize: 26, fontWeight: 600, color: '#fff',
          lineHeight: 1.1, marginBottom: 6,
        }}>
          {restaurant.name}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 12, color: 'rgba(255,255,255,0.7)',
        }}>
          {category && (
            <>
              <span>{category.name}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
            </>
          )}
          {restaurant.price_range && <span>{PRICE_LABELS[restaurant.price_range]}</span>}
          {dist && (
            <>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
              <span>{dist}</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

/* ============================================
   HORIZONTAL CARD — Compact restaurant row
   ============================================ */
function HorizontalCard({ restaurant, userPosition, discountValue, saved, onSave, onClick }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const photoUrl = getPhotoUrl(restaurant)
  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(n => getCategoryInfo(n)).filter(Boolean)
  const category = categories[0]

  const dist = userPosition && restaurant.latitude
    ? formatDistance(getDistance(userPosition.lat, userPosition.lng, restaurant.latitude, restaurant.longitude))
    : null

  return (
    <button
      onClick={() => onClick?.(restaurant)}
      style={{
        display: 'flex', gap: 14, padding: 14, marginBottom: 12,
        background: '#fff', borderRadius: 18,
        border: '1px solid rgba(0,0,0,0.04)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        cursor: 'pointer', width: '100%', textAlign: 'left',
        position: 'relative',
      }}
    >
      {/* Image */}
      <div style={{
        width: 88, height: 88, borderRadius: 14,
        flexShrink: 0, position: 'relative', overflow: 'hidden',
      }}>
        {photoUrl ? (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(135deg, ${category?.color || '#e8d5c0'}33, ${category?.color || '#d4c0a8'}22)`,
            }} />
            <img
              src={photoUrl} alt={restaurant.name} loading="lazy"
              onLoad={() => setImgLoaded(true)}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', opacity: imgLoaded ? 1 : 0,
                transition: 'opacity 0.4s',
              }}
            />
          </>
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, opacity: 0.6,
            background: `linear-gradient(135deg, ${category?.color || '#e8d5c0'}33, ${category?.color || '#d4c0a8'}22)`,
          }}>
            {category?.emoji || '🍽️'}
          </div>
        )}
        {/* Discount badge on image */}
        {discountValue && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            background: 'linear-gradient(135deg, #A3E635, #4ADE80)', color: '#1a4731',
            fontSize: 9, fontWeight: 800,
            padding: '2px 7px', borderRadius: 6,
            boxShadow: '0 2px 6px rgba(74,222,128,0.3)',
          }}>
            -{discountValue}%
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-sans)", fontWeight: 800,
          fontSize: 18, color: '#22181C',
          lineHeight: 1.2, letterSpacing: '-0.015em', marginBottom: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          paddingRight: 28,
        }}>
          {restaurant.name}
        </div>
        <div style={{
          fontSize: 12, color: '#8A8680', fontWeight: 500,
          marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {category?.name || restaurant.cuisine_type || 'Ristorante'}
          {restaurant.description && (
            <>
              <span style={{ opacity: 0.35 }}>|</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {restaurant.description.slice(0, 30)}
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dist && (
            <div style={{
              fontSize: 11, color: '#8A8680', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <DistanceIcon />
              {dist}
            </div>
          )}
          <PriceDisplay level={restaurant.price_range} />
        </div>
      </div>

      {/* Heart */}
      <div
        onClick={(e) => { e.stopPropagation(); onSave?.() }}
        style={{
          position: 'absolute', right: 14, top: 14,
          color: saved ? '#E8453C' : '#D1CDC6',
          cursor: 'pointer', padding: 4,
        }}
      >
        <HeartIcon filled={saved} />
      </div>
    </button>
  )
}

/* ============================================
   MAIN LIST VIEW
   ============================================ */
export default function ListView() {
  const navigate = useNavigate()
  const { user } = useAuth()
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
  const { isSaved, toggleSave } = useSavedRestaurants(user?.id)

  const discountValueMap = useMemo(() =>
    Object.fromEntries(activeDiscounts.map(d => [d.restaurant_id, d.discount_value])),
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

  const handleSave = useCallback((id) => {
    if (!user) { navigate('/login'); return }
    toggleSave(id)
  }, [user, navigate, toggleSave])

  // Apply extra client-side filters (deals, dietary, radius)
  const displayedRestaurants = useMemo(() => {
    let result = showDealsOnly
      ? restaurants.filter(r => discountValueMap[r.id])
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
  }, [restaurants, showDealsOnly, extraFilters, position, discountValueMap])

  // Random restaurant with discount as hero — excludes restaurants with featured discounts
  // (those are shown in DealsPage "In evidenza") so the two pages differ
  const [heroSeed] = useState(() => Math.floor(Math.random() * 1000))
  const featuredDiscountRestaurantIds = new Set((featuredDiscounts || []).map(d => d.restaurant_id))
  const restaurantsWithDiscount = displayedRestaurants.filter(r => discountValueMap[r.id] && !featuredDiscountRestaurantIds.has(r.id))
  const featuredRestaurant = restaurantsWithDiscount.length > 0
    ? restaurantsWithDiscount[heroSeed % restaurantsWithDiscount.length]
    : displayedRestaurants.filter(r => !featuredDiscountRestaurantIds.has(r.id))[0] || displayedRestaurants[0]
  const otherRestaurants = displayedRestaurants.filter(r => r.id !== featuredRestaurant?.id)

  return (
    <div
      ref={scrollContainerRef}
      style={{
        minHeight: '100dvh', background: '#FAF7F2',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 80,
      }}
    >
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
            {/* Featured / Hero card */}
            {featuredRestaurant && (
              <HeroCard
                restaurant={featuredRestaurant}
                userPosition={position}
                discountValue={discountValueMap[featuredRestaurant.id]}
                saved={isSaved(featuredRestaurant.id)}
                onSave={() => handleSave(featuredRestaurant.id)}
                onClick={handleCardClick}
              />
            )}

            {/* All restaurants */}
            {otherRestaurants.length > 0 && (
              <>
                {otherRestaurants.map((restaurant) => (
                  <HorizontalCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    userPosition={position}
                    discountValue={discountValueMap[restaurant.id]}
                    saved={isSaved(restaurant.id)}
                    onSave={() => handleSave(restaurant.id)}
                    onClick={handleCardClick}
                  />
                ))}
              </>
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
    </div>
  )
}
