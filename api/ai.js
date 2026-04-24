/**
 * POST /api/ai
 *
 * "Chiedi a Bi" — chat AI con function calling su Claude Haiku 4.5.
 *
 * Auth: opzionale (Bearer token Supabase JWT).
 *  - Utente autenticato: conversazione salvata in ai_conversations + ai_messages.
 *    Rate limit 10 richieste / minuto per utente.
 *  - Guest: effimero (nessuna persistenza). Rate limit 5 richieste / minuto per IP.
 *
 * Body:
 *   {
 *     prompt: string,                  // user message
 *     conversation_id?: uuid,          // se auth + vuole continuare chat esistente
 *     current_moment?: 'colazione'|'pranzo'|'aperitivo'|'cena'|'dopocena'
 *   }
 *
 * Response:
 *   {
 *     message: string,                 // testo Bi "bubble"
 *     results: [{                      // 2-3 ristoranti selezionati
 *       restaurant_id, slug, name, zone, price, category,
 *       open_now, closes_at, why        // "why" scritto da Bi in voce Caveat
 *     }],
 *     conversation_id?: uuid           // presente solo se auth
 *   }
 *
 * Flusso interno:
 *   1. Auth opzionale + rate limit.
 *   2. Se auth + conversation_id → carica ultimi 10 messaggi come history.
 *   3. Chiama Claude con tool `search_restaurants(filters)`.
 *   4. Se Claude usa il tool → esegue query Supabase → re-invoca Claude col
 *      tool_result → Claude produce risposta finale JSON-shape con results+why.
 *   5. Se auth → crea/aggiorna conversation + salva 2 messaggi.
 */

import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_VERSION = '2023-06-01'
const MAX_HISTORY_MSGS = 10
const MAX_RESULTS = 3
const MAX_PROMPT_LEN = 500

