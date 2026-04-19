/**
 * Vercel Serverless Function — Google Places Details proxy
 *
 * Scopo: recuperare orari di apertura di un locale dalla Places API (New),
 * con cache 24h su `restaurants.hours_cache` per minimizzare chiamate.
 *
 * Usage: GET /api/places-details?restaurantId=<uuid>
 *        GET /api/places-details?placeId=<ChIJ...>          (uso admin)
 *
 * Risposta:
 *   {
 *     ok: true,
 *     cached: boolean,
 *     data: {
 *       regularOpeningHours: { weekdayDescriptions, periods, openNow },
 *       currentOpeningHours: { weekdayDescriptions, periods, openNow },
 *       utcOffsetMinutes: number
 *     }
 *   }
 *
 * Fallback graceful: su errori Places API ritorna cache anche se scaduta;
 * se no cache, ritorna { ok: false, reason: 'no_data' } → il client mostra
 * il fallback "Chiama per orari".
 *
 * Env richieste:
 *   - GOOGLE_PLACES_KEY (server-only, NON VITE_)
 *   - VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 ore
const PLACES_FIELDS = [
  'regularOpeningHours',
  'currentOpeningHours',
  'utcOffsetMinutes',
  'displayName',
].join(',')

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
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
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
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
