/**
 * Vercel Serverless Function — Google Places hours refresh / backfill
 *
 * Aggiorna `restaurants.hours_cache` per i locali pubblicati con cache mancante
 * o più vecchia di STALE_DAYS. Risponde sia al cron settimanale di Vercel
 * (header Authorization: Bearer $CRON_SECRET) sia a una chiamata manuale con
 * lo stesso secret per il backfill iniziale.
 *
 * Cosa scarica da Google Places (API New, /v1/places/{placeId}):
 *  - regularOpeningHours   → orari "tipo" della settimana
 *  - currentOpeningHours   → orari effettivi della settimana corrente,
 *                            con specialDays mergiati (festivi, chiusure,
 *                            aperture straordinarie). api/ai.js privilegia
 *                            questo per il calcolo "aperto adesso".
 *  - utcOffsetMinutes      → necessario per confrontare l'ora del server
 *                            con l'ora locale del locale.
 *
 * Scelte:
 *  - Una run processa MAX_PER_RUN locali (oldest cache first, null first).
 *    Con 72 locali il primo run li copre quasi tutti; i successivi rinfrescano
 *    in rotazione.
 *  - Throttle 200ms fra le chiamate Places: stiamo larghi sui quota.
 *  - Errori per-locale non interrompono il batch.
 *
 * Env richieste:
 *  - GOOGLE_PLACES_KEY (server-only)
 *  - CRON_SECRET (Vercel lo invia in Authorization header per i cron)
 *  - VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'

const PLACES_FIELDS = [
  'regularOpeningHours',
  'currentOpeningHours',
  'utcOffsetMinutes',
  'displayName',
].join(',')

const STALE_DAYS = 7
const MAX_PER_RUN = 50
const THROTTLE_MS = 200

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const apiKey = process.env.GOOGLE_PLACES_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_PLACES_KEY not configured' })
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return res.status(500).json({ error: 'Supabase env missing' })

  // Due percorsi di auth:
  //  - Cron Vercel: Authorization: Bearer $CRON_SECRET (settimanale automatico).
  //  - Admin manuale: Authorization: Bearer <supabase JWT> di un utente con
  //    profiles.is_admin = true (bottone "Sincronizza orari" in /admin).
  // Se nessuno dei due passa → 401.
  const auth = req.headers.authorization || ''
  const cronSecret = process.env.CRON_SECRET
  let authedAs = null

  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    authedAs = 'cron'
  } else if (auth.startsWith('Bearer ')) {
    const token = auth.replace('Bearer ', '')
    const anon = createClient(supabaseUrl, anonKey)
    const { data: { user } } = await anon.auth.getUser(token)
    if (user) {
      const adminCheck = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: prof } = await adminCheck
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle()
      if (prof?.is_admin === true) authedAs = 'admin'
    }
  }

  if (!authedAs) return res.status(401).json({ error: 'unauthorized' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Locali pubblicati con place_id e (cache null O più vecchia di STALE_DAYS).
  // Ordine: null prima, poi più vecchi → backfill copre i mancanti per primi.
  const { data: stale, error: qErr } = await supabase
    .from('restaurants')
    .select('id, name, place_id, hours_cache_updated_at')
    .eq('is_published', true)
    .not('place_id', 'is', null)
    .or(`hours_cache.is.null,hours_cache_updated_at.lt.${staleCutoff}`)
    .order('hours_cache_updated_at', { ascending: true, nullsFirst: true })
    .limit(MAX_PER_RUN)

  if (qErr) return res.status(500).json({ error: qErr.message })

  const startedAt = Date.now()
  const results = {
    candidates: (stale || []).length,
    succeeded: 0,
    failed: 0,
    errors: [],
  }

  for (const r of (stale || [])) {
    try {
      const placesRes = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(r.place_id)}?languageCode=it&regionCode=IT`,
        {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': PLACES_FIELDS,
          },
        }
      )
      if (!placesRes.ok) {
        results.failed++
        const errText = await placesRes.text().catch(() => '')
        results.errors.push({
          id: r.id,
          name: r.name,
          status: placesRes.status,
          body: errText.slice(0, 120),
        })
        continue
      }
      const placesData = await placesRes.json()
      const { error: upErr } = await supabase
        .from('restaurants')
        .update({
          hours_cache: placesData,
          hours_cache_updated_at: new Date().toISOString(),
        })
        .eq('id', r.id)
      if (upErr) {
        results.failed++
        results.errors.push({ id: r.id, name: r.name, error: upErr.message })
      } else {
        results.succeeded++
      }
    } catch (err) {
      results.failed++
      results.errors.push({ id: r.id, name: r.name, error: err?.message || String(err) })
    }
    if (Date.now() - startedAt > 50_000) break // safety: lascia 10s di margine
    await new Promise((r) => setTimeout(r, THROTTLE_MS))
  }

  return res.status(200).json({
    ok: true,
    triggered_by: authedAs,
    elapsed_ms: Date.now() - startedAt,
    ...results,
  })
}
