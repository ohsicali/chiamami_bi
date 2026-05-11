// Single source of truth for rendering discount values across the app.
// `discount_value` is stored as free-text (admin can type "5", "5€", "10%",
// "-5€", " 5 € ") and `discount_type` drives the unit. We strip any pre-existing
// unit/sign from the raw value and reapply the canonical symbol so we never
// emit garbage like "5€%" when the type and value disagree.
//
// Discount types:
//   percentage    → "10%"             (% off the bill)
//   fixed         → "5€"              (€ amount off the bill)
//   freebie       → title             (something free / convention)
//   special_price → title || "5€"     (item sold at a fixed price)

function cleanNumeric(raw) {
  return String(raw ?? '').replace(/[%€\s]/g, '').replace(/^[-−]/, '').trim()
}

export function formatDiscountValue(deal) {
  if (!deal) return ''
  const raw = String(deal.discount_value ?? '').trim()
  const v = cleanNumeric(raw)
  if (deal.discount_type === 'special_price') {
    if (deal.title) return deal.title
    if (v) return `${v}€`
    return raw
  }
  if (deal.discount_type === 'freebie') return deal.title || raw
  if (!raw) return deal.title || ''
  if (!v) return deal.title || raw
  if (deal.discount_type === 'percentage') return `${v}%`
  if (deal.discount_type === 'fixed') return `${v}€`
  return raw
}

// Italian context word that precedes the discount label.
// e.g., "Aperitivo | sconto 10%" vs "Tramezzini | offerta Tramezzino a 5€".
export function discountContextWord(deal) {
  if (!deal) return 'sconto'
  if (deal.discount_type === 'freebie') return 'convenzione'
  if (deal.discount_type === 'special_price') return 'offerta'
  return 'sconto'
}

