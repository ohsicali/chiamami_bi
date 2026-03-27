import { motion, useAnimate } from 'framer-motion'
import { useRef, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PhotoCarousel from './PhotoCarousel'
import NearbySection from './NearbySection'
import SaveButton from './SaveButton'
import DiscountBanner from '../Discount/DiscountBanner'
import ReviewSection from '../Review/ReviewSection'
import { PRICE_LABELS, getCategoryInfo } from '../../lib/hooks/useRestaurants'

/* ── animation variants ── */
const contentVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
}

/* ── Quick Action Button ── */
function QuickAction({ icon, label, href, onClick }) {
  const Tag = href ? 'a' : 'button'
  const props = href ? { href, target: '_blank', rel: 'noopener noreferrer' } : { onClick }
  return (
    <Tag
      {...props}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        flex: 1, padding: '14px 8px', borderRadius: 16,
        background: '#fff', border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        cursor: 'pointer', textDecoration: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'rgba(232,69,60,0.08)', color: '#E8453C',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#555', textAlign: 'center' }}>{label}</span>
    </Tag>
  )
}

/* ── Share logic ── */
function useShare(restaurant, t) {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}/restaurant/${restaurant.slug || restaurant.id}`
  const handleShare = async () => {
    const shareData = { title: restaurant.name, text: t('share.shareText', { name: restaurant.name }), url: shareUrl }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  return { handleShare, copied }
}

/* ── Info Row ── */
function InfoRow({ icon, children, href }) {
  const Tag = href ? 'a' : 'div'
  const linkProps = href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {}
  return (
    <Tag {...linkProps} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', textDecoration: 'none' }}>
      <span style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(232,69,60,0.08)', color: '#E8453C',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </span>
      <span style={{ fontSize: 14, color: '#333', flex: 1, minWidth: 0 }}>{children}</span>
    </Tag>
  )
}

/* ── Section Title ── */
function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontSize: 11, fontWeight: 700, letterSpacing: 2,
      textTransform: 'uppercase', color: '#8A8680',
    }}>
      {children}
    </h2>
  )
}

/* ══════════════════════════════════════════ */
export default function RestaurantSheet({
  restaurant,
  onClose,
  allRestaurants = [],
  onSelectNearby,
  saved,
  onSaveToggle,
}) {
  const { t, i18n } = useTranslation()
  const isItalian = i18n.language === 'it' || i18n.language?.startsWith('it-')
  const scrollRef = useRef(null)
  const [backdropScope, animateBackdrop] = useAnimate()
  const [sheetScope, animateSheet] = useAnimate()
  const { handleShare, copied } = useShare(restaurant, t)

  const handleClose = useCallback(async () => {
    await Promise.all([
      animateBackdrop(backdropScope.current, { opacity: 0 }, { duration: 0.25, ease: 'easeOut' }),
      animateSheet(sheetScope.current, { y: '100%', opacity: 0 }, { duration: 0.32, ease: [0.4, 0, 0.7, 0.2] }),
    ])
    onClose()
  }, [onClose, animateBackdrop, animateSheet, backdropScope, sheetScope])

  if (!restaurant) return null

  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(name => getCategoryInfo(name))
    .filter(Boolean)
  const priceLabel = PRICE_LABELS[restaurant.price_range] || ''
  const mapsUrl = restaurant.google_maps_url || (restaurant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}` : null)
  const phoneUrl = restaurant.phone ? `tel:${restaurant.phone.replace(/\s/g, '')}` : null
  const reviewText = restaurant.our_review || ''
  const tipText = restaurant.our_tip || null

  /* SVG icons (inline, small) */
  const iconMap = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
  const iconPhone = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
  const iconGlobe = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
  const iconShare = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
  const iconPlay = <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <motion.div
        ref={backdropScope}
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <motion.div
        ref={sheetScope}
        className="relative mt-12 flex flex-1 flex-col overflow-hidden rounded-t-3xl bg-bg"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 30, stiffness: 350, mass: 0.7 }}
      >
        {/* Back button */}
        <motion.button
          className="glass absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-md"
          onClick={handleClose}
          whileTap={{ scale: 0.92 }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 400, damping: 20 }}
          aria-label="Chiudi"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
        </motion.button>

        {/* Save button */}
        {onSaveToggle && (
          <motion.div
            className="absolute top-4 right-4 z-10"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 400, damping: 20 }}
          >
            <SaveButton saved={saved} onClick={onSaveToggle} size="md" />
          </motion.div>
        )}

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none">
          {/* Photo carousel */}
          <PhotoCarousel photos={restaurant.photos || []} height="300px" restaurantName={restaurant.name} city={restaurant.city} />

          {/* Content */}
          <motion.div
            className="flex flex-col gap-6 px-5 pb-10"
            style={{ marginTop: -24, position: 'relative', zIndex: 5 }}
            variants={contentVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Header card — overlaps photo */}
            <motion.div
              variants={itemVariants}
              style={{
                background: '#fff', borderRadius: 20, padding: '20px 20px 16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            >
              {/* Name */}
              <h1 style={{
                fontFamily: "'TAN Songbird', serif",
                fontSize: 22, fontWeight: 700, color: '#111',
                lineHeight: 1.3, marginBottom: 4,
              }}>
                {restaurant.name}
              </h1>

              {/* Tagline */}
              {restaurant.tagline && (
                <p style={{ fontSize: 13, color: '#8A8680', fontWeight: 500, marginBottom: 10 }}>
                  {restaurant.tagline}
                </p>
              )}

              {/* Categories + Price */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                {categories.map(cat => (
                  <span
                    key={cat.name}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      backgroundColor: `${cat.color}15`, color: cat.color,
                      fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                    }}
                  >
                    {cat.emoji} {cat.name}
                  </span>
                ))}
                {priceLabel && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#8A8680' }}>{priceLabel}</span>
                )}
              </div>

              {/* Recommended for */}
              {restaurant.recommended_for?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {restaurant.recommended_for.map(tag => (
                    <span key={tag} style={{
                      fontSize: 11, fontWeight: 600, color: '#92700C',
                      background: '#FEF3C7', padding: '4px 10px', borderRadius: 20,
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={itemVariants} style={{ display: 'flex', gap: 10 }}>
              {phoneUrl && (
                <QuickAction
                  href={phoneUrl}
                  icon={iconPhone}
                  label="Chiama"
                />
              )}
              {mapsUrl && (
                <QuickAction
                  href={mapsUrl}
                  icon={iconMap}
                  label="Indicazioni"
                />
              )}
              <QuickAction
                onClick={handleShare}
                icon={iconShare}
                label={copied ? 'Copiato!' : 'Condividi'}
              />
            </motion.div>

            {/* Discount banner */}
            <motion.div variants={itemVariants}>
              <DiscountBanner restaurantId={restaurant.id} />
            </motion.div>

            {/* La recensione di Bi */}
            {reviewText && (
              <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SectionTitle>{t('restaurant.reviewByBi')}</SectionTitle>
                <div style={{
                  background: '#fff', borderRadius: 16, padding: 16,
                  border: '1px solid rgba(0,0,0,0.04)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                }}>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: '#444' }}>{reviewText}</p>
                  {!isItalian && (
                    <p style={{ fontSize: 11, color: '#aaa', marginTop: 8, fontStyle: 'italic' }}>
                      {t('restaurant.originalItalian')}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* I suggerimenti di Bi */}
            {tipText && (
              <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SectionTitle>{t('restaurant.tipsByBi')}</SectionTitle>
                <div style={{
                  background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                  borderRadius: 16, padding: 16,
                }}>
                  <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.7, color: '#78350F' }}>{tipText}</p>
                  {!isItalian && (
                    <p style={{ fontSize: 11, color: 'rgba(120,53,15,0.5)', marginTop: 8, fontStyle: 'italic' }}>
                      {t('restaurant.originalItalian')}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* TikTok / Instagram video */}
            {(restaurant.instagram_reel || restaurant.tiktok_url) && (
              <motion.div variants={itemVariants}>
                <a
                  href={restaurant.tiktok_url || restaurant.instagram_reel}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: '#111', borderRadius: 16, padding: 16,
                    textDecoration: 'none', color: '#fff',
                  }}
                >
                  <span style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {restaurant.tiktok_url ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48V13a8.28 8.28 0 005.58 2.17v-3.44a4.85 4.85 0 01-3.77-1.64V6.69h3.77z"/>
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                      </svg>
                    )}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>
                      {restaurant.tiktok_url ? 'Guarda su TikTok' : 'Guarda su Instagram'}
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                      Il video di Bi su {restaurant.name}
                    </p>
                  </div>
                  <span style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {iconPlay}
                  </span>
                </a>
              </motion.div>
            )}

            {/* Info */}
            <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SectionTitle>Info</SectionTitle>
              <div style={{
                background: '#fff', borderRadius: 16, padding: '4px 16px',
                border: '1px solid rgba(0,0,0,0.04)',
              }}>
                {restaurant.address && (
                  <InfoRow icon={iconMap} href={mapsUrl}>
                    {restaurant.address}
                  </InfoRow>
                )}
                {restaurant.phone && (
                  <InfoRow icon={iconPhone} href={phoneUrl}>
                    {restaurant.phone}
                  </InfoRow>
                )}
                {restaurant.website && (
                  <InfoRow icon={iconGlobe} href={restaurant.website}>
                    <span style={{ color: '#E8453C', textDecoration: 'underline' }}>{restaurant.website}</span>
                  </InfoRow>
                )}
              </div>
            </motion.div>

            {/* Community reviews */}
            <motion.div variants={itemVariants}>
              <ReviewSection restaurantId={restaurant.id} />
            </motion.div>

            {/* Nearby restaurants */}
            <motion.div variants={itemVariants}>
              <NearbySection
                currentRestaurant={restaurant}
                allRestaurants={allRestaurants}
                onSelect={onSelectNearby}
              />
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
