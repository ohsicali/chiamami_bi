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
 *     current_moment?: 'colazione'|'pranzo'|'aperitivo'|'cena'|'dopocena',
 *     city?: string,                   // città attiva del CityPicker (default Torino)
 *     user_location?: { lat, lng },
 *     stream?: boolean                 // SSE
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
 * Architettura conversazione (`runConversation`, unica per streaming e non):
 *  1. Round 1 sincrono: Claude vede system+prompt+history e di norma chiama
 *     `search_restaurants`.
 *  2. Eseguiamo la ricerca, rimandiamo il tool_result e ripartiamo. Il loop
 *     gira finché Claude chiama tool, fino a MAX_TOOL_ITERATIONS: Claude può
 *     cercare più volte (lo fa spesso quando il primo giro rende poco).
 *  3. Il giro terminale porta BLOCCO TESTO (la voce di Bi) + tool_use
 *     `present_picks` con la lista {id, why}; joinamo coi candidati raccolti
 *     per ricostruire i campi di display.
 *  In streaming ogni round dopo il primo è streamato: i text_delta diventano
 *  eventi SSE `delta`, i picks un evento `picks`, la fine un evento `done`.
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
 *
 * Fix 2026-09 (la chat rispondeva a vuoto):
 *  - Il loop streaming eseguiva SOLO la prima `search_restaurants`. Se Claude
 *    ne chiedeva una seconda — cosa che fa spesso — il turno finiva con un
 *    tool_use orfano: bolla vuota, zero card. Ora il loop è uno solo per
 *    entrambi i path ed esegue ogni tool call.
 *  - Filtro città: la guida non è più solo torinese (94 locali in 28 città),
 *    e senza filtro Bi consigliava Marsala a chi chiedeva Torino.
 *  - History: si prendevano i PRIMI 10 messaggi invece degli ultimi.
 *  - `open_now` non filtrava niente (guardia sbagliata su closes_at).
 *  - Rilassamento dei filtri a scalini dichiarati, non più ricorsione parziale.
 */

import { createClient } from '@supabase/supabase-js'
import { rateLimit, maybeCleanup } from './_rate-limit.js'
import { applyCors } from './_cors.js'

// Sonnet 5: italiano piu naturale e latenza piu bassa di 4.6, che era il
// motivo per cui le risposte suonavano da assistente e arrivavano lente.
// Se l'account non ce l'ha ancora abilitato, `claudeFetch` scala da solo al
// modello precedente invece di far fallire la chat.
const CLAUDE_MODEL = process.env.AI_MODEL || 'claude-sonnet-5'
const CLAUDE_MODEL_FALLBACK = 'claude-sonnet-4-6'
// Il primo giro non produce voce: Claude legge la domanda e sceglie i filtri.
// Non serve il modello grosso, e sono secondi che l'utente aspetta guardando
// una bolla vuota. Override con AI_MODEL_FAST (vuoto = usa sempre il grosso).
const CLAUDE_MODEL_PLANNER = process.env.AI_MODEL_FAST ?? 'claude-haiku-4-5-20251001'
let activeModel = CLAUDE_MODEL
const ANTHROPIC_VERSION = '2023-06-01'
// Bi risponde in 1-2 frasi + la tool call dei picks: 1024 bastano e
// impediscono a un turno impazzito di far aspettare l'utente.
const MAX_OUTPUT_TOKENS = 1024
const MAX_HISTORY_MSGS = 10
const MAX_RESULTS = 3
const MAX_PROMPT_LEN = 500
const MAX_TOOL_ITERATIONS = 4
const DEFAULT_CITY = 'Torino'
const MAX_CANDIDATES = 6

// Comuni della cintura torinese: chi chiede "Torino" accetta volentieri un
// locale a Collegno o Moncalieri, non uno a Marsala. Gli alias servono a
// filtrare per città senza tagliare fuori l'area metropolitana.
const CITY_ALIASES = {
  Torino: [
    'Torino', 'Collegno', 'Grugliasco', 'Rivoli', 'Moncalieri', 'Nichelino',
    'San Mauro Torinese', 'Settimo Torinese', 'Beinasco', 'Orbassano',
    'Venaria Reale', 'Chieri', 'Carmagnola', 'Poirino',
  ],
}

