/**
 * Data di nascita degli utenti (29/09): come si chiede, come si controlla,
 * quando si apre il popup per chi l'account ce l'aveva già.
 *
 * Da questa data la registrazione con email la chiede (obbligatoria, in
 * LoginPage). Chi si era registrato prima — e chi entra con Google, che il
 * modulo non lo vede — la trova chiesta da `BirthDateGate`: un popup che si
 * apre una volta per visita finché non la mette. "Più tardi" lo chiude fino
 * alla prossima apertura del sito, non per sempre: l'età ci serve di tutti.
 *
 * Sta in `profiles.birth_date` (supabase/profiles-birth-date-2026-09-29.sql).
 * Il DB rifiuta le date impossibili e chi ha meno di MIN_AGE anni con gli
 * stessi limiti di qui: se li cambi, cambiali anche lì.
 *
 * Tutto quello che decide sta nelle funzioni pure qui sotto, sotto test in
 * tests/birth-date.test.mjs.
 */

/** L'età minima dei Termini di Servizio ("almeno 16 anni"). */
export const MIN_AGE = 16
/** Oltre questa età è un anno sbagliato, non una persona. */
export const MAX_AGE = 110

export const MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

/** Giorni del mese (`month` da 1 a 12); senza anno, febbraio ne ha 29. */
export function daysInMonth(month, year) {
  if (!month) return 31
  return new Date(Date.UTC(year || 2000, month, 0)).getUTCDate()
}

/**
 * Le tre scelte del modulo → 'YYYY-MM-DD', o null se manca un pezzo o il
 * giorno non esiste (31 aprile, 29 febbraio di un anno non bisestile).
 */
export function toIsoDate({ day, month, year }) {
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null
  if (m < 1 || m > 12 || d < 1 || y < 1000) return null
  if (d > daysInMonth(m, y)) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' → { day, month, year } come stringhe (per i select). */
export function fromIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  if (!m) return { day: '', month: '', year: '' }
  return { day: String(Number(m[3])), month: String(Number(m[2])), year: m[1] }
}

/**
 * Anni compiuti al giorno `now`. Si conta sul calendario, non sui
 * millisecondi: chi compie gli anni oggi li ha già, anche all'una di notte.
 */
export function ageOn(iso, now = new Date()) {
  const parts = fromIsoDate(iso)
  if (!parts.year) return null
  const y = Number(parts.year)
  const m = Number(parts.month)
  const d = Number(parts.day)
  const today = now instanceof Date ? now : new Date(now)
  let age = today.getFullYear() - y
  const tm = today.getMonth() + 1
  if (tm < m || (tm === m && today.getDate() < d)) age -= 1
  return age
}

/**
 * Cosa c'è che non va nella data scelta, detto a chi la sta scrivendo;
 * null se va bene.
 */
export function birthDateError(parts, now = new Date()) {
  const { day, month, year } = parts || {}
  if (!day || !month || !year) return 'Scegli giorno, mese e anno di nascita.'
  const iso = toIsoDate(parts)
  if (!iso) return 'Questo giorno non esiste: ricontrolla la data.'
  const age = ageOn(iso, now)
  if (age < 0) return 'La data è nel futuro: ricontrolla l’anno.'
  if (age > MAX_AGE) return 'Ricontrolla l’anno di nascita.'
  if (age < MIN_AGE) return `Per usare ChiamamiBi devi avere almeno ${MIN_AGE} anni.`
  return null
}

/** Gli anni fra cui scegliere, dal più recente possibile all'indietro. */
export function selectableYears(now = new Date()) {
  const last = now.getFullYear() - MIN_AGE
  const first = now.getFullYear() - MAX_AGE
  const years = []
  for (let y = last; y >= first; y -= 1) years.push(y)
  return years
}

// ─── Il popup per chi l'account ce l'aveva già ───────────────────────────

/** Pagine sopra le quali non si apre: le stesse del tutorial, più le legali. */
export function isBirthDateAskAllowedOnPath(pathname) {
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
    '/feedback',
    '/privacy',
    '/terms',
  ].includes(pathname)
}

/**
 * Il popup si apre?
 *  - c'è un utente e il suo profilo è arrivato (`profile.id === user.id`:
 *    prima di allora `birth_date` mancante non vuol dire niente);
 *  - la data non c'è ancora;
 *  - in questa visita non è già stato mostrato;
 *  - il tutorial di benvenuto non è in attesa (chi si registra con Google
 *    vede prima il tutorial, poi questo);
 *  - la pagina lo consente.
 */
export function shouldAskBirthDate({ user, profile, pathname, askedThisVisit, tourPending }) {
  if (!user?.id || !profile || profile.id !== user.id) return false
  if (profile.birth_date) return false
  if (askedThisVisit || tourPending) return false
  return isBirthDateAskAllowedOnPath(pathname)
}

// "Una volta per visita": sessionStorage vive quanto la scheda (o l'app
// aperta), che è proprio "fino alla prossima apertura del sito". Se non si
// può usare (webview, dati bloccati) resta il ricordo in memoria, che vale
// fino al ricaricamento: al massimo si rivede una volta in più, mai in loop.
const ASKED_KEY_PREFIX = 'chiamamibi_birthdate_asked:'
const memoryAsked = new Set()

export function wasAskedThisVisit(userId) {
  if (!userId) return true
  if (memoryAsked.has(userId)) return true
  try {
    return window.sessionStorage.getItem(ASKED_KEY_PREFIX + userId) === '1'
  } catch {
    return false
  }
}

export function markAskedThisVisit(userId) {
  if (!userId) return
  memoryAsked.add(userId)
  try {
    window.sessionStorage.setItem(ASKED_KEY_PREFIX + userId, '1')
  } catch {
    // resta il ricordo in memoria
  }
}
