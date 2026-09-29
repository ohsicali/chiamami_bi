/**
 * Vercel Serverless Function — Broadcast notification to newsletter subscribers
 *
 * POST body: { type: 'restaurant' | 'discount' | 'drop', id: uuid, force?: boolean }
 *
 * - Admin-only (Bearer token → profiles.is_admin = true)
 * - Fetches the target item, builds an HTML email, loops over
 *   newsletter_subscribers and sends via Resend.
 * - Writes to email_notifications_log to prevent duplicate sends unless
 *   `force: true` is passed.
 *
 * In più, il giro quotidiano dei promemoria (sconti presi e non usati):
 * - GET  ?job=discount-reminders  → dal cron di Vercel (vercel.json), con
 *   `Authorization: Bearer $CRON_SECRET`. Vive qui e non in un file suo per
 *   il cap di 12 funzioni del piano Hobby. Le regole in _email/reminders.js.
 * - POST { type: 'discount-reminders', dryRun?: boolean } → lo stesso giro
 *   lanciato a mano da un admin; con `dryRun` dice chi riceverebbe cosa
 *   senza spedire niente.
 *
 * E le email "com'è andata?" dopo uno sconto convalidato (_email/feedback.js):
 * - GET  ?job=feedback-asks → ogni 10 minuti da pg_cron (token nel Vault);
 * - POST { type: 'feedback-asks', dryRun?: boolean } → a mano, da admin.
 *
 * E le uscite programmate di locali e sconti (_scheduled-publish.js):
 * - GET  ?job=scheduled-publish → ogni 5 minuti da pg_cron (stesso token);
 * - POST { type: 'scheduled-publish', dryRun?: boolean } → a mano, da admin.
 *
 * L'annuncio vero e proprio (registro, destinatari, template) sta in
 * _email/announce.js: lo usano sia il bottone dell'admin sia le uscite
 * programmate.
 */
import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'
import { applyCors } from './_cors.js'
import { announce } from './_email/announce.js'
import { runDiscountReminders } from './_email/reminders.js'
import { runFeedbackAsks } from './_email/feedback.js'
import { runScheduledPublish } from './_scheduled-publish.js'