function expandCity(city) {
  const base = capitalizeCity(city || DEFAULT_CITY)
  return CITY_ALIASES[base] || [base]
}

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

  const { prompt: rawPrompt, conversation_id, current_moment, user_location, city } = req.body || {}
  const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : ''
  if (!prompt) return res.status(400).json({ error: 'prompt required' })
  if (prompt.length > MAX_PROMPT_LEN) {
    return res.status(400).json({ error: `prompt troppo lungo (max ${MAX_PROMPT_LEN} caratteri)` })
  }
  // user_location opzionale: { lat, lng }. Sanitizzato: numeri finiti e
  // dentro lat ∈ [-90,90], lng ∈ [-180,180]. Se invalido → ignorato.
  const userLocation = sanitizeUserLocation(user_location)
  // Città attiva scelta dall'utente (CityContext lato client). La guida non è
  // più solo torinese — in DB ci sono locali in una trentina di città — quindi
  // senza questo filtro Bi consigliava un pesce a Marsala a chi chiedeva Torino.
  const sessionCity = sanitizeCity(city)

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
    // ⚠️ ordine DESC + reverse: prima era ascending, quindi in una chat lunga
    // Claude vedeva sempre i PRIMI 10 messaggi e mai quelli recenti — i
    // follow-up ("allarga la zona", "e invece una birreria?") arrivavano
    // senza il contesto a cui si riferivano.
    const { data: msgs } = await admin
      .from('ai_messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY_MSGS)
    history = normalizeHistory(msgs)
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
          metadata: {
            city: sessionCity,
            ...(current_moment ? { current_moment } : {}),
            ...(userLocation ? { user_location: userLocation } : {}),
          },
        },
        {
          conversation_id: finalConversationId,
          role: 'assistant',
          content: { text: message, results },
          metadata: { model: activeModel },
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
      const result = await runConversation({
        apiKey, admin, res,
        history,
        userPrompt: prompt,
        currentMoment: current_moment || null,
        userLocation,
        userPreferences,
        sessionCity,
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
    const result = await runConversation({
      apiKey, admin, history,
      userPrompt: prompt,
      currentMoment: current_moment || null,
      userLocation,
      userPreferences,
      sessionCity,
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
 * Normalizza la history letta dal DB (che arriva in ordine DESC) nel formato
 * messages dell'API Anthropic:
 *  - riordina cronologicamente;
 *  - scarta i messaggi senza testo (le vecchie risposte vuote sono in DB);
 *  - taglia gli assistant iniziali: il primo messaggio deve essere `user`;
 *  - fonde i turni consecutivi dello stesso ruolo, che scartando i vuoti
 *    possono restare appaiati.
 */
function normalizeHistory(rows) {
  const clean = (rows || [])
    .slice()
    .reverse()
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: extractMessageText(m.content) }))
    .filter((m) => m.content)

  while (clean.length > 0 && clean[0].role !== 'user') clean.shift()

  const merged = []
  for (const m of clean) {
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) last.content += `\n\n${m.content}`
    else merged.push({ ...m })
  }
  return merged
}

/**
 * Città attiva della sessione (dal CityPicker lato client). Solo lettere,
 * spazi e apostrofi; capitalizzata per combaciare con i valori in DB.
 * Fallback: Torino.
 */
function sanitizeCity(raw) {
  if (typeof raw !== 'string') return DEFAULT_CITY
  const clean = raw.trim().replace(/[^\p{L}\s'’-]/gu, '').slice(0, 40).trim()
  if (!clean) return DEFAULT_CITY
  return capitalizeCity(clean)
}

function capitalizeCity(name) {
  return String(name)
    .toLowerCase()
    .split(/(\s+)/)
    .map((part) => (/\s/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('')
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
/*  runConversation — loop unico (streaming e non)                      */
/*                                                                     */
/*  Un solo motore per entrambi i path. `res` valorizzato = streaming:  */
/*  i round successivi al primo vengono streamati e ogni text_delta     */
/*  diventa un evento SSE "delta".                                     */
/*                                                                     */
/*  Il loop gira finché Claude chiama tool. Ogni giro può essere:       */
/*   - search_restaurants → eseguiamo la query e rilanciamo un round.   */
/*   - present_picks      → terminale, costruiamo le card e usciamo.    */
/*   - solo testo         → terminale.                                 */
/*                                                                     */
/*  ⚠️ Il bug storico (bolla vuota + zero card, vedi log giugno-luglio) */
/*  stava qui: nel path streaming la SECONDA search_restaurants — che   */
/*  Claude fa spessissimo quando il primo giro torna pochi candidati —  */
/*  non veniva mai eseguita. Il round finiva con un tool_use orfano,    */
/*  zero testo e zero picks. Ora ogni tool call viene eseguita, in      */
/*  entrambi i path, fino a MAX_TOOL_ITERATIONS.                        */
/* ------------------------------------------------------------------ */
async function runConversation({
  apiKey, admin, history, userPrompt,
  currentMoment, userLocation, userPreferences, sessionCity,
  res = null,
}) {
  const streaming = !!res
  const system = buildSystemBlocks(currentMoment, userLocation, userPreferences, sessionCity)
  const tools = [searchRestaurantsTool(), presentPicksTool()]
  const messages = [...history, { role: 'user', content: userPrompt }]
  const searchCtx = { userLocation, sessionCity }

  // Candidati raccolti in tutti i round, indicizzati per id: present_picks
  // ci passa solo l'id e da qui ricostruiamo i campi di display.
  const candidatesById = new Map()

  let accText = ''
  let results = []
  let searchedAtLeastOnce = false

  const pushText = (text, alreadyStreamed) => {
    if (!text) return
    // Il testo streamato è già arrivato al client delta per delta, separatore
    // compreso (emesso prima del round): qui va solo accumulato così com'è.
    if (alreadyStreamed) { accText += text; return }
    const sep = accText ? '\n\n' : ''
    if (streaming) sseEvent(res, 'delta', { text: sep + text })
    accText += sep + text
  }

  // Round 1 sempre sincrono: di norma è solo la tool call di ricerca e non
  // produce voce, quindi non c'è niente da streamare e il parsing è più semplice.
  const t0 = Date.now()
  const timeline = []
  const mark = (what) => timeline.push(`${what} ${Date.now() - t0}ms`)

  // Il primo giro è SOLO pianificazione: `tool_choice` obbliga la ricerca.
  // Senza questo vincolo il modello rapido a volte rispondeva di suo,
  // inventando ("non ho gelaterie in archivio" — ne ho due). Così non può:
  // qualunque parola rivolta all'utente nasce dal modello principale, dopo
  // aver visto i candidati veri.
  let turn = await callClaudeTurn({
    apiKey, system, messages, tools, planner: true,
    toolChoice: { type: 'tool', name: 'search_restaurants' },
  })
  mark(`round1(${turn.model})`)
  let claudeCalls = 1

  for (;;) {
    pushText(turn.text, turn.streamed)

    const presentCall = turn.toolUses.find((t) => t.name === 'present_picks')
    if (presentCall) {
      results = buildResultsFromPicks(presentCall.input?.picks, candidatesById)
      break
    }

    if (turn.toolUses.length === 0) break // end_turn: Claude ha risposto solo a parole

    // Ogni tool_use del turno vuole il suo tool_result, anche quelli che non
    // sappiamo servire: se ne salta uno, la richiesta successiva viene
    // rifiutata dall'API. Claude può chiamare più tool in parallelo.
    const toolResults = []
    for (const call of turn.toolUses) {
      if (call.name !== 'search_restaurants') {
        toolResults.push({
          type: 'tool_result', tool_use_id: call.id, is_error: true,
          content: `Tool ${call.name} non disponibile qui.`,
        })
        continue
      }
      // L'attesa piu lunga è qui. Un'etichetta onesta sotto i puntini vale
      // piu di tre puntini muti: l'utente vede che Bi sta lavorando.
      if (streaming) {
        sseEvent(res, 'status', {
          text: searchedAtLeastOnce
            ? 'Allargo la ricerca…'
            : 'Sto guardando tra i miei locali…',
        })
      }
      searchedAtLeastOnce = true
      const toolOutput = await executeSearch(admin, call.input || {}, searchCtx)
      mark(`search(${(toolOutput.candidates || []).length})`)
      for (const c of (toolOutput.candidates || [])) candidatesById.set(c.id, c)
      toolResults.push({
        type: 'tool_result', tool_use_id: call.id,
        content: JSON.stringify({
          ...toolOutput,
          candidates: (toolOutput.candidates || []).map(slimCandidateForClaude),
        }),
      })
    }

    messages.push({ role: 'assistant', content: turn.content })
    messages.push({ role: 'user', content: toolResults })

    // Budget di giri esaurito: chiudiamo con quello che abbiamo invece di
    // bruciare una chiamata il cui risultato non processeremmo comunque.
    if (claudeCalls >= MAX_TOOL_ITERATIONS) break

    // Se abbiamo già scritto qualcosa, separa dal blocco che sta per arrivare.
    if (streaming && accText) {
      sseEvent(res, 'delta', { text: '\n\n' })
      accText += '\n\n'
    }

    claudeCalls++
    turn = streaming
      ? await streamClaudeTurn({ apiKey, system, messages, tools, res })
      : await callClaudeTurn({ apiKey, system, messages, tools })
    mark(`round${claudeCalls}(${turn.model})`)
  }

  // Rete di sicurezza: mai una bolla vuota. Se Claude ha esaurito i giri
  // senza scrivere niente, diciamo qualcosa di onesto invece del nulla.
  if (!accText.trim()) {
    const fallback = results.length > 0
      ? 'Ti dico questi.'
      : searchedAtLeastOnce
        ? 'Su questa non ti so dire niente che mi convinca. Prova a dirmi zona o tipo di cucina e ci riprovo.'
        : 'Non ho afferrato. Dimmi che voglia hai — cucina, zona, momento — e ti dico dove andare.'
    accText = fallback
    if (streaming) sseEvent(res, 'delta', { text: fallback })
  }

  console.log(`[ai] ${timeline.join(' · ')} · picks ${results.length}`)
  const message = cleanupText(accText)
  if (streaming) sseEvent(res, 'picks', results)
  return { message, results, timeline }
}

/**
 * Un round non streamato. Ritorna la forma normalizzata usata dal loop:
 * { text, toolUses:[{id,name,input}], content } dove `content` è il blocco
 * assistant da rimandare a Claude nel turno successivo.
 */
async function callClaudeTurn({ apiKey, system, messages, tools, planner = false, toolChoice = null }) {
  const resp = await callClaude(apiKey, { system, messages, tools, planner, toolChoice })
  const content = Array.isArray(resp.content) ? resp.content : []
  return {
    model: resp._model,
    text: extractTextBlocks(content),
    toolUses: content
      .filter((c) => c.type === 'tool_use')
      .map((c) => ({ id: c.id, name: c.name, input: c.input || {} })),
    content,
    streamed: false,
  }
}

/**
 * Un round streamato. Emette gli eventi SSE "delta" man mano che il testo
 * arriva e ricostruisce i content block (testo + tool_use con input
 * riassemblato dagli input_json_delta) nella stessa forma di callClaudeTurn,
 * così il loop può rimandare il turno a Claude senza saperne la provenienza.
 */
async function streamClaudeTurn({ apiKey, system, messages, tools, res }) {
  const { response, model } = await claudeFetch(apiKey, { system, messages, tools, stream: true })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  // index → { type, text, id, name, json }
  const blocks = new Map()

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
        const cb = data.content_block || {}
        blocks.set(data.index, {
          type: cb.type,
          text: cb.type === 'text' ? (cb.text || '') : '',
          id: cb.id,
          name: cb.name,
          json: '',
        })
      } else if (evtName === 'content_block_delta') {
        const b = blocks.get(data.index)
        if (!b) continue
        if (data.delta?.type === 'text_delta') {
          const text = data.delta.text || ''
          b.text += text
          sseEvent(res, 'delta', { text })
        } else if (data.delta?.type === 'input_json_delta') {
          b.json += data.delta.partial_json || ''
        }
      }
      // message_start / content_block_stop / message_delta / message_stop: ignorati
    }
  }

  const content = []
  const toolUses = []
  let text = ''
  for (const [, b] of [...blocks.entries()].sort((a, c) => a[0] - c[0])) {
    if (b.type === 'text') {
      if (!b.text) continue
      content.push({ type: 'text', text: b.text })
      text += (text ? '\n' : '') + b.text
    } else if (b.type === 'tool_use') {
      let input = {}
      // Un tool_use senza argomenti non emette input_json_delta: json resta ''.
      if (b.json) {
        try { input = JSON.parse(b.json) } catch (err) {
          console.warn('[ai] tool input parse failed:', b.name, err?.message)
        }
      }
      content.push({ type: 'tool_use', id: b.id, name: b.name, input })
      toolUses.push({ id: b.id, name: b.name, input })
    }
  }

  return { text: text.trim(), toolUses, content, streamed: true, model }
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
  return t.slice(0, 1600)
}

/**
 * Proiezione del candidato che vede Claude. Il record completo resta lato
 * server in `candidatesById` per ricostruire le card: qui togliamo quello che
 * a Claude non serve per scegliere (slug, foto, flag interni). Meno token in
 * ingresso = round 2 più rapido, ed è il round che l'utente aspetta.
 */
function slimCandidateForClaude(c) {
  return {
    id: c.id,
    name: c.name,
    zone: c.zone,
    city: c.city,
    out_of_city: c.out_of_city,
    price: c.price,
    category: c.category,
    open_now: c.open_now,
    closes_at: c.closes_at,
    tagline: c.tagline,
    recommended_for: c.recommended_for,
    editorial: c.editorial,
    ...(c.walk_minutes != null ? { walk_minutes: c.walk_minutes } : {}),
    ...(c.active_discount ? { active_discount: c.active_discount } : {}),
  }
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
      city: c.city,
      out_of_city: c.out_of_city === true,
      photo_url: c.photo_url || null,
      why: String(pick?.why || '').trim().slice(0, 120),
      // Geo + sconto: il frontend mostra il pill se valorizzati.
      distance_km: c.distance_km ?? null,
      walk_minutes: c.walk_minutes ?? null,
      discount_percent: c.active_discount?.percent ?? null,
    })
  }
  return out
}

