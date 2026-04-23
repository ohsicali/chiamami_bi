/**
 * POST /api/admin-actions
 *
 * Single entry-point per azioni admin avanzate (per stare sotto al cap
 * hobby Vercel di 12 functions). Dispatch su body.action.
 *
 * Actions:
 *   - "rotate-pin"        → genera nuovo PIN 6-digit, salva su restaurants.
 *                           Body: { action, restaurant_id }
 *                           Returns: { pin: '482193' }
 *   - "toggle-disable"    → flippa restaurants.is_disabled.
 *                           Body: { action, restaurant_id, disabled }
 *                           Returns: { is_disabled: bool }
 *   - "ai-seo-suggest"    → chiama Claude Haiku 4.5 con dati ristorante,
 *                           ritorna SEO campi suggeriti.
 *                           Body: { action, restaurant_id }
 *                           Returns: { seo_title, seo_description, og_title,
 *                                      og_description, suggested_keywords }
 *   - "correct-text"      → AI text correction su singolo testo (Claude Haiku).
 *                           Body: { action, text, context }
 *                           Returns: { corrected, changed }
 *   - "search-places"     → Google Places Text Search per trovare candidates
 *                           dato nome+indirizzo. Usato per associare place_id
 *                           a un ristorante (prerequisito per orari automatici).
 *                           Body: { action, name, address? }
 *                           Returns: { candidates: [{place_id, display_name,
 *                                                    address, confidence}] }
 *
 * Auth: Bearer JWT Supabase + profiles.is_admin=true.
 */

import { createClient } from '@supabase/supabase-js'

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_VERSION = '2023-06-01'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── Auth ──
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase env' })
  }

  const token = authHeader.replace('Bearer ', '')
  const anon = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authError } = await anon.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' })

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return res.status(403).json({ error: 'Admin role required' })

  // ── Dispatch ──
  const { action } = req.body || {}
  if (!action) return res.status(400).json({ error: 'Missing action' })

  try {
    if (action === 'rotate-pin') return await rotatePin(req, res, admin)
    if (action === 'toggle-disable') return await toggleDisable(req, res, admin)
    if (action === 'ai-seo-suggest') return await aiSeoSuggest(req, res, admin)
    if (action === 'correct-text') return await correctText(req, res)
    if (action === 'search-places') return await searchPlaces(req, res)
    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error(`admin-actions/${action} failed:`, err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

/* ------------------------------------------------------------------ */
/*  rotate-pin                                                         */
/* ------------------------------------------------------------------ */
async function rotatePin(req, res, admin) {
  const { restaurant_id } = req.body || {}
  if (!restaurant_id) return res.status(400).json({ error: 'Missing restaurant_id' })

  const pin = generatePin()
  const now = new Date().toISOString()

  const { error } = await admin
    .from('restaurants')
    .update({
      verify_pin: pin,
      last_pin_rotation_at: now,
      magic_token: null, // invalidate old magic token too
      magic_token_expires_at: null,
    })
    .eq('id', restaurant_id)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ pin, last_pin_rotation_at: now })
}

/* ------------------------------------------------------------------ */
/*  toggle-disable                                                     */
/* ------------------------------------------------------------------ */
async function toggleDisable(req, res, admin) {
  const { restaurant_id, disabled } = req.body || {}
  if (!restaurant_id || typeof disabled !== 'boolean') {
    return res.status(400).json({ error: 'Missing restaurant_id or disabled' })
  }

  const { error } = await admin
    .from('restaurants')
    .update({ is_disabled: disabled })
    .eq('id', restaurant_id)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ is_disabled: disabled })
}

