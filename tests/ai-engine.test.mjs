/**
 * Test del motore di "Chiedi a Bi" (api/ai.js).
 *
 * Niente rete: `fetch` verso Anthropic è stubbato e Supabase è un finto
 * query builder in memoria. Copre le regressioni che avevano rotto la chat
 * in produzione (bolla vuota, storico invertito, "aperto adesso" inerte).
 *
 *   node --test tests/ai-engine.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { __testables } from '../api/ai.js'

const {
  runConversation, executeSearch, buildRelaxStages,
  normalizeHistory, sanitizeCity, expandCity,
} = __testables

/* ---------------- finto Supabase ---------------- */

const RESTAURANTS = [
  row({ id: 'r1', name: 'Pizzeria Centro', city: 'Torino', address: 'Via Po 1, 10123 Torino TO', cuisine_type: 'Pizza', category: ['Pizza'], our_rating: 9, open: true }),
  row({ id: 'r2', name: 'Pizzeria Chiusa', city: 'Torino', address: 'Via Roma 2, 10123 Torino TO', cuisine_type: 'Pizza', category: ['Pizza'], our_rating: 8, open: false }),
  row({ id: 'r3', name: 'Pizzeria Marsala', city: 'Marsala', address: 'Via Mazara 3, 91025 Marsala TP', cuisine_type: 'Pizza', category: ['Pizza'], our_rating: 10 }),
  row({ id: 'r4', name: 'Bistrot Collegno', city: 'Collegno', address: 'Corso Francia 4, 10093 Collegno TO', cuisine_type: 'Bistrot', category: ['Bistrot'], our_rating: 7 }),
]

function row({ id, name, city, address, cuisine_type, category, our_rating, open }) {
  // hours_cache: aperto/chiuso tutta la settimana, o assente se `open` è undefined.
  let hours_cache = null
  if (open === true) {
    hours_cache = { utcOffsetMinutes: 0, regularOpeningHours: { periods: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ open: { day: d, hour: 0, minute: 0 }, close: { day: d, hour: 23, minute: 59 } })) } }
  } else if (open === false) {
    hours_cache = { utcOffsetMinutes: 0, regularOpeningHours: { periods: [{ open: { day: 0, hour: 3, minute: 0 }, close: { day: 0, hour: 3, minute: 30 } }] } }
  }
  return {
    id, slug: id, name, address, city, cuisine_type, category,
    price_range: 2, our_rating, tagline: `${name} tagline`,
    our_review: `Recensione di ${name}.`, our_tip: `Tip di ${name}.`,
    recommended_for: [], hours_cache, moments: null,
    latitude: 45.07, longitude: 7.68, is_published: true,
  }
}

/** Query builder minimo: registra i filtri e li applica in memoria. */
function fakeAdmin(rows = RESTAURANTS) {
  const builder = (table) => {
    const state = { table, eqs: [], ins: [], contains: [], lte: [], ors: [], textSearch: null, limit: Infinity }
    const api = {
      select: () => api,
      order: () => api,
      limit: (n) => { state.limit = n; return api },
      eq: (col, val) => { state.eqs.push([col, val]); return api },
      lte: (col, val) => { state.lte.push([col, val]); return api },
      gte: () => api,
      in: (col, vals) => { state.ins.push([col, vals]); return api },
      contains: (col, vals) => { state.contains.push([col, vals]); return api },
      or: (expr) => { state.ors.push(expr); return api },
      textSearch: (col, q) => { state.textSearch = q; return api },
      then: (resolve) => resolve(run(state)),
    }
    return api
  }
  const run = (state) => {
    if (state.table === 'discounts') return { data: [], error: null }
    let out = rows.filter((r) => r.is_published)
    for (const [col, vals] of state.ins) out = out.filter((r) => vals.includes(r[col]))
    for (const [col, val] of state.lte) out = out.filter((r) => r[col] <= val)
    for (const [col, vals] of state.contains) out = out.filter((r) => (r[col] || []).some((v) => vals.includes(v)))
    for (const expr of state.ors) {
      out = out.filter((r) => expr.split(',').some((clause) => {
        const m = clause.match(/^cuisine_type\.ilike\.%(.+)%$/)
        if (m) return String(r.cuisine_type || '').toLowerCase().includes(m[1].toLowerCase())
        const c = clause.match(/^category\.cs\.\{"?(.+?)"?\}$/)
        if (c) return (r.category || []).some((x) => x.toLowerCase() === c[1].toLowerCase())
        const a = clause.match(/^address\.ilike\.%(.+)%$/)
        if (a) return String(r.address || '').toLowerCase().includes(a[1].toLowerCase())
        return false
      }))
    }
    if (state.textSearch) {
      const q = state.textSearch.toLowerCase()
      out = out.filter((r) => `${r.name} ${r.our_review} ${r.our_tip}`.toLowerCase().includes(q))
    }
    return { data: out.slice(0, state.limit), error: null }
  }
  return { from: builder }
}

