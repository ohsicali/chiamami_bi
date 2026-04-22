import { useState, useCallback } from 'react'
import { getCategoryInfo, PRICE_LABELS } from '../../lib/hooks/useRestaurants'
import { proxyImg } from '../../lib/supabase'

/* ── constants ── */
const INK = '#22181C'
const CORALLO = '#E8453C'

const GLASS_BTN = {
  width: 44, height: 44, borderRadius: '50%',
  background: 'rgba(255,255,255,.92)',
  backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
  border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer',
}

/* ── share helper ── */
function useShare(restaurant) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}/restaurant/${restaurant.slug || restaurant.id}`
  const handleShare = useCallback(async () => {
    const data = { title: restaurant.name, text: `Scopri ${restaurant.name} su ChiamamiBi`, url: shareUrl }
    if (navigator.share) {
      try { await navigator.share(data) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [restaurant, shareUrl])
  return { handleShare, copied }
}

/* ── photo normalizer ── */
function getPhotoUrl(p) {
  if (!p) return null
  const raw = typeof p === 'string' ? p : (p.photo_url || p.url || null)
  return proxyImg(raw)
}

/* ══════════════════════════════════════════ */
export default function DesktopRestaurantSheet({
  restaurant,
  onClose,
  allRestaurants = [],
  onSelectNearby,
  saved,
  onSaveToggle,
}) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const { handleShare } = useShare(restaurant)

  if (!restaurant) return null

  const photos = restaurant.photos || []
  const photoCount = photos.length
  const heroUrl = photoCount > 0
    ? getPhotoUrl(photos[photoIndex])
    : proxyImg(restaurant.image) || null

  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(n => getCategoryInfo(n)).filter(Boolean)
  const firstCat = categories[0]
  const categoryChip = firstCat ? `${firstCat.emoji} ${firstCat.name}` : '🍽️ Ristorante'

  const prev = () => setPhotoIndex(i => (i - 1 + photoCount) % photoCount)
  const next = () => setPhotoIndex(i => (i + 1) % photoCount)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'var(--color-page, #FAF7F2)',
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* ── HERO ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 40px 28px', width: '100%' }}>
        <div style={{
          height: 520, borderRadius: 28, overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 8px 24px rgba(34,24,28,.08)',
          background: '#e0d8cc',
        }}>
          {heroUrl && (
            <img
              src={heroUrl}
              alt={restaurant.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}

          {/* prev / next click zones */}
          {photoCount > 1 && (
            <>
              <button onClick={prev} aria-label="Foto precedente" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%', background: 'transparent', border: 0, cursor: 'pointer', zIndex: 3 }} />
              <button onClick={next} aria-label="Foto successiva" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%', background: 'transparent', border: 0, cursor: 'pointer', zIndex: 3 }} />
            </>
          )}

          {/* gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
            background: 'linear-gradient(180deg,rgba(0,0,0,.25) 0%,transparent 30%,transparent 70%,rgba(0,0,0,.6) 100%)',
          }} />

          {/* action buttons — top right */}
          <div style={{ position: 'absolute', top: 20, right: 24, display: 'flex', gap: 10, zIndex: 4 }}>
            {/* back */}
            <button onClick={onClose} style={GLASS_BTN} aria-label="Indietro">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0zM15 9l-3 3 3 3M9 12h6" />
              </svg>
            </button>
            {/* share */}
            <button onClick={handleShare} style={GLASS_BTN} aria-label="Condividi">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="m8.6 13.5 6.8 3.9M15.4 6.6 8.6 10.5" />
              </svg>
            </button>
            {/* save */}
            <button
              onClick={onSaveToggle}
              style={{ ...GLASS_BTN, background: saved ? CORALLO : 'rgba(255,255,255,.92)' }}
              aria-label={saved ? 'Rimuovi dai salvati' : 'Salva'}
            >
              <svg viewBox="0 0 24 24" width={18} height={18} fill={saved ? '#fff' : 'none'} stroke={saved ? '#fff' : INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>

          {/* bottom meta */}
          <div style={{
            position: 'absolute', left: 32, bottom: 24, right: 32, zIndex: 3,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20,
          }}>
            {/* category chip */}
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '.14em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,.85)',
              marginBottom: 10,
            }}>
              {categoryChip}
            </div>
            {/* photo counter */}
            {photoCount > 1 && (
              <span style={{
                background: 'rgba(0,0,0,.5)', padding: '5px 12px', borderRadius: 999,
                fontSize: 11.5, fontWeight: 700, color: '#fff',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                📷 {photoIndex + 1} / {photoCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── BODY (checkpoints 2-4) ── */}
    </div>
  )
}
