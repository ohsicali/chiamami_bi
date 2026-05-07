// Single source of truth for rendering discount values across the app.
// `discount_value` is stored as free-text (admin can type "5", "5€", "10%",
// "-5€", " 5 € ") and `discount_type` drives the unit. We strip any pre-existing
// unit/sign from the raw value and reapply the canonical symbol so we never
// emit garbage like "5€%" when the type and value disagree.

function cleanNumeric(raw) {
  return String(raw ?? '').replace(/[%€\s]/g, '').replace(/^[-−]/, '').trim()
}

export function formatDiscountValue(deal) {
  if (!deal) return ''
  const raw = String(deal.discount_value ?? '').trim()
  if (!raw) return deal.title || ''
  const v = cleanNumeric(raw)
  if (!v) return deal.title || raw
  if (deal.discount_type === 'percentage') return `${v}%`
  if (deal.discount_type === 'fixed') return `${v}€`
  if (deal.discount_type === 'freebie') return deal.title || raw
  return raw
}