// Quanto può essere "giovane" uno sconto per l'annuncio automatico alla
// creazione (`onCreate`). Largo abbastanza per un salvataggio lento con le
// foto dei prodotti, stretto abbastanza da escludere qualunque modifica.
const CREATE_WINDOW_MS = 15 * 60 * 1000

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method === 'GET' && req.query?.job === 'discount-reminders') return handleReminderCron(req, res)
  if (req.method === 'GET' && req.query?.job === 'feedback-asks') return handleFeedbackCron(req, res)
  if (req.method === 'GET' && req.query?.job === 'scheduled-publish') return handleScheduledPublishCron(req, res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  maybeCleanup()
  const limited = rateLimit(req, { key: 'notify-subscribers', max: 10, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const resendKey = process.env.RESEND_API_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return res.status(500).json({ error: 'Server configuration error: missing Supabase env vars' })
  }
  if (!resendKey) {
    return res.status(500).json({ error: 'Server configuration error: missing RESEND_API_KEY' })
  }

  // Verify caller is an authenticated admin.
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

  const { type, id, force, onCreate } = req.body || {}
  if (type === 'scheduled-publish') {
    try {
      return res.status(200).json(await runScheduledPublish(admin, { dryRun: !!req.body?.dryRun }))
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }
  if (type === 'feedback-asks') {
    try {
      return res.status(200).json(await runFeedbackAsks(admin, { dryRun: !!req.body?.dryRun }))
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }
  if (type === 'discount-reminders') {
    try {
      const summary = await runDiscountReminders(admin, { dryRun: !!req.body?.dryRun })
      return res.status(200).json(summary)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }
  if (!type || !id) return res.status(400).json({ error: 'type and id required' })
  if (!['restaurant', 'discount', 'drop'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' })
  }

  // L'annuncio automatico del pannello sconti (`onCreate`) vale solo per uno
  // sconto appena nato. Se arriva per uno vecchio, qualcosa nel client ha
  // scambiato una modifica per una creazione: meglio nessuna email che
  // riannunciare a tutti uno sconto a cui è stata corretta una didascalia.
  if (onCreate && (type === 'discount' || type === 'drop')) {
    const { data: row } = await admin.from('discounts').select('created_at').eq('id', id).maybeSingle()
    const age = row?.created_at ? Date.now() - new Date(row.created_at).getTime() : Infinity
    if (!(age < CREATE_WINDOW_MS)) {
      return res.status(409).json({ error: 'Not a new discount: automatic announcement skipped' })
    }
  }

  const out = await announce(admin, { type, id, force: !!force, sentBy: user.id })
  return res.status(out.status).json(out.body)
}

/**
 * Il giro dei promemoria lanciato dal cron di Vercel.
 *
 * Vercel chiama con GET e mette da sé `Authorization: Bearer $CRON_SECRET`.
 * Senza la variabile impostata il giro non parte affatto: un endpoint che
 * spedisce email a centinaia di persone non resta aperto per distrazione.
 */
async function handleReminderCron(req, res) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey || !process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error' })
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  try {
    const summary = await runDiscountReminders(admin)
    console.log('[discount-reminders]', JSON.stringify({ ...summary, errors: summary.errors.slice(0, 5) }))
    return res.status(200).json(summary)
  } catch (err) {
    console.error('[discount-reminders]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

/**
 * Chi chiama un giro da pg_cron si fa riconoscere col token che il DB tiene
 * nel Vault: lo si verifica con la RPC `cron_token_ok`, così il segreto non
 * va copiato su Vercel. Vale anche `CRON_SECRET`, per lanciarlo a mano.
 * Ritorna il client service role, o null (e ha già risposto) se non passa.
 */
async function cronClient(req, res, rateKey) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey || !process.env.RESEND_API_KEY) {
    res.status(500).json({ error: 'Server configuration error' })
    return null
  }
  const limited = rateLimit(req, { key: rateKey, max: 6, windowMs: 60_000 })
  if (limited) {
    res.status(429).json({ error: limited })
    return null
  }

  const header = String(req.headers.authorization || '')
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const secret = process.env.CRON_SECRET
  let ok = !!secret && token === secret
  if (!ok) {
    const { data } = await admin.rpc('cron_token_ok', { p_token: token })
    ok = data === true
  }
  if (!ok) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  return admin
}

/**
 * GET ?job=feedback-asks — le email "com'è andata?" dopo uno sconto
 * convalidato (regole in _email/feedback.js). Parte ogni 10 minuti da
 * pg_cron (supabase/redemption-feedback-cron-2026-09-29.sql).
 */
async function handleFeedbackCron(req, res) {
  const admin = await cronClient(req, res, 'feedback-cron')
  if (!admin) return

  try {
    const summary = await runFeedbackAsks(admin)
    if (summary.planned || summary.errors.length) {
      console.log('[feedback-asks]', JSON.stringify({ ...summary, errors: summary.errors.slice(0, 5) }))
    }
    return res.status(200).json(summary)
  } catch (err) {
    console.error('[feedback-asks]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

/**
 * GET ?job=scheduled-publish — mette online i locali e gli sconti la cui
 * uscita programmata è arrivata, e manda gli annunci. Ogni 5 minuti da
 * pg_cron (supabase/scheduled-publish-cron-2026-09-29.sql).
 */
async function handleScheduledPublishCron(req, res) {
  const admin = await cronClient(req, res, 'scheduled-publish-cron')
  if (!admin) return

  try {
    const summary = await runScheduledPublish(admin)
    if (summary.published.length || summary.errors.length) {
      console.log('[scheduled-publish]', JSON.stringify(summary))
    }
    return res.status(200).json(summary)
  } catch (err) {
    console.error('[scheduled-publish]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