const MOMENT_LABELS = {
  colazione: 'colazione (06:30-10:30)',
  pranzo:    'pranzo (11:30-14:30)',
  aperitivo: 'aperitivo (17:00-20:30)',
  cena:      'cena (19:30-23:30)',
  dopocena:  'dopo cena / cocktail (22:30-02:00)',
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  maybeCleanup()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurata' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return res.status(500).json({ error: 'Server misconfigured: Supabase env' })
  }

  // ── Auth opzionale ──
  let userId = null
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    const anon = createClient(supabaseUrl, anonKey)
    const { data: { user } } = await anon.auth.getUser(token)
    if (user) userId = user.id
  }

  // ── Rate limit ──
  const limited = userId
    ? rateLimit(req, { key: `ai-auth-${userId}`, max: 10, windowMs: 60_000 })
    : rateLimit(req, { key: 'ai-guest', max: 5, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  // ── Validate body ──
  const { prompt: rawPrompt, conversation_id, current_moment } = req.body || {}
  const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : ''
  if (!prompt) return res.status(400).json({ error: 'prompt required' })
  if (prompt.length > MAX_PROMPT_LEN) {
    return res.status(400).json({ error: `prompt troppo lungo (max ${MAX_PROMPT_LEN} caratteri)` })
  }
  if (conversation_id && !userId) {
    return res.status(400).json({ error: 'conversation_id disponibile solo per utenti autenticati' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Load history (if auth + conversation_id) ──
  let history = []
  if (userId && conversation_id) {
    const { data: conv } = await admin
      .from('ai_conversations')
      .select('id, user_id')
      .eq('id', conversation_id)
      .single()
    if (!conv || conv.user_id !== userId) {
      return res.status(403).json({ error: 'Conversation not accessible' })
    }
    const { data: msgs } = await admin
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(MAX_HISTORY_MSGS)
    history = (msgs || [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: typeof m.content === 'string'
          ? m.content
          : m.content?.text || JSON.stringify(m.content),
      }))
  }

  try {
    const result = await askClaude({
      apiKey,
      admin,
      history,
      userPrompt: prompt,
      currentMoment: current_moment || null,
    })

    // ── Persist if auth ──
    let finalConversationId = conversation_id || null
    if (userId) {
      if (!finalConversationId) {
        const { data: newConv, error: convErr } = await admin
          .from('ai_conversations')
          .insert({
            user_id: userId,
            title: prompt.slice(0, 60),
          })
          .select('id')
          .single()
        if (!convErr && newConv) finalConversationId = newConv.id
      } else {
        await admin
          .from('ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', finalConversationId)
      }

      if (finalConversationId) {
        await admin.from('ai_messages').insert([
          {
            conversation_id: finalConversationId,
            role: 'user',
            content: { text: prompt },
            metadata: current_moment ? { current_moment } : null,
          },
          {
            conversation_id: finalConversationId,
            role: 'assistant',
            content: { text: result.message, results: result.results },
            metadata: { model: CLAUDE_MODEL },
          },
        ])
      }
    }

    return res.status(200).json({
      message: result.message,
      results: result.results,
      conversation_id: finalConversationId,
    })
  } catch (err) {
    console.error('ai endpoint error:', err)
    return res.status(502).json({ error: `AI service error: ${err.message}` })
  }
}

/* ------------------------------------------------------------------ */
/*  askClaude — function calling loop                                   */
/* ------------------------------------------------------------------ */
async function askClaude({ apiKey, admin, history, userPrompt, currentMoment }) {
  const system = buildSystemPrompt(currentMoment)
  const tools = [searchRestaurantsTool()]

  const messages = [
    ...history,
    { role: 'user', content: userPrompt },
  ]

  // Round 1: ask Claude
  let resp = await callClaude(apiKey, { system, messages, tools })

  // Tool loop (max 2 iterations to cap cost)
  let toolIterations = 0
  let toolResults = []
  while (resp.stop_reason === 'tool_use' && toolIterations < 4) {
    toolIterations++
    const toolUse = (resp.content || []).find((c) => c.type === 'tool_use')
    if (!toolUse) break

    const toolOutput = toolUse.name === 'search_restaurants'
      ? await executeSearch(admin, toolUse.input || {})
      : { error: `Unknown tool: ${toolUse.name}` }

    toolResults = toolOutput.results || toolResults

    messages.push({ role: 'assistant', content: resp.content })
    messages.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolOutput),
      }],
    })

    resp = await callClaude(apiKey, { system, messages, tools })
  }

  // Extract final text from assistant
  const finalText = (resp.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim()

  // Try to parse structured JSON (we ask Claude in system prompt to emit JSON)
  const parsed = tryParseFinalJson(finalText)
  if (parsed) {
    return {
      message: String(parsed.message || '').slice(0, 400),
      results: Array.isArray(parsed.results) ? parsed.results.slice(0, MAX_RESULTS) : [],
    }
  }

  // Fallback: plain text + whatever the tool returned
  return {
    message: finalText || "Non ho trovato niente che corrisponda — riprova con qualcosa di diverso?",
    results: (toolResults || []).slice(0, MAX_RESULTS).map((r) => ({
      restaurant_id: r.id,
      slug: r.slug,
      name: r.name,
      zone: r.zone,
      price: r.price,
      category: r.category,
      open_now: r.open_now,
      closes_at: r.closes_at,
      why: r.tagline || '',
    })),
  }
}