/**
 * Chiamata all'API Anthropic con fallback di modello.
 *
 * Se il modello preferito non è disponibile su questo account, l'API risponde
 * 404 (o 400 citando il modello): invece di rompere la chat scendiamo una
 * volta sola al modello precedente e ce lo ricordiamo per le chiamate
 * successive dello stesso processo.
 */
async function claudeFetch(apiKey, { system, messages, tools, stream = false, planner = false, toolChoice = null }) {
  for (let attempt = 0; attempt < 2; attempt++) {
    // Il planner non fa fallback: se non c'è, si usa il modello principale.
    const model = (planner && activeModel === CLAUDE_MODEL && CLAUDE_MODEL_PLANNER)
      ? CLAUDE_MODEL_PLANNER
      : activeModel
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system, tools, messages,
        ...(toolChoice ? { tool_choice: toolChoice } : {}),
        ...(stream ? { stream: true } : {}),
      }),
    })
    if (response.ok) return { response, model }

    const errBody = await response.text().catch(() => '')
    if (isModelUnavailable(response.status, errBody) && model === CLAUDE_MODEL_PLANNER && planner) {
      console.warn(`[ai] planner ${model} non disponibile, uso ${activeModel}`)
      return { response: await claudeFetch(apiKey, { system, messages, tools, stream, toolChoice }).then((r) => r.response), model: activeModel }
    }
    if (isModelUnavailable(response.status, errBody) && model !== CLAUDE_MODEL_FALLBACK) {
      console.warn(`[ai] modello ${model} non disponibile, passo a ${CLAUDE_MODEL_FALLBACK}`)
      activeModel = CLAUDE_MODEL_FALLBACK
      continue
    }
    throw new Error(`Claude HTTP ${response.status}: ${errBody.slice(0, 200)}`)
  }
  throw new Error('Claude: nessun modello disponibile')
}

