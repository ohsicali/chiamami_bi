/**
 * Vercel Serverless Function — Google Places Details proxy + bulk refresh
 *
 * Due modalità:
 *  - GET  /api/places-details?restaurantId=<uuid>   → single lookup, cache 24h.
 *  - GET  /api/places-details?placeId=<ChIJ...>     → admin lookup (no cache).
 *  - POST /api/places-details                       → bulk refresh hours_cache
 *      Auth: Bearer $CRON_SECRET (cron) o JWT Supabase admin.
 *      Aggiorna fino a MAX_BULK_PER_RUN locali con cache null o vecchia di
 *      BULK_STALE_DAYS giorni. Throttle 200ms fra le chiamate Places.
 *
 * Risposta GET:
 *   { ok: true, cached: boolean, data: { regularOpeningHours, currentOpeningHours, utcOffsetMinutes } }
 *
 * Risposta POST:
 *   { ok: true, triggered_by: 'cron'|'admin', candidates, succeeded, failed, errors[], elapsed_ms }
 *
 * Cosa scarica da Google (entrambe le modalità):
 *  - regularOpeningHours · orari "tipo" settimanali
 *  - currentOpeningHours · settimana corrente con specialDays mergiati
 *    (festivi, chiusure, aperture straordinarie). api/ai.js privilegia
 *    questo per il calcolo "aperto adesso".
 *  - utcOffsetMinutes · confronto ora locale del locale.
 *
 * Fallback graceful sul GET: su errori Places API ritorna cache anche se
 * scaduta; se no cache, { ok: false, reason: 'no_data' }.
 *
 * Env richieste:
 *   - GOOGLE_PLACES_KEY (server-only, NON VITE_)
 *   - VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ ANON_KEY per il bulk)
 *   - CRON_SECRET (opzionale: per chiamate cron future)
 */
import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'
import { applyCors } from './_cors.js'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 ore
const PLACES_FIELDS = [
  'regularOpeningHours',
  'currentOpeningHours',
  'utcOffsetMinutes',
  'displayName',
].join(',')

// Bulk refresh tuning
const BULK_STALE_DAYS = 7
const BULK_MAX_PER_RUN = 50
const BULK_THROTTLE_MS = 200
const BULK_TIME_BUDGET_MS = 50_000   // lascia ~10s di margine sotto maxDuration

