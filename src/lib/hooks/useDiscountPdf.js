import { useCallback, useState } from 'react'
import { supabase } from '../supabase'
import { slugify } from '../utils/slug'

/**
 * Scarica il PDF di uno sconto sbloccato (`/api/discount-pdf`).
 *
 * Stava dentro `DiscountDetailPopup`; ora che il pass del QR è lo stesso
 * anche sulla pagina del locale, il bottone "PDF" c'è in tutti e due i
 * popup e la logica sta qui una volta sola.
 */
export function useDiscountPdf(redemptionId, restaurantName) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const download = useCallback(async () => {
    if (busy || !redemptionId) return
    setBusy(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('not_authenticated')
      const res = await fetch(`/api/discount-pdf?id=${encodeURIComponent(redemptionId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const ctype = res.headers.get('content-type') || ''
      if (!res.ok || !ctype.includes('application/pdf')) {
        let detail = `HTTP ${res.status}`
        try {
          if (ctype.includes('application/json')) detail = (await res.json())?.error || detail
        } catch { /* ignore */ }
        throw new Error(detail)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sconto-${slugify(restaurantName, 'sconto')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF download failed:', err)
      setError('Non sono riuscito a generare il PDF, riprova.')
    } finally {
      setBusy(false)
    }
  }, [busy, redemptionId, restaurantName])

  return { download, busy, error }
}