/* ---------------- finto Anthropic ---------------- */

/** Costruisce il body SSE di un turno streamato a partire da blocchi logici. */
function sseBody(blocks) {
  let out = ''
  blocks.forEach((b, i) => {
    if (b.type === 'text') {
      out += `event: content_block_start\ndata: ${JSON.stringify({ index: i, content_block: { type: 'text', text: '' } })}\n\n`
      for (const chunk of b.chunks) {
        out += `event: content_block_delta\ndata: ${JSON.stringify({ index: i, delta: { type: 'text_delta', text: chunk } })}\n\n`
      }
    } else {
      out += `event: content_block_start\ndata: ${JSON.stringify({ index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } })}\n\n`
      out += `event: content_block_delta\ndata: ${JSON.stringify({ index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } })}\n\n`
    }
    out += `event: content_block_stop\ndata: ${JSON.stringify({ index: i })}\n\n`
  })
  out += 'event: message_stop\ndata: {"type":"message_stop"}\n\n'
  return out
}

/** Stub di fetch: consuma `turns` in ordine, uno per chiamata a Claude. */
function stubFetch(turns) {
  const calls = []
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body)
    calls.push(body)
    const turn = turns.shift()
    if (!turn) throw new Error('stub fetch: nessun turno rimasto')
    if (body.stream) {
      const bytes = new TextEncoder().encode(sseBody(turn))
      return {
        ok: true,
        body: { getReader: () => { let sent = false; return { read: async () => (sent ? { done: true } : (sent = true, { done: false, value: bytes })) } } },
      }
    }
    return {
      ok: true,
      json: async () => ({
        stop_reason: turn.some((b) => b.type !== 'text') ? 'tool_use' : 'end_turn',
        content: turn.map((b) => (b.type === 'text'
          ? { type: 'text', text: b.chunks.join('') }
          : { type: 'tool_use', id: b.id, name: b.name, input: b.input })),
      }),
    }
  }
  return calls
}

/** Finto `res` che raccoglie gli eventi SSE scritti. */
function fakeRes() {
  const events = []
  return {
    events,
    write: (chunk) => {
      const m = chunk.match(/^event: (\w+)\ndata: ([\s\S]*)\n\n$/)
      if (m) events.push({ name: m[1], data: JSON.parse(m[2]) })
    },
    text: () => events.filter((e) => e.name === 'delta').map((e) => e.data.text).join(''),
    picks: () => (events.find((e) => e.name === 'picks') || {}).data,
  }
}

/* ================= i test ================= */

test('streaming: una seconda search_restaurants viene eseguita, non buttata', async () => {
  // Questo è il bug che svuotava la chat: round 2 = solo un tool_use di
  // ricerca. Prima finiva nel nulla → bolla vuota e zero card.
  stubFetch([
    // round 1 (sync): cerca pizza a Vanchiglia
    [{ type: 'tool', id: 't1', name: 'search_restaurants', input: { category: 'pizza', zone: 'vanchiglia' } }],
    // round 2 (stream): non convinta, ricerca allargata — SENZA testo
    [{ type: 'tool', id: 't2', name: 'search_restaurants', input: { category: 'pizza' } }],
    // round 3 (stream): finalmente parla e presenta
    [
      { type: 'text', chunks: ['Per la pizza ', 'ti dico questa.'] },
      { type: 'tool', id: 't3', name: 'present_picks', input: { picks: [{ restaurant_id: 'r1', why: 'Impasto vero.' }] } },
    ],
  ])
  const res = fakeRes()
  const out = await runConversation({
    apiKey: 'x', admin: fakeAdmin(), history: [], userPrompt: 'pizza a vanchiglia',
    currentMoment: null, userLocation: null, userPreferences: null,
    sessionCity: 'Torino', res,
  })

  assert.equal(out.message, 'Per la pizza ti dico questa.')
  assert.equal(out.results.length, 1)
  assert.equal(out.results[0].name, 'Pizzeria Centro')
  assert.equal(res.text(), 'Per la pizza ti dico questa.')
  assert.equal(res.picks().length, 1)
})