async function callClaude(apiKey, { system, messages, tools }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system,
      tools,
      messages,
    }),
  })
  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Claude HTTP ${response.status}: ${errBody.slice(0, 200)}`)
  }
  return await response.json()
}

/* ------------------------------------------------------------------ */
/*  Tool definition                                                     */
/* ------------------------------------------------------------------ */
function searchRestaurantsTool() {
  return {
    name: 'search_restaurants',
    description: 'Cerca ristoranti nel database della Guida di Bi filtrando per categoria, momento giornata, prezzo e altre caratteristiche. Ritorna fino a 5 ristoranti con info essenziali (nome, zona, prezzo, aperto ora, chiusura).',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: "Categoria cucina/tipo locale. Es: 'pizza', 'giapponese', 'cinese', 'aperitivo', 'cocktail', 'enoteca', 'piemontese', 'pesce', 'carne', 'vegano', 'colazione', 'italiana'. Lascia vuoto se non pertinente.",
        },
        moment: {
          type: 'string',
          enum: ['colazione', 'pranzo', 'aperitivo', 'cena', 'dopocena'],
          description: 'Momento della giornata per cui deve essere adatto il locale.',
        },
        price_max: {
          type: 'integer',
          description: "Fascia prezzo massima: 1=€ economico, 2=€€ medio, 3=€€€ 30-50€, 4=€€€€ alto. Usa se l'utente cita un budget.",
        },
        zone: {
          type: 'string',
          description: "Quartiere/zona Torino se citata (es: 'San Salvario', 'Centro', 'Quadrilatero', 'Vanchiglia', 'Porta Nuova', 'Crocetta').",
        },
        open_now: {
          type: 'boolean',
          description: "True se l'utente vuole un locale aperto adesso.",
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: "Parole chiave aggiuntive da cercare nel nome, tagline o recensione (es: 'romantica', 'terrazza', 'vegan', 'vini naturali').",
        },
      },
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Tool executor — query Supabase                                      */
/* ------------------------------------------------------------------ */
async function executeSearch(admin, filters) {
  let query = admin
    .from('restaurants')
    .select('id, slug, name, address, cuisine_type, category, price_range, tagline, our_review, our_tip, recommended_for, hours_cache, is_published')
    .eq('is_published', true)
    .limit(30)

  if (filters.category) {
    const cat = String(filters.category).trim().replace(/[%,{}]/g, '')
    if (cat) {
      // Matcha sia cuisine_type (case-insensitive) sia ogni elemento nell'array category.
      // array_to_string permette il match case-insensitive sugli array.
      const capitalized = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()
      query = query.or(`cuisine_type.ilike.%${cat}%,category.cs.{${cat}},category.cs.{${capitalized}}`)
    }
  }
  if (typeof filters.price_max === 'number' && filters.price_max > 0) {
    query = query.lte('price_range', filters.price_max)
  }
  if (filters.zone) {
    const zoneQuery = mapZoneToAddressPatterns(filters.zone)
    if (zoneQuery) query = query.or(zoneQuery)
  }
  if (Array.isArray(filters.tags) && filters.tags.length > 0) {
    // Soft match via 'tagline' or 'our_review' — OR concat
    const ors = filters.tags.slice(0, 3).map((t) => {
      const safe = String(t).replace(/[%,]/g, '')
      return `tagline.ilike.%${safe}%,our_review.ilike.%${safe}%`
    }).join(',')
    if (ors) query = query.or(ors)
  }

  const { data, error } = await query
  if (error) return { error: error.message, results: [] }

  const now = new Date()
  const results = (data || []).map((r) => {
    const openStatus = computeOpenStatus(r.hours_cache, now)
    const momentOk = filters.moment
      ? isOpenForMomentServer(r.hours_cache, filters.moment, now).match
      : true

    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      zone: extractZone(r.address),
      price: '€'.repeat(r.price_range || 2),
      category: Array.isArray(r.category) && r.category[0] ? r.category[0] : (r.cuisine_type || ''),
      open_now: openStatus.open,
      closes_at: openStatus.closesAt,
      tagline: r.tagline || r.our_tip || '',
      moment_match: momentOk,
    }
  })

  // Filtra per momento + open_now se richiesto
  let filtered = results
  if (filters.moment) filtered = filtered.filter((r) => r.moment_match)
  if (filters.open_now) filtered = filtered.filter((r) => r.open_now || r.closes_at == null)

  // Retry allargato: se zero risultati, prova senza zone e senza open_now
  if (filtered.length === 0 && (filters.zone || filters.open_now)) {
    const relaxed = { ...filters, zone: null, open_now: false }
    const relaxedResult = await executeSearch(admin, relaxed)
    if (relaxedResult.results && relaxedResult.results.length > 0) {
      return { results: relaxedResult.results, total: relaxedResult.total, relaxed: true }
    }
  }

  // Retry ancora più permissivo: se zero, rilassa anche price_max di +1
  if (filtered.length === 0 && typeof filters.price_max === 'number' && filters.price_max < 4) {
    const relaxed = { ...filters, zone: null, open_now: false, price_max: filters.price_max + 1 }
    const relaxedResult = await executeSearch(admin, relaxed)
    if (relaxedResult.results && relaxedResult.results.length > 0) {
      return { results: relaxedResult.results, total: relaxedResult.total, relaxed: true }
    }
  }

  return { results: filtered.slice(0, 5), total: filtered.length }
}

function extractZone(address) {
  if (!address) return ''
  const part = address.split(',')[0] || ''
  return part.trim().slice(0, 40)
}

/**
 * Mappa termini generici utente → pattern address Supabase.
 * "centro" → ILIKE su quartieri del centro storico di Torino.
 * Ritorna stringa OR per Supabase.or() o null.
 */
function mapZoneToAddressPatterns(zoneRaw) {
  if (!zoneRaw) return null
  const zone = String(zoneRaw).toLowerCase().trim().replace(/[%,]/g, '')
  if (!zone) return null

  // Alias per termini generici → quartieri concreti di Torino
  const ALIASES = {
    'centro': ['crocetta', 'san salvario', 'quadrilatero', 'porta nuova', 'porta palazzo', 'centro storico', 'piazza castello', 'via po', 'via roma', 'piazza vittorio', 'piazza san carlo', 'carlina', 'romana'],
    'centro storico': ['quadrilatero', 'porta palazzo', 'piazza castello', 'via po', 'via roma', 'piazza san carlo'],
    'centro città': ['crocetta', 'san salvario', 'quadrilatero', 'porta nuova'],
  }

  const patterns = ALIASES[zone] || [zone]
  return patterns.map(p => `address.ilike.%${p}%`).join(',')
}

function computeOpenStatus(hours, now) {
  const source = hours?.regularOpeningHours || hours?.currentOpeningHours
  if (!source?.periods?.length) return { open: null, closesAt: null }
  // riassuntivo rapido — stessa logica semplificata di getHoursStatus
  const offset = typeof hours?.utcOffsetMinutes === 'number' ? hours.utcOffsetMinutes : null
  const shifted = offset != null ? new Date(now.getTime() + offset * 60_000) : now
  const dow = offset != null ? shifted.getUTCDay() : shifted.getDay()
  const nowMin = (offset != null ? shifted.getUTCHours() : shifted.getHours()) * 60
    + (offset != null ? shifted.getUTCMinutes() : shifted.getMinutes())

  for (const p of source.periods) {
    if (p.open?.day == null) continue
    const openMin = (p.open.hour || 0) * 60 + (p.open.minute || 0)
    if (!p.close) {
      if (dow === p.open.day) return { open: true, closesAt: null }
      continue
    }
    const closeMinRaw = (p.close.hour || 0) * 60 + (p.close.minute || 0)
    if (p.open.day === p.close.day) {
      const eff = closeMinRaw <= openMin ? 24 * 60 : closeMinRaw
      if (dow === p.open.day && nowMin >= openMin && nowMin < eff) {
        return { open: true, closesAt: fmt(p.close.hour, p.close.minute) }
      }
    } else {
      if (dow === p.open.day && nowMin >= openMin) {
        return { open: true, closesAt: fmt(p.close.hour, p.close.minute) }
      }
      if (dow === p.close.day && nowMin < closeMinRaw) {
        return { open: true, closesAt: fmt(p.close.hour, p.close.minute) }
      }
    }
  }
  return { open: false, closesAt: null }
}

function fmt(h, m) {
  return `${String(h || 0).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
}

