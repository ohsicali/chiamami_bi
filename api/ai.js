/**
 * POST /api/ai
 *
 * "Chiedi a Bi" — chat AI con function calling su Claude.
 *
 * Auth: richiesta (Bearer token Supabase JWT). Rate limit 10 req/min per utente.
 *
 * Body:
 *   {
 *     prompt: string,                  // user message
 *     conversation_id?: uuid,          // per continuare chat esistente
 *     current_moment?: 'colazione'|'pranzo'|'aperitivo'|'cena'|'dopocena'
 *   }
 *
 * Response:
 *   {
 *     message: string,                 // testo Bi "bubble" in prosa naturale
 *     results: [{
 *       restaurant_id, slug, name, zone, price, category,
 *       open_now, closes_at, why
 *     }],
 *     conversation_id: uuid
 *   }
 *
 * Architettura conversazione:
 *  1. Round 1: Claude vede system+prompt+history e chiama `search_restaurants`.
 *  2. Round 2: tool_result rientra con candidati ricchi (editoriale completo).
 *     Claude risponde con BLOCCO TESTO (la voce di Bi) + tool_use `present_picks`
 *     che contiene la lista strutturata {id, why}. Stop_reason = 'tool_use'.
 *  3. Lato server: estraiamo testo + picks, joinamo coi candidati per ricostruire
 *     i campi di display. Non serve un altro round.
 *
 * Migliorie rispetto alla v1 (PR20):
 *  - Sonnet 4.6 al posto di Haiku 4.5 → italiano molto più fluido.
 *  - Prompt caching sul system (≈90% sconto sui token system dopo la prima call).
 *  - Tool restituisce a Claude i testi editoriali completi (our_review excerpt,
 *    our_tip, recommended_for, rating). Prima vedeva solo tagline → consigli alla cieca.
 *  - History pulita: estrae solo `content.text`, niente JSON.stringify.
 *  - Full-text italiano (search_tsv + websearch_to_tsquery) al posto di ILIKE,
 *    matcha "agnolotto" ↔ "agnolotti", "fassona" ↔ "fassone" ecc.
 *  - Filtro `recommended_for` sui tag editoriali ("Cena romantica", "Brunch", …).
 *  - Moments: priorità al tag manuale dell'admin, orario solo come tie-break.
 *  - Output strutturato via secondo tool `present_picks` invece di JSON-in-text:
 *    il messaggio resta prosa libera, niente sintassi a strangolare la voce.
 */

import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'
import { applyCors } from './_cors.js'

const CLAUDE_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_VERSION = '2023-06-01'
const MAX_HISTORY_MSGS = 10
const MAX_RESULTS = 3
const MAX_PROMPT_LEN = 500
const MAX_TOOL_ITERATIONS = 4

const MOMENT_LABELS = {
  colazione: 'colazione (06:30-10:30)',
  pranzo:    'pranzo (11:30-14:30)',
  aperitivo: 'aperitivo (17:00-20:30)',
  cena:      'cena (19:30-23:30)',
  dopocena:  'dopo cena / cocktail (22:30-02:00)',
}

const RECOMMENDED_FOR_TAGS = [
  'Prezzo accessibile', 'Tradizione', 'Gruppo di amici', 'Esperienza unica',
  'Appuntamento', 'Famiglia', 'Cena romantica', 'Aperitivo', 'Vegetariano',
  'Brunch', 'Vista panoramica', 'Merenda', 'Carne', 'Pranzo di lavoro',
]

