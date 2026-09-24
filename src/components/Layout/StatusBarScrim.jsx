import { useEffect, useState } from 'react'

/**
 * Striscia sotto la status bar (orologio, Dynamic Island, notch): compare
 * solo quando la pagina è scorsa. Da ferma ogni header si sposta già
 * dell'area sicura; scorrendo, sulle pagine senza header fisso il testo
 * passava dietro l'isola e l'orologio. Lo stile è in globals.css
 * (`.status-bar-scrim`): alta env(safe-area-inset-top), cioè 0 — e quindi
 * assente — in Safari con la barra degli indirizzi, su Android e su desktop.
 */
export default function StatusBarScrim() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let raf = 0
    const read = () => {
      raf = 0
      setVisible(window.scrollY > 0)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return <div className="status-bar-scrim" data-visible={visible || undefined} aria-hidden="true" />
}
