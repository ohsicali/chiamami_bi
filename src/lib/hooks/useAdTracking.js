import { useEffect, useRef } from 'react'
import { getOrCreateSessionId } from './usePageTracking'

/**
 * Impression e click sui banner.
 *
 * Un'impression si conta quando il banner è stato **visto**: almeno metà
 * della sua altezza a schermo per un secondo pieno. Contarla al montaggio
 * gonfierebbe i numeri con banner che nessuno ha mai raggiunto scorrendo —
 * e sono numeri che finiscono nel report al cliente.
 *
 * Scritture fire-and-forget: se l'insert fallisce, il sito non se ne accorge.
 * Le metriche non devono mai rompere una pagina.
 */

const MIN_VISIBLE_RATIO = 0.5
const MIN_VISIBLE_MS = 1000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Una impression per campagna per caricamento pagina: scorrendo su e giù lo
// stesso banner entra ed esce dallo schermo molte volte, ma è stato visto una
// volta sola. Il Set vive quanto la pagina.
const counted = new Set()

function logEvent(eventType, placementId, slot) {
  if (!placementId || !slot) return
  // Le campagne finte — demo (`?demo=ads`) e anteprima dell'admin — non
  // esistono in tabella: la foreign key rifiuterebbe la riga, e comunque non
  // sono impression vere.
  if (!UUID_RE.test(String(placementId))) return

  // La scrittura passa dall'endpoint server, non dal client: `ad_events` è
  // chiusa alla chiave pubblica come `page_views`, così nessuno può
  // fabbricare impression dal browser. Su questi numeri si fattura.
  try {
    fetch('/api/ad-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placement_id: placementId,
        slot,
        event_type: eventType,
        session_id: getOrCreateSessionId(),
      }),
      // Un click porta via dalla pagina: senza keepalive la richiesta verrebbe
      // annullata dalla navigazione e il click non risulterebbe mai.
      keepalive: true,
    }).catch(() => {})
  } catch {
    // silenzio: l'analytics non deve mai rompere l'app
  }
}

export function trackAdClick(placementId, slot) {
  logEvent('click', placementId, slot)
}

/**
 * Attacca l'osservatore di visibilità a un elemento. Ritorna la ref da
 * mettere sul contenitore del banner.
 */
export function useAdImpression(placementId, slot) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    // Senza slot il banner non è in una posizione del sito: è l'anteprima
    // dell'admin o il fallback drop. Guardarli non è un'impression.
    if (!el || !placementId || !slot) return
    const key = `${placementId}|${slot}`
    if (counted.has(key)) return
    if (typeof IntersectionObserver === 'undefined') return

    let timer = null
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= MIN_VISIBLE_RATIO) {
          if (timer) return
          timer = setTimeout(() => {
            if (!counted.has(key)) {
              counted.add(key)
              logEvent('impression', placementId, slot)
            }
            observer.disconnect()
          }, MIN_VISIBLE_MS)
        } else if (timer) {
          // Uscito dallo schermo prima del secondo pieno: non conta.
          clearTimeout(timer)
          timer = null
        }
      },
      { threshold: [0, MIN_VISIBLE_RATIO, 1] }
    )

    observer.observe(el)
    return () => {
      if (timer) clearTimeout(timer)
      observer.disconnect()
    }
  }, [placementId, slot])

  return ref
}