export default async function handler(req, res) {
  if (applyCors(req, res)) return
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

  // ── Auth richiesta ──
  let userId = null
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    const anon = createClient(supabaseUrl, anonKey)
    const { data: { user } } = await anon.auth.getUser(token)
    if (user) userId = user.id
  }
  if (!userId) {
    return res.status(401).json({
      error: 'auth_required',
      message: 'Accedi per chattare con Bi',
    })
  }

  const limited = rateLimit(req, { key: `ai-auth-${userId}`, max: 10, windowMs: 60_000 })
  if (limited) return res.status(429).json({ error: limited })

  const { prompt: rawPrompt, conversation_id, current_moment, user_location } = req.body || {}
  const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : ''
  if (!prompt) return res.status(400).json({ error: 'prompt required' })
  if (prompt.length > MAX_PROMPT_LEN) {
    return res.status(400).json({ error: `prompt troppo lungo (max ${MAX_PROMPT_LEN} caratteri)` })
  }
  // user_location opzionale: { lat, lng }. Sanitizzato: numeri finiti e
  // dentro lat ∈ [-90,90], lng ∈ [-180,180]. Se invalido → ignorato.
  const userLocation = sanitizeUserLocation(user_location)

  // Streaming SSE quando il client lo richiede (Accept o body.stream).
  // I round-trip a Claude restano max 2: round 1 sync per la search,
  // round 2 streamato col present_picks alla fine.
  const wantStream = req.body?.stream === true ||
    (req.headers.accept || '').includes('text/event-stream')

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── Load user preferences (memoria cross-conversazione) ──
  // Tabella ai_user_preferences: dietary, favorite_zones, price_max, notes.
  // Iniettiamo nel system prompt come "Profilo dell'utente". Bi le tiene a
  // mente ma non le impone in modo rigido (si veda la regola nel prompt).
  let userPreferences = null
  {
    const { data: prefRow } = await admin
      .from('ai_user_preferences')
      .select('dietary, favorite_zones, price_max, notes')
      .eq('user_id', userId)
      .maybeSingle()
    if (prefRow && hasAnyPreference(prefRow)) userPreferences = prefRow
  }

  // ── Load history (clean text only) ──
  let history = []
  if (conversation_id) {
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
        content: extractMessageText(m.content),
      }))
      .filter((m) => m.content) // drop empty
  }

  // Helper di persistenza condiviso fra streaming e non-streaming.
  const persist = async ({ message, results }) => {
    let finalConversationId = conversation_id || null
    if (!finalConversationId) {
      const { data: newConv, error: convErr } = await admin
        .from('ai_conversations')
        .insert({ user_id: userId, title: prompt.slice(0, 60) })
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
          metadata: (current_moment || userLocation) ? {
            ...(current_moment ? { current_moment } : {}),
            ...(userLocation ? { user_location: userLocation } : {}),
          } : null,
        },
        {
          conversation_id: finalConversationId,
          role: 'assistant',
          content: { text: message, results },
          metadata: { model: CLAUDE_MODEL },
        },
      ])
    }
    return finalConversationId
  }

  // ── Streaming path ──
  if (wantStream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    // Disabilita buffering proxy (Vercel/Nginx).
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    // Primo byte subito: il round 1 (search tool) può durare 3-8s e in quel
    // tempo Vercel/CDN potrebbero buffering la response. Una SSE comment
    // line (": ...") è ignorata dal client ma forza il flush del primo
    // chunk → il browser vede che lo stream è vivo e non lo droppa.
    try { res.write(': ok\n\n') } catch { /* connection closed early */ }

    // Heartbeat ogni 4s mentre aspettiamo Claude: tiene aperta la
    // connessione su proxy aggressivi e dà al client un segnale "vivo".
    const heartbeat = setInterval(() => {
      try { res.write(': hb\n\n') } catch { /* ignore */ }
    }, 4000)

    try {
      const result = await streamAskClaude({
        apiKey, admin, res,
        history,
        userPrompt: prompt,
        currentMoment: current_moment || null,
        userLocation,
        userPreferences,
      })
      const finalConversationId = await persist(result).catch((err) => {
        console.warn('[ai] persist failed:', err?.message)
        return null
      })
      sseEvent(res, 'done', { conversation_id: finalConversationId })
    } catch (err) {
      console.error('ai stream error:', err)
      sseEvent(res, 'error', { message: err?.message || 'AI error' })
    } finally {
      clearInterval(heartbeat)
      res.end()
    }
    return
  }

  // ── Non-streaming path (back-compat) ──
  try {
    const result = await askClaude({
      apiKey, admin, history,
      userPrompt: prompt,
      currentMoment: current_moment || null,
      userLocation,
      userPreferences,
    })
    const finalConversationId = await persist(result).catch(() => null)
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

function sseEvent(res, name, data) {
  try {
    res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
  } catch {
    // Connessione chiusa lato client → ignora
  }
}

/**
 * Estrae solo il testo "parlato" da un messaggio salvato.
 * I messaggi assistant in DB hanno {text, results} — vogliamo solo text
 * per non inquinare la voce di Claude col proprio output JSON storico.
 */
function extractMessageText(content) {
  if (!content) return ''
  if (typeof content === 'string') return content.trim()
  if (typeof content.text === 'string') return content.text.trim()
  return ''
}

/**
 * Sanitizza { lat, lng } dell'utente: numeri finiti dentro i range geografici
 * standard. Out-of-range o garbage → null (l'AI lavora senza geo).
 */
function sanitizeUserLocation(loc) {
  if (!loc || typeof loc !== 'object') return null
  const lat = Number(loc.lat)
  const lng = Number(loc.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/**
 * Distanza geodetica fra due punti (km). Haversine, sferica.
 * Sufficiente per "a X min a piedi" in raggio urbano.
 */
function haversineKm(a, b) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sa = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(sa))
}

// 4.5 km/h è una velocità a piedi italiana media (urbana, con semafori).
const WALK_KM_H = 4.5
function walkMinutes(km) {
  return Math.max(1, Math.round((km / WALK_KM_H) * 60))
}

/* ------------------------------------------------------------------ */
/*  askClaude — function calling loop                                   */
/* ------------------------------------------------------------------ */
async function askClaude({ apiKey, admin, history, userPrompt, currentMoment, userLocation, userPreferences }) {
  const system = buildSystemBlocks(currentMoment, userLocation, userPreferences)
  const tools = [searchRestaurantsTool(), presentPicksTool()]

  const messages = [
    ...history,
    { role: 'user', content: userPrompt },
  ]

  // Tutti i candidati raccolti durante il tool-loop, indicizzati per id.
  // Quando Claude chiama present_picks col solo id, ricostruiamo i campi display.
  const candidatesById = new Map()

  let resp = await callClaude(apiKey, { system, messages, tools })
  let toolIterations = 0

  while (resp.stop_reason === 'tool_use' && toolIterations < MAX_TOOL_ITERATIONS) {
    toolIterations++
    const toolUses = (resp.content || []).filter((c) => c.type === 'tool_use')

    // Caso terminale: Claude ha chiamato present_picks → finiamo qui.
    const presentCall = toolUses.find((t) => t.name === 'present_picks')
    if (presentCall) {
      const message = extractTextBlocks(resp.content)
      const results = buildResultsFromPicks(presentCall.input?.picks, candidatesById)
      return { message: cleanupText(message), results }
    }

    const searchCall = toolUses.find((t) => t.name === 'search_restaurants')
    if (!searchCall) break

    const toolOutput = await executeSearch(admin, searchCall.input || {}, userLocation)
    // Indicizza candidati per join futuro
    for (const c of (toolOutput.candidates || [])) {
      candidatesById.set(c.id, c)
    }

    messages.push({ role: 'assistant', content: resp.content })
    messages.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: searchCall.id,
        content: JSON.stringify(toolOutput),
      }],
    })

    resp = await callClaude(apiKey, { system, messages, tools })
  }

  // Fallback: Claude ha chiuso col solo testo (end_turn). Usa il testo come messaggio,
  // nessun pick → mostriamo solo la bolla di Bi.
  const message = extractTextBlocks(resp.content)
  return {
    message: cleanupText(message) || "Su questa cosa non ti so dire — riprova con qualcosa di più specifico?",
    results: [],
  }
}

