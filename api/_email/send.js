/**
 * L'unico punto da cui parte un'email.
 *
 * Chi manda (send-email.js, notify-subscribers.js) non parla con Resend
 * direttamente: passa di qui, così le intestazioni per la disiscrizione, il
 * mittente e il registro degli invii sono uguali dappertutto e non si
 * dimenticano un pezzo alla volta.
 */

import { SITE_URL } from './theme.js'

const RESEND_URL = 'https://api.resend.com/emails'
const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch'
// Il limite del blocco è di Resend, non nostro.
export const BATCH_SIZE = 100

export const FROM = () => process.env.RESEND_FROM || 'Bi <ciao@chiamamibi.com>'
export const REPLY_TO = () => process.env.RESEND_REPLY_TO || 'info@chiamamibi.com'

/** La pagina dove si sceglie cosa ricevere, raggiungibile senza accedere. */
export function unsubscribeUrl(token) {
  return token ? `${SITE_URL}/preferenze-email?t=${encodeURIComponent(token)}` : null
}

/**
 * Le intestazioni che fanno comparire "Annulla iscrizione" accanto al
 * mittente in Gmail e in Apple Mail.
 *
 * Non sono un vezzo: da quando Google e Yahoo hanno stretto le regole, chi
 * manda a molti indirizzi senza `List-Unsubscribe` finisce in spam a
 * prescindere da cosa scrive. `List-Unsubscribe-Post` è quella che rende il
 * link a un clic invece che una pagina da compilare.
 */
export function listUnsubscribeHeaders(token) {
  const url = unsubscribeUrl(token)
  if (!url) return {}
  return {
    'List-Unsubscribe': `<${url}>, <mailto:${REPLY_TO()}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

/** Un messaggio solo. Restituisce { ok, id?, error? }. */
export async function sendEmail({ to, subject, html, text, headers, attachments, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY mancante' }

  try {
    const r = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM(),
        reply_to: replyTo || REPLY_TO(),
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        ...(headers && Object.keys(headers).length ? { headers } : {}),
        ...(attachments?.length ? { attachments } : {}),
      }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, error: data?.message || `Resend ${r.status}` }
    return { ok: true, id: data?.id }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/** Fino a 100 messaggi per chiamata. Restituisce { sent, failed, errors }. */
export async function sendBatch(messages) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: 0, failed: messages.length, errors: ['RESEND_API_KEY mancante'] }

  let sent = 0
  let failed = 0
  const errors = []

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const chunk = messages.slice(i, i + BATCH_SIZE)
    try {
      const r = await fetch(RESEND_BATCH_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      })
      if (r.ok) {
        sent += chunk.length
      } else {
        const data = await r.json().catch(() => ({}))
        failed += chunk.length
        errors.push(data?.message || `Resend ${r.status}`)
      }
    } catch (e) {
      failed += chunk.length
      errors.push(e.message)
    }
  }
  return { sent, failed, errors }
}

/* ------------------------------------------------------------------ */
/*  Chi deve ricevere                                                  */
/* ------------------------------------------------------------------ */

/** I tre interruttori, con il nome della colonna su email_preferences. */
export const KINDS = {
  'new-discount': 'new_discounts',
  'new-place': 'new_places',
  'my-discounts': 'my_discounts',
}

/**
 * Gli utenti registrati che vogliono ancora ricevere questo tipo di email.
 *
 * Si parte da `profiles` e non da `newsletter_subscribers`: gli annunci
 * vanno a tutti i registrati, e l'iscrizione alla newsletter era un insieme
 * più piccolo e separato. Chi ha spento l'interruttore esce qui, non a valle:
 * così nessuno può dimenticarsi di filtrare.
 *
 * @returns {Promise<Array<{email:string, name:string, token:string}>>}
 */
export async function recipientsFor(supabaseAdmin, kind) {
  const column = KINDS[kind]
  if (!column) throw new Error(`Tipo email sconosciuto: ${kind}`)

  const { data, error } = await supabaseAdmin
    .from('email_preferences')
    .select(`unsubscribe_token, user_id, profiles!inner(email, full_name)`)
    .eq(column, true)

  if (error) throw new Error(`Lettura destinatari fallita: ${error.message}`)

  const seen = new Set()
  const out = []
  for (const row of data || []) {
    const email = row?.profiles?.email?.trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    out.push({ email, name: row.profiles.full_name || '', token: row.unsubscribe_token })
  }
  return out
}

/** Il token di una persona sola, per le email che la riguardano. */
export async function tokenForUser(supabaseAdmin, userId) {
  if (!userId) return null
  const { data } = await supabaseAdmin
    .from('email_preferences')
    .select('unsubscribe_token')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.unsubscribe_token || null
}

/* ------------------------------------------------------------------ */
/*  Registro                                                           */
/* ------------------------------------------------------------------ */

/**
 * Segna che l'email è partita. L'indice unico su (kind, ref_id) fa sì che
 * il secondo tentativo per lo stesso riscatto fallisca in scrittura: è così
 * che evitiamo di mandare due volte la stessa ricevuta.
 *
 * @returns {Promise<boolean>} false se era già stata mandata
 */
export async function claimSendSlot(supabaseAdmin, { userId, kind, refId, toEmail }) {
  if (!refId) return true // senza riferimento non c'è niente da deduplicare
  const { error } = await supabaseAdmin
    .from('email_sent_log')
    .insert({ user_id: userId || null, kind, ref_id: refId, to_email: toEmail || null, ok: true })
  if (error) {
    // 23505 = violazione di unicità: già mandata, e va bene così.
    if (error.code === '23505') return false
    // Un errore diverso non deve impedire l'invio: il registro serve a noi,
    // la ricevuta serve all'utente.
    return true
  }
  return true
}

/** Annota un invio fallito, per poterlo ritrovare. */
export async function logFailure(supabaseAdmin, { userId, kind, refId, toEmail, error }) {
  await supabaseAdmin
    .from('email_sent_log')
    .insert({ user_id: userId || null, kind, ref_id: refId || null, to_email: toEmail || null, ok: false, error: String(error).slice(0, 400) })
    .then(() => {}, () => {})
}