test('streaming: mai una bolla vuota anche se Claude non scrive nulla', async () => {
  stubFetch([
    [{ type: 'tool', id: 't1', name: 'search_restaurants', input: { category: 'pizza' } }],
    [{ type: 'tool', id: 't2', name: 'search_restaurants', input: { category: 'pizza' } }],
    [{ type: 'tool', id: 't3', name: 'search_restaurants', input: { category: 'pizza' } }],
    [{ type: 'tool', id: 't4', name: 'search_restaurants', input: { category: 'pizza' } }],
  ])
  const res = fakeRes()
  const out = await runConversation({
    apiKey: 'x', admin: fakeAdmin(), history: [], userPrompt: 'pizza',
    currentMoment: null, userLocation: null, userPreferences: null,
    sessionCity: 'Torino', res,
  })
  assert.ok(out.message.length > 0, 'il messaggio non deve essere vuoto')
  assert.equal(res.text(), out.message)
  assert.deepEqual(res.picks(), [])
})

test('non-streaming: stesso loop, stesso risultato', async () => {
  stubFetch([
    [{ type: 'tool', id: 't1', name: 'search_restaurants', input: { category: 'pizza' } }],
    [{ type: 'tool', id: 't2', name: 'search_restaurants', input: { category: 'pizza' } }],
    [
      { type: 'text', chunks: ['Eccoti.'] },
      { type: 'tool', id: 't3', name: 'present_picks', input: { picks: [{ restaurant_id: 'r1', why: 'Impasto vero.' }] } },
    ],
  ])
  const out = await runConversation({
    apiKey: 'x', admin: fakeAdmin(), history: [], userPrompt: 'pizza',
    currentMoment: null, userLocation: null, userPreferences: null,
    sessionCity: 'Torino',
  })
  assert.equal(out.message, 'Eccoti.')
  assert.equal(out.results[0].restaurant_id, 'r1')
})

test('la ricerca resta nella città attiva (e nella sua cintura)', async () => {
  const out = await executeSearch(fakeAdmin(), { category: 'pizza' }, { sessionCity: 'Torino' })
  const cities = out.candidates.map((c) => c.city)
  assert.ok(!cities.includes('Marsala'), 'niente Marsala per chi guarda Torino')
  assert.ok(cities.includes('Torino'))
})

test('la cintura torinese è marcata out_of_city', async () => {
  const out = await executeSearch(fakeAdmin(), { category: 'bistrot' }, { sessionCity: 'Torino' })
  assert.equal(out.candidates.length, 1)
  assert.equal(out.candidates[0].city, 'Collegno')
  assert.equal(out.candidates[0].out_of_city, true)
})

test('una città esplicita batte quella di sessione', async () => {
  const out = await executeSearch(fakeAdmin(), { category: 'pizza', city: 'marsala' }, { sessionCity: 'Torino' })
  assert.deepEqual(out.candidates.map((c) => c.name), ['Pizzeria Marsala'])
})

test('open_now scarta davvero i locali chiusi', async () => {
  const out = await executeSearch(fakeAdmin(), { category: 'pizza', open_now: true }, { sessionCity: 'Torino' })
  const names = out.candidates.map((c) => c.name)
  assert.ok(names.includes('Pizzeria Centro'), 'il locale aperto resta')
  assert.ok(!names.includes('Pizzeria Chiusa'), 'il locale chiuso sparisce')
})

test('lo scalino di rilassamento dichiara cosa ha mollato', async () => {
  // Zona inesistente in DB → il primo scalino è vuoto, il secondo molla la zona.
  const out = await executeSearch(fakeAdmin(), { category: 'pizza', zone: 'crocetta' }, { sessionCity: 'Torino' })
  assert.ok(out.candidates.length > 0)
  assert.equal(out.relaxed, true)
  assert.deepEqual(out.dropped, ['zona'])
})