/* ------------------------------------------------------------------ */
/*  ai-seo-suggest                                                     */
/* ------------------------------------------------------------------ */
async function aiSeoSuggest(req, res, admin) {
  const { restaurant_id } = req.body || {}
  if (!restaurant_id) return res.status(400).json({ error: 'Missing restaurant_id' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  // Load restaurant + related dishes to feed the prompt
  const [{ data: restaurant, error: rErr }, { data: dishes }] = await Promise.all([
    admin
      .from('restaurants')
      .select('name, tagline, our_review, our_tip, category, cuisine_type, city, address, price_range, slug')
      .eq('id', restaurant_id)
      .single(),
    admin
      .from('restaurant_dishes')
      .select('title, description')
      .eq('restaurant_id', restaurant_id)
      .order('sort_order', { ascending: true })
      .limit(5),
  ])

  if (rErr || !restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' })
  }

  const prompt = buildSeoPrompt(restaurant, dishes || [])

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    console.error('Anthropic API error:', response.status, errBody)
    return res.status(502).json({ error: 'AI service error' })
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || ''
  const parsed = parseSeoJson(text)
  if (!parsed) {
    return res.status(502).json({ error: 'AI returned malformed response', raw: text })
  }

  return res.status(200).json(parsed)
}

function buildSeoPrompt(r, dishes) {
  const categories = Array.isArray(r.category) ? r.category.join(', ') : r.cuisine_type || ''
  const priceRanges = ['', '€ · economico', '€€ · medio', '€€€ · 30-50€', '€€€€ · alto']
  const priceLabel = priceRanges[r.price_range] || ''
  const dishesText = dishes.length
    ? dishes.map((d) => `- ${d.title}${d.description ? `: ${d.description}` : ''}`).join('\n')
    : '(nessun piatto specifico segnalato)'

  return `Sei un esperto SEO italiano che ottimizza schede ristorante per la Guida di Bi (chiamamibi.com), la guida curata ai migliori locali di Torino.

Ricevi i dati di un ristorante e devi generare metadati SEO in italiano, naturale, persuasivi, NON generici, che invoglino a cliccare e trasmettano curatela.

## Dati del ristorante
Nome: ${r.name}
Zona/Città: ${r.city || 'Torino'}${r.address ? ` · ${r.address}` : ''}
Categorie: ${categories || '—'}
Fascia prezzo: ${priceLabel || '—'}
Occhiello (tagline): ${r.tagline || '—'}
Racconto/voce di Bi: ${(r.our_review || '—').slice(0, 600)}
Nota di consiglio: ${(r.our_tip || '—').slice(0, 300)}
Piatti segnalati:
${dishesText}

## Regole
- TITLE: max 60 caratteri, includi nome + zona + "Guida di Bi" (o variante). Chiaro, click-worthy.
- DESCRIPTION: max 160 caratteri, first-person dalla voce di Bi se coerente, con 1 dettaglio concreto del locale (un piatto, un'atmosfera, un'unicità). Evita boilerplate SEO.
- OG_TITLE: simile al title ma può essere più conversazionale, max 70.
- OG_DESCRIPTION: versione social più emozionale, max 200.
- KEYWORDS: 5-8 keyword italiane pertinenti, miste (nome + categoria + zona + piatto + intent).

## Output
Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo prima o dopo, senza markdown code fences:
{
  "seo_title": "...",
  "seo_description": "...",
  "og_title": "...",
  "og_description": "...",
  "suggested_keywords": ["...", "...", "..."]
}`
}

function parseSeoJson(text) {
  // Try to extract JSON even if model wraps it
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const obj = JSON.parse(match[0])
    return {
      seo_title: String(obj.seo_title || '').slice(0, 80),
      seo_description: String(obj.seo_description || '').slice(0, 200),
      og_title: String(obj.og_title || obj.seo_title || '').slice(0, 90),
      og_description: String(obj.og_description || obj.seo_description || '').slice(0, 220),
      suggested_keywords: Array.isArray(obj.suggested_keywords) ? obj.suggested_keywords.slice(0, 10).map(String) : [],
    }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/*  correct-text (was /api/correct-text — inlined to stay under the    */
/*  Vercel hobby cap of 12 functions)                                  */
/* ------------------------------------------------------------------ */
async function correctText(req, res) {
  const { text, context } = req.body || {}
  const trimmedText = typeof text === 'string' ? text.trim() : ''
  if (!trimmedText) return res.status(400).json({ error: 'text required' })
  if (trimmedText.length > 4000) {
    return res.status(400).json({ error: 'Testo troppo lungo (max 4000 caratteri)' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurata' })

  const contextHint =
    context === 'restaurant review'
      ? 'This is a restaurant review written in Italian.'
      : context === 'restaurant tip'
        ? 'This is a restaurant dining tip written in Italian.'
        : 'This is Italian text about a restaurant.'

  const prompt = `${contextHint} Correggi SOLO errori grammaticali e ortografici. NON cambiare tono, stile, emoji, espressioni personali. Mantieni tutto il resto identico. Rispondi SOLO con il testo corretto, nient'altro.\n\nTesto originale:\n${trimmedText}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    console.error('Anthropic correct-text error:', response.status, errBody)
    return res.status(502).json({ error: 'AI service error' })
  }

  const data = await response.json()
  const corrected = data.content?.[0]?.text || ''
  return res.status(200).json({
    corrected: corrected || null,
    changed: corrected.trim() !== trimmedText,
  })
}

/* ------------------------------------------------------------------ */
/*  search-places — Google Places Text Search                          */
/* ------------------------------------------------------------------ */
async function searchPlaces(req, res) {
  const { name, address } = req.body || {}
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' })

  const apiKey = process.env.GOOGLE_PLACES_KEY
  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_PLACES_KEY non configurata' })

  const query = [name, address].filter(Boolean).join(' ').trim()

  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'it', regionCode: 'IT' }),
    })
    if (!r.ok) {
      const errBody = await r.text()
      console.error('Places searchText error:', r.status, errBody)
      return res.status(502).json({ error: 'Google Places API error' })
    }
    const data = await r.json()
    const places = Array.isArray(data.places) ? data.places : []
    // Rough confidence: higher when input name is contained in displayName
    const needle = name.toLowerCase().trim()
    const candidates = places.slice(0, 5).map((p) => {
      const dn = p.displayName?.text || ''
      const dnLower = dn.toLowerCase()
      let confidence = 0.4
      if (dnLower === needle) confidence = 0.95
      else if (dnLower.startsWith(needle)) confidence = 0.8
      else if (dnLower.includes(needle)) confidence = 0.65
      return {
        place_id: p.id,
        display_name: dn,
        address: p.formattedAddress || '',
        latitude: p.location?.latitude ?? null,
        longitude: p.location?.longitude ?? null,
        confidence,
      }
    })
    return res.status(200).json({ candidates })
  } catch (err) {
    console.error('search-places failed:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function generatePin() {
  // 6-digit PIN, no leading zeros stripping: exact 6 chars.
  const n = Math.floor(Math.random() * 900000) + 100000
  return String(n)
}
