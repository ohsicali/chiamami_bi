import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { supabase, proxyImg } from '../../lib/supabase'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { getDistance, formatDistance } from '../../lib/utils/distance'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import Footer from '../../components/Layout/Footer'

function slugify(name) {
  return name.toLowerCase().replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/* ── SVG Icons (same as ListView) ── */
const StarIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#C4A265" stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
  </svg>
)

const HeartIcon = ({ filled, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill={filled ? '#E8453C' : 'none'}
    stroke={filled ? '#E8453C' : 'currentColor'}
    strokeWidth="2"
  >
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
)

const DistanceIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </svg>
)

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

function getPhotoUrl(restaurant) {
  if (Array.isArray(restaurant.photos) && restaurant.photos.length > 0) {
    const sorted = [...restaurant.photos].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    return proxyImg(sorted[0]?.photo_url)
  }
  return null
}

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { savedIds, toggleSave } = useSavedRestaurants(user?.id)
  const [restaurants, setRestaurants] = useState([])
  const [activeDiscounts, setActiveDiscounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [userLocation, setUserLocation] = useState(null)

  // Get user location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, timeout: 5000 }
      )
    }
  }, [])

  // Fetch saved restaurants
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
        .select('id, discount_value, discount_type, restaurant_id')
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

  // Filtered & sorted list
  const displayList = useMemo(() => {
    let list = [...restaurants]

    if (filter === 'discounted') {
      list = list.filter(r => activeDiscounts[r.id])
    }

    if (filter === 'nearby' && userLocation) {
      list = list
        .map(r => ({
          ...r,
          _distance: r.latitude && r.longitude
            ? getDistance(userLocation.lat, userLocation.lng, r.latitude, r.longitude)
            : Infinity,
        }))
        .sort((a, b) => a._distance - b._distance)
    }

    return list
  }, [restaurants, filter, activeDiscounts, userLocation])

  // Redirect if not logged in
  if (!authLoading && !user) return <Navigate to="/login" replace />

  const goTo = (r) => navigate(`/restaurant/${r?.slug || slugify(r?.name || '')}`)

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 22px 14px',
        background: 'rgba(250,247,242,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 0 }}>
          <Link to="/" className="flex flex-col items-start" style={{ gap: 1 }}>
            <img src="/logo-guida-bi.png" alt="La Guida di Bi" style={{ height: 22, width: 'auto' }} />
            <span style={{ fontSize: 9, color: 'var(--color-secondary)', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' }}>by Chiamami Bi</span>
          </Link>
          <button className="flex items-center gap-1.5" style={{
            fontSize: 12, color: '#555', fontWeight: 600, padding: '6px 12px', borderRadius: 20,
            background: 'rgba(0,0,0,0.04)', border: '1px solid var(--color-bordo)',
          }}>
            <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--color-success)' }} />
              <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: 'var(--color-success)', opacity: 0.4, animation: 'cityPulse 2s ease-in-out infinite' }} />
            </span>
            Torino
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
      </div>

      {/* Title */}
      <div style={{ padding: '16px 22px 10px' }}>
        <h1 style={{ fontFamily: "'TAN Songbird', serif", fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>
          I miei salvati
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-secondary)', margin: '4px 0 0' }}>
          I ristoranti che ti hanno conquistato
        </p>
      </div>

      {/* Filter chips */}
      {restaurants.length > 0 && (
        <div className="flex" style={{ padding: '0 22px 8px', gap: 6 }}>
          {[
            { key: 'all', label: `Tutti (${restaurants.length})` },
            { key: 'discounted', label: 'Scontati' },
            { key: 'nearby', label: 'Vicino a me' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                fontSize: 12, borderRadius: 18, padding: '6px 14px',
                fontWeight: filter === f.key ? 500 : 400, cursor: 'pointer',
                background: filter === f.key ? 'var(--color-primary)' : '#fff',
                color: filter === f.key ? '#fff' : 'var(--color-secondary)',
                border: filter === f.key ? 'none' : '1px solid var(--color-bordo)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1" style={{ padding: '8px 16px', paddingBottom: TAB_BAR_HEIGHT + 16 }}>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[88, 88, 88].map((h, i) => (
              <div key={i} className="shimmer" style={{ height: h, borderRadius: 18 }} />
            ))}
          </div>
        ) : displayList.length === 0 && filter !== 'all' ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span style={{ fontSize: 28, marginBottom: 8 }}>{filter === 'discounted' ? '🏷️' : '📍'}</span>
            <p style={{ fontSize: 14, color: 'var(--color-secondary)' }}>
              {filter === 'discounted' ? 'Nessuno dei tuoi salvati ha uno sconto attivo' : 'Attiva la geolocalizzazione per ordinare per distanza'}
            </p>
          </div>
        ) : restaurants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 40px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-bordo)" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto' }}>
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            <h2 style={{ fontFamily: "'TAN Songbird', serif", fontSize: 18, color: 'var(--color-primary)', marginTop: 16 }}>
              Non hai ancora salvato nessun posto
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-secondary)', marginTop: 8, lineHeight: 1.5 }}>
              Esplora la mappa e salva i ristoranti che ti incuriosiscono
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'var(--color-accent)', color: '#fff', borderRadius: 14,
                padding: '14px 28px', fontSize: 14, fontWeight: 600, marginTop: 20,
                border: 'none', cursor: 'pointer',
              }}
            >
              Esplora la mappa
            </button>
          </div>
        ) : (
          displayList.map(r => {
            const photoUrl = getPhotoUrl(r)
            const categories = (r.category || (r.cuisine_type ? [r.cuisine_type] : []))
              .map(n => getCategoryInfo(n)).filter(Boolean)
            const category = categories[0]
            const discount = activeDiscounts[r.id]
            const discountLabel = discount
              ? (discount.discount_type === 'percentage' ? `-${discount.discount_value}%` : `-${discount.discount_value}€`)
              : null

            const dist = userLocation && r.latitude
              ? formatDistance(getDistance(userLocation.lat, userLocation.lng, r.latitude, r.longitude))
              : null

            return (
              <button
                key={r.id}
                onClick={() => goTo(r)}
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
                        src={photoUrl} alt={r.name} loading="lazy"
                        style={{
                          position: 'absolute', inset: 0, width: '100%', height: '100%',
                          objectFit: 'cover',
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
                  {discountLabel && (
                    <div style={{
                      position: 'absolute', top: 6, left: 6,
                      background: '#E8453C', color: '#fff',
                      fontSize: 9, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 6,
                      boxShadow: '0 2px 6px rgba(232,69,60,0.3)',
                    }}>
                      {discountLabel}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'TAN Songbird', 'DM Sans', sans-serif",
                    fontSize: 18, fontWeight: 600, color: '#22181C',
                    lineHeight: 1.2, marginBottom: 3,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    paddingRight: 28,
                  }}>
                    {r.name}
                  </div>
                  <div style={{
                    fontSize: 12, color: '#8A8680', fontWeight: 500,
                    marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {category?.name || r.cuisine_type || 'Ristorante'}
                    {r.description && (
                      <>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1CDC6', flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.description.slice(0, 30)}
                        </span>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {r.our_rating && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        background: '#FBF9F4', padding: '3px 8px', borderRadius: 8,
                        fontSize: 12, fontWeight: 700, color: '#22181C',
                      }}>
                        <StarIcon />
                        {r.our_rating}
                      </div>
                    )}
                    {dist && (
                      <div style={{
                        fontSize: 11, color: '#8A8680', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <DistanceIcon />
                        {dist}
                      </div>
                    )}
                    <PriceDisplay level={r.price_range} />
                  </div>
                </div>

                {/* Heart */}
                <div
                  onClick={(e) => { e.stopPropagation(); toggleSave(r.id) }}
                  style={{
                    position: 'absolute', right: 14, top: 14,
                    color: '#E8453C',
                    cursor: 'pointer', padding: 4,
                  }}
                >
                  <HeartIcon filled={true} />
                </div>
              </button>
            )
          })
        )}
      </div>

      <div style={{ paddingBottom: TAB_BAR_HEIGHT }}>
        <Footer />
      </div>
    </div>
  )
}
