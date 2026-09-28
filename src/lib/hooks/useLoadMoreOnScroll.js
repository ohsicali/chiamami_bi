import { useEffect, useRef } from 'react'

/**
 * Chiama `onMore` quando l'elemento sentinella (in fondo a una lista) entra
 * in vista — dentro `rootRef` se la lista scorre in un riquadro suo, se no
 * nella pagina. Restituisce il ref da mettere sulla sentinella.
 *
 * `watch` va cambiato a ogni pezzo caricato (di solito la lunghezza della
 * lista): l'observer si ricrea e, se la sentinella è ancora in vista perché
 * il pezzo nuovo non bastava a riempire il riquadro, carica ancora.
 */
export function useLoadMoreOnScroll(onMore, { enabled = true, rootRef = null, watch } = {}) {
  const sentinelRef = useRef(null)
  const cbRef = useRef(onMore)

  useEffect(() => {
    cbRef.current = onMore
  }, [onMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!enabled || !el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cbRef.current?.()
      },
      { root: rootRef?.current || null, rootMargin: '0px 0px 240px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [enabled, rootRef, watch])

  return sentinelRef
}
