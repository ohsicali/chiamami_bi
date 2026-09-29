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
