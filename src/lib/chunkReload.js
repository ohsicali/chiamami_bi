/**
 * Un nuovo deploy rinomina i file delle pagine caricate con `lazy()` (hash
 * diverso nel nome). Chi ha il sito già aperto e naviga verso una pagina non
 * ancora scaricata prova a prendere il vecchio file: Vercel non lo trova più
 * e restituisce la pagina HTML del routing SPA al suo posto, da cui il
 * "text/html is not a valid JavaScript MIME type". Non è un bug dell'app, è
 * il sito vecchio in mano all'utente: un ricaricamento prende l'HTML nuovo con
 * i riferimenti giusti e risolve.
 *
 * Contro i ricaricamenti in loop (file che manca anche dopo, es. offline con
 * la pagina vecchia servita dal service worker) si ricarica al massimo una
 * volta ogni `RELOAD_WINDOW_MS`. Prima era un flag azzerato al montaggio di
 * App — che però monta prima che il chunk della pagina fallisca, quindi il
 * flag era sempre già sparito e il loop non si fermava.
 */
const CHUNK_ERROR_PATTERN = /dynamically imported module|is not a valid JavaScript MIME type|Importing a module script failed|Failed to fetch dynamically imported module|Unable to preload CSS/i
const RELOAD_KEY = 'chiamamibi-chunk-reload'
export const RELOAD_WINDOW_MS = 30_000

export function isChunkLoadError(error) {
  return CHUNK_ERROR_PATTERN.test(error?.message || '')
}

/**
 * true se si può ricaricare adesso (e lo segna): nessun ricaricamento per
 * chunk negli ultimi `RELOAD_WINDOW_MS`. Senza storage niente ricaricamento
 * automatico, perché non ci sarebbe modo di fermare un loop.
 */
export function claimChunkReload(storage, now = Date.now()) {
  try {
    // Dentro il try: in alcuni browser anche solo leggere sessionStorage lancia.
    storage ??= globalThis.sessionStorage
    const last = Number(storage.getItem(RELOAD_KEY))
    if (last > 0 && now - last >= 0 && now - last < RELOAD_WINDOW_MS) return false
    storage.setItem(RELOAD_KEY, String(now))
    return true
  } catch {
    return false
  }
}
