/**
 * Vercel Serverless Function — Unified email dispatcher
 *
 * Router interno su `type`:
 * - type='user'                           → benvenuto dopo la registrazione (no auth, body {email, name};
 *                                            parte solo verso un account appena creato, e una volta sola)
 * - type='partner'                        → benvenuto ristoratore col PIN (Bearer admin, body {to, nomeLocale, pin, restaurantId})
 * - type='internal-notify'                → notifica interna a info@ + conferma a chi ha segnalato
 *                                            (no auth + Turnstile, body {nome_locale, …, email_utente})
 * - type='confirmation' / 'partner-application-confirmation' → non spediscono più niente (vedi sotto)
 * - type='discount-claimed' / 'discount-used' → le due ricevute (sessione utente / QR)
 * - type='preview'                        → una copia di prova all'admin che la chiede
 *
 * Motivo del merge: Vercel Hobby cap = 12 serverless functions.
 *
 * L'HTML non sta qui: tutte le email di cui sopra le costruisce
 * `_email/templates.js` e le spedisce `_email/send.js`. Prima cinque di esse
 * avevano il proprio HTML scritto a mano in fondo a questo file — cinquecento
 * righe, tre testate diverse, due piè di pagina — e cambiare un colore del
 * marchio voleva dire cambiarlo in sei posti sperando di non saltarne uno.
 */

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'
import { applyCors } from './_cors.js'
import { verifyTurnstile } from './_turnstile.js'
import {
  welcomeEmail, newDiscountEmail, newRestaurantEmail,
  discountClaimedEmail, discountUsedEmail, partnerWelcomeEmail,
  suggestionConfirmationEmail, partnerApplicationConfirmationEmail,
  recoveryOtpEmail, internalSuggestionEmail, internalPartnerApplicationEmail, SAMPLE,
} from './_email/templates.js'
import {
  sendEmail, claimSendSlot, logFailure, tokenForUser,
  unsubscribeUrl, listUnsubscribeHeaders, REPLY_TO,
} from './_email/send.js'
import { formatDiscountBadge, pickPerk } from './_email/discount.js'
import { formatShortCode, normalizeShortCode } from './_short-code.js'
import { SITE_URL as PUBLIC_SITE } from './_email/theme.js'

export default async function handler(req, res) {
  if (applyCors(req, res)) return

  // La disiscrizione a un clic arriva qui e non ha un `type`: è una POST
  // fatta da Gmail, non dal nostro sito, e nel corpo ha `List-Unsubscribe=
  // One-Click` invece del nostro JSON. Va intercettata prima di tutto il
  // resto, altrimenti cade sul 400 "Missing type" e la persona resta
  // iscritta convinta di non esserlo più — vedi oneClickUrl in _email/send.js.
  if (req.query?.unsub) return handleOneClickUnsubscribe(req, res)

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { type } = req.body || {}
  if (!type) return res.status(400).json({ error: 'Missing required field: type' })

  maybeCleanup()

  if (type === 'user')                             return handleUserWelcome(req, res)
  if (type === 'partner')                          return handlePartnerWelcome(req, res)
  // Le due conferme ai form erano aperte a chiunque: bastava un POST per
  // spedire a un indirizzo qualsiasi un'email col nostro mittente e un testo
  // scelto da chi chiamava. Ora le manda il server da sé, dopo il captcha —
  // quella del suggerimento `internal-notify`, quella della candidatura
  // /api/partner-application. Il 200 resta per le schede rimaste aperte con
  // la versione vecchia del sito, che le chiamano ancora.
  if (type === 'confirmation' || type === 'partner-application-confirmation') {
    return res.status(200).json({ success: true, skipped: 'sent-by-server' })
  }
  if (type === 'internal-notify')                  return handleInternalNotify(req, res)
  // Le ricevute degli sconti (Blocco mail): chi le chiede deve essere
  // l'utente stesso, con il proprio token di sessione — vedi handleDiscount*.
  if (type === 'discount-claimed')                 return handleDiscountClaimed(req, res)
  if (type === 'discount-used')                    return handleDiscountUsed(req, res)
  // Anteprima: manda a sé stesso una copia di prova di una qualunque email.
  if (type === 'preview')                          return handlePreview(req, res)
  return res.status(400).json({ error: `Unknown type: ${type}` })
}

