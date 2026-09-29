/**
 * Errori che PostHog riceve ma che non vengono dal nostro codice: li
 * lanciano gli script che i browser dentro le app (Instagram, Facebook,
 * TikTok…) iniettano nella pagina per parlare con l'app nativa, o sono
 * errori di script di altri domini che il browser riduce a "Script error."
 * senza messaggio né stack. Non si possono correggere da qui e coprivano gli
 * errori veri in Error tracking, quindi non partono.
 *
 * Un errore finisce qui solo se il messaggio è esattamente di quel tipo: se
 * un giorno una di queste stringhe comparisse nel nostro codice, va tolta.
 */
const NOISE = [
  // WebView Android: il ponte JS→Java dell'app è già stato distrutto.
  /Java object is gone/,
  // WebView iOS delle app: script loro che cercano il ponte verso l'app.
  /webkit\.messageHandlers/,
  // Script di un altro dominio senza CORS: niente messaggio, niente stack.
  /^Script error\.?$/,
]

function messages(properties) {
  const list = properties?.$exception_list
  if (Array.isArray(list) && list.length) return list.map((e) => String(e?.value ?? ''))
  return [String(properties?.$exception_message ?? '')]
}

/** true se l'evento è un `$exception` di rumore (vedi sopra). */
export function isNoiseException(event) {
  if (event?.event !== '$exception') return false
  return messages(event.properties).some((m) => NOISE.some((re) => re.test(m.trim())))
}