export default async function handler(req, res) {
  if (applyCors(req, res, { methods: 'GET, POST, OPTIONS' })) return
  if (req.method === 'POST') return handleBulkRefresh(req, res)
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  maybeCleanup()
  const limited = rateLimit(req, { key: 'places-details', max: 60, windowMs: 60_000 })
  if (limited) return res.status(429).json({ ok: false, error: limited })

  const apiKey = process.env.GOOGLE_PLACES_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiKey) return res.status(500).json({ ok: false, error: 'Places API not configured' })
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ ok: false, error: 'Supabase not configured' })

  const { restaurantId, placeId: placeIdParam } = req.query
  if (!restaurantId && !placeIdParam) {
    return res.status(400).json({ ok: false, error: 'restaurantId or placeId required' })
  }

  // The restaurantId path is public and DB-cached (cheap). A direct placeId
  // lookup bypasses the cache and bills the Google Places API per call, so it
  // is admin-only — no public client uses it.
  if (placeIdParam && !restaurantId) {
    const auth = req.headers.authorization || ''
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    let isAdmin = false
    if (anonKey && auth.startsWith('Bearer ')) {
      const token = auth.replace('Bearer ', '')
      const anon = createClient(supabaseUrl, anonKey)
      const { data: { user } = {} } = await anon.auth.getUser(token)
      if (user) {
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const { data: prof } = await adminClient
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle()
        isAdmin = prof?.is_admin === true
      }
    }
    if (!isAdmin) return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let placeId = placeIdParam
  let cachedRow = null

  if (restaurantId) {
    const { data, error } = await supabase
      .from('restaurants')
      .select('place_id, place_id_verified_at, hours_cache, hours_cache_updated_at')
      .eq('id', restaurantId)
      .maybeSingle()
    if (error) {
      return res.status(500).json({ ok: false, error: 'Restaurant lookup failed' })
    }
    if (!data?.place_id || !data.place_id_verified_at) {
      return res.status(200).json({ ok: false, reason: 'no_place_id' })
    }
    placeId = data.place_id
    cachedRow = data
  }

  const now = Date.now()
  const cacheAge = cachedRow?.hours_cache_updated_at
    ? now - new Date(cachedRow.hours_cache_updated_at).getTime()
    : Infinity

  if (cachedRow?.hours_cache && cacheAge < CACHE_TTL_MS) {
    return res.status(200).json({ ok: true, cached: true, data: cachedRow.hours_cache })
  }

  let placesData
  try {
    const placesRes = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=it&regionCode=IT`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': PLACES_FIELDS,
        },
      }
    )
    if (!placesRes.ok) {
      const errText = await placesRes.text().catch(() => '')
      console.warn('Places API error', placesRes.status, errText.slice(0, 200))
      if (cachedRow?.hours_cache) {
        return res.status(200).json({ ok: true, cached: true, stale: true, data: cachedRow.hours_cache })
      }
      return res.status(200).json({ ok: false, reason: 'api_error' })
    }
    placesData = await placesRes.json()
  } catch (err) {
    console.error('Places fetch failed:', err?.message || err)
    if (cachedRow?.hours_cache) {
      return res.status(200).json({ ok: true, cached: true, stale: true, data: cachedRow.hours_cache })
    }
    return res.status(200).json({ ok: false, reason: 'network_error' })
  }

  if (restaurantId) {
    await supabase
      .from('restaurants')
      .update({
        hours_cache: placesData,
        hours_cache_updated_at: new Date().toISOString(),
      })
      .eq('id', restaurantId)
  }

  return res.status(200).json({ ok: true, cached: false, data: placesData })
}

/* ------------------------------------------------------------------ */
/*  Bulk refresh (POST)                                                 */
/*                                                                     */
/*  Aggiorna hours_cache per i locali con cache mancante o stale.      */
/*  Pensato per essere triggerato dal bottone admin /admin → "Sincro-  */
/*  nizza orari" o (in futuro) da un cron Vercel.                      */
/* ------------------------------------------------------------------ */
async function handleBulkRefresh(req, res) {
  const apiKey = process.env.GOOGLE_PLACES_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!apiKey) return res.status(500).json({ ok: false, error: 'GOOGLE_PLACES_KEY not configured' })
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return res.status(500).json({ ok: false, error: 'Supabase env missing' })
  }

  // Auth: o $CRON_SECRET, o JWT di admin (profiles.is_admin = true).
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
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: prof } = await admin
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle()
      if (prof?.is_admin === true) authedAs = 'admin'
    }
  }
  if (!authedAs) return res.status(401).json({ ok: false, error: 'unauthorized' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const staleCutoff = new Date(Date.now() - BULK_STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  // Cache null prima, poi più vecchie → backfill copre i mancanti per primi.
  const { data: stale, error: qErr } = await supabase
    .from('restaurants')
    .select('id, name, place_id, hours_cache_updated_at')
    .eq('is_published', true)
    .not('place_id', 'is', null)
    .or(`hours_cache.is.null,hours_cache_updated_at.lt.${staleCutoff}`)
    .order('hours_cache_updated_at', { ascending: true, nullsFirst: true })
    .limit(BULK_MAX_PER_RUN)
  if (qErr) return res.status(500).json({ ok: false, error: qErr.message })

  const startedAt = Date.now()
  const out = {
    ok: true,
    triggered_by: authedAs,
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
        out.failed++
        const errText = await placesRes.text().catch(() => '')
        out.errors.push({ id: r.id, name: r.name, status: placesRes.status, body: errText.slice(0, 120) })
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
        out.failed++
        out.errors.push({ id: r.id, name: r.name, error: upErr.message })
      } else {
        out.succeeded++
      }
    } catch (err) {
      out.failed++
      out.errors.push({ id: r.id, name: r.name, error: err?.message || String(err) })
    }
    if (Date.now() - startedAt > BULK_TIME_BUDGET_MS) break
    await new Promise((r) => setTimeout(r, BULK_THROTTLE_MS))
  }

  out.elapsed_ms = Date.now() - startedAt
  return res.status(200).json(out)
}
