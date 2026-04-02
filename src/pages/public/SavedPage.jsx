import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { supabase, proxyImg } from '../../lib/supabase'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import Footer from '../../components/Layout/Footer'

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { savedIds, toggleSave } = useSavedRestaurants(user?.id)
  const [restaurants, setRestaurants] = useState([])
  const [activeDiscounts, setActiveDiscounts] = useState({}) // restaurant_id → discount
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'discounted' | 'nearby'
  const [userLocation, setUserLocation] = useState(null)

  // Get user location for "Vicino a me"
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, timeout: 5000 }
      )
    }
  }, [])

  // Fetch saved restaurants with photos
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

  const discountedCount = useMemo(() => restaurants.filter(r => activeDiscounts[r.id]).length, [restaurants, activeDiscounts])

  // Redirect if not logged in
  if (!authLoading && !user) return <Navigate to="/login" replace />

  const goTo = (r) => navigate(`/restaurant/${r?.slug || slugify(r?.name || '')}`)

  const handleUnsave = async (e, restaurantId) => {
    e.stopPropagation()
    await toggleSave(restaurantId)
  }

  const formatDiscount = (d) => {
    if (!d) return null
    if (d.discount_type === 'percentage') return `-${d.discount_value}%`
    if (d.discount_type === 'fixed') return `-${d.discount_value}€`
    return d.discount_value
  }

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
                fontWeight: filter === f.key ? 500 : 400, border: 'none', cursor: 'pointer',
                background: filter === f.key ? 'var(--color-primary)' : '#fff',
                color: filter === f.key ? '#fff' : 'var(--color-secondary)',
                ...(filter !== f.key ? { border: '1px solid var(--color-bordo)' } : {}),
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1" style={{ padding: '8px 22px', paddingBottom: TAB_BAR_HEIGHT + 16 }}>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[200, 200, 200].map((h, i) => (
              <div key={i} className="shimmer" style={{ height: h, borderRadius: 20 }} />
            ))}
          </div>
        ) : displayList.length === 0 && filter !== 'all' ? (
          // No results for this filter
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span style={{ fontSize: 28, marginBottom: 8 }}>{filter === 'discounted' ? '🏷️' : '📍'}</span>
            <p style={{ fontSize: 14, color: 'var(--color-secondary)' }}>
              {filter === 'discounted' ? 'Nessuno dei tuoi salvati ha uno sconto attivo' : 'Attiva la geolocalizzazione per ordinare per distanza'}
            </p>
          </div>
        ) : restaurants.length === 0 ? (
          // Empty state
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
          // Restaurant cards
          displayList.map(r => {
            const photo = (r.photos || []).sort((a, b) => a.sort_order - b.sort_order).map(p => proxyImg(p.photo_url)).filter(Boolean)[0]
            const categories = (r.category || (r.cuisine_type ? [r.cuisine_type] : [])).map(name => getCategoryInfo(name)).filter(Boolean)
            const discount = activeDiscounts[r.id]
            const priceLabel = r.price_range || ''
            const distance = r._distance && r._distance !== Infinity ? formatDistance(r._distance) : null

            return (
              <div
                key={r.id}
                onClick={() => goTo(r)}
                style={{
                  background: '#fff', borderRadius: 20, overflow: 'hidden',
                  border: '1px solid var(--color-bordo)', marginBottom: 12, cursor: 'pointer',
                }}
              >
                {/* Photo */}
                <div style={{ position: 'relative', width: '100%', height: 140, overflow: 'hidden' }}>
                  {photo ? (
                    <img src={photo} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #e8d5c0, #d4c0a8)' }} />
                  )}
                  {/* Gradient overlay */}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)' }} />

                  {/* Name on photo */}
                  <div style={{ position: 'absolute', bottom: 12, left: 14, right: 50 }}>
                    <h3 style={{
                      fontFamily: "'TAN Songbird', serif", fontSize: 22, fontWeight: 700,
                      color: '#fff', margin: 0, lineHeight: 1.2,
                    }}>
                      {r.name}
                    </h3>
                    {(categories[0] || priceLabel) && (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>
                        {[categories[0]?.name, priceLabel].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Heart button */}
                  <button
                    onClick={(e) => handleUnsave(e, r.id)}
                    style={{
                      position: 'absolute', top: 10, right: 10,
                      width: 34, height: 34, background: 'rgba(250,247,242,0.92)',
                      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-accent)" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                  </button>

                  {/* Discount badge */}
                  {discount && (
                    <span style={{
                      position: 'absolute', top: 10, left: 10,
                      background: 'var(--color-accent)', color: '#fff',
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                    }}>
                      {formatDiscount(discount)}
                    </span>
                  )}
                </div>

                {/* Tags area */}
                <div style={{ padding: '10px 14px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {categories.map((cat, i) => (
                    <span key={i} style={{
                      fontSize: 11, color: 'var(--color-secondary)',
                      background: 'var(--color-bg)', padding: '3px 8px', borderRadius: 8,
                    }}>
                      {cat.emoji} {cat.name}
                    </span>
                  ))}
                  {distance && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-secondary)' }}>
                      {distance}
                    </span>
                  )}
                </div>
              </div>
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