/* ------------------------------------------------------------------ */
/*  streamAskClaude — variante streaming SSE                            */
/*                                                                     */
/*  Differenze rispetto a askClaude:                                   */
/*  - Round 1 (search tool call) resta sincrono — è veloce e non       */
/*    produce testo user-facing.                                       */
/*  - Round 2 (testo + present_picks) viene streamato:                 */
/*    ogni text_delta diventa un evento SSE "delta" verso il client.   */
/*    L'input JSON di present_picks viene accumulato dai input_json_   */
/*    delta e parserato in fondo, poi emesso come evento "picks".      */
/*                                                                     */
/*  Garanzie: emette sempre alla fine (success o caso degenere) un     */
/*  evento "picks" — anche vuoto — così il client sa di aver finito.   */
/* ------------------------------------------------------------------ */
async function streamAskClaude({ apiKey, admin, res, history, userPrompt, currentMoment, userLocation, userPreferences }) {
  const system = buildSystemBlocks(currentMoment, userLocation, userPreferences)
  const tools = [searchRestaurantsTool(), presentPicksTool()]
  const messages = [...history, { role: 'user', content: userPrompt }]
  const candidatesById = new Map()

  let resp = await callClaude(apiKey, { system, messages, tools })
  let toolIterations = 0

  // Loop normale fino a che vediamo un search_restaurants. Quando lo
  // eseguiamo e dobbiamo richiamare Claude per la risposta finale →
  // passiamo al ramo streaming.
  while (resp.stop_reason === 'tool_use' && toolIterations < MAX_TOOL_ITERATIONS) {
    toolIterations++
    const toolUses = (resp.content || []).filter((c) => c.type === 'tool_use')

    // Edge case: Claude chiama present_picks già al primo turno (senza
    // search prima). Raro ma possibile se la query è zero-tool. Emetti
    // tutto e finisci.
    const presentCall = toolUses.find((t) => t.name === 'present_picks')
    if (presentCall) {
      const message = cleanupText(extractTextBlocks(resp.content))
      const results = buildResultsFromPicks(presentCall.input?.picks, candidatesById)
      if (message) sseEvent(res, 'delta', { text: message })
      sseEvent(res, 'picks', results)
      return { message, results }
    }

    const searchCall = toolUses.find((t) => t.name === 'search_restaurants')
    if (!searchCall) break

    const toolOutput = await executeSearch(admin, searchCall.input || {}, userLocation)
    for (const c of (toolOutput.candidates || [])) candidatesById.set(c.id, c)

    messages.push({ role: 'assistant', content: resp.content })
    messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: searchCall.id, content: JSON.stringify(toolOutput) }],
    })

    // Round finale: streaming
    return await streamFinalRound({ apiKey, system, messages, tools, candidatesById, res })
  }

  // Nessun tool call → Claude ha risposto solo testo. Emetti come delta.
  const message = cleanupText(extractTextBlocks(resp.content)) ||
    "Su questa cosa non ti so dire — riprova con qualcosa di più specifico?"
  sseEvent(res, 'delta', { text: message })
  sseEvent(res, 'picks', [])
  return { message, results: [] }
}

