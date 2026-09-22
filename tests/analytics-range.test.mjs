/**
 * Periodi della pagina admin Analytics.
 *
 * Ogni barra del grafico dev'essere un giorno intero, e il confronto va fatto
 * con un intervallo lungo uguale subito prima — "Oggi" con ieri fino alla
 * stessa ora, non con tutta la giornata di ieri.
 *
 *   node --test tests/analytics-range.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { getAnalyticsRange } from '../src/lib/analyticsRange.js'

const NOW = new Date(2026, 8, 23, 15, 30) // 23/09 15:30 locali

test('Oggi: da mezzanotte ad adesso, a ore, confronto con ieri alla stessa ora', () => {
  const r = getAnalyticsRange('today', null, null, NOW)
  assert.deepEqual(r.from, new Date(2026, 8, 23))
  assert.deepEqual(r.to, NOW)
  assert.deepEqual(r.prevFrom, new Date(2026, 8, 22))
  assert.deepEqual(r.prevTo, new Date(2026, 8, 22, 15, 30))
  assert.equal(r.bucket, 'hour')
})

test('7g: oggi più i sei giorni prima, a giorni', () => {
  const r = getAnalyticsRange('7d', null, null, NOW)
  assert.deepEqual(r.from, new Date(2026, 8, 17))
  assert.deepEqual(r.prevFrom, new Date(2026, 8, 10))
  assert.deepEqual(r.prevTo, new Date(2026, 8, 16, 15, 30))
  assert.equal(r.days, 7)
  assert.equal(r.bucket, 'day')
})

test('Personalizzato: giorni interi, fine esclusa, mai oltre adesso', () => {
  const past = getAnalyticsRange('custom', new Date(2026, 8, 1), new Date(2026, 8, 10), NOW)
  assert.deepEqual(past.from, new Date(2026, 8, 1))
  assert.deepEqual(past.to, new Date(2026, 8, 11))
  assert.equal(past.days, 10)
  assert.deepEqual(past.prevFrom, new Date(2026, 7, 22))

  const upToToday = getAnalyticsRange('custom', new Date(2026, 8, 20), new Date(2026, 8, 23), NOW)
  assert.deepEqual(upToToday.to, NOW)

  const oneDay = getAnalyticsRange('custom', new Date(2026, 8, 22), new Date(2026, 8, 22), NOW)
  assert.equal(oneDay.bucket, 'hour')
})

test('Cambio dell\'ora legale: il giorno parte sempre a mezzanotte', () => {
  const afterDst = new Date(2026, 9, 27, 10, 0) // 27/10, l'ora è tornata indietro il 25
  const r = getAnalyticsRange('7d', null, null, afterDst)
  assert.deepEqual(r.from, new Date(2026, 9, 21))
})
