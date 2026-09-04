import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import Footer from '../../components/Layout/Footer'
import MobileFilterBar from '../../components/Layout/MobileFilterBar'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
import { isOpenForMoment } from '../../lib/hours'
import { getDistance } from '../../lib/utils/distance'
import { supabase } from '../../lib/supabase'
import { formatDiscountValue } from '../../lib/utils/discountFormat'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'

function slugify(name) {
  return name.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
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
  const discountLabelMap = Object.fromEntries(
    activeDiscounts.map(d => [d.restaurant_id, formatDiscountValue(d)])
  )

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
      .select('*, photos:restaurant_photos(id, photo_url, thumb_url, sort_order)')
      .in('id', ids)
      .then(({ data, error }) => {
        if (error) console.error('[DesktopSavedPage] fetch error:', error)
        setRestaurants(data || [])
        setLoading(false)
      })
  }, [user?.id, savedIds])

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
      list = list.filter(r => isOpenForMoment(r.hours_cache, filters.moment, undefined, r.moments).match)
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
          <h1 style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 26,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            margin: '0 0 4px',
          }}>I miei salvati</h1>
          <div style={{ color: 'var(--color-ink-70)', fontSize: 13 }}>
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
            {displayedRestaurants.map((r, i) => (
              <RestaurantCard
                key={r.id}
                variant="tile"
                restaurant={r}
                index={i}
                userPosition={position}
                saved={savedIds.has(r.id)}
                hasDiscount={discountRestaurantIds.has(r.id)}
                discountTitle={discountLabelMap[r.id]}
                onSaveToggle={() => toggleSave(r.id)}
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