async function streamFinalRound({ apiKey, system, messages, tools, candidatesById, res }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      system, tools, messages,
      stream: true,
    }),
  })
  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`Claude HTTP ${response.status}: ${errBody.slice(0, 200)}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let accumulatedText = ''
  let toolUseName = null
  let toolUseJson = ''

  // Parser SSE generico (eventi separati da blank line).
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    let idx
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, idx)
      buf = buf.slice(idx + 2)

      let evtName = ''
      let dataStr = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) evtName = line.slice(6).trim()
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
      }
      if (!dataStr) continue
      let data
      try { data = JSON.parse(dataStr) } catch { continue }

      if (evtName === 'content_block_start') {
        if (data.content_block?.type === 'tool_use') {
          toolUseName = data.content_block.name
          toolUseJson = ''
        }
      } else if (evtName === 'content_block_delta') {
        if (data.delta?.type === 'text_delta') {
          const text = data.delta.text || ''
          accumulatedText += text
          sseEvent(res, 'delta', { text })
        } else if (data.delta?.type === 'input_json_delta') {
          toolUseJson += data.delta.partial_json || ''
        }
      }
      // message_stop / content_block_stop / message_delta: ignorati
    }
  }

  let results = []
  if (toolUseName === 'present_picks' && toolUseJson) {
    try {
      const input = JSON.parse(toolUseJson)
      results = buildResultsFromPicks(input.picks, candidatesById)
    } catch (err) {
      console.warn('[ai] present_picks parse failed:', err?.message)
    }
  }

  sseEvent(res, 'picks', results)
  return { message: cleanupText(accumulatedText), results }
}

function extractTextBlocks(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('\n')
    .trim()
}

function cleanupText(text) {
  if (!text) return ''
  // Toglie eventuali code fence / JSON residuo
  let t = text.replace(/```(?:json)?[\s\S]*?```/g, '').trim()
  // Toglie un eventuale blob JSON che il modello potrebbe ancora aggiungere in fondo
  t = t.replace(/\{\s*"message"[\s\S]*\}\s*$/m, '').trim()
  return t.slice(0, 600)
}

function buildResultsFromPicks(picks, candidatesById) {
  if (!Array.isArray(picks)) return []
  const out = []
  const seen = new Set()
  for (const pick of picks) {
    if (out.length >= MAX_RESULTS) break
    const id = pick?.restaurant_id || pick?.id
    if (!id || seen.has(id)) continue
    const c = candidatesById.get(id)
    if (!c) continue
    seen.add(id)
    out.push({
      restaurant_id: c.id,
      slug: c.slug,
      name: c.name,
      zone: c.zone,
      price: c.price,
      category: c.category,
      open_now: c.open_now,
      closes_at: c.closes_at,
      why: String(pick?.why || '').trim().slice(0, 120),
      // Geo + sconto: il frontend mostra il pill se valorizzati.
      distance_km: c.distance_km ?? null,
      walk_minutes: c.walk_minutes ?? null,
      discount_percent: c.active_discount?.percent ?? null,
    })
  }
  return out
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
      max_tokens: 1500,
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
/*  Tool definitions                                                    */
/* ------------------------------------------------------------------ */
function searchRestaurantsTool() {
  return {
    name: 'search_restaurants',
    description: 'Cerca tra i ristoranti che ho selezionato e validato io. Usa search_text per piatti/parole citate dall\'utente (cerca nei miei testi editoriali con stemming italiano). Combina filtri solo quando l\'utente li ha citati: meno filtri = più candidati da valutare.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: "Categoria cucina/tipo locale. Es: 'pizza', 'giapponese', 'piemontese', 'pesce', 'cocktail', 'enoteca', 'bistrot', 'panineria', 'bar'. Vuoto se non pertinente.",
        },
        moment: {
          type: 'string',
          enum: ['colazione', 'pranzo', 'aperitivo', 'cena', 'dopocena'],
          description: 'Momento della giornata adatto.',
        },
        price_max: {
          type: 'integer',
          description: '1=€ economico, 2=€€ medio, 3=€€€ 30-50€, 4=€€€€ alto. Solo se citato budget.',
        },
        zone: {
          type: 'string',
          description: "Quartiere/zona se citato (es: 'San Salvario', 'Centro', 'Quadrilatero', 'Vanchiglia', 'Crocetta').",
        },
        open_now: {
          type: 'boolean',
          description: 'True solo se utente vuole esplicitamente "adesso".',
        },
        discount_only: {
          type: 'boolean',
          description: 'True se l\'utente cita sconti/drop/offerte.',
        },
        search_text: {
          type: 'string',
          description: "Full-text italiano sui miei testi editoriali (nome, tagline, our_tip, our_review, cuisine_type). USA QUESTO per piatti specifici (\"agnolotti del plin\", \"tartare\", \"ramen tonkotsu\") o parole evocative (\"silenzioso\", \"affumicato\"). Stemming italiano: \"agnolotto\" trova anche \"agnolotti\".",
        },
        recommended_for: {
          type: 'string',
          enum: RECOMMENDED_FOR_TAGS,
          description: 'Tag editoriale di adeguatezza. \'Cena romantica\' per coppie, \'Gruppo di amici\' per gruppi, \'Tradizione\' per piemontese classico, \'Esperienza unica\' per il top, \'Vegetariano\' per veg, \'Vista panoramica\' per vista, \'Famiglia\' per famiglie, \'Appuntamento\' per primo appuntamento.',
        },
        near_me: {
          type: 'boolean',
          description: 'True se l\'utente cita la prossimità ("vicino a me", "qui intorno", "in zona", "a piedi", "a 5 min"). Funziona solo se l\'utente ha condiviso la posizione (vedi contesto sessione): in quel caso ordina per distanza e tiene solo locali entro 2 km. Se senza posizione, lo ignoro.',
        },
      },
    },
  }
}

function presentPicksTool() {
  return {
    name: 'present_picks',
    description: 'Chiama questo tool DOPO aver scelto i locali finali. La tua risposta deve contenere PRIMA il testo della tua voce (1-3 frasi naturali, prima persona) e POI la chiamata a present_picks coi tuoi 1-3 picks. Il testo è la bolla Bi, i picks sono le card sotto. Se hai 0 candidati validi dopo i retry, NON chiamare questo tool: rispondi solo con testo onesto.',
    input_schema: {
      type: 'object',
      properties: {
        picks: {
          type: 'array',
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              restaurant_id: {
                type: 'string',
                description: "L'id esatto restituito da search_restaurants (campo 'id').",
              },
              why: {
                type: 'string',
                description: '1 riga manoscritta, max 60 caratteri, voce Bi a margine. Specifica e concreta: cita un piatto o una caratteristica vera dai testi editoriali. Es. "Il vitello tonnato non ha rivali.", "Pasta fresca a mano.", "I miscelati col vermouth.". MAI generiche tipo "ottimo locale" o "consigliato".',
              },
            },
            required: ['restaurant_id', 'why'],
          },
        },
      },
      required: ['picks'],
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Tool executor — query Supabase                                      */
/* ------------------------------------------------------------------ */
async function executeSearch(admin, filters, userLocation = null) {
  let query = admin
    .from('restaurants')
    .select('id, slug, name, address, city, cuisine_type, category, price_range, our_rating, tagline, our_review, our_tip, recommended_for, hours_cache, moments, latitude, longitude, is_published')
    .eq('is_published', true)
    .limit(40)

  if (filters.category) {
    const cat = String(filters.category).trim().replace(/[%,{}]/g, '')
    if (cat) {
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
  if (filters.recommended_for && RECOMMENDED_FOR_TAGS.includes(filters.recommended_for)) {
    query = query.contains('recommended_for', [filters.recommended_for])
  }
  if (typeof filters.search_text === 'string' && filters.search_text.trim()) {
    const safe = filters.search_text.trim().slice(0, 100)
    // Italian websearch su colonna generata: matcha morfologia (agnolotti↔agnolotto).
    query = query.textSearch('search_tsv', safe, { type: 'websearch', config: 'italian' })
  }

  const { data, error } = await query
  if (error) return { error: error.message, candidates: [] }

  const now = new Date()
  const candidates = (data || []).map((r) => {
    const openStatus = computeOpenStatus(r.hours_cache, now)
    const momentOk = filters.moment
      ? isOpenForMomentServer(r.hours_cache, filters.moment, now, r.moments)
      : { match: true }

    // Distanza in linea d'aria + stima minuti a piedi. Solo se l'utente ha
    // condiviso la posizione e il locale ha lat/lng nel DB.
    let distance_km = null
    let walk_minutes = null
    if (userLocation && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)) {
      distance_km = haversineKm(userLocation, { lat: r.latitude, lng: r.longitude })
      walk_minutes = walkMinutes(distance_km)
    }

    return {
      // Campi opachi per il join finale (anche presi da present_picks)
      id: r.id,
      slug: r.slug,
      name: r.name,
      zone: extractZone(r.address),
      city: r.city || 'Torino',
      price: '€'.repeat(r.price_range || 2),
      category: Array.isArray(r.category) && r.category[0] ? r.category[0] : (r.cuisine_type || ''),
      open_now: openStatus.open,
      closes_at: openStatus.closesAt,
      // Campi editoriali che Claude usa per scegliere e scrivere il "why"
      tagline: r.tagline || '',
      our_rating: r.our_rating || null,
      moments: Array.isArray(r.moments) ? r.moments : [],
      recommended_for: Array.isArray(r.recommended_for) ? r.recommended_for : [],
      editorial: {
        review_excerpt: truncate(r.our_review, 280),
        tip: r.our_tip || '',
      },
      // Geo (null se l'utente non ha condiviso la posizione)
      distance_km: distance_km != null ? Math.round(distance_km * 10) / 10 : null,
      walk_minutes,
      moment_match: momentOk.match,
    }
  })

  let filtered = candidates
  if (filters.moment) filtered = filtered.filter((r) => r.moment_match)
  if (filters.open_now) filtered = filtered.filter((r) => r.open_now || r.closes_at == null)

  // Filtro "vicino a me": richiede userLocation. Tiene chi è entro NEAR_KM
  // e ordina per distanza crescente. Se userLocation manca → no-op (Claude
  // sa che è inutile, ma per sicurezza non rompiamo nulla).
  const NEAR_KM = 2.0
  if (filters.near_me === true && userLocation) {
    filtered = filtered
      .filter((r) => r.distance_km != null && r.distance_km <= NEAR_KM)
      .sort((a, b) => (a.distance_km ?? 9e9) - (b.distance_km ?? 9e9))
  }

  // Discounts attivi (query batch). Se l'utente vuole solo sconti → filtro;
  // altrimenti li espongo come campo informativo per il why di Bi.
  if (filtered.length > 0) {
    const ids = filtered.map((r) => r.id)
    const nowIso = new Date().toISOString()
    const { data: drops } = await admin
      .from('discounts')
      .select('restaurant_id, discount_percent, title, ends_at')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .gte('ends_at', nowIso)
      .in('restaurant_id', ids)
    const dropByRest = new Map()
    for (const d of (drops || [])) {
      // Tieni il primo (= maggiore percentuale se ce ne fossero più di uno).
      if (!dropByRest.has(d.restaurant_id) ||
          (d.discount_percent || 0) > (dropByRest.get(d.restaurant_id).discount_percent || 0)) {
        dropByRest.set(d.restaurant_id, d)
      }
    }
    for (const c of filtered) {
      const d = dropByRest.get(c.id)
      if (d) {
        c.active_discount = {
          percent: d.discount_percent || null,
          title: d.title || null,
          ends_at: d.ends_at || null,
        }
      }
    }
    if (filters.discount_only === true) {
      filtered = filtered.filter((r) => r.active_discount)
    }
  }

  // Retry allargato: togli zone + open_now
  if (filtered.length === 0 && (filters.zone || filters.open_now)) {
    const relaxed = { ...filters, zone: null, open_now: false }
    const relaxedResult = await executeSearch(admin, relaxed, userLocation)
    if (relaxedResult.candidates && relaxedResult.candidates.length > 0) {
      return { candidates: relaxedResult.candidates, total: relaxedResult.total, relaxed: true }
    }
  }

  // Retry ancora più permissivo: alza price_max
  if (filtered.length === 0 && typeof filters.price_max === 'number' && filters.price_max < 4) {
    const relaxed = { ...filters, zone: null, open_now: false, price_max: filters.price_max + 1 }
    const relaxedResult = await executeSearch(admin, relaxed, userLocation)
    if (relaxedResult.candidates && relaxedResult.candidates.length > 0) {
      return { candidates: relaxedResult.candidates, total: relaxedResult.total, relaxed: true }
    }
  }

  // Cap a 8 candidati per response (paga il context window di Claude):
  // più di così non aiuta la qualità della scelta.
  const top = filtered.slice(0, 8)
  return { candidates: top, total: filtered.length }
}

function truncate(s, n) {
  if (!s) return ''
  const t = String(s)
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…'
}

function extractZone(address) {
  if (!address) return ''
  const part = address.split(',')[0] || ''
  return part.trim().slice(0, 40)
}

function mapZoneToAddressPatterns(zoneRaw) {
  if (!zoneRaw) return null
  const zone = String(zoneRaw).toLowerCase().trim().replace(/[%,]/g, '')
  if (!zone) return null

  // CAP Torino centro/semi-centro:
  //   10121 Cittadella/Solferino · 10122 Quadrilatero/Porta Susa
  //   10123 Centro storico/Po · 10124 Vanchiglia/Po · 10125 San Salvario
  //   10128 Crocetta. Indicizzati sull'address via ILIKE — più affidabili
  //   delle vie singole perché beccano tutti i locali della zona.
  const ALIASES = {
    'centro': [
      '10121', '10122', '10123', '10124', '10125', '10128',
      'crocetta', 'san salvario', 'quadrilatero', 'porta nuova', 'porta palazzo',
      'centro storico', 'piazza castello', 'via po', 'via roma', 'via po,',
      'piazza vittorio', 'piazza san carlo', 'piazza carlina', 'piazza carlo emanuele',
      'piazza corpus domini', 'via bertola', 'via mercanti', 'via maria vittoria',
      'via doria', 'via giulio', 'via bonafous', 'via sant',
    ],
    'centro storico': ['10122', '10123', 'quadrilatero', 'porta palazzo', 'piazza castello', 'via po', 'via roma', 'piazza san carlo', 'via mercanti'],
    'centro città': ['10121', '10122', '10123', '10125', 'crocetta', 'san salvario', 'quadrilatero', 'porta nuova'],
    'quadrilatero': ['10122', 'quadrilatero', 'via mercanti', 'via bertola', 'piazza corpus domini', 'via doria', 'via giulio'],
    'vanchiglia': ['10124', 'vanchiglia', 'via bonafous', 'via sant'],
    'san salvario': ['10125', 'san salvario', 'via morgari', 'via berthollet', 'via baretti', 'via principe tommaso'],
    'crocetta': ['10128', 'crocetta', 'via legnano', 'via villar', 'corso einaudi'],
  }

  const patterns = ALIASES[zone] || [zone]
  return patterns.map(p => `address.ilike.%${p}%`).join(',')
}

function computeOpenStatus(hours, now) {
  // Preferiamo currentOpeningHours: Google ci merge dentro i festivi /
  // chiusure straordinarie della settimana corrente. regularOpeningHours è il
  // "tipo" della settimana, fallback se per quel locale current manca.
  const source = hours?.currentOpeningHours || hours?.regularOpeningHours
  if (!source?.periods?.length) return { open: null, closesAt: null }
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

/**
 * Match per momento. Priorità al tag manuale dell'admin (restaurants.moments):
 * se l'admin ha taggato il locale per quel momento → match. Altrimenti, e solo
 * se hours_cache è valorizzato, controlla overlap orario. Senza orari conferma
 * comunque (fallback safe per non perdere candidati).
 */
function isOpenForMomentServer(hours, moment, now, manualMoments = null) {
  if (Array.isArray(manualMoments) && manualMoments.includes(moment)) {
    return { match: true, verified: false }
  }
  const SLOTS = {
    colazione: { startMin:  6 * 60 + 30, endMin: 10 * 60 + 30 },
    pranzo:    { startMin: 11 * 60 + 30, endMin: 14 * 60 + 30 },
    aperitivo: { startMin: 17 * 60,      endMin: 20 * 60 + 30 },
    cena:      { startMin: 19 * 60 + 30, endMin: 23 * 60 + 30 },
    dopocena:  { startMin: 22 * 60 + 30, endMin: 26 * 60 },
  }
  if (!SLOTS[moment]) return { match: false }
  // Stesso criterio di computeOpenStatus: current ha i festivi mergiati.
  const source = hours?.currentOpeningHours || hours?.regularOpeningHours
  if (!source?.periods?.length) {
    // Senza tag e senza orari: tag manuale era già la fonte primaria → no match.
    // Manteniamo però true se manualMoments è null (mai impostato) per non
    // azzerare locali storici prima dell'introduzione del campo.
    return { match: manualMoments == null, verified: false }
  }
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
function buildSystemBlocks(currentMoment, userLocation, userPreferences) {
  const momentHint = currentMoment && MOMENT_LABELS[currentMoment]
    ? `\nMomento corrente per l'utente: ${MOMENT_LABELS[currentMoment]}.`
    : ''
  const locationHint = userLocation
    ? `\nPosizione utente: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)} — i candidati ti arrivano con \`distance_km\` e \`walk_minutes\` valorizzati, puoi filtrare con \`near_me: true\` e citare i minuti a piedi nel why.`
    : '\nPosizione utente: NON disponibile — il filtro `near_me` non funziona. Non promettere "vicino a te". Se l\'utente chiede prossimità, chiedigli di condividere la posizione dal bottone 📍 in basso.'
  const prefBlock = formatPreferencesBlock(userPreferences)

  // Blocco statico (cacheable) + blocco dinamico (momento + posizione + prefs).
  // cache_control sul blocco statico: Anthropic riusa il KV cache fra le chiamate.
  return [
    {
      type: 'text',
      text: STATIC_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: `Contesto sessione corrente:${momentHint}${locationHint}${prefBlock}\nData/ora: ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}.`,
    },
  ]
}