test('buildRelaxStages arriva a mollare testo e città', () => {
  const stages = buildRelaxStages({ category: 'pizza', zone: 'centro', moment: 'cena', search_text: 'agnolotti', price_max: 2 })
  assert.deepEqual(stages[0].dropped, [])
  assert.deepEqual(stages.at(-1).dropped, ['zona', 'momento', 'budget', 'ricerca testuale', 'città'])
  assert.equal(stages.at(-1).filters.any_city, true)
})

test('la history tiene gli ULTIMI messaggi e parte da un turno utente', () => {
  // Arriva in ordine DESC dal DB (il più recente per primo).
  const rows = [
    { role: 'assistant', content: { text: 'A3' } },
    { role: 'user', content: { text: 'U3' } },
    { role: 'assistant', content: { text: 'A2' } },
    { role: 'user', content: { text: 'U2' } },
    { role: 'assistant', content: { text: 'A1' } },
  ]
  assert.deepEqual(normalizeHistory(rows), [
    { role: 'user', content: 'U2' },
    { role: 'assistant', content: 'A2' },
    { role: 'user', content: 'U3' },
    { role: 'assistant', content: 'A3' },
  ])
})

test('la history fonde i turni rimasti appaiati dopo aver scartato i vuoti', () => {
  const rows = [
    { role: 'user', content: { text: 'seconda' } },
    { role: 'assistant', content: { text: '' } }, // vecchia risposta vuota in DB
    { role: 'user', content: { text: 'prima' } },
  ]
  assert.deepEqual(normalizeHistory(rows), [{ role: 'user', content: 'prima\n\nseconda' }])
})

test('sanitizeCity / expandCity', () => {
  assert.equal(sanitizeCity('  torino '), 'Torino')
  assert.equal(sanitizeCity('san mauro torinese'), 'San Mauro Torinese')
  assert.equal(sanitizeCity(''), 'Torino')
  assert.equal(sanitizeCity(null), 'Torino')
  assert.ok(expandCity('Torino').includes('Collegno'))
  assert.deepEqual(expandCity('Milano'), ['Milano'])
})

test('testo su più round: server e client vedono la stessa stringa', async () => {
  stubFetch([
    // round 1 (sync): parla e poi cerca
    [
      { type: 'text', chunks: ['Fammi guardare.'] },
      { type: 'tool', id: 't1', name: 'search_restaurants', input: { category: 'pizza' } },
    ],
    // round 2 (stream): parla e presenta
    [
      { type: 'text', chunks: ['Ecco.'] },
      { type: 'tool', id: 't2', name: 'present_picks', input: { picks: [{ restaurant_id: 'r1', why: 'Impasto vero.' }] } },
    ],
  ])
  const res = fakeRes()
  const out = await runConversation({
    apiKey: 'x', admin: fakeAdmin(), history: [], userPrompt: 'pizza',
    currentMoment: null, userLocation: null, userPreferences: null,
    sessionCity: 'Torino', res,
  })
  assert.equal(out.message, 'Fammi guardare.\n\nEcco.')
  assert.equal(res.text(), out.message, 'client e DB devono combaciare')
})

test('due tool call nello stesso turno ricevono entrambe il loro tool_result', async () => {
  // L'API rifiuta il turno successivo se un tool_use resta senza risposta.
  const calls = stubFetch([
    [
      { type: 'tool', id: 'a', name: 'search_restaurants', input: { category: 'pizza' } },
      { type: 'tool', id: 'b', name: 'search_restaurants', input: { category: 'bistrot' } },
    ],
    [
      { type: 'text', chunks: ['Due strade.'] },
      { type: 'tool', id: 'c', name: 'present_picks', input: { picks: [{ restaurant_id: 'r1', why: 'Impasto vero.' }] } },
    ],
  ])
  const res = fakeRes()
  await runConversation({
    apiKey: 'x', admin: fakeAdmin(), history: [], userPrompt: 'pizza o bistrot',
    currentMoment: null, userLocation: null, userPreferences: null,
    sessionCity: 'Torino', res,
  })
  const second = calls[1].messages.at(-1)
  assert.equal(second.role, 'user')
  assert.deepEqual(second.content.map((c) => c.tool_use_id), ['a', 'b'])
})
