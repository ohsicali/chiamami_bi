/**
 * Vercel Serverless Function — Tracking (visite di pagina + banner)
 *
 * Receives page view events from the client and enriches them with
 * geo data (country, city) from Vercel edge headers before inserting
 * into Supabase. The headers `x-vercel-ip-country` and `x-vercel-ip-city`
 * are only available server-side, so this endpoint is the only way to
 * capture visitor location without exposing API keys or using a 3rd-party
 * geolocation service.
 *
 * Also derives a simple device_type (mobile/tablet/desktop) from the UA.
 *
 * Gestisce anche impression e click sui banner (`kind: 'ad_event'`), per lo
 * stesso motivo di sicurezza: la scrittura avviene con il service role, così
 * `ad_events` resta chiusa alla chiave pubblica e nessuno può fabbricare
 * impression dal browser — sono numeri su cui si fattura.
 *
 * I due eventi condividono una funzione invece di averne una a testa perché
 * il piano Vercel del progetto ne ammette 12 per deploy, e siamo al limite:
 * un file in più fa fallire il deploy dell'intero sito.
 */

import { applyCors } from './_cors.js'
import { rateLimit } from './_rate-limit.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AD_EVENT_TYPES = new Set(['impression', 'click'])

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // This endpoint writes with the service role and is unauthenticated, so cap
  // abusive flooding (analytics spam / table poisoning). Generous limit: a real
  // visitor never approaches it; dropping an over-limit event is harmless.
  const limited = rateLimit(req, { key: 'track', max: 120, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const body = req.body || {}

  if (body.kind === 'ad_event') return handleAdEvent(res, body)

  // Constrain attacker-controlled fields: cap lengths and only accept a
  // well-formed UUID for user_id (otherwise events could be attributed to
  // arbitrary users).
  const path = typeof body.path === 'string' ? body.path.slice(0, 512) : null
  const session_id = typeof body.session_id === 'string' ? body.session_id.slice(0, 128) : null
  const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 512) : null
  const user_id = typeof body.user_id === 'string' && UUID_RE.test(body.user_id) ? body.user_id : null

  if (!path || !session_id) {
    return res.status(400).json({ error: 'Missing path or session_id' })
  }

  // Don't track admin routes server-side either (defense in depth)
  if (String(path).startsWith('/admin')) {
    return res.status(200).json({ ok: true, skipped: true })
  }

  // Geo from Vercel edge headers (available on Vercel Edge/Serverless runtime)
  const country = req.headers['x-vercel-ip-country'] || null
  const city = decodeCity(req.headers['x-vercel-ip-city']) || null
  const region = req.headers['x-vercel-ip-country-region'] || null

  // User agent and device type
  const ua = String(req.headers['user-agent'] || '').slice(0, 255)
  const device_type = detectDevice(ua)

  // Insert into Supabase via REST (service role preferred)
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    // Tracking writes use the service role only: this keeps page_views
    // locked down at the RLS level (no public INSERT policy needed) and
    // avoids exposing write access to the anon key.
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' })
    }

    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/page_views`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        path,
        user_id,
        session_id,
        referrer,
        user_agent: ua || null,
        country,
        city,
        region,
        device_type,
      }),
    })

    if (!dbResponse.ok) {
      const errText = await dbResponse.text()
      console.error('page_views insert failed:', dbResponse.status, errText)
      return res.status(500).json({ error: 'DB insert failed' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('track error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

/**
 * Impression e click sui banner. Stessa impostazione della visita di pagina:
 * campi vincolati e scrittura con il service role.
 */
async function handleAdEvent(res, body) {
  const placement_id = typeof body.placement_id === 'string' && UUID_RE.test(body.placement_id)
    ? body.placement_id
    : null
  const slot = typeof body.slot === 'string' ? body.slot.slice(0, 64) : null
  const event_type = AD_EVENT_TYPES.has(body.event_type) ? body.event_type : null
  const session_id = typeof body.session_id === 'string' ? body.session_id.slice(0, 128) : null

  if (!placement_id || !slot || !event_type) {
    return res.status(400).json({ error: 'Missing placement_id, slot or event_type' })
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' })
    }

    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/ad_events`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ placement_id, slot, event_type, session_id }),
    })

    if (!dbResponse.ok) {
      const errText = await dbResponse.text()
      console.error('ad_events insert failed:', dbResponse.status, errText)
      return res.status(500).json({ error: 'DB insert failed' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('ad event error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

function decodeCity(raw) {
  if (!raw) return null
  try {
    return decodeURIComponent(String(raw))
  } catch {
    return String(raw)
  }
}

function detectDevice(ua) {
  if (!ua) return 'unknown'
  const s = ua.toLowerCase()
  if (/ipad|tablet|playbook|silk/.test(s)) return 'tablet'
  if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/.test(s)) return 'mobile'
  return 'desktop'
}