/* ------------------------------------------------------------------ */
/*  Disiscrizione a un clic (RFC 8058)                                 */
/* ------------------------------------------------------------------ */

/**
 * POST /api/send-email?unsub=<token> — spegne tutti e tre gli interruttori.
 * GET  /api/send-email?unsub=<token> — porta alla pagina delle preferenze,
 *      per chi l'indirizzo se lo è copiato a mano dalle intestazioni.
 *
 * Il token è l'autorizzazione: è un uuid, non si indovina, e la funzione SQL
 * `set_email_prefs_by_token` tocca solo la riga di quel token — nessun dato
 * della persona passa di qui. Il limite di frequenza c'è comunque, perché
 * chi tira a indovinare non deve poterlo fare a raffica.
 */
async function handleOneClickUnsubscribe(req, res) {
  const token = String(req.query.unsub || '').trim()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)

  if (req.method === 'GET') {
    // Anche con un token storto: la pagina sa dire "questo link non vale più"
    // meglio di un JSON di errore.
    res.setHeader('Location', `${PUBLIC_SITE}/preferenze-email?t=${encodeURIComponent(token)}`)
    return res.status(302).end()
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const limited = rateLimit(req, { key: 'email-unsub', max: 20, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  if (!isUuid) return res.status(400).json({ error: 'Invalid token' })

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !anon) return res.status(500).json({ error: 'Server configuration error' })

  const client = createClient(url, anon, { auth: { persistSession: false } })
  const { error } = await client.rpc('set_email_prefs_by_token', {
    p_token: token,
    p_new_discounts: false,
    p_new_places: false,
    p_my_discounts: false,
  })
  if (error) {
    console.error('[send-email unsub] ', error.message)
    // Un 500 fa ritentare Gmail all'infinito; il 200 chiude il giro e
    // l'errore resta nei log, dove serve a noi.
    return res.status(200).json({ ok: false })
  }
  return res.status(200).json({ ok: true })
}

/* ------------------------------------------------------------------ */
/*  Le ricevute degli sconti                                           */
/* ------------------------------------------------------------------ */

/**
 * Da chi arriva la richiesta.
 *
 * Non ci si fida del `userId` scritto nel corpo: chiunque potrebbe mandare
 * quello di un altro e farsi spedire il codice sconto altrui. L'identità la
 * decide il token di sessione, e l'email la leggiamo dal profilo, non dal
 * corpo della richiesta.
 */
async function requireUser(req) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return { error: 'Missing authorization token', status: 401 }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) return { error: 'Server configuration error', status: 500 }

  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const { data: { user }, error } = await asUser.auth.getUser()
  if (error || !user) return { error: 'Invalid token', status: 401 }

  const admin = createClient(url, service, { auth: { persistSession: false } })
  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .maybeSingle()

  return {
    user,
    admin,
    email: profile?.email || user.email,
    name: profile?.full_name || user.user_metadata?.full_name || '',
  }
}

