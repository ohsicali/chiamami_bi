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
 * Due livelli (29/09, Web Vitals):
 * - `prewarmExplore()` — codice **e** mappa. Parte subito su /esplora, al
 *   primo tocco (o passaggio del mouse) su "Esplora" e, solo da computer, a
 *   browser libero dalle altre pagine.
 * - `preloadExploreCode()` — solo il codice. È quello che parte a browser
 *   libero **dal telefono**, e solo quando chi guarda non tocca lo schermo da
 *   qualche secondo.
 *
 * Perché sul telefono la mappa non nasce più da sola: creare una mappa Mapbox
 * sono secondi di lavoro sul processore (stile, tessere, disegno), a pezzi
 * fino a ~1,4 s l'uno su un telefono medio, e un tocco che capita in mezzo
 * aspetta che finisca. PostHog lo misurava così: su iPhone l'INP (risposta ai
 * tocchi) della *prima* pagina della visita era 1,4 s, sulle successive
 * 0,4 s. Si paga su tutte le home per un vantaggio che serve solo a chi apre
 * Esplora. Il tocco su "Esplora" dà comunque qualche centinaio di ms di
 * anticipo, e il codice è già scaricato.
 *
 * Non parte niente con "risparmio dati" attivo o su rete 2G: lì la mappa si
 * carica solo quando la si chiede.
 */

let started = false
let codeStarted = false
let scheduled = false

function onSlowOrMeteredNetwork() {
  const c = typeof navigator !== 'undefined' ? navigator.connection : null
  if (!c) return false
  return c.saveData === true || /(^|-)2g$/.test(c.effectiveType || '')
}

// Computer: mouse e schermo largo. Lì il processore regge e l'INP è buono,
// quindi la mappa si può preparare in anticipo come prima.
function isDesktop() {
  return !!window.matchMedia?.('(min-width: 768px) and (hover: hover) and (pointer: fine)').matches
}

const ignore = () => {}

/** Scarica (ed esegue) il codice di Esplora e della mappa, senza crearla. */
export function preloadExploreCode() {
  if (codeStarted || typeof window === 'undefined') return
  codeStarted = true
  import('../pages/public/HomePage').catch(ignore)
  if (window.matchMedia?.('(min-width: 768px)').matches) {
    import('../pages/public/DesktopExplorePage').catch(ignore)
  }
  import('../components/Map/MapView').catch(ignore)
  import('../components/Map/mapInstance').catch(ignore)
}

/** Codice e mappa: da chiamare quando si sta per aprire Esplora. */
export function prewarmExplore() {
  if (started || typeof window === 'undefined') return
  started = true
  preloadExploreCode()
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
  const desktop = isDesktop()
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
  const run = () => idle(desktop ? prewarmExplore : preloadExploreCode, { timeout: 4000 })
  const go = desktop
    ? () => setTimeout(run, 1500)
    : () => whenUserQuiet(3000, run)
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go, { once: true })
}