// Minimal server-side reimpl of isOpenForMoment (can't import frontend src/lib)
function isOpenForMomentServer(hours, moment, now) {
  const SLOTS = {
    colazione: { startMin:  6 * 60 + 30, endMin: 10 * 60 + 30 },
    pranzo:    { startMin: 11 * 60 + 30, endMin: 14 * 60 + 30 },
    aperitivo: { startMin: 17 * 60,      endMin: 20 * 60 + 30 },
    cena:      { startMin: 19 * 60 + 30, endMin: 23 * 60 + 30 },
    dopocena:  { startMin: 22 * 60 + 30, endMin: 26 * 60 },
  }
  if (!SLOTS[moment]) return { match: false }
  const source = hours?.regularOpeningHours || hours?.currentOpeningHours
  if (!source?.periods?.length) return { match: true, verified: false }
  const slot = SLOTS[moment]
  const offset = typeof hours?.utcOffsetMinutes === 'number' ? hours.utcOffsetMinutes : null
  const shifted = offset != null ? new Date(now.getTime() + offset * 60_000) : now
  const dow = offset != null ? shifted.getUTCDay() : shifted.getDay()

  for (const p of source.periods) {
    if (p.open?.day !== dow) continue
    const openMin = (p.open.hour || 0) * 60 + (p.open.minute || 0)
    let closeMin = p.close ? (p.close.hour || 0) * 60 + (p.close.minute || 0) : 24 * 60
    if (p.close && p.close.day !== p.open.day) closeMin += 24 * 60
    if (closeMin <= openMin) closeMin = 24 * 60
    const overlapStart = Math.max(openMin, slot.startMin)
    const overlapEnd = Math.min(closeMin, slot.endMin)
    if (overlapEnd > overlapStart) return { match: true, verified: true }
  }
  return { match: false, verified: true }
}

