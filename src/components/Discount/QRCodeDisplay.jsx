import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'

function QRCanvas({ value, size = 220 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#1A1A1A', light: '#FFFFFF' },
    })
  }, [value, size])

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />
}

export default function QRCodeDisplay({ qrCode, discountTitle, discountValue, onClose }) {
  const { t } = useTranslation()
  const verifyUrl = `${window.location.origin}/verify?code=${qrCode}`

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="mx-4 w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-5">
          <h3 className="text-lg font-bold text-primary" style={{ fontFamily: "var(--font-sans)", fontWeight: 800 }}>
            {t('discount.yourDiscount')}
          </h3>
          <p className="text-accent font-bold text-xl mt-1">{discountValue}</p>
          {discountTitle && discountTitle !== discountValue && (
            <p className="text-sm text-secondary mt-0.5">{discountTitle}</p>
          )}
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-4 rounded-2xl bg-white p-4">
          <QRCanvas value={verifyUrl} size={220} />
        </div>

        {/* Code text */}
        <div className="text-center mb-5">
          <p className="text-xs text-secondary mb-1">{t('discount.code')}</p>
          <p className="font-mono text-sm font-bold text-primary tracking-wider">{qrCode}</p>
        </div>

        {/* Instructions */}
        <div className="rounded-xl bg-accent-light p-3 mb-5">
          <p className="text-xs text-center text-secondary leading-relaxed">
            {t('discount.showToWaiter')}
          </p>
        </div>

        {/* Close button */}
        <motion.button
          onClick={onClose}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white"
          whileTap={{ scale: 0.97 }}
        >
          {t('discount.close')}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
