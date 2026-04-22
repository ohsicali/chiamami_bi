import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { getCategoryInfo, PRICE_LABELS } from '../../lib/hooks/useRestaurants'
import { useActiveDiscounts, useUserRedemption } from '../../lib/hooks/useDiscounts'
import { useOrariStatus } from '../../lib/hooks/useOrariStatus'
import { useAuth } from '../../lib/hooks/useAuth'
import { proxyImg } from '../../lib/supabase'
import QRCodeDisplay from '../Discount/QRCodeDisplay'

/* ── design tokens ── */
const INK = '#22181C'
const INK70 = 'rgba(34,24,28,.7)'
const INK40 = 'rgba(34,24,28,.4)'
const INK15 = 'rgba(34,24,28,.12)'
const INK05 = 'rgba(34,24,28,.05)'
const CORALLO = '#E8453C'
const CORALLO_INK = '#C6372F'
const BEIGE_CTA = '#F2EDE1'
const ORO = '#B08954'
const ORO_DEEP = '#8E6B3E'
const ORO_SOFT = '#F4E7CC'
const GREEN = '#2E7D5B'
const GREEN_SOFT = '#E5F3EA'
const GREEN_GRAD = 'linear-gradient(135deg,#A3E635,#4ADE80)'

const GLASS_BTN = {
  width: 44, height: 44, borderRadius: '50%',
  background: 'rgba(255,255,255,.92)',
  backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
  border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer',
}

/* ── share helper ── */
function useShare(restaurant) {
  const shareUrl = `${window.location.origin}/restaurant/${restaurant.slug || restaurant.id}`
  const handleShare = useCallback(async () => {
    const data = { title: restaurant.name, text: `Scopri ${restaurant.name} su ChiamamiBi`, url: shareUrl }
    if (navigator.share) {
      try { await navigator.share(data) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl)
    }
  }, [restaurant, shareUrl])
  return { handleShare }
}