/* ------------------------------------------------------------------ */
/*  System prompt                                                       */
/* ------------------------------------------------------------------ */
function buildSystemPrompt(currentMoment) {
  const momentHint = currentMoment && MOMENT_LABELS[currentMoment]
    ? `\nMomento corrente: ${MOMENT_LABELS[currentMoment]}.`
    : ''

  return `Sei Bi, l'autrice della Guida di Bi (chiamamibi.com), una guida curata ai migliori locali di Torino.
Parli in prima persona, tono amichevole, diretto, italiano naturale. Non usi emoji in eccesso, mai superlativi vuoti.${momentHint}

STRATEGIA DI RICERCA:
1. Chiama search_restaurants con i filtri più rilevanti (categoria, momento, prezzo, zona se citata).
2. Se il tool torna 0 risultati, NON rispondere "non trovo niente" al primo tentativo — RICHIAMA il tool con filtri progressivamente rilassati:
   - Primo retry: rimuovi zone, mantieni categoria e prezzo.
   - Secondo retry: alza price_max di 1, tieni solo la categoria.
   - Terzo retry: prova solo con tags[] estratti dal prompt.
3. Se dopo 2-3 retry ancora 0 risultati, rispondi onestamente.

ZONE DI TORINO (pattern comuni):
- "centro" / "in centro" / "centro città" → zone candidate: Crocetta, San Salvario, Quadrilatero, Porta Nuova, Porta Palazzo, Centro Storico, Piazza Castello. Passa "centro" come zone al tool — il server espande il mapping.
- "San Salvario", "Vanchiglia", "Crocetta", "Quadrilatero" ecc. → passa letterale.

CATEGORIE COMUNI (es. in italiano):
- "piemontese", "italiana", "pizza", "giapponese", "cinese", "pesce", "carne", "vegano", "cocktail", "enoteca", "aperitivo", "bistrot", "trattoria", "fusion".

VOCE:
- Prima persona: "io ci sono stata", "ti consiglierei", "secondo me".
- Niente asterischi markdown, niente titoli H#, niente liste bullet.
- Risposta "message": 1-2 frasi max. Risultati: massimo 3.
- Per ogni risultato scrivi una "why" di 1 riga (max 60 caratteri) in tono Bi, come fosse un pensiero scritto a mano: "Per te, stasera.", "Piccolo, silenzioso.", "Se vuoi partire bene.", "Il vitello tonnato non ha rivali.". Evita formule generiche.

OUTPUT FORMAT (DEVI rispondere ESCLUSIVAMENTE con JSON valido, niente testo extra prima o dopo, niente code fences):
{
  "message": "testo della bolla Bi, 1-2 frasi, prima persona",
  "results": [
    {
      "restaurant_id": "<id dal tool>",
      "slug": "<slug>",
      "name": "<nome>",
      "zone": "<quartiere>",
      "price": "€€",
      "category": "<categoria>",
      "open_now": true,
      "closes_at": "23:30",
      "why": "<1 riga Bi handwriting>"
    }
  ]
}

Se dopo tutti i retry il tool torna 0 risultati, rispondi con results vuoto e un message onesto ma caldo: "Nel database non ho nessun posto con quelle caratteristiche precise — vuoi che allarghiamo?" o simile.`
}

function tryParseFinalJson(text) {
  if (!text) return null
  // Strip code fences if present
  const cleaned = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}
