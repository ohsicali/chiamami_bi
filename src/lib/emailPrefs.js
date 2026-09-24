/**
 * L'interruttore "Newsletter" di Impostazioni e Profilo.
 *
 * Le email di annuncio (sconti nuovi, locali nuovi) partono a chi ha
 * `email_preferences.new_discounts` / `new_places` accesi — vedi
 * `recipientsFor()` in api/_email/send.js. Fino al 24/09 l'interruttore
 * leggeva e scriveva invece `newsletter_subscribers`, la lista vecchia che
 * non decide più niente: spegnerlo non fermava nessuna email (e la
 * scrittura falliva comunque). Ora accende e spegne i due interruttori
 * degli annunci; le ricevute degli sconti (`my_discounts`) restano fuori,
 * come nella pagina /preferenze-email.
 */
import { supabase } from './supabase'

/** true se almeno uno dei due annunci è acceso (una riga assente = acceso). */
export async function fetchAnnouncementsEnabled(userId) {
  const { data, error } = await supabase
    .from('email_preferences')
    .select('new_discounts, new_places')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return true
  return data.new_discounts !== false || data.new_places !== false
}

/** Accende o spegne tutti e due gli annunci. */
export async function setAnnouncementsEnabled(userId, on) {
  const { data, error } = await supabase
    .from('email_preferences')
    .update({ new_discounts: on, new_places: on, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('user_id')
  if (error) throw error
  // La riga la crea il trigger alla registrazione; se manca (account
  // vecchissimi) la si crea qui.
  if (!data || data.length === 0) {
    const { error: insErr } = await supabase
      .from('email_preferences')
      .insert({ user_id: userId, new_discounts: on, new_places: on })
    if (insErr) throw insErr
  }
}

// Chi alla registrazione toglie la spunta "newsletter" spesso non ha ancora
// una sessione (deve confermare l'email): la scelta si parcheggia qui e la
// applica useAuth al primo accesso.
const PENDING_KEY = (email) => `chiamamibi_announcements_off_${String(email).toLowerCase()}`

export function rememberAnnouncementsOff(email) {
  try { localStorage.setItem(PENDING_KEY(email), '1') } catch { /* ignore */ }
}

export async function applyPendingAnnouncementsOff(userId, email) {
  if (!email) return
  let pending = false
  try { pending = localStorage.getItem(PENDING_KEY(email)) === '1' } catch { return }
  if (!pending) return
  try {
    await setAnnouncementsEnabled(userId, false)
    localStorage.removeItem(PENDING_KEY(email))
  } catch { /* si riprova al prossimo accesso */ }
}