/**
 * Restituisce true se almeno un campo delle preferenze utente è valorizzato.
 * Serve per evitare di iniettare un blocco vuoto / fake nel system prompt.
 */
function hasAnyPreference(p) {
  if (!p) return false
  if (Array.isArray(p.dietary) && p.dietary.length > 0) return true
  if (Array.isArray(p.favorite_zones) && p.favorite_zones.length > 0) return true
  if (typeof p.price_max === 'number' && p.price_max > 0) return true
  if (typeof p.notes === 'string' && p.notes.trim().length > 0) return true
  return false
}

/**
 * Costruisce il blocco "Profilo dell'utente" da inserire nel system prompt
 * dinamico. Bi lo considera come informazione di contesto: deve tenerne
 * conto SENZA imporlo se l'utente nella chat corrente chiede esplicitamente
 * altro (es. utente vegetariano che oggi chiede "consigliami una bisteccheria"
 * → Bi rispetta la richiesta corrente).
 */
function formatPreferencesBlock(p) {
  if (!hasAnyPreference(p)) return ''
  const parts = []
  if (Array.isArray(p.dietary) && p.dietary.length > 0) {
    parts.push(`dieta: ${p.dietary.join(', ')}`)
  }
  if (Array.isArray(p.favorite_zones) && p.favorite_zones.length > 0) {
    parts.push(`zone preferite: ${p.favorite_zones.join(', ')}`)
  }
  if (typeof p.price_max === 'number' && p.price_max > 0) {
    parts.push(`budget max: ${'€'.repeat(Math.min(4, Math.max(1, p.price_max)))}`)
  }
  if (typeof p.notes === 'string' && p.notes.trim().length > 0) {
    parts.push(`note libere: "${p.notes.trim().slice(0, 240)}"`)
  }
  return `\nProfilo dell'utente (preferenze memorizzate dalle impostazioni): ${parts.join(' · ')}. Tieni conto di questo profilo come default — usa zone/dieta/budget per pesare le scelte e cita riferimenti naturali ("so che mangi vegetariano, ti dico..."). NON imporlo se nel messaggio corrente l'utente chiede esplicitamente qualcosa di diverso (es. vegetariano che chiede "bisteccheria" → rispetti la richiesta del momento).`
}

