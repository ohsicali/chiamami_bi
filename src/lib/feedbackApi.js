import { supabase, isSupabaseConfigured } from './supabase'

/**
 * Le chiamate del feedback dopo la convalida. Tutte col `token` della riga
 * di `redemption_feedback`: vale sia per chi è nell'app (lo legge dalla
 * propria riga) sia per chi arriva dal link dell'email senza aver fatto
 * l'accesso. Le funzioni SQL stanno in
 * supabase/redemption-feedback-2026-09-29.sql.
 */

const FEEDBACK_ROW_COLUMNS = 'redemption_id, token, redeemed_at, rating, completed_at, restaurant_id, discount_id'

/** La riga di una convalida (RLS: solo la propria). */
export async function fetchOwnFeedbackRow(redemptionId) {
  if (!isSupabaseConfigured() || !redemptionId) return null
  const { data } = await supabase
    .from('redemption_feedback')
    .select(FEEDBACK_ROW_COLUMNS)
    .eq('redemption_id', redemptionId)
    .maybeSingle()
  return data || null
}

/** Le convalide recenti ancora senza stelle (per chi riapre l'app dopo). */
export async function fetchRecentOpenFeedback(userId, sinceIso) {
  if (!isSupabaseConfigured() || !userId) return []
  const { data } = await supabase
    .from('redemption_feedback')
    .select(FEEDBACK_ROW_COLUMNS)
    .eq('user_id', userId)
    .is('rating', null)
    .is('completed_at', null)
    .gte('redeemed_at', sinceIso)
    .order('redeemed_at', { ascending: false })
    .limit(3)
  return data || []
}

/** Stato di un riscatto: serve al controllo del QR aperto, se il realtime tace. */
export async function fetchRedemptionStatus(redemptionId) {
  if (!isSupabaseConfigured() || !redemptionId) return null
  const { data } = await supabase
    .from('discount_redemptions')
    .select('id, status, redeemed_at')
    .eq('id', redemptionId)
    .maybeSingle()
  return data || null
}

export async function getFeedback(token) {
  if (!isSupabaseConfigured()) return { error: 'offline' }
  const { data, error } = await supabase.rpc('feedback_get', { p_token: token })
  if (error) return { error: error.message }
  return data || { error: 'not_found' }
}

/**
 * Spedisce una chiamata RPC con `navigator.sendBeacon`: è l'unico modo che il
 * browser garantisce anche mentre la pagina si chiude. Una fetch, anche con
 * `keepalive`, ha bisogno di due giri (la verifica CORS e poi la richiesta)
 * e chiudendo nello stesso istante del tocco si perdeva — provato il 29/09.
 * Il beacon parte in un giro solo perché è un modulo "semplice": corpo
 * form-urlencoded (PostgREST lo accetta per le RPC) e chiave pubblica
 * nell'indirizzo (`?apikey=`, che il gateway di Supabase accetta) invece che
 * nelle intestazioni. Le funzioni sono concesse ad anon: l'autorizzazione è
 * il token della riga.
 *
 * @returns {boolean} true se il browser ha preso in carico l'invio
 */
function beaconRpc(fn, params) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key || typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue
    body.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
  }
  try {
    return navigator.sendBeacon(`${url}/rest/v1/rpc/${fn}?apikey=${encodeURIComponent(key)}`, body)
  } catch {
    return false
  }
}

/**
 * Il voto, spedito al tocco: col beacon (arriva anche se la pagina si chiude
 * subito dopo), e se il browser non lo prende con una fetch normale che sa
 * dire se è andata male.
 */
export function rateFeedbackNow(token, rating, source = 'app') {
  if (!token || !rating) return Promise.resolve({ error: 'invalid' })
  if (beaconRpc('feedback_rate', { p_token: token, p_rating: rating, p_source: source })) {
    return Promise.resolve({ ok: true, beacon: true })
  }
  return rateFeedback(token, rating, source)
}

/**
 * Il modulo, quando chi sta scrivendo chiude l'app o cambia scheda senza aver
 * premuto "Manda a Bi": quello che ha scritto non si perde (e da lì in poi
 * non riceve più le email che chiedono il resto).
 */
export function submitFeedbackNow(token, { rating, answers, comment }, source = 'app') {
  if (!token || !rating) return false
  return beaconRpc('feedback_submit', {
    p_token: token,
    p_rating: rating,
    p_answers: answers || {},
    p_comment: comment || null,
    p_source: source,
  })
}

export async function rateFeedback(token, rating, source = 'app') {
  if (!isSupabaseConfigured()) return { error: 'offline' }
  const { data, error } = await supabase.rpc('feedback_rate', { p_token: token, p_rating: rating, p_source: source })
  if (error) return { error: error.message }
  return data || {}
}

export async function submitFeedback(token, { rating, answers, comment }, source = 'app') {
  if (!isSupabaseConfigured()) return { error: 'offline' }
  const { data, error } = await supabase.rpc('feedback_submit', {
    p_token: token,
    p_rating: rating,
    p_answers: answers || {},
    p_comment: comment || null,
    p_source: source,
  })
  if (error) return { error: error.message }
  return data || {}
}
