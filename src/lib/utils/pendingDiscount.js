// Persists a pending "Prendi sconto" id across login / OAuth redirects.
const PENDING_KEY = 'sconte_pending_discount_id'

export function setPendingDiscountId(id) {
  if (!id) return
  try { sessionStorage.setItem(PENDING_KEY, id) } catch { /* ignore */ }
}

export function readAndClearPendingDiscountId() {
  try {
    const v = sessionStorage.getItem(PENDING_KEY)
    if (v) sessionStorage.removeItem(PENDING_KEY)
    return v || null
  } catch {
    return null
  }
}
