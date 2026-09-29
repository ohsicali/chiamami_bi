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
 * Il voto, spedito subito e con `keepalive`: la richiesta arriva al DB
 * anche se chi ha toccato la stella chiude la pagina un attimo dopo (una
 * fetch normale verrebbe interrotta con la pagina). Va diretta all'RPC di
 * PostgREST con la chiave pubblica: `feedback_rate` è concessa ad anon e
 * l'autorizzazione è il token della riga.
 */
export function rateFeedbackNow(token, rating, source = 'app') {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key || !token) return Promise.resolve({ error: 'offline' })
  return fetch(`${url}/rest/v1/rpc/feedback_rate`, {
    method: 'POST',
    keepalive: true,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_rating: rating, p_source: source }),
  })
    .then((r) => (r.ok ? r.json() : { error: `http_${r.status}` }))
    .catch((e) => ({ error: e?.message || 'network' }))
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
