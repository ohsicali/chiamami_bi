// Client-side PDF generation for a saved discount.
// A6 portrait (105×148 mm), un layout pulito con header corallo, foto in
// alto, titolo grande sotto, QR centrato, didascalia "Mostra al ristoratore",
// codice + scadenza, footer.

import QRCode from 'qrcode'

function slugify(name) {
  return (name || 'sconto').toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sconto'
}

// Sostituisce caratteri non rappresentabili dal font helvetica di jsPDF
// (es. minus tipografico U+2212 → hyphen ASCII, ellipsis singolo).
function sanitize(s) {
  if (s == null) return ''
  return String(s)
    .replace(/−/g, '-')
    .replace(/–|—/g, '-')
    .replace(/ /g, ' ')
    .replace(/…/g, '...')
}

async function loadImageDataUrl(url) {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function formatExpiry(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('it-IT', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return ''
  }
}

export async function generateDiscountPdf({
  qrCode,
  qrPayload,
  restaurantName,
  restaurantSubtitle,
  photoUrl,
  discountValue,
  discountTitle,
  expiresAt,
}) {
  const { jsPDF } = await import('jspdf')

  // A6: 105 × 148 mm
  const W = 105
  const H = 148
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'portrait' })

  /* ============= 1) HEADER CORALLO ============= */
  const headerH = 22
  doc.setFillColor(232, 69, 60) // corallo
  doc.rect(0, 0, W, headerH, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text('LA GUIDA DI BI', W / 2, 11, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)
  doc.text('BY CHIAMAMI BI', W / 2, 17, { align: 'center', charSpace: 0.4 })

  /* ============= 2) FOTO LOCALE (full width sotto header) ============= */
  let y = headerH
  const photoH = 32
  const photoData = await loadImageDataUrl(photoUrl)
  if (photoData) {
    try {
      doc.addImage(photoData, 'JPEG', 0, y, W, photoH, undefined, 'FAST')
    } catch {
      doc.setFillColor(241, 236, 227)
      doc.rect(0, y, W, photoH, 'F')
    }
  } else {
    doc.setFillColor(241, 236, 227)
    doc.rect(0, y, W, photoH, 'F')
  }
  y += photoH

  /* ============= 3) NOME LOCALE + TIPO ============= */
  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(34, 24, 28)
  const nameLines = doc.splitTextToSize(sanitize(restaurantName) || 'Ristorante', W - 16)
  // Limita a 2 righe per non rompere il layout.
  const nameRendered = nameLines.slice(0, 2)
  doc.text(nameRendered, W / 2, y, { align: 'center' })
  y += nameRendered.length * 5

  if (restaurantSubtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(120, 110, 116)
    doc.text(sanitize(restaurantSubtitle), W / 2, y + 1, { align: 'center' })
    y += 4
  }

  /* ============= 4) PERCENTUALE — pill corallo grande, centrata ============= */
  y += 4
  if (discountValue) {
    const pctText = sanitize(discountValue)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    const pctTextW = doc.getTextWidth(pctText)
    const padX = 8
    const pillW = pctTextW + padX * 2
    const pillH = 9.5
    const pillX = (W - pillW) / 2
    doc.setFillColor(232, 69, 60)
    doc.roundedRect(pillX, y, pillW, pillH, pillH / 2, pillH / 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(pctText, W / 2, y + 6.4, { align: 'center' })
    y += pillH + 5
  }

  /* ============= 5) QR CODE centrato ============= */
  // Il QR rimane abbastanza grande da essere scansionato senza zoom.
  const qrPng = await QRCode.toDataURL(qrPayload, {
    width: 600,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  })
  const qrSize = 50
  const qrX = (W - qrSize) / 2
  // Cornice nera sottile come nel popup.
  doc.setDrawColor(34, 24, 28)
  doc.setLineWidth(0.5)
  doc.roundedRect(qrX - 1.5, y - 1.5, qrSize + 3, qrSize + 3, 1.5, 1.5, 'S')
  doc.addImage(qrPng, 'PNG', qrX, y, qrSize, qrSize)
  y += qrSize + 5

  /* ============= 6) CAPTION "Mostra al ristoratore" ============= */
  // Helvetica italic come fallback estetico (Caveat non è imbarcato in jsPDF).
  doc.setFont('helvetica', 'bolditalic')
  doc.setFontSize(13)
  doc.setTextColor(232, 69, 60)
  doc.text('Mostra al ristoratore', W / 2, y, { align: 'center' })
  y += 6

  /* ============= 7) CODICE + SCADENZA ============= */
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(60, 50, 54)
  doc.text(`Codice: ${sanitize(qrCode)}`, W / 2, y, { align: 'center' })
  y += 4

  if (expiresAt) {
    doc.setTextColor(120, 110, 116)
    doc.text(`Scade il ${formatExpiry(expiresAt)}`, W / 2, y, { align: 'center' })
    y += 4
  }

  // Titolo dello sconto (se diverso da % e leggibile, sotto la scadenza)
  if (discountTitle && discountTitle !== discountValue) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120, 110, 116)
    const titleLines = doc.splitTextToSize(sanitize(discountTitle), W - 16).slice(0, 1)
    doc.text(titleLines, W / 2, y, { align: 'center' })
    y += 4
  }

  /* ============= 8) FOOTER fisso a fondo pagina ============= */
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(154, 142, 148)
  doc.text('Codice valido una sola volta', W / 2, H - 7, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(232, 69, 60)
  doc.text('chiamamibi.com', W / 2, H - 3.5, { align: 'center' })

  const filename = `sconto-${slugify(restaurantName)}.pdf`
  doc.save(filename)
}
