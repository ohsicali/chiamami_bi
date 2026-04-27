// Client-side PDF generation for a saved discount.
// Layout follows docs/HANDOFF-PR21-SCONTI.md §5.3 (A6 vertical).
// We generate everything in the browser to keep Vercel function count == 12.

import QRCode from 'qrcode'

function slugify(name) {
  return (name || 'sconto').toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sconto'
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

function safeText(s, fallback = '') {
  if (!s) return fallback
  return String(s).normalize('NFC')
}

function formatExpiry(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
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

  // A6 portrait: 105 × 148 mm
  const doc = new jsPDF({ unit: 'mm', format: 'a6', orientation: 'portrait' })
  const W = 105
  const margin = 8

  // Brand top
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(232, 69, 60)
  doc.text('LA GUIDA DI BI', margin, margin + 4)
  doc.setFontSize(7)
  doc.setTextColor(154, 142, 148)
  doc.text('BY CHIAMAMI BI', margin, margin + 8)

  // Photo + nome locale row
  let cursorY = margin + 14
  const photoData = await loadImageDataUrl(photoUrl)
  if (photoData) {
    try {
      doc.addImage(photoData, 'JPEG', margin, cursorY, 22, 22, undefined, 'FAST')
    } catch { /* skip image on error */ }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(34, 24, 28)
  const nameX = photoData ? margin + 26 : margin
  const nameMaxW = W - margin - nameX
  const nameLines = doc.splitTextToSize(safeText(restaurantName, 'Ristorante'), nameMaxW)
  doc.text(nameLines, nameX, cursorY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(92, 79, 84)
  const subLines = doc.splitTextToSize(safeText(restaurantSubtitle), nameMaxW)
  doc.text(subLines, nameX, cursorY + 12)

  cursorY += 26

  // Percentuale corallo box
  if (discountValue) {
    const pctText = String(discountValue)
    doc.setFillColor(232, 69, 60)
    doc.roundedRect(margin, cursorY, 30, 11, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(255, 255, 255)
    doc.text(pctText, margin + 15, cursorY + 7.5, { align: 'center' })
    if (discountTitle && discountTitle !== discountValue) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(92, 79, 84)
      const titleLines = doc.splitTextToSize(safeText(discountTitle), W - margin - (margin + 34))
      doc.text(titleLines, margin + 34, cursorY + 7)
    }
    cursorY += 16
  }

  // QR
  const qrPng = await QRCode.toDataURL(qrPayload, {
    width: 600,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  })
  const qrSize = 60
  const qrX = (W - qrSize) / 2
  doc.setDrawColor(34, 24, 28)
  doc.setLineWidth(0.6)
  doc.roundedRect(qrX - 2, cursorY - 2, qrSize + 4, qrSize + 4, 2, 2, 'S')
  doc.addImage(qrPng, 'PNG', qrX, cursorY, qrSize, qrSize)
  cursorY += qrSize + 6

  // Caption Caveat (jsPDF doesn't ship Caveat — use italic helvetica with corallo color as visual fallback)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(13)
  doc.setTextColor(232, 69, 60)
  doc.text('Mostra al ristoratore', W / 2, cursorY + 2, { align: 'center' })
  cursorY += 6

  // Codice testuale fallback
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(154, 142, 148)
  doc.text(`Codice: ${qrCode}`, W / 2, cursorY + 4, { align: 'center' })
  cursorY += 5

  // Scadenza
  if (expiresAt) {
    doc.text(`Scade ${formatExpiry(expiresAt)}`, W / 2, cursorY + 4, { align: 'center' })
    cursorY += 5
  }

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(154, 142, 148)
  doc.text('Codice valido una sola volta · chiamamibi.com', W / 2, 145, { align: 'center' })

  const filename = `sconto-${slugify(restaurantName)}.pdf`
  doc.save(filename)
}
