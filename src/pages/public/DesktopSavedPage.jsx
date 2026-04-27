import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import Footer from '../../components/Layout/Footer'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { supabase, proxyImg } from '../../lib/supabase'

const LS_NOTE_KEY = 'chiamamibi_saved_note_tutti'

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

  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState(() => {
    try { return localStorage.getItem(LS_NOTE_KEY) || '' } catch { return '' }
  })
  const [isEditingNote, setIsEditingNote] = useState(false)
  const noteRef = useRef(null)

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
      .select('id, name, slug, city, address, latitude, longitude, cuisine_type, category, price_range, photos:restaurant_photos(id, photo_url, thumb_url, sort_order)')
      .in('id', ids)
      .eq('is_published', true)
      .then(({ data }) => {
        setRestaurants(data || [])
        setLoading(false)
      })
  }, [user?.id, savedIds.size])

  const handleNoteBlur = useCallback(() => {
    setIsEditingNote(false)
    try { localStorage.setItem(LS_NOTE_KEY, note) } catch {}
  }, [note])

  const handleNoteKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); noteRef.current?.blur() }
    if (e.key === 'Escape') { noteRef.current?.blur() }
  }, [])

  const handleRestaurantClick = useCallback((r) => {
    navigate(`/restaurant/${r.slug || slugify(r.name)}`)
  }, [navigate])

  const initial = (user?.user_metadata?.full_name || user?.email || 'U')[0].toUpperCase()

  if (!authLoading && !user) return <Navigate to="/login" replace />

  return (
    <div style={{ minHeight: 'calc(100vh - 80px)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, maxWidth: 1280, width: '100%', margin: '0 auto', padding: '24px 40px 0' }}>

        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontWeight: 900, fontSize: 32, letterSpacing: '-0.025em', margin: 0 }}>I miei salvati</h1>
          <div style={{ color: 'var(--color-ink-70)', fontSize: 13.5, marginTop: 6 }}>
            {restaurants.length} locali · 1 lista
          </div>
        </div>

        {/* List chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 22, scrollbarWidth: 'none' }}>
          {/* Active "Tutti" chip */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 16px', borderRadius: 999,
            background: 'var(--color-ink)', color: '#fff',
            border: '1px solid var(--color-ink)',
            fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', cursor: 'pointer',
          }}>
            Tutti <span style={{ opacity: .55, fontSize: 11.5, fontWeight: 800 }}>{restaurants.length}</span>
          </div>
          {/* New list chip */}
          <div
            role="button"
            tabIndex={0}
            title="Funzionalità in arrivo — le liste multiple richiedono un aggiornamento DB"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 999,
              background: 'transparent',
              border: '1px dashed var(--color-corallo)',
              color: 'var(--color-corallo-ink)',
              fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', cursor: 'not-allowed',
              opacity: .7,
            }}
          >
            + Nuova lista
          </div>
        </div>

        {/* Lista hero (note in Caveat) */}
        {restaurants.length > 0 && (
          <div style={{
            background: '#fff', border: '1px solid var(--color-ink-05)', borderRadius: 20,
            padding: '20px 22px', marginBottom: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em' }}>Tutti i salvati</div>
              {isEditingNote ? (
                <textarea
                  ref={noteRef}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  onBlur={handleNoteBlur}
                  onKeyDown={handleNoteKeyDown}
                  autoFocus
                  placeholder="Aggiungi una nota a questa lista…"
                  style={{
                    fontFamily: 'var(--font-editorial, "Caveat", cursive)',
                    fontSize: 20, lineHeight: 1.3, color: 'var(--color-oro-deep, #8E6B3E)',
                    marginTop: 6, maxWidth: 560, width: '100%',
                    background: 'transparent', border: 'none', outline: 'none',
                    resize: 'none', padding: 0, minHeight: 60,
                  }}
                  rows={2}
                />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsEditingNote(true)}
                  onKeyDown={e => e.key === 'Enter' && setIsEditingNote(true)}
                  style={{
                    fontFamily: 'var(--font-editorial, "Caveat", cursive)',
                    fontSize: 20, lineHeight: 1.3,
                    color: note ? 'var(--color-oro-deep, #8E6B3E)' : 'var(--color-ink-40, rgba(34,24,28,.4))',
                    marginTop: 6, maxWidth: 560, cursor: 'text',
                    minHeight: 28,
                  }}
                >
                  {note || 'Aggiungi una nota a questa lista…'}
                </div>
              )}
            </div>
            {/* Avatar */}
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: 'var(--color-corallo)',
              color: '#fff', fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
              display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0,
            }}>{initial}</div>
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
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
            {restaurants.map(r => (
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
