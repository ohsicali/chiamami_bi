/**
 * Vercel Serverless Function — Impression e click sui banner
 *
 * Stessa impostazione di `api/track.js`, e per lo stesso motivo: la scrittura
 * avviene con il service role, così `ad_events` resta chiusa alla chiave
 * pubblica e un visitatore non può fabbricare impression.
 *
 * Qui la cosa pesa più che altrove: su questi numeri si fattura. Se chiunque
 * potesse gonfiare le viste di una campagna dal browser, il report al cliente
 * non varrebbe niente.
 */

import { applyCors } from './_cors.js'
import { rateLimit } from './_rate-limit.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EVENT_TYPES = new Set(['impression', 'click'])

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Un visitatore vero fa al massimo qualche evento per pagina. Il tetto serve
  // contro il flooding; scartare un evento oltre soglia non fa danno.
  const limited = rateLimit(req, { key: 'ad-event', max: 120, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const body = req.body || {}

  const placement_id = typeof body.placement_id === 'string' && UUID_RE.test(body.placement_id)
    ? body.placement_id
    : null
  const slot = typeof body.slot === 'string' ? body.slot.slice(0, 64) : null
  const event_type = EVENT_TYPES.has(body.event_type) ? body.event_type : null
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
    console.error('ad-event error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
