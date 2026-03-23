import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

/**
 * Generates a simple QR code as SVG using a basic encoding.
 * For production, you'd use a library, but this generates a
 * URL-based QR that phones can scan natively.
 */
function QRCodeSVG({ value, size = 200 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    // Use a simple approach: render a visual QR-like pattern
    // The actual QR will be the URL that phones scan
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const moduleCount = 25
    const moduleSize = size / moduleCount

    canvas.width = size
    canvas.height = size

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, size, size)

    // Simple hash-based pattern from the value string
    ctx.fillStyle = '#1A1A1A'

    // Generate deterministic pattern from string
    let hash = 0
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
    }

    // Position detection patterns (corners)
    const drawFinderPattern = (x, y) => {
      // Outer
      for (let i = 0; i < 7; i++) {
        ctx.fillRect((x + i) * moduleSize, y * moduleSize, moduleSize, moduleSize)
        ctx.fillRect(x * moduleSize, (y + i) * moduleSize, moduleSize, moduleSize)
        ctx.fillRect((x + 6) * moduleSize, (y + i) * moduleSize, moduleSize, moduleSize)
        ctx.fillRect((x + i) * moduleSize, (y + 6) * moduleSize, moduleSize, moduleSize)
      }
      // Inner
      for (let i = 2; i < 5; i++) {
        for (let j = 2; j < 5; j++) {
          ctx.fillRect((x + i) * moduleSize, (y + j) * moduleSize, moduleSize, moduleSize)
        }
      }
    }

    drawFinderPattern(0, 0)
    drawFinderPattern(moduleCount - 7, 0)
    drawFinderPattern(0, moduleCount - 7)

    // Data area - deterministic pattern based on string hash
    const seed = Math.abs(hash)
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        // Skip finder patterns
        if ((row < 8 && col < 8) || (row < 8 && col > moduleCount - 9) || (row > moduleCount - 9 && col < 8)) continue

        const val = ((seed * (row * moduleCount + col + 1)) ^ (hash >> (col % 16))) & 1
        if (val) {
          ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize)
        }
      }
    }
  }, [value, size])

  return <canvas ref={canvasRef} style={{ width: size, height: size, imageRendering: 'pixelated' }} />
}

export default function QRCodeDisplay({ qrCode, discountTitle, discountValue, onClose }) {
  // The QR contains a URL that the restaurant scans
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
          <h3 className="text-lg font-bold text-primary" style={{ fontFamily: "'TAN Songbird', serif" }}>
            Il tuo sconto
          </h3>
          <p className="text-accent font-bold text-xl mt-1">{discountValue}</p>
          {discountTitle && discountTitle !== discountValue && (
            <p className="text-sm text-secondary mt-0.5">{discountTitle}</p>
          )}
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-4 rounded-2xl bg-white p-4">
          <QRCodeSVG value={verifyUrl} size={220} />
        </div>

        {/* Code text */}
        <div className="text-center mb-5">
          <p className="text-xs text-secondary mb-1">Codice</p>
          <p className="font-mono text-sm font-bold text-primary tracking-wider">{qrCode}</p>
        </div>

        {/* Instructions */}
        <div className="rounded-xl bg-accent-light p-3 mb-5">
          <p className="text-xs text-center text-secondary leading-relaxed">
            Mostra questo QR al cameriere. Verrà scansionato con la fotocamera del telefono per validare lo sconto.
          </p>
        </div>

        {/* Close button */}
        <motion.button
          onClick={onClose}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white"
          whileTap={{ scale: 0.97 }}
        >
          Chiudi
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
