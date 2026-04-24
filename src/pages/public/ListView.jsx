import { useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
import { useCategories } from '../../lib/hooks/useCategories'
import { MOMENT_KEYS, MOMENT_SLOTS } from '../../lib/hours'

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
          background: '#E8453C', color: '#fff',
          fontSize: 11, fontWeight: 700,
          padding: '5px 12px', borderRadius: 10,
          boxShadow: '0 2px 10px rgba(232, 69, 60,0.4)',
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
            background: '#E8453C', color: '#fff',
            fontSize: 9, fontWeight: 700,
            padding: '2px 7px', borderRadius: 6,
            boxShadow: '0 2px 6px rgba(232, 69, 60,0.3)',
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
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1CDC6', flexShrink: 0 }} />
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
   FILTER SHEET
   ============================================ */
function FilterSheet({ open, onClose, filters, onFilterChange, restaurants, categories, selectedDiet, onDietToggle }) {
  const selected = filters.category ? (Array.isArray(filters.category) ? filters.category : [filters.category]) : []
  const activeMoment = filters.moment || null

  function toggleCategory(name) {
    const next = selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name]
    onFilterChange({ ...filters, category: next.length > 0 ? next : null })
  }
  function toggleMoment(key) {
    onFilterChange({ ...filters, moment: activeMoment === key ? null : key })
  }
  function togglePrice(p) {
    onFilterChange({ ...filters, priceRange: filters.priceRange === p ? null : p })
  }
  function resetAll() {
    onFilterChange({ category: null, moment: null, priceRange: null, sortBy: null })
    onDietToggle([])
  }

  const hasFilters = selected.length > 0 || activeMoment || filters.priceRange || selectedDiet.length > 0
  const DIET = [
    { key: 'vegano', label: 'Vegano', emoji: '🥦' },
    { key: 'vegetariano', label: 'Vegetariano', emoji: '🫑' },
    { key: 'salutare', label: 'Salutare', emoji: '🥗' },
    { key: 'senza_glutine', label: 'Senza glutine', emoji: '🌾' },
  ]
  const PRICES = ['€', '€€', '€€€', '€€€€']

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 80, display: 'flex', alignItems: 'flex-end' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            style={{ width: '100%', background: '#FAF7F2', borderRadius: '24px 24px 0 0', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 -20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 42, height: 4, background: 'rgba(34,24,28,0.12)', borderRadius: 2, margin: '10px auto' }} />
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '4px 20px 14px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 26, letterSpacing: '-0.02em' }}>Filtri</span>
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(34,24,28,0.05)', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 140px', WebkitOverflowScrolling: 'touch' }}>
              {/* Categoria */}
              <div style={{ marginBottom: 22 }}>
                <p style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.01em', marginBottom: 10 }}>Categoria</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px 6px' }}>
                  {categories.map(cat => {
                    const active = selected.includes(cat.name)
                    return (
                      <button key={cat.name} onClick={() => toggleCategory(cat.name)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: active ? '#E8453C' : '#fff', border: `1.5px solid ${active ? '#E8453C' : 'rgba(34,24,28,0.12)'}`, display: 'grid', placeItems: 'center', fontSize: 26, boxShadow: active ? '0 6px 16px rgba(232,69,60,0.4)' : '0 1px 4px rgba(34,24,28,0.06)', transition: 'all .15s ease' }}>
                          {cat.emoji}
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 700, textAlign: 'center', lineHeight: 1.15, color: active ? '#C6372F' : '#22181C', maxWidth: 72 }}>{cat.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Fascia d'orario */}
              <div style={{ marginBottom: 22 }}>
                <p style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.01em', marginBottom: 10 }}>Fascia d'orario</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {MOMENT_KEYS.map(key => {
                    const slot = MOMENT_SLOTS[key]
                    const active = activeMoment === key
                    return (
                      <button key={key} onClick={() => toggleMoment(key)} style={{ padding: '10px 14px', background: active ? '#E8453C' : '#fff', border: `1px solid ${active ? '#E8453C' : 'rgba(34,24,28,0.12)'}`, borderRadius: 999, fontSize: 13, fontWeight: 700, color: active ? '#fff' : '#22181C', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: active ? '0 4px 10px rgba(232,69,60,0.3)' : 'none', transition: 'all .15s ease' }}>
                        <span>{slot.emoji}</span>{slot.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Dieta e stile */}
              <div style={{ marginBottom: 22 }}>
                <p style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.01em', marginBottom: 10 }}>Dieta e stile</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DIET.map(d => {
                    const active = selectedDiet.includes(d.key)
                    return (
                      <button key={d.key} onClick={() => onDietToggle(active ? selectedDiet.filter(k => k !== d.key) : [...selectedDiet, d.key])} style={{ padding: '10px 14px', background: active ? '#E8453C' : '#fff', border: `1px solid ${active ? '#E8453C' : 'rgba(34,24,28,0.12)'}`, borderRadius: 999, fontSize: 13, fontWeight: 700, color: active ? '#fff' : '#22181C', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: active ? '0 4px 10px rgba(232,69,60,0.3)' : 'none', transition: 'all .15s ease' }}>
                        <span>{d.emoji}</span>{d.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Fascia prezzo */}
              <div style={{ marginBottom: 22 }}>
                <p style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.01em', marginBottom: 10 }}>Fascia prezzo</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRICES.map((p, i) => {
                    const level = i + 1
                    const active = filters.priceRange === level
                    return (
                      <button key={p} onClick={() => togglePrice(level)} style={{ padding: '10px 14px', background: active ? '#E8453C' : '#fff', border: `1px solid ${active ? '#E8453C' : 'rgba(34,24,28,0.12)'}`, borderRadius: 999, fontSize: 13, fontWeight: 700, color: active ? '#fff' : '#22181C', cursor: 'pointer', boxShadow: active ? '0 4px 10px rgba(232,69,60,0.3)' : 'none', transition: 'all .15s ease' }}>
                        {p}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* CTA sticky */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', background: '#FAF7F2', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={onClose} style={{ padding: 16, background: '#E8453C', color: '#fff', borderRadius: 999, fontSize: 14.5, fontWeight: 900, border: 'none', cursor: 'pointer', boxShadow: '0 12px 28px rgba(232,69,60,0.4)', letterSpacing: '-0.01em', textAlign: 'center' }}>
                Mostra {restaurants.length} locali
              </button>
              {hasFilters && (
                <button onClick={resetAll} style={{ padding: 14, background: '#fff', border: '1px solid rgba(34,24,28,0.12)', color: '#22181C', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                  Azzera filtri
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
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

  const { discounts: activeDiscounts, allFeatured: featuredDiscounts } = useActiveDiscounts()
  const { isSaved, toggleSave } = useSavedRestaurants(user?.id)
  const { categories: CUISINE_CATEGORIES } = useCategories()

  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [showDealsOnly, setShowDealsOnly] = useState(false)
  const [selectedDiet, setSelectedDiet] = useState([])

  const discountValueMap = useMemo(() =>
    Object.fromEntries(activeDiscounts.map(d => [d.restaurant_id, d.discount_value])),
    [activeDiscounts]
  )

  const activeFilterCount = useMemo(() => {
    const selected = filters.category ? (Array.isArray(filters.category) ? filters.category.length : 1) : 0
    return selected + (filters.moment ? 1 : 0) + (filters.priceRange ? 1 : 0)
  }, [filters])

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

  const [heroSeed] = useState(() => Math.floor(Math.random() * 1000))
  const featuredDiscountRestaurantIds = new Set((featuredDiscounts || []).map(d => d.restaurant_id))

  const visibleRestaurants = useMemo(() =>
    showDealsOnly ? restaurants.filter(r => discountValueMap[r.id]) : restaurants,
    [restaurants, showDealsOnly, discountValueMap]
  )

  const restaurantsWithDiscount = visibleRestaurants.filter(r => discountValueMap[r.id] && !featuredDiscountRestaurantIds.has(r.id))
  const featuredRestaurant = restaurantsWithDiscount.length > 0
    ? restaurantsWithDiscount[heroSeed % restaurantsWithDiscount.length]
    : visibleRestaurants.filter(r => !featuredDiscountRestaurantIds.has(r.id))[0] || visibleRestaurants[0]
  const otherRestaurants = visibleRestaurants.filter(r => r.id !== featuredRestaurant?.id)

  function resetAllFilters() {
    setFilters({ category: null, moment: null, priceRange: null, sortBy: null })
    setSearchQuery('')
    setShowDealsOnly(false)
    setSelectedDiet([])
  }

  return (
    <div
      ref={scrollContainerRef}
      style={{
        minHeight: '100dvh', background: '#FAF7F2',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 100,
      }}
    >
      {/* Navbar */}
      <Navbar view="list" onToggleView={handleToggleView} restaurants={restaurants} />

      {/* Search pill */}
      <div style={{ padding: '4px 16px 10px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 72px)', background: '#FAF7F2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', background: '#fff', border: '1px solid rgba(34,24,28,0.12)', borderRadius: 999, fontSize: 13.5, color: 'rgba(34,24,28,0.4)', fontWeight: 500, boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(34,24,28,0.7)" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cerca ristoranti, zone, piatti…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13.5, fontWeight: 500, color: '#22181C', fontFamily: 'var(--font-sans)' }}
            autoComplete="off" spellCheck={false}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(34,24,28,0.4)" strokeWidth="2.5" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* 3 filter pills */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 10px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', background: '#FAF7F2' }}>
        <button onClick={() => setFilterSheetOpen(true)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: '#fff', border: `1.5px solid ${activeFilterCount > 0 ? '#22181C' : 'rgba(34,24,28,0.12)'}`, borderRadius: 999, fontSize: 13, fontWeight: activeFilterCount > 0 ? 800 : 700, color: '#22181C', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="20" y2="6"/><circle cx="12" cy="6" r="2"/><line x1="4" y1="12" x2="7" y2="12"/><line x1="11" y1="12" x2="20" y2="12"/><circle cx="9" cy="12" r="2"/><line x1="4" y1="18" x2="14" y2="18"/><line x1="18" y1="18" x2="20" y2="18"/><circle cx="16" cy="18" r="2"/></svg>
          Filtri
          {activeFilterCount > 0 && <span style={{ background: '#E8453C', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 999, minWidth: 18, textAlign: 'center' }}>{activeFilterCount}</span>}
        </button>
        <button onClick={() => setFilterSheetOpen(true)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: '#fff', border: '1.5px solid rgba(34,24,28,0.12)', borderRadius: 999, fontSize: 13, fontWeight: 700, color: '#22181C', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          Categorie<span style={{ fontSize: 9, opacity: 0.5 }}>▾</span>
        </button>
        <button onClick={() => setShowDealsOnly(v => !v)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: showDealsOnly ? '#FDF2F0' : '#fff', border: `1.5px solid ${showDealsOnly ? '#E8453C' : 'rgba(34,24,28,0.12)'}`, borderRadius: 999, fontSize: 13, fontWeight: 700, color: showDealsOnly ? '#C6372F' : '#22181C', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>
          Sconti
        </button>
      </div>

      {/* Count bar */}
      <div style={{ padding: '4px 20px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', background: '#FAF7F2' }}>
        {loading ? (
          <div style={{ width: 100, height: 14, borderRadius: 6, background: '#E8E5DE' }} />
        ) : (
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em', color: '#22181C' }}>
            {visibleRestaurants.length} locali{activeFilterCount > 0 || showDealsOnly ? ` · ${activeFilterCount + (showDealsOnly ? 1 : 0)} ${activeFilterCount + (showDealsOnly ? 1 : 0) === 1 ? 'filtro attivo' : 'filtri attivi'}` : ''}
          </span>
        )}
        {(activeFilterCount > 0 || showDealsOnly || searchQuery) && (
          <button onClick={resetAllFilters} style={{ fontSize: 12, fontWeight: 700, color: '#E8453C', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Azzera</button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingLeft: 16, paddingRight: 16, maxWidth: 600, margin: '0 auto', width: '100%' }}>


        {/* Restaurant list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : visibleRestaurants.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#22181C' }}>Nessun ristorante trovato</p>
            <p style={{ fontSize: 14, color: '#8A8680', marginTop: 4 }}>Prova a cambiare i filtri o la ricerca</p>
          </div>
        ) : (
          <>
            {/* Featured / Hero card */}
            {featuredRestaurant && (
              <>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: 2,
                  textTransform: 'uppercase', color: '#8A8680',
                  marginBottom: 14, paddingLeft: 6,
                }}>
                  In evidenza
                </div>
                <HeroCard
                  restaurant={featuredRestaurant}
                  userPosition={position}
                  discountValue={discountValueMap[featuredRestaurant.id]}
                  saved={isSaved(featuredRestaurant.id)}
                  onSave={() => handleSave(featuredRestaurant.id)}
                  onClick={handleCardClick}
                />
              </>
            )}

            {/* All restaurants */}
            {otherRestaurants.length > 0 && (
              <>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: 2,
                  textTransform: 'uppercase', color: '#8A8680',
                  marginBottom: 14, paddingLeft: 6,
                }}>
                  Tutti i ristoranti
                </div>
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/>
          <line x1="9" y1="3" x2="9" y2="18"/>
          <line x1="15" y1="6" x2="15" y2="21"/>
        </svg>
        Mappa
      </button>

      <FilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onFilterChange={setFilters}
        restaurants={visibleRestaurants}
        categories={CUISINE_CATEGORIES}
        selectedDiet={selectedDiet}
        onDietToggle={setSelectedDiet}
      />

      {/* Tab bar */}
      <MobileTabBar />
    </div>
  )
}