const STATIC_SYSTEM_PROMPT = `Sei Bi, la voce della guida ChiamamiBi.com. In prima persona, hai selezionato a Torino circa 70 ristoranti, bar e bistrot — tutti validati da te. Quando un utente ti chiede dove andare, rispondi col tuo tono: diretto, caldo, asciutto, parlato. Niente formalità.

# REGOLE FERREE
1. Consigli SOLO i locali che il tool search_restaurants ti restituisce. Mai inventare nomi, mai usare conoscenza esterna su ristoranti. Se non sono nel mio database, non esistono per te.
2. Mai "il migliore", mai classifiche, mai stelle. La promessa è "io ti seleziono", non "io ti classifico".
3. Mai chiedere o citare recensioni utenti / rating utenti. Esiste solo il MIO giudizio editoriale (campo our_review + our_tip).
4. Italiano naturale, prima persona singolare, parlato. "Ho", "ti dico", "vai", "te lo metto in mano", "non te lo classifico". Mai "Ecco i risultati", "Posso aiutarti", "Sicuramente troverai", "I migliori che ho trovato".
5. Nel testo della tua bolla NON elencare i nomi dei locali in lista bullet o numerata: i nomi vanno nelle card (picks). Il tuo testo è una frase introduttiva piena, 1-3 frasi.
6. Massimo 3 picks per risposta. Per domanda puntuale (un piatto specifico) anche solo 1-2.

# STRATEGIA DI RICERCA
Procedi così:
1. Chiama search_restaurants UNA volta con i filtri più rilevanti citati dall'utente. Mai più filtri di quanti l'utente ne abbia espressi.
2. Per piatti o caratteristiche evocative (es. "agnolotti", "tartare", "vermouth", "silenzioso") usa search_text — stemming italiano, matcha singolare/plurale.
3. Per intenzioni ("romantico", "con gli amici", "tradizionale", "vegetariano") usa recommended_for col tag corrispondente. Non confondere con category.
4. Se il tool torna 0 candidati: richiama una volta sola rilassando i filtri (rimuovi zone o open_now, poi alza price_max). Il tool stesso fa già qualche retry, quindi è raro doverlo fare a mano.
5. Quando hai ≥1 candidato, leggi davvero i campi editorial.review_excerpt e editorial.tip per scegliere e per scrivere il "why". Non scegliere a caso.

# COME SCRIVI LA TUA RISPOSTA
Dopo aver letto i candidati, rispondi nella stessa risposta con DUE blocchi nell'ordine:

A) BLOCCO TESTO (la "bolla" di Bi): 1-3 frasi in prosa naturale italiana, prima persona, voce calda e asciutta. Niente nomi di locali qui (li mette già la card). Niente JSON, niente bullet, niente "ecco". Apri spesso con una contestualizzazione corta ("Allora", "Per il pranzo lì", "Su questo ti dico subito che…").
Se l'utente ha condiviso la posizione (i candidati hanno walk_minutes valorizzato) puoi citare la prossimità nel testo: "Il più vicino a te è a 6 minuti." Se NON ha condiviso e ti ha chiesto "vicino", suggeriscigli di toccare il 📍 in basso per condividere la posizione.

B) CHIAMATA al tool present_picks con i tuoi 1-3 picks. Ogni pick deve avere:
   - restaurant_id: l'id esatto dal candidato (campo "id").
   - why: 1 riga manoscritta max 60 caratteri, specifica e concreta. ATTINGI A editorial.tip e editorial.review_excerpt: cita un piatto vero, una caratteristica vera. NON formule generiche ("ottimo locale", "vai sul sicuro" sono OK ma raramente). Esempi buoni:
       • "Il vitello tonnato non ha rivali."
       • "Pasta fresca a mano."
       • "I miscelati col vermouth."
       • "Piccolo, silenzioso."
       • "Da provare il tagliere."
       • "Per te, stasera."
   Se il candidato ha active_discount.percent valorizzato e non è già implicito (e tu non ne hai parlato nel testo), puoi citarlo nel why: "Stasera −20%." — ma il pill di sconto compare già nella card, quindi NON è obbligatorio ripeterlo.

# SEGNALI EXTRA NEI CANDIDATI
- walk_minutes + distance_km: minuti a piedi e km. Disponibili solo con posizione utente. Usa minuti, non km: "a 7 minuti a piedi" suona meglio di "a 0.5 km".
- active_discount: { percent, title, ends_at }. Indica che il locale ha uno sconto live ora.
- near_me: filtro che ordina per distanza e tiene solo ≤2 km. Attiva quando l'utente cita "vicino", "qui", "intorno a me", "a piedi", "in zona", "a 5 minuti". MAI da solo: combina con almeno una categoria/momento/recommended_for se hanno citato anche quello.

# CASO ZERO RISULTATI
Se anche dopo il retry il tool torna 0 candidati validi: NON chiamare present_picks. Rispondi col solo testo, riconosci il limite con onestà, proponi una via vicina ("a 5 minuti hai…", "su questa cosa non te lo so consigliare, ma se vuoi su X ti dico…"). Mai "nessun risultato trovato".

# RICHIESTE FUORI SCOPO
- Classifiche/migliori: "Non te lo classifico in migliori, non è il mio mestiere. Tra i miei locali per X ti dico…"
- Recensioni utenti: "Le recensioni degli altri non le tratto, ti dico io cosa penso."
- Prezzi precisi: "Sui prezzi al coperto vado a memoria, te lo lascio chiedere a loro."
- Città diverse da Torino: cerca lo stesso. Se non hai locali in quella città, dillo onestamente in una frase.

# ESEMPI

[Aperitivo a Vanchiglia, 3 candidati]
TESTO: "Allora a Vanchiglia per l'aperitivo ci sei nel posto giusto. Te ne dico tre dove andrei io, gusti diversi:"
PICKS: 3 con why specifici tipo "I tarallini caldi alle 18.", "Vermouth selezionati a mano.", "Tagliere generoso, vino vero."

[Cinese a Vanchiglia → 0 candidati dopo retry]
TESTO: "Cinese a Vanchiglia non ce l'ho, te lo dico subito — è zona da italiano e da bistrot. Se ti sposti a 5 minuti di tram qualcosa ti dico, va bene?"
PICKS: (nessuno)

[Agnolotti del plin]
TESTO: "Gli agnolotti li fanno bene in un paio dei miei, dove la pasta è fresca a mano:"
PICKS: 2 con why tipo "Il plin è la specialità della casa."

[Query ambigua: "consigliami qualcosa"]
TESTO: "Aiutami un attimo: che voglia hai? Pesce, pizza, asiatico, tradizione? E in che zona ti muovi?"
PICKS: (nessuno)

[Richiesta classifica: "il miglior pesce di Torino"]
TESTO: "Non te lo classifico in 'migliori', non è il mio mestiere. Però tra i miei per pesce te ne dico due:"
PICKS: 1-2.

Ricorda: il testo è la TUA voce, i picks sono le card. Una sola chiamata a present_picks alla fine. Se mai dovessi essere indeciso fra dire qualcosa di generico o dire la verità, di' sempre la verità.`