/* ── photo URL normalizer ── */
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
  const navigate = useNavigate()
  const { user } = useAuth()
  const [photoIndex, setPhotoIndex] = useState(0)
  const [inlineGenerating, setInlineGenerating] = useState(false)
  const [inlineShowQR, setInlineShowQR] = useState(false)
  const { handleShare } = useShare(restaurant)
  const { discounts: activeDiscounts } = useActiveDiscounts()
  const { status: orariStatus } = useOrariStatus(restaurant)

  const discount = activeDiscounts.find(d => d.restaurant_id === restaurant?.id)
  const { redemption, loading: redemptionLoading, generateRedemption } = useUserRedemption(discount?.id, user?.id)

  if (!restaurant) return null

  /* ── derived data ── */
  const photos = restaurant.photos || []
  const photoCount = photos.length
  const heroUrl = photoCount > 0
    ? getPhotoUrl(photos[photoIndex])
    : proxyImg(restaurant.image) || null

  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(n => getCategoryInfo(n)).filter(Boolean)
  const firstCat = categories[0]
  const categoryChip = firstCat ? `${firstCat.emoji} ${firstCat.name}` : '🍽️ Ristorante'

  const priceLabel = PRICE_LABELS[restaurant.price_range] || ''
  const mapsUrl = restaurant.google_maps_url ||
    (restaurant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}` : null)
  const phoneUrl = restaurant.phone ? `tel:${restaurant.phone.replace(/\s/g, '')}` : null
  const reviewText = restaurant.our_review || ''
  const tipText = restaurant.our_tip || null

  /* address + zone */
  const addrLine = [restaurant.address, restaurant.zone].filter(Boolean).join(' · ')

  /* discount text */
  const discountMainText = discount
    ? `${discount.title || discount.discount_value}${discount.description ? ' · ' + discount.description : ''}`
    : null

  /* open/close status */
  const openChipText = orariStatus
    ? (orariStatus.openNow
      ? (orariStatus.closesAt ? `Aperto ora · chiude alle ${orariStatus.closesAt}` : 'Aperto ora')
      : 'Chiuso ora')
    : null

  /* photo nav */
  const prev = () => setPhotoIndex(i => (i - 1 + photoCount) % photoCount)
  const next = () => setPhotoIndex(i => (i + 1) % photoCount)

  /* discount unlock */
  const handleDiscountClick = async () => {
    if (!user) {
      navigate('/login', { state: { from: window.location.pathname, discount: true } })
      return
    }
    if (redemption?.status === 'redeemed') return
    if (redemption?.status === 'generated') { setInlineShowQR(true); return }
    setInlineGenerating(true)
    try {
      const result = await generateRedemption()
      if (result) setInlineShowQR(true)
    } finally {
      setInlineGenerating(false)
    }
  }

  /* ══════ RENDER ══════ */
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
          position: 'relative', boxShadow: '0 8px 24px rgba(34,24,28,.08)',
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
            <button onClick={onClose} style={GLASS_BTN} aria-label="Indietro">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0zM15 9l-3 3 3 3M9 12h6" />
              </svg>
            </button>
            <button onClick={handleShare} style={GLASS_BTN} aria-label="Condividi">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="m8.6 13.5 6.8 3.9M15.4 6.6 8.6 10.5" />
              </svg>
            </button>
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
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)', marginBottom: 10 }}>
              {categoryChip}
            </div>
            {photoCount > 1 && (
              <span style={{ background: 'rgba(0,0,0,.5)', padding: '5px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                📷 {photoIndex + 1} / {photoCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── BODY 2-COL ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px 80px', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 40 }}>

          {/* ══ LEFT COLUMN ══ */}
          <div>
            {/* H1 name */}
            <h1 style={{
              fontFamily: 'var(--font-sans, "Poppins", sans-serif)',
              fontWeight: 900, fontSize: 52, lineHeight: 1,
              letterSpacing: '-.035em', color: INK,
              marginBottom: 10, marginTop: 0,
            }}>
              {restaurant.name}
            </h1>

            {/* Address */}
            {addrLine && (
              <div style={{ fontSize: 14, color: INK70, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
                📍 {addrLine}
              </div>
            )}

            {/* Chip row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
              {/* category chips */}
              {categories.map(cat => (
                <span key={cat.name} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                  border: `1.5px solid ${CORALLO}`, color: CORALLO_INK, background: '#fff',
                }}>
                  {cat.emoji} {cat.name}
                </span>
              ))}
              {/* price */}
              {priceLabel && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: INK05, color: INK }}>
                  {priceLabel}
                </span>
              )}
              {/* recommended_for (momento) */}
              {(restaurant.recommended_for || []).map(tag => (
                <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: ORO_SOFT, color: ORO_DEEP }}>
                  {tag}
                </span>
              ))}
              {/* open status */}
              {openChipText && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
                  background: orariStatus?.openNow ? GREEN_SOFT : INK05,
                  color: orariStatus?.openNow ? GREEN : INK70,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: orariStatus?.openNow ? GREEN : '#9a8e84', flexShrink: 0 }} />
                  {openChipText}
                </span>
              )}
            </div>

            {/* CTA row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
                  flex: 1, padding: '16px 22px', background: BEIGE_CTA, border: 0, borderRadius: 16,
                  fontFamily: 'var(--font-sans, "Poppins", sans-serif)', fontWeight: 800, fontSize: 14.5, color: INK,
                  textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer',
                }}>
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 11l18-8-8 18-2-8-8-2z" />
                  </svg>
                  Indicazioni
                </a>
              )}
              {phoneUrl && (
                <a href={phoneUrl} style={{
                  width: 54, height: 54, borderRadius: 16, background: '#fff', border: `1px solid ${INK15}`,
                  display: 'grid', placeItems: 'center', textDecoration: 'none', color: INK, flexShrink: 0,
                }} aria-label="Chiama">
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </a>
              )}
              {restaurant.website && (
                <a href={restaurant.website} target="_blank" rel="noopener noreferrer" style={{
                  width: 54, height: 54, borderRadius: 16, background: '#fff', border: `1px solid ${INK15}`,
                  display: 'grid', placeItems: 'center', textDecoration: 'none', color: INK, flexShrink: 0,
                }} aria-label="Sito web">
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                  </svg>
                </a>
              )}
            </div>

            {/* Sconto banner */}
            {discount && discountMainText && (
              <div style={{
                margin: '0 0 28px', background: GREEN_GRAD,
                borderRadius: 18, padding: '16px 22px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                color: INK,
              }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(34,24,28,.7)', marginBottom: 4 }}>
                    Sconto attivo per te
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: '-.01em' }}>
                    {discountMainText}
                  </div>
                </div>
                <button
                  onClick={handleDiscountClick}
                  disabled={inlineGenerating || redemptionLoading}
                  style={{
                    background: INK, color: '#fff', border: 0,
                    padding: '8px 16px', borderRadius: 999,
                    fontFamily: 'var(--font-sans, "Poppins", sans-serif)',
                    fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
                    whiteSpace: 'nowrap', opacity: inlineGenerating ? 0.6 : 1,
                  }}
                >
                  {redemption?.status === 'redeemed' ? '✓ Usato' : redemption?.status === 'generated' ? 'Mostra QR' : 'Usa sconto →'}
                </button>
              </div>
            )}

            {/* Secondo Bi */}
            {reviewText && (
              <div style={{ borderTop: 0, paddingTop: 0, marginBottom: 24 }}>
                <h3 style={{ fontFamily: 'var(--font-sans, "Poppins", sans-serif)', fontWeight: 900, fontSize: 18, letterSpacing: '-.02em', marginBottom: 10, marginTop: 0, color: INK }}>
                  Secondo Bi
                </h3>
                {reviewText.split('\n').filter(Boolean).map((para, i) => (
                  <p key={i} style={{ fontSize: 14, lineHeight: 1.65, color: INK, fontWeight: 500, marginTop: i > 0 ? 14 : 0 }}>
                    {para}
                  </p>
                ))}
                <div style={{ marginTop: 12, fontFamily: 'var(--font-hand, "Caveat", cursive)', fontSize: 22, color: CORALLO_INK, lineHeight: 1 }}>
                  — Bi
                </div>
              </div>
            )}

            {/* Cosa prendere — oro */}
            {tipText && (
              <div style={{
                background: `linear-gradient(135deg, ${ORO} 0%, ${ORO_DEEP} 100%)`,
                color: '#fff', borderRadius: 20, padding: '24px 26px', marginTop: 20,
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.82)', display: 'inline-flex', gap: 8, alignItems: 'center', marginBottom: 0 }}>
                  🍴 Cosa ti consiglio di prendere
                </span>
                <p style={{ fontFamily: 'var(--font-hand, "Caveat", cursive)', fontSize: 22, lineHeight: 1.35, color: '#fff', marginTop: 10 }}>
                  {tipText}
                </p>
              </div>
            )}
          </div>

          {/* ══ RIGHT COLUMN (checkpoint 3) ══ */}
          <div />

        </div>
      </div>

      {/* QR overlay */}
      <AnimatePresence>
        {inlineShowQR && redemption && (
          <QRCodeDisplay
            qrCode={redemption.qr_code}
            discountTitle={discount?.title}
            discountValue={discount?.discount_value}
            onClose={() => setInlineShowQR(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