/** POST { type:'discount-claimed', redemptionId } — il codice via email. */
async function handleDiscountClaimed(req, res) {
  const limited = rateLimit(req, { key: 'send-email-claimed', max: 20, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const ctx = await requireUser(req)
  if (ctx.error) return res.status(ctx.status).json({ error: ctx.error })

  const { redemptionId } = req.body || {}
  if (!redemptionId) return res.status(400).json({ error: 'redemptionId required' })

  // Il riscatto deve essere suo: `eq('user_id', …)` non è ridondante con la
  // RLS, perché qui stiamo usando la service role key che la salta.
  const { data: red } = await ctx.admin
    .from('discount_redemptions')
    .select('id, qr_code, short_code, status, generated_at, discount_id, user_id, discount:discounts(*, restaurant:restaurants(name, slug, address, neighborhood, city, cuisine_type))')
    .eq('id', redemptionId)
    .eq('user_id', ctx.user.id)
    .maybeSingle()

  if (!red) return res.status(404).json({ error: 'Redemption not found' })
  if (!ctx.email) return res.status(400).json({ error: 'No email on profile' })

  const first = await claimSendSlot(ctx.admin, {
    userId: ctx.user.id, kind: 'discount-claimed', refId: red.id, toEmail: ctx.email,
  })
  if (!first) return res.status(200).json({ ok: true, skipped: 'already-sent' })

  const mail = discountClaimedEmail(discountClaimedProps(red))
  const r = await sendEmail({ to: ctx.email, ...mail })
  if (!r.ok) {
    await logFailure(ctx.admin, { userId: ctx.user.id, kind: 'discount-claimed', refId: red.id, toEmail: ctx.email, error: r.error })
    return res.status(502).json({ error: 'Send failed', detail: r.error })
  }
  return res.status(200).json({ ok: true, id: r.id })
}

/** POST { type:'discount-used', redemptionId } — la conferma dopo la scansione. */
async function handleDiscountUsed(req, res) {
  const limited = rateLimit(req, { key: 'send-email-used', max: 30, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  // Qui chi chiama è il locale che ha appena scansionato, non l'utente:
  // l'autorizzazione è il codice QR stesso, che solo chi ha il telefono in
  // mano davanti a sé può aver letto.
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) return res.status(500).json({ error: 'Server configuration error' })
  const admin = createClient(url, service, { auth: { persistSession: false } })

  const { qrCode } = req.body || {}
  if (!qrCode) return res.status(400).json({ error: 'qrCode required' })

  const REDEMPTION_FIELDS =
    'id, status, redeemed_at, user_id, discount:discounts(*, restaurant:restaurants(name, slug))'

  let { data: red } = await admin
    .from('discount_redemptions')
    .select(REDEMPTION_FIELDS)
    .eq('qr_code', qrCode)
    .maybeSingle()

  // Il locale può aver digitato lo short code invece di scansionare il QR.
  // La RPC rimanda il qr_code canonico apposta, ma una scheda rimasta
  // aperta da prima di questa versione manda ancora quello che ha in mano.
  if (!red) {
    const normalized = normalizeShortCode(qrCode)
    if (/^[A-HJ-NP-Z][0-9]{5}$/.test(normalized)) {
      const { data: byShort } = await admin
        .from('discount_redemptions')
        .select(REDEMPTION_FIELDS)
        .eq('short_code', normalized)
        .maybeSingle()
      red = byShort
    }
  }

  if (!red) return res.status(404).json({ error: 'Redemption not found' })
  // 'redeemed' è il valore che scrive la RPC verify_redeem_qr: mandare la
  // conferma per uno sconto non ancora scansionato sarebbe una bugia.
  if (red.status !== 'redeemed') return res.status(409).json({ error: 'Redemption not marked as redeemed' })
  // La chiamata arriva subito dopo la scansione. Un riscatto usato da ore non
  // ha motivo di generare email: chi prova codici a caso non deve poterlo
  // usare per scrivere a utenti che hanno usato uno sconto settimane fa.
  if (!red.redeemed_at || Date.now() - new Date(red.redeemed_at).getTime() > 2 * 60 * 60 * 1000) {
    return res.status(200).json({ ok: true, skipped: 'too-old' })
  }

  const { data: profile } = await admin
    .from('profiles').select('email').eq('id', red.user_id).maybeSingle()
  const to = profile?.email
  if (!to) return res.status(200).json({ ok: true, skipped: 'no-email' })

  const first = await claimSendSlot(admin, {
    userId: red.user_id, kind: 'discount-used', refId: red.id, toEmail: to,
  })
  if (!first) return res.status(200).json({ ok: true, skipped: 'already-sent' })

  const mail = discountUsedEmail(discountUsedProps(red))
  const r = await sendEmail({ to, ...mail })
  if (!r.ok) {
    await logFailure(admin, { userId: red.user_id, kind: 'discount-used', refId: red.id, toEmail: to, error: r.error })
    return res.status(502).json({ error: 'Send failed', detail: r.error })
  }
  return res.status(200).json({ ok: true, id: r.id })
}

/** POST { type:'preview', template } — una copia di prova a sé stessi (admin). */
async function handlePreview(req, res) {
  const ctx = await requireUser(req)
  if (ctx.error) return res.status(ctx.status).json({ error: ctx.error })

  const { data: me } = await ctx.admin
    .from('profiles').select('is_admin').eq('id', ctx.user.id).maybeSingle()
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin only' })

  const { template } = req.body || {}
  const token = await tokenForUser(ctx.admin, ctx.user.id)
  const u = unsubscribeUrl(token)
  const built = {
    welcome: () => welcomeEmail({ ...SAMPLE.welcome, name: ctx.name || SAMPLE.welcome.name, unsubscribeUrl: u }),
    // Drop e convenzione sono due email diverse, non la stessa con un flag:
    // si provano tutte e due, o la seconda non la guarda nessuno finché non
    // arriva a un iscritto vero.
    'new-discount': () => newDiscountEmail({ ...SAMPLE.newDiscount, unsubscribeUrl: u }),
    'new-convention': () => newDiscountEmail({
      ...SAMPLE.newDiscount, isDrop: false, countdown: null, taken: null, left: null, unsubscribeUrl: u,
    }),
    'new-place': () => newRestaurantEmail({ ...SAMPLE.newRestaurant, unsubscribeUrl: u }),
    'discount-claimed': () => discountClaimedEmail(SAMPLE.discountClaimed),
    'discount-used': () => discountUsedEmail(SAMPLE.discountUsed),
    partner: () => partnerWelcomeEmail(SAMPLE.partnerWelcome),
    suggestion: () => suggestionConfirmationEmail(SAMPLE.suggestionConfirmation),
    'partner-application': () => partnerApplicationConfirmationEmail(SAMPLE.partnerApplicationConfirmation),
    'internal-suggestion': () => internalSuggestionEmail(SAMPLE.internalSuggestion),
    otp: () => recoveryOtpEmail(SAMPLE.recoveryOtp),
    'internal-partner-application': () => internalPartnerApplicationEmail(SAMPLE.internalPartnerApplication),
  }[template]

  if (!built) return res.status(400).json({ error: `Unknown template: ${template}` })
  const mail = built()
  const r = await sendEmail({
    to: ctx.email,
    subject: `[PROVA] ${mail.subject}`,
    html: mail.html,
    text: mail.text,
    headers: listUnsubscribeHeaders(token),
  })
  if (!r.ok) return res.status(502).json({ error: 'Send failed', detail: r.error })
  return res.status(200).json({ ok: true, to: ctx.email, id: r.id })
}

/* ── Dalla riga del DB ai campi dell'email ───────────────────────────── */

function discountClaimedProps(red) {
  const d = red.discount || {}
  const r = d.restaurant || {}
  return {
    value: formatDiscountBadge(d),
    restaurantName: r.name || 'il locale',
    perk: pickPerk(d),
    conditions: (d.conditions || '').trim() || null,
    address: [r.address, r.city].filter(Boolean).join(', ') || null,
    // Il codice da dettare, non il qr_code: `BiSc-aB3dK9pM` in mezzo a
    // un'email nessuno lo legge al bancone, `K48 213` sì. Il fallback è per
    // le righe scritte prima che la colonna esistesse.
    code: formatShortCode(red.short_code) || red.qr_code,
    expiryLabel: expiryLabel(d),
    href: `${PUBLIC_SITE}/sconti`,
  }
}

function discountUsedProps(red) {
  const d = red.discount || {}
  const r = d.restaurant || {}
  return {
    value: formatDiscountBadge(d),
    restaurantName: r.name || 'il locale',
    whenLabel: red.redeemed_at ? formatWhen(red.redeemed_at) : null,
    href: `${PUBLIC_SITE}/sconti`,
  }
}

function expiryLabel(d) {
  if (!d?.valid_until) return null
  const date = new Date(d.valid_until)
  if (Number.isNaN(date.getTime())) return null
  return `Scade il ${date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })}`
}

function formatWhen(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `il ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })} alle ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}`
}

/* ------------------------------------------------------------------ */
/*  USER — benvenuto dopo la registrazione                             */
/* ------------------------------------------------------------------ */

async function handleUserWelcome(req, res) {
  const limited = rateLimit(req, { key: 'send-email-user', max: 10, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const { email, name } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Email required' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  // Il benvenuto parte solo verso un account vero, registrato da poco, e una
  // volta sola. Prima partiva verso qualunque indirizzo scritto nel corpo,
  // col nome scelto da chi chiamava: un modo gratuito per mandare email col
  // nostro mittente a chi si voleva (e la registrazione ne mandava due, una
  // dal form e una al primo caricamento del profilo).
  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supaService = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaService) return res.status(500).json({ error: 'Server configuration error' })
  const adminDb = createClient(supaUrl, supaService, { auth: { persistSession: false } })
  const normalizedEmail = String(email).trim().toLowerCase()
  const { data: account } = await adminDb
    .from('profiles').select('id, full_name, created_at').eq('email', normalizedEmail).maybeSingle()
  const FRESH_MS = 24 * 60 * 60 * 1000
  if (!account || !account.created_at || Date.now() - new Date(account.created_at).getTime() > FRESH_MS) {
    return res.status(200).json({ success: true, skipped: 'no-new-account' })
  }
  const firstSend = await claimSendSlot(adminDb, {
    userId: account.id, kind: 'welcome', refId: account.id, toEmail: normalizedEmail,
  })
  if (!firstSend) return res.status(200).json({ success: true, skipped: 'already-sent' })
  const safeName = String(account.full_name || name || '').slice(0, 60)

  // Il token per "scegli cosa ricevere": senza, il benvenuto sarebbe l'unica
  // email di annuncio senza via d'uscita — e senza le intestazioni che fanno
  // comparire "Annulla iscrizione" accanto al mittente, che è il primo posto
  // dove guarda chi non ha voglia di leggerci più. Lo cerchiamo con la
  // service role key perché qui la chiamata arriva subito dopo la
  // registrazione, quando il browser una sessione valida può non averla ancora.
  let token = null
  // Quanti sconti attivi ci sono adesso: il bottone dice il numero ("Guarda
  // i 6 sconti attivi"), che è l'esca — la stessa che il sito usa già sul
  // gate di registrazione. Se il conteggio non arriva il bottone resta
  // senza numero, che è l'unica cosa peggiore di dirne uno sbagliato.
  let attivi = null
  try {
    token = await tokenForUser(adminDb, account.id)
    const { count } = await adminDb
      .from('discounts')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .gt('valid_until', new Date().toISOString())
    attivi = Number.isFinite(count) ? count : null
  } catch { /* il benvenuto parte comunque */ }

  const mail = welcomeEmail({ name: safeName, attivi, unsubscribeUrl: unsubscribeUrl(token) })
  const r = await sendEmail({ to: normalizedEmail, ...mail, headers: listUnsubscribeHeaders(token) })
  if (!r.ok) {
    console.error('[send-email user] ', r.error)
    await logFailure(adminDb, { userId: account.id, kind: 'welcome', refId: null, toEmail: normalizedEmail, error: r.error })
    return res.status(502).json({ error: 'Failed to send email' })
  }
  return res.status(200).json({ success: true })
}

/* ------------------------------------------------------------------ */
/*  PARTNER — benvenuto ristoratore, col PIN                           */
/* ------------------------------------------------------------------ */

async function handlePartnerWelcome(req, res) {
  const limited = rateLimit(req, { key: 'send-email-partner', max: 5, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return res.status(500).json({ error: 'Server configuration error: missing Supabase env vars' })
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: missing RESEND_API_KEY' })
  }

  const token = authHeader.replace('Bearer ', '')
  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) {
    return res.status(403).json({ error: 'Admin role required' })
  }

  const { to, nomeLocale, pin, restaurantId } = req.body || {}
  if (!to || !nomeLocale || !pin || !restaurantId) {
    return res.status(400).json({ error: 'Missing required fields: to, nomeLocale, pin, restaurantId' })
  }

  // Il gettone usa e getta (24h) che fa entrare senza ridigitare il PIN.
  const magicToken = randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const { error: tokenError } = await admin
    .from('restaurants')
    .update({
      magic_token: magicToken,
      magic_token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', restaurantId)

  if (tokenError) {
    console.error('Failed to store magic token:', tokenError)
  }

  const verifyUrl = !tokenError
    ? `${PUBLIC_SITE}/verify?token=${magicToken}&pin=${encodeURIComponent(pin)}`
    : `${PUBLIC_SITE}/verify?pin=${encodeURIComponent(pin)}`

  const mail = partnerWelcomeEmail({ nomeLocale, pin, verifyUrl })
  const r = await sendEmail({ to, ...mail })
  if (!r.ok) {
    console.error('[send-email partner] ', r.error)
    return res.status(502).json({ error: 'Failed to send email', detail: r.error })
  }
  return res.status(200).json({ success: true })
}

/* ------------------------------------------------------------------ */
/*  CONFIRMATION — conferma suggerimento all'utente proponente         */
/* ------------------------------------------------------------------ */

/** La manda handleInternalNotify, dopo il captcha: non ha un `type` suo. */
async function sendSuggestionConfirmation({ to, nomeUtente, nomeLocale }) {
  const mail = suggestionConfirmationEmail({ nomeUtente, nomeLocale })
  const r = await sendEmail({
    to,
    ...mail,
    // Non è un annuncio e non ha un interruttore da spegnere, ma una via
    // d'uscita va lasciata comunque: questa email arriva a chi non ha un
    // account, e per Gmail un messaggio non richiesto senza uscita è spam.
    headers: { 'List-Unsubscribe': `<mailto:${REPLY_TO()}?subject=unsubscribe>` },
  })
  if (!r.ok) console.error('[send-email confirmation] ', r.error)
}

/* ------------------------------------------------------------------ */
/*  INTERNAL-NOTIFY — notifica interna a info@chiamamibi.com           */
/* ------------------------------------------------------------------ */

async function handleInternalNotify(req, res) {
  // Unauthenticated endpoint that delivers arbitrary user-supplied text to
  // info@chiamamibi.com. Defenses, layered:
  //   • Cloudflare Turnstile (verifyTurnstile below)
  //   • Rate-limit 3/min per IP
  //   • Strict input validation
  const limited = rateLimit(req, { key: 'send-email-internal-notify', max: 3, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const captcha = await verifyTurnstile(req)
  if (!captcha.ok) return res.status(captcha.status).json({ error: captcha.error })

  const { nome_locale, address, tags, description, nome_utente, email_utente } = req.body || {}
  if (!nome_locale || !email_utente) {
    return res.status(400).json({ error: 'Missing required fields: nome_locale, email_utente' })
  }
  // Strict email validation — esc() already runs in the template, but reject
  // anything that's not a real address up front: qui l'indirizzo finisce
  // anche nel reply-to, e un'intestazione non si ripulisce a valle.
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(email_utente).trim())) {
    return res.status(400).json({ error: 'Invalid email_utente' })
  }
  // Cap free-text field lengths to prevent oversized payloads to Resend.
  const cap = (v, n) => (v == null ? null : String(v).slice(0, n))

  const mail = internalSuggestionEmail({
    nomeLocale: cap(nome_locale, 200),
    address: cap(address, 500),
    tags: cap(tags, 500),
    description: cap(description, 2000),
    nomeUtente: cap(nome_utente, 200),
    emailUtente: String(email_utente).trim().slice(0, 254),
    // Non esiste una pagina del singolo suggerimento: si apre la lista.
    urlAdmin: `${PUBLIC_SITE}/admin/suggestions`,
  })

  const r = await sendEmail({
    to: 'info@chiamamibi.com',
    ...mail,
    // Rispondere all'email risponde a chi ha segnalato, non a noi stessi.
    replyTo: String(email_utente).trim().slice(0, 254),
  })
  if (!r.ok) {
    console.error('[send-email internal-notify] ', r.error)
    return res.status(502).json({ error: 'Failed to send email' })
  }

  // La conferma a chi ha segnalato parte da qui, dopo il captcha: prima era
  // una chiamata a parte, senza captcha, che accettava qualsiasi destinatario.
  await sendSuggestionConfirmation({
    to: String(email_utente).trim().slice(0, 254),
    nomeUtente: cap(nome_utente, 200) || '',
    nomeLocale: cap(nome_locale, 200),
  })
  return res.status(200).json({ success: true })
}
