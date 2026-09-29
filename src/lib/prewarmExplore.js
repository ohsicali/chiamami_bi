/**
 * Prepara Esplora prima che ci si arrivi.
 *
 * Senza questo, il tocco su "Esplora" dava il via a una fila di attese una
 * dopo l'altra: il codice della pagina, quello della mappa, Mapbox (1,7 MB,
 * ~450 KB compressi), poi stile, font e tessere di Torino. Qui si fa tutto
 * prima: si scaricano i pezzi e si crea la mappa in un contenitore nascosto
 * (`prewarmMap`, vedi components/Map/mapInstance.js). Quando la pagina si
 * apre la mappa è già disegnata e ci viene solo spostata dentro.
 *
 * Quando parte:
 * - subito, se si apre direttamente /esplora (tutto in parallelo invece che
 *   in fila);
 * - a browser libero dalle altre pagine, dopo il caricamento, così non ruba
 *   rete e CPU alla pagina che si sta guardando;
 * - al primo tocco (o passaggio del mouse) su "Esplora", se non era già
 *   partito.
 * Non parte con "risparmio dati" attivo o su rete 2G: lì la mappa si carica
 * solo quando la si chiede.
 */

let started = false
let scheduled = false

function onSlowOrMeteredNetwork() {
  const c = typeof navigator !== 'undefined' ? navigator.connection : null
  if (!c) return false
  return c.saveData === true || /(^|-)2g$/.test(c.effectiveType || '')
}

const ignore = () => {}

export function prewarmExplore() {
  if (started || typeof window === 'undefined') return
  started = true
  import('../pages/public/HomePage').catch(ignore)
  if (window.matchMedia?.('(min-width: 768px)').matches) {
    import('../pages/public/DesktopExplorePage').catch(ignore)
  }
  import('../components/Map/MapView').catch(ignore)
  import('../components/Map/mapInstance')
    .then(({ prewarmMap }) => prewarmMap())
    .catch(ignore)
}

/** Dalle altre pagine: a caricamento finito e browser libero. */
export function scheduleExplorePrewarm() {
  if (started || scheduled || typeof window === 'undefined') return
  if (onSlowOrMeteredNetwork()) return
  scheduled = true
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
  const go = () => setTimeout(() => idle(prewarmExplore, { timeout: 4000 }), 1500)
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go, { once: true })
}
