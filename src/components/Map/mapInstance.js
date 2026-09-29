/**
 * Una sola mappa Mapbox per tutta la visita.
 *
 * Prima ogni ingresso in Esplora creava una mappa nuova e ogni uscita la
 * distruggeva: contesto WebGL, stile (93 KB), sprite, font e tessere da
 * rifare ogni volta, e sul telefono si vedeva il riquadro vuoto per qualche
 * secondo. Ora la mappa nasce una volta sola — in anticipo, mentre si è
 * ancora sulla home (`prewarmMap`) — e quando si esce da Esplora non muore:
 * il suo contenitore torna in un "parcheggio" fuori schermo (`parkMap`) e
 * rientra al prossimo ingresso già disegnata, con posizione e zoom di prima.
 *
 * Il contenitore non è di React: MapView lo appende dentro il proprio div e
 * lo restituisce al parcheggio quando si smonta. Una MapView alla volta:
 * una seconda montata insieme si prenderebbe la stessa mappa. Spostare un canvas nel DOM
 * non perde il contesto WebGL, e Mapbox si ridimensiona da sé (osserva il
 * contenitore); `resize()` lo forza comunque subito.
 */
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { track } from '../../lib/posthog'

export const TORINO_CENTER = [7.6869, 45.0703]
const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'

let entry = null
let parking = null

function getParking() {
  if (parking?.isConnected) return parking
  parking = document.createElement('div')
  parking.setAttribute('aria-hidden', 'true')
  // `data-html2canvas-ignore`: il vetro della tab bar (liquidGL) fotografa il
  // body con html2canvas, e una mappa parcheggiata non deve finirci dentro.
  parking.setAttribute('data-html2canvas-ignore', '')
  // Fuori schermo ma con le misure di uno schermo: la mappa prepara le
  // tessere giuste per quando entrerà davvero in pagina.
  parking.style.cssText =
    'position:fixed;top:0;left:-200vw;width:100vw;height:100vh;height:100dvh;' +
    'visibility:hidden;pointer-events:none;overflow:hidden;contain:strict;z-index:-1'
  document.body.appendChild(parking)
  return parking
}

/**
 * La mappa della visita: la stessa se c'è già, altrimenti la crea nel
 * parcheggio. Senza WebGL il costruttore di Mapbox lancia: l'errore passa
 * al chiamante e non resta niente in cache, così un nuovo tentativo riparte.
 */
export function getMap() {
  if (entry) return entry
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) throw new Error('VITE_MAPBOX_TOKEN mancante')
  mapboxgl.accessToken = token

  const container = document.createElement('div')
  container.style.cssText = 'width:100%;height:100%'
  getParking().appendChild(container)

  const map = new mapboxgl.Map({
    container,
    style: MAP_STYLE,
    center: TORINO_CENTER,
    zoom: 13,
    pitch: 15,
    // Il replay di PostHog fotografa il canvas della mappa: senza questo
    // il buffer WebGL è già vuoto quando lo legge, e per leggerlo lo
    // svuota con `clear()` — la mappa diventa bianca anche per chi la
    // sta usando. Vedi `session_recording` in lib/posthog.js.
    preserveDrawingBuffer: true,
    // Una richiesta in meno a events.mapbox.com a ogni caricamento.
    performanceMetricsCollection: false,
  })

  entry = { map, container, loaded: false, createdAt: performance.now(), loadedAt: null }
  const current = entry

  // Via le etichette dei luoghi di Mapbox (negozi, bar...): i pin sono i
  // nostri. Su `style.load`, non su `load`, così non vengono mai disegnate.
  map.on('style.load', () => {
    for (const layer of map.getStyle().layers) {
      if (layer.id.includes('poi')) map.setLayoutProperty(layer.id, 'visibility', 'none')
    }
  })
  map.once('load', () => {
    current.loaded = true
    current.loadedAt = performance.now()
  })
  // Il primo errore prima del caricamento dice perché la mappa non parte
  // (token, rete, stile); quelli dopo sono tessere singole, rumore.
  let errorSent = false
  map.on('error', (e) => {
    if (current.loaded || errorSent) return
    errorSent = true
    track('map_error', {
      message: String(e?.error?.message || 'unknown').slice(0, 200),
      status: e?.error?.status ?? null,
    })
  })
  map.on('webglcontextlost', () => track('map_context_lost', { loaded: current.loaded }))

  return entry
}

/** Riporta il contenitore della mappa nel parcheggio (MapView smontata). */
export function parkMap(e) {
  if (e?.container) getParking().appendChild(e.container)
}

/** Crea la mappa in anticipo, se possibile; in silenzio se non si può. */
export function prewarmMap() {
  try {
    getMap()
  } catch {
    // Niente WebGL o niente token: se ne accorgerà MapView e lo dirà.
  }
}
