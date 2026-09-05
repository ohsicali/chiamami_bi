import { useState, useEffect } from 'react'
import { TR_REVEAL } from '../../lib/motion'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurantDiscount, useUserRedemption } from '../../lib/hooks/useDiscounts'
import QRCodeDisplay from './QRCodeDisplay'

export default function DiscountBanner({ restaurantId }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discount, loading: discountLoading } = useRestaurantDiscount(restaurantId)
  const { redemption, loading: redemptionLoading, generateRedemption } = useUserRedemption(
    discount?.id,
    user?.id
  )
  const [generating, setGenerating] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [error, setError] = useState(null)
  const [justRedeemed, setJustRedeemed] = useState(false)

  const isRedeemed = redemption?.status === 'redeemed'
  const isGenerated = redemption?.status === 'generated'

  // When the restaurant scans the QR, the redemption flips from
  // 'generated' to 'redeemed' via realtime. Auto-close the QR modal,
  // vibrate briefly, and flash a confirmation animation on the banner
  // so the user immediately sees that the validation happened.
  // IMPORTANT: this effect must be declared BEFORE any conditional
  // early-return to satisfy React's Rules of Hooks — otherwise the
  // effect is skipped on the first render (when discount is still
  // loading), and on subsequent renders the hook order changes and
  // the realtime flip never triggers the UI update.
  useEffect(() => {
    if (!isRedeemed) return
    if (showQR) setShowQR(false)
    // Only flash on the transition, not on initial mount of an already-used
    // discount. We detect this by checking if the redeemed_at timestamp is
    // very recent (last 5s).
    const redeemedAt = redemption?.redeemed_at ? new Date(redemption.redeemed_at).getTime() : 0
    if (redeemedAt && Date.now() - redeemedAt < 5000) {
      setJustRedeemed(true)
      try { navigator.vibrate?.([30, 40, 30]) } catch {}
      const timer = setTimeout(() => setJustRedeemed(false), 1800)
      return () => clearTimeout(timer)
    }
  }, [isRedeemed, redemption?.redeemed_at, showQR])

  if (discountLoading || !discount) return null

  const isExpired = new Date(discount.valid_until) < new Date()
  const isMaxed = discount.max_redemptions && discount.total_redeemed >= discount.max_redemptions

  if (isExpired || isMaxed) return null

  const loading = redemptionLoading

  const handleUnlock = async () => {
    if (!user) {
      navigate('/login', { state: { from: window.location.pathname, discount: true } })
      return
    }

    setGenerating(true)
    setError(null)
    try {
      const result = await generateRedemption()
      if (result) {
        setShowQR(true)
      } else {
        setError(t('discount.unlockError'))
      }
    } catch (err) {
      console.error('Discount unlock error:', err)
      setError(err?.message || t('discount.unlockError'))
    } finally {
      setGenerating(false)
    }
  }

  const validUntil = new Date(discount.valid_until).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      <motion.div
        className="relative overflow-hidden rounded-2xl"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={TR_REVEAL}
        style={{
          animation: justRedeemed ? 'usedFlash 1.2s ease-out' : 'none',
        }}
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: isRedeemed
              ? 'linear-gradient(135deg, #f3f4f6, #e5e7eb)'
              : 'linear-gradient(135deg, #FFF0F0, #FFE0E0, #FFF5F0)',
            transition: 'background 0.6s ease',
          }}
        />

        {/* Green success flash overlay shown for ~1.2s when realtime flips
            status to redeemed — gives immediate visual feedback. */}
        {justRedeemed && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(74,222,128,0.55), rgba(74,222,128,0) 70%)',
              animation: 'usedFlashOverlay 1.4s ease-out forwards',
              zIndex: 2,
            }}
          />
        )}

        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">{isRedeemed ? '✅' : '🎁'}</span>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-primary">
                {isRedeemed ? t('discount.used') : t('discount.exclusive')}
              </h3>
              <p
                className={`text-lg font-bold mt-0.5 ${
                  isRedeemed ? 'text-secondary line-through' : 'text-accent'
                }`}
              >
                {discount.discount_value}
              </p>
              {discount.title && discount.title !== discount.discount_value && (
                <p className="text-sm text-secondary mt-0.5">{discount.title}</p>
              )}
            </div>
          </div>

          {/* Conditions */}
          {discount.conditions && (
            <p className="text-xs text-secondary mb-3 pl-9">
              {discount.conditions}
            </p>
          )}

          {/* Valid until */}
          <p className="text-xs text-secondary mb-4 pl-9">
            {t('discount.validUntil')} {validUntil}
          </p>

          {/* State: Not logged in - blurred teaser */}
          {!user && !loading && (
            <div className="relative">
              {/* Blur overlay */}
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/60 backdrop-blur-sm">
                <p className="text-sm font-semibold text-primary mb-2">
                  {t('discount.registerToUnlock')}
                </p>
                <motion.button
                  onClick={() =>
                    navigate('/login', {
                      state: { from: window.location.pathname, discount: true },
                    })
                  }
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
                  whileTap={{ scale: 0.95 }}
                >
                  {t('discount.registerFree')}
                </motion.button>
              </div>
              {/* Blurred content behind */}
              <div className="rounded-xl bg-white/40 p-4 blur-sm select-none pointer-events-none">
                <div className="h-32 flex items-center justify-center text-6xl opacity-30">
                  🎟️
                </div>
              </div>
            </div>
          )}

          {/* State: Logged in, no redemption yet */}
          {user && !redemption && !loading && (
            <motion.button
              onClick={handleUnlock}
              disabled={generating}
              className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 hover-lift-sm"
              whileTap={{ transform: 'scale(0.97)' }}
            >
              {generating ? t('discount.generating') : `🔓 ${t('discount.unlock')}`}
            </motion.button>
          )}

          {/* State: QR generated, not yet used */}
          {user && isGenerated && !loading && (
            <div className="flex flex-col gap-2">
              <motion.button
                onClick={() => setShowQR(true)}
                className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm"
                whileTap={{ scale: 0.97 }}
              >
                📱 {t('discount.showQR')}
              </motion.button>
              <p className="text-xs text-center text-secondary">
                {t('discount.goToProfile')}
              </p>
            </div>
          )}

          {/* State: Already redeemed */}
          {user && isRedeemed && !loading && (
            <div className="rounded-xl bg-gray-100 px-4 py-3 text-center">
              <p className="text-sm text-secondary">
                {t('discount.alreadyUsed')}{' '}
                {new Date(redemption.redeemed_at).toLocaleDateString()}
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 text-center mt-2">{error}</p>
          )}
        </div>
      </motion.div>

      {/* QR Code Fullscreen Modal */}
      <AnimatePresence>
        {showQR && redemption && (
          <QRCodeDisplay
            qrCode={redemption.qr_code}
            discountTitle={discount.title}
            discountValue={discount.discount_value}
            onClose={() => setShowQR(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
