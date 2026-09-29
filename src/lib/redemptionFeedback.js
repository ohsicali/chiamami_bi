/**
 * Il feedback dopo lo sconto convalidato (29/09): quando si apre, cosa si
 * chiede, cosa si manda al DB.
 *
 * Il giro completo:
 *   1. il locale convalida il codice (/verify) → il trigger crea la riga in
 *      `redemption_feedback` (supabase/redemption-feedback-2026-09-29.sql);
 *   2. il realtime lo dice al telefono di chi l'ha usato →
 *      RedemptionFeedbackGate apre la festa "convalidato", poi le stelle
 *      (obbligatorie, niente "Salta"), poi il modulo per Bi (saltabile), poi
 *      Bi che ringrazia;
 *   3. chi non arriva in fondo riceve un'email dopo ~30 minuti e una dopo un
 *      giorno (api/_email/feedback.js), col link a /feedback?t=<token>.
 *
 * Tutto quello che decide sta nelle funzioni pure qui sotto, sotto test in
 * tests/redemption-feedback.test.mjs.
 */

/** Evento che QRPassSheet lancia quando si apre o si chiude (il Gate lo guarda). */
export const QR_PASS_EVENT = 'chiamamibi:qr-pass'
/** Evento che il Gate lancia appena vede la convalida (QRPassSheet si chiude). */
export const REDEMPTION_VALIDATED_EVENT = 'chiamamibi:redemption-validated'

/**
 * Entro quanto dalla convalida il telefono apre ancora il feedback da solo.
 * Dopo, ci pensano le email: chi riapre l'app il giorno dopo non deve
 * trovarsi addosso una schermata su una cena di ieri.
 */
export const IN_APP_WINDOW_MS = 3 * 60 * 60 * 1000

/**
 * Entro quanto la festa "convalidato" ha senso. Chi apre l'app mezz'ora
 * dopo, la festa l'ha persa: si parte direttamente dalle stelle.
 */
export const CELEBRATE_WINDOW_MS = 5 * 60 * 1000

/** Ogni quanto si ricontrolla il QR aperto, se il realtime tace. */
export const QR_POLL_MS = 4000

const SHOWN_KEY_PREFIX = 'chiamamibi_feedback_shown:'

/** Pagine sopra le quali non si apre (le stesse del tutorial, più /feedback). */
export function isFeedbackAllowedOnPath(pathname) {
  if (!pathname) return false
  if (pathname.startsWith('/admin')) return false
  return ![
    '/login',
    '/auth/callback',
    '/reset-password',
    '/verify',
    '/partner',
    '/preferenze-email',
    '/feedback',
  ].includes(pathname)
}

/**
 * Il feedback di questa convalida si apre da solo?
 *  - la riga c'è e non è finita;
 *  - le stelle non sono ancora state date: chi le ha date e ha saltato il
 *    modulo ha già scelto, e da lì in poi ci pensano le email;
 *  - la convalida è recente (`IN_APP_WINDOW_MS`).
 * Chi chiude l'app sulle stelle (che non si saltano) se le ritrova la
 * volta dopo, finché la finestra è aperta.
 */
export function shouldOpenFeedback(row, now = Date.now()) {
  if (!row?.token) return false
  if (row.completed_at || row.completed) return false
  if (row.rating != null) return false
  const at = Date.parse(row.redeemed_at ?? '')
  if (!Number.isFinite(at)) return false
  const age = now - at
  return age > -5 * 60 * 1000 && age < IN_APP_WINDOW_MS
}

/** La festa "convalidato" solo se la convalida è appena successa (e non già mostrata). */
export function shouldCelebrate(row, { shown = false, now = Date.now() } = {}) {
  if (shown) return false
  const at = Date.parse(row?.redeemed_at ?? '')
  if (!Number.isFinite(at)) return false
  return now - at < CELEBRATE_WINDOW_MS
}

export function hasShownFeedback(redemptionId) {
  if (!redemptionId) return false
  try { return localStorage.getItem(SHOWN_KEY_PREFIX + redemptionId) === '1' } catch { return false }
}

export function markFeedbackShown(redemptionId) {
  if (!redemptionId) return
  try { localStorage.setItem(SHOWN_KEY_PREFIX + redemptionId, '1') } catch { /* private mode */ }
}

/* ── Le domande ──────────────────────────────────────────────────────── */

/** Cosa dice Bi sotto le stelle, e che faccia fa. */
export const RATING_COPY = {
  1: { label: 'Proprio no', mood: 'sad' },
  2: { label: 'Poteva andare meglio', mood: 'meh' },
  3: { label: 'Nella media', mood: 'ok' },
  4: { label: 'Mi è piaciuto', mood: 'smile' },
  5: { label: 'Da tornarci!', mood: 'love' },
}

export function ratingCopy(rating) {
  return RATING_COPY[rating] || { label: 'Tocca le stelle', mood: 'idle' }
}

/** Le stesse voci, ma la domanda cambia col voto. */
export const LIKED_OPTIONS = [
  { key: 'cibo', label: 'Il cibo', emoji: '🍝' },
  { key: 'servizio', label: 'Il servizio', emoji: '🙋' },
  { key: 'atmosfera', label: "L'atmosfera", emoji: '🕯️' },
  { key: 'prezzo', label: 'Il prezzo', emoji: '💶' },
  { key: 'attesa', label: "L'attesa", emoji: '⏱️' },
]

export function likedQuestion(rating) {
  return rating != null && rating <= 2 ? 'Cosa non è andato?' : 'Cosa ti è piaciuto?'
}

export const DISCOUNT_OPTIONS = [
  { key: 'liscio', label: 'Liscio come l’olio' },
  { key: 'intoppo', label: 'Qualche intoppo' },
  { key: 'problema', label: 'Non ha funzionato' },
]

export const RETURN_OPTIONS = [
  { key: 'si', label: 'Sì' },
  { key: 'forse', label: 'Forse' },
  { key: 'no', label: 'No' },
]

export const COMMENT_MAX = 1500

const LIKED_KEYS = new Set(LIKED_OPTIONS.map((o) => o.key))
const DISCOUNT_KEYS = new Set(DISCOUNT_OPTIONS.map((o) => o.key))
const RETURN_KEYS = new Set(RETURN_OPTIONS.map((o) => o.key))

/**
 * Le risposte come vanno al DB: solo chiavi conosciute, niente di vuoto.
 * Il DB controlla forma e misura; il significato delle chiavi sta qui.
 */
export function buildAnswers({ liked = [], sconto = null, tornare = null } = {}) {
  const out = {}
  const l = [...new Set((liked || []).filter((k) => LIKED_KEYS.has(k)))]
  if (l.length) out.liked = l
  if (DISCOUNT_KEYS.has(sconto)) out.sconto = sconto
  if (RETURN_KEYS.has(tornare)) out.tornare = tornare
  return out
}

/** Il modulo si può mandare quando dice almeno una cosa. */
export function hasFeedbackContent({ answers = {}, comment = '' } = {}) {
  return Object.keys(answers || {}).length > 0 || String(comment || '').trim().length > 0
}

/** "Mario Rossi" → "Mario". */
export function firstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || ''
}

/** Il token dell'URL è un uuid, o niente. */
export function parseFeedbackToken(value) {
  const t = String(value || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t) ? t.toLowerCase() : null
}

/** `?stelle=4` dal link dell'email: un voto valido, o niente. */
export function parseStars(value) {
  const n = Number.parseInt(String(value ?? ''), 10)
  return n >= 1 && n <= 5 ? n : null
}
