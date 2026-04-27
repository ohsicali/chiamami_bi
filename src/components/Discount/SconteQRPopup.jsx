import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { generateDiscountPdf } from '../../lib/discountPdf'

function QRCanvas({ value, size }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !value) return
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#1A1A1A', light: '#FFFFFF' },
    })
  }, [value, size])
  return <canvas ref={ref} />
}

export default function SconteQRPopup({
  qrCode,
  qrPayload,
  restaurantName,
  restaurantSubtitle,
  photoUrl,
  discountValue,
  discountTitle,
  expiresLabel,
  expiresAt,
  onClose,
}) {
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  async function handleDownload() {
    if (pdfBusy) return
    setPdfBusy(true)
    setPdfError(null)
    try {
      await generateDiscountPdf({
        qrCode,
        qrPayload,
        restaurantName,
        restaurantSubtitle,
        photoUrl,
        discountValue,
        discountTitle,
        expiresAt,
      })
    } catch (err) {
      console.error('PDF generation failed:', err)
      setPdfError('Non sono riuscito a generare il PDF, riprova.')
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div
      className="sc-qr-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Codice QR sconto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="sc-qr-sheet">
        <div className="sc-grip" aria-hidden="true" />
        <button type="button" className="sc-close" aria-label="Chiudi" onClick={onClose}>✕</button>

        <div className="sc-place-info">
          {photoUrl && (
            <div className="sc-ph">
              <img src={photoUrl} alt="" loading="lazy" decoding="async" />
            </div>
          )}
          <div className="sc-info-x">
            <h3>{restaurantName}</h3>
            {restaurantSubtitle && <div className="sc-meta">{restaurantSubtitle}</div>}
          </div>
          {discountValue && (
            <span className="sc-badge-pct">{discountValue}</span>
          )}
        </div>

        {discountValue && (
          <div className="sc-pct-big">{discountValue}</div>
        )}

        <div className="sc-qr-block">
          <QRCanvas value={qrPayload} size={200} />
        </div>

        <div className="sc-qr-hint">Mostra al ristoratore</div>
        <div className="sc-small-info">
          Lui scansiona il codice e <strong>attiva lo sconto</strong>.<br />
          Codice valido una sola volta.
        </div>

        {expiresLabel && (
          <div className="sc-scad-line">{expiresLabel}</div>
        )}

        <div className="sc-qr-actions">
          <button
            type="button"
            className="sc-action-btn"
            onClick={handleDownload}
            disabled={pdfBusy}
          >
            <span className="sc-ic" aria-hidden="true">⬇</span>
            {pdfBusy ? 'Genero il PDF…' : 'Scarica PDF'}
            {!pdfBusy && <small>stampa o salva sul telefono</small>}
          </button>
          {pdfError && (
            <div role="status" style={{
              marginTop: 8, fontSize: 12, color: 'var(--sc-corallo-ink, #C53A33)', textAlign: 'center',
            }}>{pdfError}</div>
          )}
        </div>
      </div>
    </div>
  )
}
