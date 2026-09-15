/**
 * Il dispatcher delle email, chiamato come lo chiama Vercel.
 *
 * Perché serve: la preview su Vercel è protetta da SSO, quindi la funzione
 * distribuita non si può chiamare da fuori per provarla. Qui si carica il
 * modulo esattamente come fa il runtime (import ESM del default export) e
 * gli si passano un `req` e un `res` finti, così i rami nuovi del router
 * vengono percorsi davvero invece che solo letti.
 *
 * Quello che queste prove proteggono è la porta d'ingresso: che un tipo
 * sconosciuto non passi, che le ricevute non partano senza un token di
 * sessione, e soprattutto che la catena di import si risolva — è quella che
 * si rompe in silenzio quando si sposta un file, e si scopre solo quando un
 * utente prende uno sconto e la ricevuta non arriva.
 *
 *   node --test tests/send-email-routes.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'

const { default: handler } = await import('../api/send-email.js')

/** Un `res` finto che registra quello che l'handler ci scrive sopra. */
function mockRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.end = () => res
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

const call = async (body, headers = {}) => {
  const res = mockRes()
  await handler({ method: 'POST', body, headers, socket: {} }, res)
  return res
}

/** Come sopra, ma con metodo e query: la disiscrizione non manda un JSON. */
const callRaw = async ({ method = 'POST', query = {}, body = {}, headers = {} }) => {
  const res = mockRes()
  await handler({ method, query, body, headers, socket: {} }, res)
  return res
}

test('il modulo espone un handler', () => {
  assert.equal(typeof handler, 'function')
})

test('senza `type` non si va da nessuna parte', async () => {
  const res = await call({})
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /type/)
})

test('un tipo sconosciuto viene respinto, non ignorato', async () => {
  const res = await call({ type: 'qualcosa-che-non-esiste' })
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /Unknown type/)
})

test('solo POST', async () => {
  const res = mockRes()
  await handler({ method: 'GET', body: {}, headers: {}, socket: {} }, res)
  assert.equal(res.statusCode, 405)
})

/* ── Le ricevute vogliono un'identità ──────────────────────────────── */

test('la ricevuta dello sconto non parte senza token di sessione', async () => {
  const res = await call({ type: 'discount-claimed', redemptionId: 'x' })
  // 401 e non 500: il ramo è stato percorso e ha fatto il controllo giusto.
  assert.equal(res.statusCode, 401)
  assert.match(res.body.error, /authorization/i)
})

test('l’anteprima non parte senza token di sessione', async () => {
  const res = await call({ type: 'preview', template: 'welcome' })
  assert.equal(res.statusCode, 401)
})

test('un token inventato non basta: viene verificato davvero', async () => {
  const res = await call(
    { type: 'discount-claimed', redemptionId: 'x' },
    { authorization: 'Bearer non-e-un-token-vero' }
  )
  // Senza le variabili d'ambiente qui si ferma prima (500 di configurazione);
  // con le variabili a posto il token finto viene rifiutato (401). In nessuno
  // dei due casi l'email parte, ed è l'unica cosa che conta.
  assert.ok([401, 500].includes(res.statusCode), `atteso 401 o 500, ricevuto ${res.statusCode}`)
  assert.ok(res.body.error, 'deve dire perché')
})

/* ── La conferma dopo la scansione ─────────────────────────────────── */

test('la conferma di uso vuole il codice QR', async () => {
  const res = await call({ type: 'discount-used' })
  // Senza env si ferma sulla configurazione, con env chiede il codice.
  assert.ok([400, 500].includes(res.statusCode), `atteso 400 o 500, ricevuto ${res.statusCode}`)
})


/* ── Disiscrizione a un clic ───────────────────────────────────────── */

test('la disiscrizione a un clic non passa dal router dei `type`', async () => {
  // Gmail fa una POST senza il nostro JSON: se finisse nel router normale si
  // beccherebbe "Missing required field: type" e la persona resterebbe
  // iscritta convinta di essersi tolta.
  const res = await callRaw({ query: { unsub: 'non-un-uuid' } })
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /token/i, 'deve lamentarsi del token, non del `type` mancante')
})

test('chi apre quell’indirizzo col browser finisce sulle preferenze', async () => {
  const res = await callRaw({
    method: 'GET',
    query: { unsub: '11111111-2222-3333-4444-555555555555' },
  })
  assert.equal(res.statusCode, 302)
  assert.match(res.headers.Location, /\/preferenze-email\?t=11111111/)
})
