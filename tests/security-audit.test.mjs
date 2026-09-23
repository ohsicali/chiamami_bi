/**
 * Le porte chiuse dall'audit di sicurezza del 23/09
 * (docs/security-audit-2026-09-23.md), provate chiamando le funzioni come
 * le chiama Vercel, con `req` e `res` finti e senza variabili d'ambiente:
 * ogni prova verifica che la richiesta si fermi PRIMA di arrivare a
 * Resend, a Google o allo storage.
 *
 *   node --test tests/security-audit.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'

const { default: sendEmail } = await import('../api/send-email.js')
const { default: resolveMaps } = await import('../api/resolve-maps.js')
const { default: img } = await import('../api/img.js')

function mockRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.end = () => res
  res.send = (b) => { res.body = b; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

const call = async (handler, { method = 'POST', body = {}, query = {}, headers = {} } = {}) => {
  const res = mockRes()
  await handler({ method, body, query, headers, socket: { remoteAddress: `10.0.0.${Math.floor(Math.random() * 250)}` } }, res)
  return res
}

/* ── Email: niente più spedizioni a indirizzi scelti da chi chiama ─── */

test('la conferma suggerimento non ha più un invio pubblico', async () => {
  const res = await call(sendEmail, {
    body: { type: 'confirmation', to: 'vittima@example.com', nome_locale: 'Clicca qui: phishing' },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.skipped, 'sent-by-server')
})

test('la conferma candidatura non ha più un invio pubblico', async () => {
  const res = await call(sendEmail, {
    body: { type: 'partner-application-confirmation', to: 'vittima@example.com', nome_referente: 'x', nome_attivita: 'y' },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.skipped, 'sent-by-server')
})

test('il benvenuto non parte senza poter controllare che l’account esista', async () => {
  // Senza Supabase configurato il ramo non può verificare l'account: deve
  // fermarsi, non spedire alla cieca.
  const res = await call(sendEmail, { body: { type: 'user', email: 'vittima@example.com', name: 'x' } })
  assert.equal(res.statusCode, 500)
})

/* ── resolve-maps: la chiave Google a pagamento solo per l'admin ────── */

test('resolve-maps respinge chi non manda un token', async () => {
  const res = await call(resolveMaps, { body: { query: 'pizzeria torino' } })
  assert.equal(res.statusCode, 401)
})

test('resolve-maps respinge anche la strada del reel senza token', async () => {
  const res = await call(resolveMaps, { body: { type: 'reel', url: 'https://www.instagram.com/reel/abc/' } })
  assert.equal(res.statusCode, 401)
})

/* ── img: solo lo storage del progetto ─────────────────────────────── */

test('img non va a prendere host esterni', async () => {
  const res = await call(img, { method: 'GET', query: { url: 'https://evil.example.com/storage/v1/object/public/x.png' } })
  assert.equal(res.statusCode, 403)
})

test('img non si lascia ingannare dal nome utente nell’URL', async () => {
  const res = await call(img, { method: 'GET', query: { url: 'https://abc.supabase.co@evil.example.com/storage/v1/object/public/x.png' } })
  assert.equal(res.statusCode, 403)
})

test('img rifiuta http', async () => {
  const res = await call(img, { method: 'GET', query: { url: 'http://abc.supabase.co/storage/v1/object/public/x.png' } })
  assert.equal(res.statusCode, 403)
})