function isModelUnavailable(status, body) {
  if (status === 404) return true
  return status === 400 && /model/i.test(body || '')
}

async function callClaude(apiKey, { system, messages, tools, planner = false, toolChoice = null }) {
  const { response, model } = await claudeFetch(apiKey, { system, messages, tools, planner, toolChoice })
  return { ...(await response.json()), _model: model }
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
        city: {
          type: 'string',
          description: "Città, SOLO se l'utente ne nomina una diversa da quella attiva della sessione (es. 'Milano', 'Roma', 'Marsala'). Se non la cita, lascia vuoto: cerco nella città attiva e nella sua cintura.",
        },
        zone: {
          type: 'string',
          description: "Quartiere/zona DENTRO la città, se citato (es: 'San Salvario', 'Centro', 'Quadrilatero', 'Vanchiglia', 'Crocetta'). Non usarlo per i nomi di città.",
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
/**
 * executeSearch — una ricerca "a scalini".
 *
 * Prima prova coi filtri esatti che Claude ha chiesto; se non esce niente
 * rilassa per gradi e dichiara nel risultato cosa ha mollato, così Bi può
 * essere onesta ("a Vanchiglia non ce l'ho, questo è a due fermate").
 *
 * Gli scalini sono una lista esplicita, non una ricorsione: prima
 * `executeSearch` richiamava sé stessa e rilassava solo zone/open_now/prezzo,
 * mai i filtri più stretti (moment, recommended_for, search_text), quindi una
 * query tipo "agnolotti a pranzo" tornava zero anche con locali validi in DB.
 */
async function executeSearch(admin, filters, ctx = {}) {
  const stages = buildRelaxStages(filters)
  let lastError = null

  for (const stage of stages) {
    const out = await runSearchOnce(admin, stage.filters, ctx)
    if (out.error) {
      // Mai in silenzio: un filtro malformato somiglia in tutto e per tutto a
      // "nessun risultato", e per mesi ha nascosto la zona rotta.
      console.warn('[ai] ricerca fallita, passo allo stage successivo:', out.error)
      lastError = out.error
      continue
    }
    if (out.candidates.length > 0) {
      // Foto e sconti solo sullo stage vincente e solo sui candidati che
      // Claude vedrà davvero: prima si pagavano due query per ogni stage
      // scartato.
      const top = out.candidates.slice(0, MAX_CANDIDATES)
      await enrichCandidates(admin, top, { skipDiscounts: out.discountsAttached })
      return {
        candidates: top,
        total: out.total,
        ...(stage.dropped.length ? { relaxed: true, dropped: stage.dropped } : {}),
      }
    }
  }

  if (lastError) return { error: lastError, candidates: [] }
  return { candidates: [], total: 0, relaxed: true, dropped: ['tutti i filtri'] }
}

/**
 * Sequenza di filtri via via più larghi. Ogni scalino porta con sé l'elenco
 * (in italiano, per Claude) di cosa è stato lasciato cadere rispetto alla
 * richiesta originale.
 */
/** true se il testo cercato ha piu di un termine (token di almeno 3 lettere). */
function hasMultipleTerms(text) {
  return splitSearchTerms(text).length > 1
}

function splitSearchTerms(text) {
  if (typeof text !== 'string') return []
  return text
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((t) => t.length > 2)
}

function buildRelaxStages(filters) {
  const f = { ...filters }
  const stages = [{ filters: f, dropped: [] }]
  const add = (patch, dropped) => {
    const prev = stages[stages.length - 1]
    const next = { ...prev.filters, ...patch }
    stages.push({ filters: next, dropped: [...prev.dropped, ...dropped] })
  }

  // Il full-text di Postgres mette i termini in AND: "agnolotti del plin" non
  // matcha nessun documento anche quando "agnolotti" ne matcha uno. Prima di
  // toccare gli altri filtri proviamo lo stesso testo in OR — resta una
  // ricerca sul piatto, quindi non è una perdita da dichiarare.
  if (hasMultipleTerms(f.search_text)) add({ search_mode: 'or' }, [])

  if (f.zone || f.open_now || f.near_me) {
    add({ zone: null, open_now: false, near_me: false },
      [f.zone ? 'zona' : null, f.open_now ? 'aperto adesso' : null, f.near_me ? 'vicinanza' : null].filter(Boolean))
  }
  if (f.moment || f.recommended_for || (typeof f.price_max === 'number' && f.price_max > 0 && f.price_max < 4)) {
    add(
      {
        zone: null, open_now: false, near_me: false,
        moment: null, recommended_for: null,
        price_max: typeof f.price_max === 'number' && f.price_max > 0 ? Math.min(4, f.price_max + 1) : f.price_max,
      },
      [f.moment ? 'momento' : null, f.recommended_for ? 'occasione' : null,
        typeof f.price_max === 'number' && f.price_max > 0 ? 'budget' : null].filter(Boolean),
    )
  }
  // Mollare il testo si può SOLO se resta la categoria a dare un senso al
  // risultato. Senza, "agnolotti" tornava 63 locali a caso e Bi ne consigliava
  // tre che con gli agnolotti non c'entravano niente: meglio zero e dirlo.
  if (f.search_text && f.category) {
    add({ zone: null, open_now: false, near_me: false, moment: null, recommended_for: null, price_max: null, search_text: null },
      ['ricerca testuale'])
  }
  // Ultimo scalino: fuori città. Solo se prima c'era un vincolo di categoria
  // o testo, altrimenti restituiremmo locali a caso da mezza Italia.
  if (f.category || f.search_text) {
    add({ zone: null, open_now: false, near_me: false, moment: null, recommended_for: null, price_max: null, any_city: true },
      ['città'])
  }
  return stages
}

/* Una singola passata sul DB. */
async function runSearchOnce(admin, filters, ctx) {
  const { userLocation = null, sessionCity = DEFAULT_CITY } = ctx

  let query = admin
    .from('restaurants')
    .select('id, slug, name, address, city, cuisine_type, category, price_range, our_rating, tagline, our_review, our_tip, recommended_for, hours_cache, moments, latitude, longitude, is_published')
    .eq('is_published', true)
    // ⚠️ ORDER esplicito: senza, Postgres restituiva un sottoinsieme arbitrario
    // e il cap tagliava fuori locali validi in modo non deterministico.
    .order('our_rating', { ascending: false, nullsFirst: false })
    .order('name', { ascending: true })
    .limit(200)

  // ── Città ──
  // filters.city (se Claude l'ha dedotta dal messaggio) vince sulla città
  // attiva della sessione. any_city = ultimo scalino di rilassamento.
  const requestedCity = typeof filters.city === 'string' && filters.city.trim()
    ? capitalizeCity(filters.city.trim())
    : sessionCity
  // Il match è in JS e su stringa normalizzata: i valori di `city` in DB
  // arrivano da Google Places con maiuscole e apostrofi non uniformi
  // ("Anzola d'Ossola"), e un `.in()` esatto ne perderebbe qualcuno.
  // Il set completo dei pubblicati è ~100 kB: filtrarlo qui non costa nulla.
  const cityAllow = filters.any_city
    ? null
    : new Set(expandCity(requestedCity).map(normCity))

  if (filters.category) {
    const cat = String(filters.category).trim().replace(/[%,{}"]/g, '')
    if (cat) {
      const capitalized = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()
      // Le virgolette servono alle categorie multi-parola ("Street Food"):
      // senza, PostgREST spezza l'array literal sullo spazio.
      query = query.or(`cuisine_type.ilike.%${cat}%,category.cs.{"${cat}"},category.cs.{"${capitalized}"}`)
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
    if (filters.search_mode === 'or') {
      // tsquery esplicito coi termini in OR: "agnolotti | plin" trova le piole
      // che ne citano almeno uno. Stemming italiano comunque attivo.
      const terms = splitSearchTerms(safe)
      if (terms.length > 0) {
        query = query.textSearch('search_tsv', terms.join(' | '), { config: 'italian' })
      }
    } else {
      // Italian websearch su colonna generata: matcha morfologia (agnolotti↔agnolotto).
      query = query.textSearch('search_tsv', safe, { type: 'websearch', config: 'italian' })
    }
  }

  const { data, error } = await query
  if (error) return { error: error.message, candidates: [], total: 0 }

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
      city: r.city || DEFAULT_CITY,
      // Fuori dalla città che l'utente sta guardando: Bi deve dirlo, non
      // spacciarlo per "qui vicino".
      out_of_city: normCity(r.city) !== normCity(requestedCity),
      price: r.price_range ? '€'.repeat(r.price_range) : null,
      category: Array.isArray(r.category) && r.category[0] ? r.category[0] : (r.cuisine_type || ''),
      // true = aperto, false = chiuso, null = orari non disponibili.
      open_now: openStatus.open,
      closes_at: openStatus.closesAt,
      // Campi editoriali che Claude usa per scegliere e scrivere il "why"
      tagline: r.tagline || '',
      our_rating: r.our_rating || null,
      moments: Array.isArray(r.moments) ? r.moments : [],
      recommended_for: Array.isArray(r.recommended_for) ? r.recommended_for : [],
      editorial: {
        review_excerpt: truncate(r.our_review, 200),
        tip: r.our_tip || '',
      },
      // Geo (null se l'utente non ha condiviso la posizione)
      distance_km: distance_km != null ? Math.round(distance_km * 10) / 10 : null,
      walk_minutes,
      moment_match: momentOk.match,
    }
  })

  let filtered = candidates
  if (cityAllow) filtered = filtered.filter((r) => cityAllow.has(normCity(r.city)))
  if (filters.moment) filtered = filtered.filter((r) => r.moment_match)
  // ⚠️ `open_now === null` = orari sconosciuti, li teniamo. Prima la guardia
  // era `r.open_now || r.closes_at == null`: per un locale CHIUSO closes_at è
  // null, quindi passava lo stesso e il filtro "aperto adesso" non filtrava nulla.
  if (filters.open_now) filtered = filtered.filter((r) => r.open_now !== false)

  // Filtro "vicino a me": richiede userLocation. Tiene chi è entro NEAR_KM
  // e ordina per distanza crescente. Se userLocation manca → no-op (Claude
  // sa che è inutile, ma per sicurezza non rompiamo nulla).
  const NEAR_KM = 2.0
  if (filters.near_me === true && userLocation) {
    filtered = filtered
      .filter((r) => r.distance_km != null && r.distance_km <= NEAR_KM)
      .sort((a, b) => (a.distance_km ?? 9e9) - (b.distance_km ?? 9e9))
  }

  // "Solo sconti" deve filtrare PRIMA del cap, quindi qui gli sconti servono
  // per forza. Negli altri casi l'arricchimento avviene una volta sola, sullo
  // stage vincente (vedi executeSearch).
  let discountsAttached = false
  if (filters.discount_only === true && filtered.length > 0) {
    await attachDiscounts(admin, filtered)
    filtered = filtered.filter((r) => r.active_discount)
    discountsAttached = true
  }

  // L'ordine è già quello editoriale (our_rating desc) o per distanza se
  // near_me è attivo: il taglio a MAX_CANDIDATES lo fa executeSearch.
  return { candidates: filtered, total: filtered.length, discountsAttached }
}

/**
 * Foto + sconti sui candidati finali, in parallelo. Le foto NON vengono
 * mostrate a Claude (token sprecati): restano sul candidato lato server e
 * finiscono nelle card via buildResultsFromPicks, così la card nasce già con
 * l'immagine invece di aspettare un secondo giro di rete dal browser.
 */
async function enrichCandidates(admin, candidates, { skipDiscounts = false } = {}) {
  if (!candidates || candidates.length === 0) return candidates
  await Promise.all([
    attachPhotos(admin, candidates),
    skipDiscounts ? Promise.resolve() : attachDiscounts(admin, candidates),
  ])
  return candidates
}

async function attachPhotos(admin, candidates) {
  const { data, error } = await admin
    .from('restaurant_photos')
    .select('restaurant_id, photo_url, thumb_url, sort_order')
    .in('restaurant_id', candidates.map((r) => r.id))
    .order('sort_order', { ascending: true })
  if (error) { console.warn('[ai] foto non caricate:', error.message); return }
  const byRest = new Map()
  for (const p of (data || [])) {
    if (!byRest.has(p.restaurant_id)) byRest.set(p.restaurant_id, p.thumb_url || p.photo_url || null)
  }
  for (const c of candidates) c.photo_url = byRest.get(c.id) || null
}

/**
 * Sconti attivi sui candidati.
 *
 * ⚠️ Le colonne interrogate qui erano `discount_percent`, `starts_at` e
 * `ends_at`: NESSUNA delle tre esiste. La tabella ha `discount_value` +
 * `discount_type` e `valid_from` / `valid_until`. La query falliva sempre, e
 * l'errore non veniva nemmeno letto — quindi il badge "−X%" non è mai
 * comparso e `discount_only` (il prompt "Sconti attivi stasera" in home)
 * tornava sempre zero.
 *
 * "Attivo" usa la stessa definizione del resto dell'app (useDiscounts):
 * `is_active` e `valid_until` nel futuro.
 */
async function attachDiscounts(admin, candidates) {
  const nowIso = new Date().toISOString()
  const { data, error } = await admin
    .from('discounts')
    .select('restaurant_id, title, discount_type, discount_value, valid_until')
    .eq('is_active', true)
    .gt('valid_until', nowIso)
    .in('restaurant_id', candidates.map((r) => r.id))
  if (error) { console.warn('[ai] sconti non caricati:', error.message); return }

  const byRest = new Map()
  for (const d of (data || [])) {
    const prev = byRest.get(d.restaurant_id)
    // A parità, tieni la percentuale più alta.
    if (!prev || (discountPercent(d) || 0) > (discountPercent(prev) || 0)) {
      byRest.set(d.restaurant_id, d)
    }
  }
  for (const c of candidates) {
    const d = byRest.get(c.id)
    if (d) {
      c.active_discount = {
        percent: discountPercent(d),
        title: d.title || null,
        ends_at: d.valid_until || null,
      }
    }
  }
}

/** Percentuale dello sconto, o null se è a importo fisso o illeggibile. */
function discountPercent(d) {
  if (d?.discount_type !== 'percentage') return null
  const n = Number(d.discount_value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function normCity(c) {
  return String(c || '').trim().toLowerCase()
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
      'centro storico', 'piazza castello', 'via po', 'via roma',
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

  // ⚠️ I pattern vanno ripuliti da virgole e % come l'input: la lista `or=` è
  // separata da virgole, e un alias tipo "via po," spezzava il logic tree →
  // PGRST100 su OGNI ricerca con zona. L'errore veniva ingoiato in silenzio e
  // la zona finiva sempre rilassata: "in centro" non ha mai filtrato niente.
  const patterns = (ALIASES[zone] || [zone])
    .map((p) => String(p).replace(/[%,()]/g, '').trim())
    .filter(Boolean)
  if (patterns.length === 0) return null
  return patterns.map((p) => `address.ilike.%${p}%`).join(',')
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
function buildSystemBlocks(currentMoment, userLocation, userPreferences, sessionCity = DEFAULT_CITY) {
  const momentHint = currentMoment && MOMENT_LABELS[currentMoment]
    ? `\nMomento corrente per l'utente: ${MOMENT_LABELS[currentMoment]}.`
    : ''
  const locationHint = userLocation
    ? `\nPosizione utente: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)} — i candidati ti arrivano con \`distance_km\` e \`walk_minutes\` valorizzati, puoi filtrare con \`near_me: true\` e citare i minuti a piedi nel why.`
    : '\nPosizione utente: NON disponibile — il filtro `near_me` non funziona. Non promettere "vicino a te". Se l\'utente chiede prossimità, chiedigli di condividere la posizione dal bottone 📍 in basso.'
  const prefBlock = formatPreferencesBlock(userPreferences)
  const cityHint = `\nCittà attiva della sessione: ${sessionCity}. Se l'utente non ne nomina un'altra, cerco lì (e nella cintura). Non passare il nome della città nel filtro \`zone\`.`

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
      text: `Contesto sessione corrente:${cityHint}${momentHint}${locationHint}${prefBlock}\nData/ora: ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}.`,
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

const STATIC_SYSTEM_PROMPT = `Sei Bi, la voce della guida ChiamamiBi.com. In prima persona, hai selezionato quasi cento fra ristoranti, bar e bistrot — tutti validati da te. Il grosso è a Torino, il resto sparso in una trentina di altre città italiane. Quando un utente ti chiede dove andare, rispondi col tuo tono: diretto, caldo, asciutto, parlato. Niente formalità.

# REGOLE FERREE
1. Consigli SOLO i locali che il tool search_restaurants ti restituisce. Mai inventare nomi, mai usare conoscenza esterna su ristoranti. Se non sono nel mio database, non esistono per te.
2. Mai "il migliore", mai classifiche, mai stelle. La promessa è "io ti seleziono", non "io ti classifico".
3. Mai chiedere o citare recensioni utenti / rating utenti. Esiste solo il MIO giudizio editoriale (campo our_review + our_tip).
4. Italiano naturale, prima persona singolare, parlato. "Ho", "ti dico", "vai", "te lo metto in mano", "non te lo classifico". Mai "Ecco i risultati", "Posso aiutarti", "Sicuramente troverai", "I migliori che ho trovato".
5. Nel testo della tua bolla NON elencare i nomi dei locali, né le loro categorie, zone o indirizzi: sono già nelle card. Il tuo testo introduce, non riassume.
6. Massimo 3 picks per risposta. Per domanda puntuale (un piatto specifico) anche solo 1-2.
7. Città: cerco di default nella città attiva della sessione (te la dico nel contesto) e nella sua cintura. \`out_of_city: true\` = fuori da quella città. Se ne consigli uno, dillo nel testo ("questo però è a Rivoli"). Se lo scarti, NON dirlo: chi non consigli non esiste.
8. **CORTO.** Massimo 2 frasi, sotto le 35 parole. Una risposta lunga suona da assistente, e Bi non è un assistente.
9. Mai chiedere il permesso di cercare ancora, mai offrire alternative di ricerca, mai rimandare la palla. VIETATE: "se vuoi posso…", "vuoi che…", "dimmi tu…", "fammi sapere…", "come preferisci…", "posso allargare…". Se serve allargare, il tool l'ha già fatto: presenta quello che hai. Se non hai niente, chiudi in una frase.
10. Mai raccontare come stai lavorando né cosa hai scartato. VIETATE: "il candidato da X lo salto", "ho cercato e…", "tra gli altri…", "fammi guardare". L'utente vede il risultato, non il tuo processo.
11. Niente punti esclamativi. Niente entusiasmo di servizio.

# STRATEGIA DI RICERCA
Procedi così:
1. Chiama search_restaurants UNA volta con i filtri più rilevanti citati dall'utente. Mai più filtri di quanti l'utente ne abbia espressi.
2. Per piatti o caratteristiche evocative (es. "agnolotti", "tartare", "vermouth", "silenzioso") usa search_text — stemming italiano, matcha singolare/plurale.
3. Per intenzioni ("romantico", "con gli amici", "tradizionale", "vegetariano") usa recommended_for col tag corrispondente. Non confondere con category.
4. Il tool rilassa già i filtri da solo, per gradi, quando la ricerca esatta è vuota. Quando lo fa te lo dice: nella risposta trovi \`relaxed: true\` e \`dropped: [...]\` con l'elenco di cosa ha mollato ("zona", "momento", "budget", "città"). USALO NEL TESTO, è la tua onestà: "a Vanchiglia non ce l'ho, questo è a due fermate", "sforo un pelo il budget che mi avevi dato". Se \`dropped\` include "città" i locali sono di un'altra città: dillo.
   Mezza frase, non un paragrafo: "questo però è a due fermate", "sforo un pelo il budget". Poi passa ai picks.
   Rilancia search_restaurants a mano UNA volta sola, e solo se hai capito che il primo giro aveva un filtro sbagliato (categoria errata, zona scambiata per città). Se il tool torna comunque zero, chiudi a parole: NON continuare a cercare.
5. Quando hai ≥1 candidato, leggi davvero i campi editorial.review_excerpt e editorial.tip per scegliere e per scrivere il "why". Non scegliere a caso.

# COME SCRIVI LA TUA RISPOSTA
Dopo aver letto i candidati, rispondi nella stessa risposta con DUE blocchi nell'ordine:

A) BLOCCO TESTO (la "bolla" di Bi): **1-2 frasi, sotto le 35 parole.** Prima persona, voce calda e asciutta, parlata. Niente nomi di locali (li mette la card), niente JSON, niente bullet, niente "ecco". Chiudi con i due punti quando presenti dei picks.
Se hai dovuto accontentarti (niente napoletana, zona allargata, budget sforato), dillo in mezza frase e passa oltre — non ci costruisci sopra un paragrafo.
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
- open_now: \`true\` aperto adesso, \`false\` chiuso, \`null\` non ho gli orari di quel locale. Con \`null\` non promettere che è aperto: al massimo "dovrebbe essere aperto, dagli un colpo di telefono".
- out_of_city: \`true\` = il locale non è nella città attiva. Vedi regola ferrea 7.
- price: \`null\` significa che non ho la fascia di prezzo. Non inventarla.
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
Guarda la lunghezza, non solo il tono: è quella il punto.

[Aperitivo a Vanchiglia, 3 candidati]
TESTO: "A Vanchiglia per l'aperitivo sei nel posto giusto. Te ne dico tre dove andrei io:"
PICKS: 3 con why specifici tipo "I tarallini caldi alle 18.", "Vermouth selezionati a mano.", "Tagliere generoso, vino vero."

[Pizza napoletana in centro → napoletana non c'è, altre pizze sì]
TESTO: "Napoletana in senso stretto in centro non ce l'ho. Altre pizze buone sì, e queste te le firmo:"
PICKS: 2-3.
✗ SBAGLIATO (troppo lungo, elenca le categorie, racconta cosa ha scartato): "Napoletana in senso stretto non ce l'ho in centro, ma hai due/tre alternative di tutto rispetto — teglia romana, padellino torinese, pane e pizza d'autore. Il candidato da Collegno lo salto, non è in centro. Tra gli altri, ecco dove mi fido davvero:"

[Cinese a Vanchiglia → 0 candidati dopo il rilassamento]
TESTO: "Cinese a Vanchiglia non ce l'ho — è zona da italiano e da bistrot."
PICKS: (nessuno)
✗ SBAGLIATO (chiede il permesso, rimanda la palla): "Se vuoi posso cercare senza il vincolo cinese e vedo cos'altro ho, oppure se allarghi la zona posso trovare qualcosa in più — dimmi tu come preferisci muoverti!"

[Agnolotti del plin]
TESTO: "Gli agnolotti li fanno a mano in un paio dei miei:"
PICKS: 2 con why tipo "Il plin è la specialità della casa."

[Query ambigua: "consigliami qualcosa"]
TESTO: "Che voglia hai? Pesce, pizza, asiatico, tradizione — e in che zona ti muovi?"
PICKS: (nessuno)

[Richiesta classifica: "il miglior pesce di Torino"]
TESTO: "Non te li classifico in migliori, non è il mio mestiere. Per pesce però te ne dico due:"
PICKS: 1-2.

Ricorda: il testo è la TUA voce, i picks sono le card. Una sola chiamata a present_picks alla fine. Se mai dovessi essere indeciso fra dire qualcosa di generico o dire la verità, di' sempre la verità — in due frasi.`

/* ------------------------------------------------------------------ */
/*  Export per i test (node --test tests/ai-engine.test.mjs).           */
/*  Non usati a runtime: Vercel importa solo il default export.         */
/* ------------------------------------------------------------------ */
export const __testables = {
  runConversation,
  executeSearch,
  buildRelaxStages,
  normalizeHistory,
  sanitizeCity,
  expandCity,
  cleanupText,
  buildResultsFromPicks,
  mapZoneToAddressPatterns,
  splitSearchTerms,
}
