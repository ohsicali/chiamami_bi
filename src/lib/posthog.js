/**
 * PostHog — analisi di come si usa il sito (pagine, click, funnel, replay).
 *
 * Tre scelte, tutte e tre volute:
 *
 * - **Si carica dopo.** `posthog-js` arriva con un `import()` quando il
 *   browser è libero, come il banner dei cookie: il primo disegno della
 *   pagina non lo aspetta.
 * - **Senza consenso non lascia niente nel browser.** Finché il banner non ha
 *   ricevuto "Accetta tutti" la persistenza è `memory`: nessun cookie, nessun
 *   localStorage, un id anonimo che muore col ricaricamento. Dopo il consenso
 *   passa a `localStorage+cookie` e la stessa persona resta riconoscibile tra
 *   una visita e l'altra. Il banner promette "non utilizziamo cookie di
 *   profilazione": così resta vero.
 * - **Passa da noi.** Gli eventi vanno a `/ingest`, che `vercel.json` gira
 *   ai server US di PostHog: niente dominio di terzi da bloccare per gli
 *   adblock, e la CSP resta `'self'` anche per gli script che PostHog carica
 *   da sé (registrazione sessioni, sondaggi).
 *
 * L'admin (`/admin/...`) non viene contato, come in `usePageTracking`.
 *
 * La chiave di progetto è pubblica per natura (sta comunque nel JavaScript
 * servito al browser), quindi è scritta qui. Parte solo su chiamamibi.com:
 * anteprime Vercel e `localhost` non sporcano i numeri. `VITE_POSTHOG_KEY`,
 * se impostata, la sostituisce e fa partire PostHog anche fuori produzione.
 */

const PROJECT_KEY = 'phc_zS9aMGPuNLKzuxytwmibmfa6wzqJPSvL6ftYoARBKYQw'
const ENV_KEY = import.meta.env.VITE_POSTHOG_KEY
const CONSENT_COOKIE = 'chiamamibi_cookie_consent'

let client = null
let loading = null
// L'account può arrivare prima di PostHog (che parte a browser libero):
// l'ultimo richiesto si applica appena il client c'è.
let wantedUserId = null

function hasConsent() {
  try {
    return document.cookie.split('; ').some((c) => c === `${CONSENT_COOKIE}=true`)
  } catch {
    return false
  }
}

function isAdminUrl(url) {
  try {
    return new URL(url, window.location.origin).pathname.startsWith('/admin')
  } catch {
    return false
  }
}

function isProductionHost() {
  const host = window.location.hostname
  return host === 'chiamamibi.com' || host.endsWith('.chiamamibi.com')
}

export function initPostHog() {
  if (loading) return loading
  const KEY = ENV_KEY || (isProductionHost() ? PROJECT_KEY : null)
  if (!KEY) return null
  loading = import('posthog-js').then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: '/ingest',
      ui_host: 'https://us.posthog.com',
      // Pageview a ogni cambio di route della SPA, pageleave, autocapture,
      // web vitals: i default consigliati di PostHog a questa data.
      defaults: '2026-08-30',
      person_profiles: 'identified_only',
      // Errori JavaScript non gestiti e promise rifiutate → Error tracking.
      // Quelli presi dall'ErrorBoundary di React li manda `captureError`.
      capture_exceptions: true,
      persistence: hasConsent() ? 'localStorage+cookie' : 'memory',
      before_send: (event) =>
        event && isAdminUrl(event.properties?.$current_url) ? null : event,
    })
    client = posthog
    applyIdentity()
    return posthog
  }).catch(() => null)
  return loading
}

/** Chiamata dal banner su "Accetta tutti": da qui in poi l'id resta. */
export function posthogConsentGranted() {
  client?.set_config({ persistence: 'localStorage+cookie' })
}

/** Chiamata dal banner su "Solo necessari". */
export function posthogConsentDenied() {
  client?.set_config({ persistence: 'memory' })
  client?.reset()
}

/** Lega gli eventi all'account (solo l'id Supabase, mai l'email) — e solo
 *  con il consenso: senza, chi ha un account resta anonimo come gli altri. */
export function posthogIdentify(userId) {
  wantedUserId = userId || null
  applyIdentity()
}

function applyIdentity() {
  if (!client) return
  if (wantedUserId) {
    if (hasConsent() && client.get_distinct_id() !== wantedUserId) client.identify(wantedUserId)
  } else if (client.get_property('$user_state') === 'identified') {
    client.reset()
  }
}

/** Errore già intercettato (es. ErrorBoundary): senza questa chiamata
 *  React lo trattiene e PostHog non lo vedrebbe. */
export function captureError(error, properties) {
  client?.captureException(error, properties)
}

/** Evento su misura, es. `track('discount_claimed', { restaurant_id })`.
 *  Se PostHog non è (ancora) caricato non fa niente. */
export function track(event, properties) {
  client?.capture(event, properties)
}
