/**
 * Il tutorial di benvenuto (28/09): quando si mostra e quando no.
 *
 * Parte una volta sola, a chi ha appena creato l'account — con email e
 * codice o con Google, che dal lato nostro sono due strade diverse (il
 * primo passa da LoginPage, il secondo da /auth/callback). Invece di
 * agganciarsi a tutte e due si guarda l'account: se è nato da meno di
 * `TOUR_WINDOW_MS` ed è la prima volta che lo vediamo su questo browser, è
 * un nuovo arrivato. Un accesso con Google di chi l'account ce l'ha da mesi
 * non lo fa partire.
 *
 * "Visto" vale sia per chi arriva in fondo sia per chi preme Salta: tutti e
 * due hanno scelto, e non glielo si ripropone. Chi lo vuole rivedere lo
 * trova in Impostazioni (`openWelcomeTour()`).
 *
 * Tutto quello che decide sta nelle funzioni pure qui sotto, sotto test in
 * tests/welcome-tour.test.mjs.
 */

/** Un account più vecchio di così non è "appena creato". */
export const TOUR_WINDOW_MS = 24 * 60 * 60 * 1000

/** Evento con cui Impostazioni lo riapre (vedi WelcomeTourGate). */
export const OPEN_TOUR_EVENT = 'chiamamibi:open-welcome-tour'

const SEEN_KEY_PREFIX = 'chiamamibi_welcome_tour_seen:'

/**
 * Pagine sopra le quali non si apre: il login (da lì si viene rimandati
 * altrove un attimo dopo), i passaggi dell'autenticazione, l'area admin e
 * quella dei ristoratori, e Chiedi a Bi — chi ci arriva dal login ha una
 * domanda già scritta che aspetta, e il tutorial gliela coprirebbe.
 */
export function isTourAllowedOnPath(pathname) {
  if (!pathname) return false
  if (pathname.startsWith('/admin')) return false
  if (pathname.startsWith('/chiedi')) return false
  return ![
    '/login',
    '/auth/callback',
    '/reset-password',
    '/verify',
    '/partner',
    '/preferenze-email',
  ].includes(pathname)
}

/** L'account è nato da poco? `created_at` è quello di Supabase Auth. */
export function isFreshAccount(user, now = Date.now()) {
  const created = Date.parse(user?.created_at ?? '')
  if (!Number.isFinite(created)) return false
  const age = now - created
  // Un orologio del telefono un po' indietro dà un'età negativa di qualche
  // secondo: conta come appena nato, non come errore.
  return age > -5 * 60 * 1000 && age < TOUR_WINDOW_MS
}

export function shouldShowTour({ user, pathname, seen, now = Date.now() }) {
  if (!user?.id) return false
  if (seen) return false
  if (!isTourAllowedOnPath(pathname)) return false
  return isFreshAccount(user, now)
}

// localStorage può mancare o lanciare (navigazione privata di Safari,
// webview delle app, dati bloccati). In quel caso il tutorial si vede al
// massimo una volta per scheda — `memorySeen` — e mai in un loop.
const memorySeen = new Set()

export function hasSeenTour(userId) {
  if (!userId) return true
  if (memorySeen.has(userId)) return true
  try {
    return window.localStorage.getItem(SEEN_KEY_PREFIX + userId) === '1'
  } catch {
    return false
  }
}

export function markTourSeen(userId) {
  if (!userId) return
  memorySeen.add(userId)
  try {
    window.localStorage.setItem(SEEN_KEY_PREFIX + userId, '1')
  } catch {
    // vedi sopra: resta il ricordo in memoria
  }
}

/**
 * Apre il tutorial da qualunque punto dell'app.
 *
 * - `source: 'settings'` → "Rivedi il tutorial" in Impostazioni;
 * - `source: 'signup'` → subito dopo la conferma dell'account (codice
 *   accettato, link della mail, primo accesso con Google), senza aspettare
 *   di atterrare sulla home. Con `origin` ({ x, y, r } in px) il tutorial
 *   entra come un cerchio che si allarga da quel punto: il cerchio corallo
 *   della spunta "Ci sei" diventa la prima schermata, che è corallo anche lei.
 */
export function openWelcomeTour({ source = 'settings', origin = null } = {}) {
  window.dispatchEvent(new CustomEvent(OPEN_TOUR_EVENT, { detail: { source, origin } }))
}

/**
 * Dopo l'"account confermato": la spunta si disegna e si legge "Ci sei",
 * poi (dopo questo ritardo) il cerchio cresce e diventa il tutorial.
 */
export const SIGNUP_TOUR_DELAY_MS = 1000

/** Il tutorial avvisa con questo evento quando ha finito di entrare. */
export const TOUR_COVERED_EVENT = 'chiamamibi:welcome-tour-covered'

/**
 * Esegue `fn` quando il tutorial copre tutto lo schermo — è lì che la
 * pagina sotto può cambiare senza che si veda niente saltare. Non a tempo
 * fisso: su una rete lenta il tutorial può arrivare più tardi, e cambiare
 * pagina prima faceva lampeggiare la home fra "Ci sei" e il tutorial.
 * Se il tutorial non arriva proprio, dopo `fallbackMs` si va avanti lo
 * stesso: chi si è appena registrato non deve restare fermo su "Ci sei".
 */
export function whenTourCovers(fn, fallbackMs = 3500) {
  let done = false
  const go = () => {
    if (done) return
    done = true
    window.removeEventListener(TOUR_COVERED_EVENT, go)
    clearTimeout(timer)
    fn()
  }
  window.addEventListener(TOUR_COVERED_EVENT, go)
  const timer = setTimeout(go, fallbackMs)
}

/** Il nome con cui salutare: il primo del nome completo, se c'è. */
export function greetingName(user, profile) {
  const full = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || ''
  const first = String(full).trim().split(/\s+/)[0] || ''
  if (!first || first.includes('@')) return ''
  return first.charAt(0).toUpperCase() + first.slice(1)
}
