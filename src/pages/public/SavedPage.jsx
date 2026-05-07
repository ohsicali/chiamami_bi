import DesktopSavedPage from './DesktopSavedPage'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import CityPickerSheet from '../../components/UI/CityPickerSheet'
import { useCity } from '../../lib/CityContext'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { supabase, proxyImg } from '../../lib/supabase'
import { getDistance } from '../../lib/utils/distance'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import Footer from '../../components/Layout/Footer'
import MobileLogoHeader from '../../components/Layout/MobileLogoHeader'
import SaveButton from '../../components/Restaurant/SaveButton'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import MobileFilterBar from '../../components/Layout/MobileFilterBar'
import { isOpenForMoment } from '../../lib/hours'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
import { formatDiscountValue } from '../../lib/utils/discountFormat'

function slugify(name) {
  return name.toLowerCase().replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { savedIds, isSaved, toggleSave } = useSavedRestaurants(user?.id)
  const [restaurants, setRestaurants] = useState([])
  const [activeDiscounts, setActiveDiscounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ category: null, priceRange: null, moment: null, sortBy: null })
  const [extraFilters, setExtraFilters] = useState({ dietary: [], radiusKm: null })
  const [showDealsOnly, setShowDealsOnly] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [filtersStuck, setFiltersStuck] = useState(false)
  const headerRef = useRef(null)
  const [headerH, setHeaderH] = useState(0)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [sortMode, setSortMode] = useState('recent')
  const { city: currentCity } = useCity()
  const isDesktop = useIsDesktop()

  // Measure header height for sticky top offset
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setHeaderH(el.offsetHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Detect when filters are stuck (only for border visual — no layout effect)
  useEffect(() => {
    if (!headerH) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setFiltersStuck(window.scrollY > headerH + 70)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [headerH])

  useEffect(() => {
    if (!user?.id || savedIds.size === 0) {
      setRestaurants([])
      setLoading(false)
      return
    }

    const ids = [...savedIds]
    setLoading(true)

    Promise.all([
      supabase
        .from('restaurants')
        .select('*, photos:restaurant_photos(id, photo_url, thumb_url, sort_order)')
        .in('id', ids),
      supabase
        .from('discounts')
        .select('id, title, discount_value, discount_type, restaurant_id')
        .in('restaurant_id', ids)
        .eq('is_active', true)
        .lte('valid_from', new Date().toISOString())
        .gte('valid_until', new Date().toISOString()),
    ]).then(([resResult, discResult]) => {
      if (resResult.data) setRestaurants(resResult.data)
      if (discResult.data) {
        const map = {}
        discResult.data.forEach(d => { map[d.restaurant_id] = d })
        setActiveDiscounts(map)
      }
      setLoading(false)
    })
  }, [user?.id, savedIds])

  const cityRestaurants = useMemo(() => {
    if (!currentCity.name) return restaurants
    return restaurants.filter(r => r.city?.toLowerCase() === currentCity.name.toLowerCase())
  }, [restaurants, currentCity.name])

  const dealsCount = useMemo(() => cityRestaurants.filter(r => activeDiscounts[r.id]).length, [cityRestaurants, activeDiscounts])

  const displayList = useMemo(() => {
    let list = [...restaurants]

    // Filter by selected city
    if (currentCity.name) {
      list = list.filter(r => r.city?.toLowerCase() === currentCity.name.toLowerCase())
    }

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

    if (extraFilters.radiusKm !== null && userLocation) {
      list = list.filter(r => {
        if (!r.latitude || !r.longitude) return true
        return getDistance(userLocation.lat, userLocation.lng, r.latitude, r.longitude) <= extraFilters.radiusKm
      })
    }

    if (showDealsOnly) {
      list = list.filter(r => activeDiscounts[r.id])
    }

    if (filters.sortBy === 'distance' && userLocation) {
      list.sort((a, b) => {
        const dA = a.latitude ? getDistance(userLocation.lat, userLocation.lng, a.latitude, a.longitude) : Infinity
        const dB = b.latitude ? getDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude) : Infinity
        return dA - dB
      })
    }

    return list
  }, [restaurants, filters, extraFilters, showDealsOnly, activeDiscounts, userLocation, currentCity.name])

  if (!authLoading && !user) return <Navigate to="/login" replace />
  if (isDesktop) return <DesktopSavedPage />

  const handleClick = (restaurant) => {
    navigate(`/restaurant/${restaurant.slug || slugify(restaurant.name || '')}`)
  }

  const handleSave = (id) => {
    if (!user) { navigate('/login'); return }
    toggleSave(id)
  }

  const handleNearbyClick = () => {
    if (userLocation) {
      setFilters(f => ({ ...f, sortBy: 'distance' }))
    } else if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setFilters(f => ({ ...f, sortBy: 'distance' }))
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }
  }

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-bg)' }}>
      <MobileLogoHeader />
      {/* Sticky Header — v4 mobile topbar con dual ico-btn (mobile only) */}
      <div ref={headerRef} className="md:hidden" style={{
        padding: '10px 20px 14px',
        background: 'var(--color-page)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, color: 'var(--color-ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              Salvati
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 4 }}>
              {cityRestaurants.length} {cityRestaurants.length === 1 ? 'locale' : 'locali'}
              {dealsCount > 0 && ` · ${dealsCount} con sconto`}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              onClick={() => setCityPickerOpen(true)}
              aria-label="Cerca"
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--color-ink-05)', display: 'grid', placeItems: 'center',
                border: 0, cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
              </svg>
            </button>
            <button
              aria-label="Opzioni"
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--color-ink-05)', display: 'grid', placeItems: 'center',
                border: 0, cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-ink)" stroke="none">
                <circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>


      {/* Desktop-only page header — title + chip filters on the right */}
      <div className="hidden md:flex md:max-w-[940px] md:mx-auto md:w-full" style={{
        padding: '32px 16px 18px',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 26,
            fontWeight: 900,
            color: 'var(--color-ink)',
            letterSpacing: '-0.02em',
            marginBottom: 4,
          }}>
            Salvati
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-ink-70)' }}>
            {cityRestaurants.length} {cityRestaurants.length === 1 ? 'ristorante salvato' : 'ristoranti salvati'}
          </p>
        </div>
        {restaurants.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'all', label: `Tutti (${cityRestaurants.length})`, active: !showDealsOnly && filters.sortBy !== 'distance', onClick: () => { setShowDealsOnly(false); setFilters(f => ({ ...f, sortBy: null })) } },
              { key: 'deals', label: `Scontati${dealsCount ? ` (${dealsCount})` : ''}`, active: showDealsOnly, onClick: () => { setShowDealsOnly(v => !v); setFilters(f => ({ ...f, sortBy: null })) } },
              { key: 'near', label: 'Vicino a me', active: filters.sortBy === 'distance', onClick: () => { setShowDealsOnly(false); handleNearbyClick() } },
            ].map(chip => (
              <button
                key={chip.key}
                onClick={chip.onClick}
                style={{
                  padding: '7px 14px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 999,
                  border: `1px solid ${chip.active ? 'var(--color-ink)' : 'var(--color-bordo)'}`,
                  background: chip.active ? 'var(--color-ink)' : '#ffffff',
                  color: chip.active ? '#ffffff' : 'var(--color-ink)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter bar — CSS sticky, sticks sotto il logo header (hidden on desktop) */}
      {restaurants.length > 0 && (
        <div className="md:hidden" style={{
          position: 'sticky',
          top: 'calc(env(safe-area-inset-top, 0px) + 51px)',
          zIndex: 49,
          padding: '14px 16px 14px',
          background: 'rgba(250,247,242,0.75)',
          backdropFilter: 'blur(20px) saturate(1.6)', WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
          boxShadow: filtersStuck ? '0 1px 0 0 var(--color-bordo)' : 'none',
        }}>
          <div className="md:max-w-[940px] md:mx-auto">
            <MobileFilterBar
              filters={filters}
              onFilterChange={setFilters}
              showDealsOnly={showDealsOnly}
              onToggleDeals={() => setShowDealsOnly(v => !v)}
              restaurantCount={displayList.length}
              extraFilters={extraFilters}
              onExtraFilterChange={setExtraFilters}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 md:max-w-[940px] md:mx-auto md:w-full" style={{ padding: '8px 16px', paddingBottom: TAB_BAR_HEIGHT + 16 }}>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[120, 120, 120].map((h, i) => (
              <div key={i} className="shimmer" style={{ height: h, borderRadius: 18 }} />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 40px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-bordo)" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto' }}>
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 18, color: 'var(--color-ink)', marginTop: 16 }}>
              Non hai ancora salvato nessun posto
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-ink-70)', marginTop: 8, lineHeight: 1.5 }}>
              Esplora la mappa e salva i ristoranti che ti incuriosiscono
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'var(--color-corallo)', color: '#fff', borderRadius: 14,
                padding: '14px 28px', fontSize: 14, fontWeight: 600, marginTop: 20,
                border: 'none', cursor: 'pointer',
              }}
            >
              Esplora la mappa
            </button>
          </div>
        ) : cityRestaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span style={{ fontSize: 28, marginBottom: 8 }}>📍</span>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>Nessun locale salvato a {currentCity.name}</p>
            <p style={{ fontSize: 13, color: 'var(--color-ink-70)', marginTop: 4, lineHeight: 1.5 }}>
              Prova a selezionare un'altra città
            </p>
            <button
              onClick={() => setCityPickerOpen(true)}
              style={{
                background: 'var(--color-corallo)', color: '#fff', borderRadius: 14,
                padding: '12px 24px', fontSize: 13, fontWeight: 600, marginTop: 16,
                border: 'none', cursor: 'pointer',
              }}
            >
              Cambia città
            </button>
          </div>
        ) : displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span style={{ fontSize: 28, marginBottom: 8 }}>🔍</span>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>Nessun salvato in questa categoria</p>
            <p style={{ fontSize: 13, color: 'var(--color-ink-70)', marginTop: 4, lineHeight: 1.5 }}>
              Scopri tutti i ristoranti di questa categoria nell'elenco
            </p>
            <button
              onClick={() => {
                const cat = filters.category
                  ? (Array.isArray(filters.category) ? filters.category : [filters.category])
                  : null
                navigate('/', { state: { initialCategory: cat } })
              }}
              style={{
                background: 'var(--color-corallo)', color: '#fff', borderRadius: 14,
                padding: '12px 24px', fontSize: 13, fontWeight: 600, marginTop: 16,
                border: 'none', cursor: 'pointer',
              }}
            >
              Vedi tutti i ristoranti
            </button>
          </div>
        ) : (
          <>
            {/* Mobile: sv-lists chips + sv-head + sv-grid */}
            {!isDesktop && (() => {
              const renderSvCard = (r) => {
                const discount = activeDiscounts[r.id]
                const categories = (r.category || (r.cuisine_type ? [r.cuisine_type] : [])).map(name => getCategoryInfo(name)).filter(Boolean)
                const category = categories[0]
                const firstPhoto = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos[0] : null
                const photoUrl = proxyImg(firstPhoto ? (typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url) : null, { w: 800 })
                const priceStr = r.price_range != null ? '€'.repeat(r.price_range) : null
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(r)}
                    style={{
                      background: '#fff', borderRadius: 14, overflow: 'hidden',
                      border: '1px solid var(--color-ink-05)', position: 'relative',
                      cursor: 'pointer', textDecoration: 'none', color: 'inherit',
                    }}
                  >
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#ddd', overflow: 'hidden' }}>
                      {photoUrl ? (
                        <img src={photoUrl} alt={r.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, background: category?.color ? `linear-gradient(135deg, ${category.color}40, ${category.color}20)` : 'var(--color-cream-deep)', opacity: 0.6 }}>
                          {category?.emoji || '🍽️'}
                        </div>
                      )}
                      {discount && (
                        <span style={{
                          position: 'absolute', top: 8, left: 8,
                          background: 'var(--color-corallo)', color: '#fff',
                          fontWeight: 800, fontSize: 10, padding: '2.5px 6px',
                          borderRadius: 999, letterSpacing: '-0.01em',
                        }}>{discount.title || formatDiscountValue(discount) || 'SCONTO'}</span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSave(r.id) }}
                        aria-label="Rimuovi dai salvati"
                        style={{
                          position: 'absolute', top: 8, right: 8,
                          width: 26, height: 26, borderRadius: '50%',
                          background: 'var(--color-corallo)', color: '#fff',
                          display: 'grid', placeItems: 'center', fontSize: 12,
                          border: 0, cursor: 'pointer',
                        }}
                      >♥</button>
                    </div>
                    <div style={{ padding: '8px 10px 10px' }}>
                      <div style={{
                        fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 13,
                        letterSpacing: '-0.01em', lineHeight: 1.2, color: 'var(--color-ink)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{r.name}</div>
                      <div style={{
                        fontSize: 10.5, color: 'var(--color-ink-70)', marginTop: 3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {r.neighborhood || r.city}
                        {priceStr && <> | {priceStr}</>}
                      </div>
                    </div>
                  </div>
                )
              }
              const sortLabel = sortMode === 'recent' ? 'Recente' : sortMode === 'name' ? 'Nome' : 'Vicino'
              const sortSub = sortMode === 'recent' ? 'Ordinati per ultimo aggiunto' : sortMode === 'name' ? 'Ordine alfabetico' : 'Più vicini a te'
              return (
                <>
                  {/* sv-head: title + subtitle + sort */}
                  <div style={{
                    padding: '4px 4px 10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <h3 style={{
                        fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 18,
                        letterSpacing: '-0.02em', color: 'var(--color-ink)',
                      }}>{displayList.length} locali salvati</h3>
                      <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 2 }}>{sortSub}</div>
                    </div>
                    <div
                      onClick={() => {
                        const next = sortMode === 'recent' ? 'name' : sortMode === 'name' ? 'distance' : 'recent'
                        setSortMode(next)
                        if (next === 'distance') handleNearbyClick()
                        else setFilters(f => ({ ...f, sortBy: null }))
                      }}
                      style={{
                        fontSize: 12, fontWeight: 700, color: 'var(--color-ink)',
                        display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                      }}
                    >
                      {sortLabel}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>
                  </div>

                  {/* Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {displayList.map(renderSvCard)}
                  </div>
                </>
              )
            })()}

            {/* Desktop: vertical photo cards grid (3-col) — renderizzato SOLO su desktop */}
            {isDesktop && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
              {displayList.map((r) => {
                const discount = activeDiscounts[r.id]
                const categories = (r.category || (r.cuisine_type ? [r.cuisine_type] : [])).map(name => getCategoryInfo(name)).filter(Boolean)
                const category = categories[0]
                const firstPhoto = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos[0] : null
                const photoUrl = proxyImg(firstPhoto ? (typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url) : null, { w: 800 })
                const priceStr = r.price_range != null ? '€'.repeat(r.price_range) : null

                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(r)}
                    className="relative overflow-hidden cursor-pointer group"
                    style={{ height: 250, borderRadius: 16 }}
                  >
                    {/* Photo background */}
                    {photoUrl ? (
                      <img src={photoUrl} alt={r.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: category?.color ? `linear-gradient(135deg, ${category.color}40, ${category.color}20)` : 'var(--color-cream-deep)', fontSize: 40, opacity: 0.6 }}>
                        {category?.emoji || '🍽️'}
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 45%, transparent 100%)' }} />
                    {/* Discount badge */}
                    {discount && (
                      <div style={{
                        position: 'absolute', top: 10, left: 10, zIndex: 2,
                        background: 'linear-gradient(135deg, var(--color-corallo-soft) 0%, var(--color-corallo) 100%)', color: 'var(--color-ink)',
                        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                      }}>
                        {discount.title || discount.discount_value}
                      </div>
                    )}
                    {/* Save button */}
                    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }} onClick={(e) => { e.stopPropagation(); handleSave(r.id) }}>
                      <SaveButton saved={isSaved(r.id)} onClick={() => {}} size="sm" />
                    </div>
                    {/* Info at bottom */}
                    <div className="absolute bottom-0 left-0 right-0" style={{ padding: '14px 16px', zIndex: 2 }}>
                      <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 15, color: '#fff', lineHeight: 1.4, marginBottom: 4 }}>
                        {r.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                        {category && <span>{category.emoji} {category.name}</span>}
                        {category && priceStr && <span style={{ opacity: 0.4 }}>|</span>}
                        {priceStr && <span>{priceStr}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
              {/* Placeholder "Esplora la mappa" when fewer than 3 saved — fills the row */}
              {displayList.length > 0 && displayList.length < 3 && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/')}
                  className="saved-empty-card"
                  style={{
                    height: 250,
                    borderRadius: 16,
                    border: '2px dashed var(--color-bordo)',
                    background: 'var(--color-page)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-ink-15)'; e.currentTarget.style.background = '#fff' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-bordo)'; e.currentTarget.style.background = 'var(--color-page)' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-15)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink-55)' }}>Esplora la mappa</span>
                  <span style={{ fontSize: 11, color: 'var(--color-ink-55)', marginTop: 3 }}>per salvare altri ristoranti</span>
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>

      <Footer />

      <CityPickerSheet open={cityPickerOpen} onClose={() => setCityPickerOpen(false)} />
    </div>
  )
}
