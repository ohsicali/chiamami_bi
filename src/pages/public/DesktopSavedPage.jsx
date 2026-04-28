import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import Footer from '../../components/Layout/Footer'
import MobileFilterBar from '../../components/Layout/MobileFilterBar'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
import { isOpenForMoment } from '../../lib/hours'
import { getDistance } from '../../lib/utils/distance'
import { supabase, proxyImg } from '../../lib/supabase'

function slugify(name) {
  return name.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function getFirstPhoto(restaurant) {
  const photos = Array.isArray(restaurant.photos) ? restaurant.photos : []
  const sorted = [...photos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return proxyImg(sorted[0]?.thumb_url || sorted[0]?.photo_url || null)
}

const HEART_PATH = "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"

function RestaurantCard({ restaurant, isSaved, hasDiscount, discountLabel, onSave, onClick }) {
  const cats = restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : [])
  const catInfo = getCategoryInfo(cats[0])
  const photo = getFirstPhoto(restaurant)
  const priceStr = restaurant.price_range ? '€'.repeat(restaurant.price_range) : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(restaurant)}
      onKeyDown={e => e.key === 'Enter' && onClick(restaurant)}
      style={{
        background: '#fff', borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)',
        cursor: 'pointer', transition: 'transform .2s, box-shadow .2s',
        border: '1px solid var(--color-ink-05)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(34,24,28,.08)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)' }}
    >
      {/* Photo */}
      <div style={{ aspectRatio: '4/3', background: '#ddd', position: 'relative', overflow: 'hidden' }}>
        {photo
          ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
          : <div style={{ width: '100%', height: '100%', background: '#E8E5DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>{catInfo.emoji}</div>
        }
        {/* Heart button */}
        <button
          aria-label="Rimuovi dai salvati"
          onClick={e => { e.stopPropagation(); onSave(restaurant.id) }}
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 34, height: 34, borderRadius: '50%',
            background: isSaved ? 'var(--color-corallo-soft)' : 'rgba(255,255,255,.92)',
            border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer',
            color: isSaved ? 'var(--color-corallo)' : 'var(--color-ink)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d={HEART_PATH} />
          </svg>
        </button>
        {/* Discount badge */}
        {hasDiscount && discountLabel && (
          <span style={{
            position: 'absolute', top: 10, left: 10,
            background: 'linear-gradient(135deg,#A3E635,#4ADE80)', color: 'var(--color-ink)',
            fontWeight: 800, fontSize: 10.5, padding: '4px 9px', borderRadius: 999,
            letterSpacing: '-0.01em',
          }}>{discountLabel}</span>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--color-ink)' }}>
          {restaurant.name}
        </div>
        <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--color-corallo-soft)', color: 'var(--color-corallo-ink)', borderRadius: 999, fontSize: 10.5, fontWeight: 700 }}>
            {catInfo.emoji} {catInfo.name}
          </span>
          {priceStr && <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--color-ink-70)' }}>{priceStr}</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-ink-70)', marginTop: 6 }}>{restaurant.address}</div>
      </div>
    </div>
  )
}

