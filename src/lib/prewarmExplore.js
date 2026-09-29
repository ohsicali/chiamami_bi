/**
 * Prepara Esplora prima che ci si arrivi.
 *
 * Senza questo, il tocco su "Esplora" dava il via a una fila di attese una
 * dopo l'altra: il codice della pagina, quello della mappa, Mapbox (1,7 MB,
 * ~450 KB compressi), poi stile, font e tessere di Torino. Qui si fa tutto
 * prima: si scaricano i pezzi e si crea la mappa in un contenitore nascosto
 * (`prewarmMap`, vedi components/Map/mapInstance.js). Quando la pagina si
 * apre la mappa è già disegnata e ci viene solo spostata dentro: Esplora è
 * istantanea, ed è voluto (deciso dal proprietario il 29/09).
 *
 * Quando parte:
 * - subito, se si apre direttamente /esplora (tutto in parallelo invece che
 *   in fila);
 * - al primo tocco (o passaggio del mouse) su "Esplora", se non era già
 *   partito;
 * - dalle altre pagine a browser libero. **Dal telefono solo quando chi
 *   guarda non tocca e non scorre da 3 secondi** (29/09): creare la mappa
 *   sono secondi di processore a pezzi (fino a ~1,4 s su un telefono medio)
 *   e un tocco che ci capita in mezzo aspetta. Su iPhone l'INP della prima
 *   pagina della visita era 1,4 s contro 0,4 s delle successive; aspettare
 *   un momento di calma lo rende molto meno probabile senza rinunciare alla
 *   mappa pronta. Da computer il processore regge e basta la pausa fissa.
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

// Computer: mouse e schermo largo.
function isDesktop() {
  return !!window.matchMedia?.('(min-width: 768px) and (hover: hover) and (pointer: fine)').matches
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

/**
 * Chiama `cb` quando per `ms` millisecondi non ci sono stati tocchi, tasti o
 * scroll: il lavoro pesante non si mette in mezzo a chi sta usando la pagina.
 */
function whenUserQuiet(ms, cb) {
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']
  let timer = 0
  const arm = () => {
    clearTimeout(timer)
    timer = setTimeout(done, ms)
  }
  const done = () => {
    for (const e of events) window.removeEventListener(e, arm, true)
    cb()
  }
  for (const e of events) window.addEventListener(e, arm, { capture: true, passive: true })
  arm()
}

/** Dalle altre pagine: a caricamento finito e browser libero. */
export function scheduleExplorePrewarm() {
  if (started || scheduled || typeof window === 'undefined') return
  if (onSlowOrMeteredNetwork()) return
  scheduled = true
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
  const run = () => idle(prewarmExplore, { timeout: 4000 })
  const go = isDesktop()
    ? () => setTimeout(run, 1500)
    : () => whenUserQuiet(3000, run)
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go, { once: true })
}