export default function DesktopSavedPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { savedIds, toggleSave } = useSavedRestaurants(user?.id)
  const { discounts: activeDiscounts } = useActiveDiscounts()
  const { position } = useGeolocation()

  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ category: null, priceRange: null, moment: null, sortBy: null })
  const [extraFilters, setExtraFilters] = useState({ dietary: [], radiusKm: null })
  const [showDealsOnly, setShowDealsOnly] = useState(false)

  const discountRestaurantIds = new Set(activeDiscounts.map(d => d.restaurant_id))
  const discountLabelMap = Object.fromEntries(activeDiscounts.map(d => {
    const v = String(d.discount_value).replace(/[%€]/g, '')
    const isNumeric = /^\d+(\.\d+)?$/.test(v)
    const label = !isNumeric ? v : d.discount_type === 'percentage' ? `-${v}%` : `-${v}€`
    return [d.restaurant_id, label]
  }))

  // Fetch saved restaurants
  useEffect(() => {
    if (!user?.id || savedIds.size === 0) {
      setRestaurants([])
      setLoading(false)
      return
    }
    setLoading(true)
    const ids = [...savedIds]
    supabase
      .from('restaurants')
      .select('id, name, slug, city, address, latitude, longitude, cuisine_type, category, price_range, hours_cache, is_vegan, is_vegetarian, is_healthy, is_gluten_free, photos:restaurant_photos(id, photo_url, thumb_url, sort_order)')
      .in('id', ids)
      .eq('is_published', true)
      .then(({ data }) => {
        setRestaurants(data || [])
        setLoading(false)
      })
  }, [user?.id, savedIds.size])

  const displayedRestaurants = useMemo(() => {
    let list = [...restaurants]

    if (filters.category) {
      const selected = Array.isArray(filters.category) ? filters.category : [filters.category]
      list = list.filter(r => {
        const cats = r.category || (r.cuisine_type ? [r.cuisine_type] : [])
        return selected.some(s => cats.includes(s))
      })
    }

    if (filters.priceRange) {
      list = list.filter(r => r.price_range === filters.priceRange)
    }

    if (filters.moment) {
      list = list.filter(r => isOpenForMoment(r.hours_cache, filters.moment).match)
    }

    if (extraFilters.dietary?.length > 0) {
      const fieldMap = {
        vegano: 'is_vegan', vegetariano: 'is_vegetarian',
        salutare: 'is_healthy', senza_glutine: 'is_gluten_free',
      }
      list = list.filter(r =>
        extraFilters.dietary.every(key => r[fieldMap[key]] === true)
      )
    }

    if (extraFilters.radiusKm !== null && position) {
      list = list.filter(r => {
        if (!r.latitude || !r.longitude) return true
        return getDistance(position.lat, position.lng, r.latitude, r.longitude) <= extraFilters.radiusKm
      })
    }

    if (showDealsOnly) {
      list = list.filter(r => discountRestaurantIds.has(r.id))
    }

    return list
  }, [restaurants, filters, extraFilters, showDealsOnly, position, discountRestaurantIds])

  const handleRestaurantClick = useCallback((r) => {
    navigate(`/restaurant/${r.slug || slugify(r.name)}`)
  }, [navigate])

  if (!authLoading && !user) return <Navigate to="/login" replace />

  return (
    <div style={{ minHeight: 'calc(100vh - 80px)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, maxWidth: 1280, width: '100%', margin: '0 auto', padding: '24px 40px 0' }}>

        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontWeight: 900, fontSize: 32, letterSpacing: '-0.025em', margin: 0 }}>I miei salvati</h1>
          <div style={{ color: 'var(--color-ink-70)', fontSize: 13.5, marginTop: 6 }}>
            {restaurants.length} {restaurants.length === 1 ? 'locale salvato' : 'locali salvati'}
          </div>
        </div>

        {/* Filter bar — same as esplora */}
        {restaurants.length > 0 && (
          <div style={{ marginBottom: 22, maxWidth: 560 }}>
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

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ borderRadius: 20, background: '#fff', height: 260, border: '1px solid var(--color-ink-05)', opacity: .5 }} />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🤍</div>
            <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', marginBottom: 8 }}>
              Nessun locale salvato
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-ink-70)', marginBottom: 28 }}>
              Esplora i locali di Torino e salva quelli che ti incuriosiscono.
            </div>
            <Link
              to="/esplora"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '13px 28px', borderRadius: 999,
                background: 'var(--color-ink)', color: '#fff',
                fontWeight: 800, fontSize: 14, textDecoration: 'none',
              }}
            >Esplora i locali →</Link>
          </div>
        ) : displayedRestaurants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em', marginBottom: 8 }}>
              Nessun locale corrisponde ai filtri
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-ink-70)' }}>
              Prova a rimuovere qualche filtro per vedere più risultati.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
            {displayedRestaurants.map(r => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                isSaved={savedIds.has(r.id)}
                hasDiscount={discountRestaurantIds.has(r.id)}
                discountLabel={discountLabelMap[r.id]}
                onSave={id => toggleSave(id)}
                onClick={handleRestaurantClick}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
