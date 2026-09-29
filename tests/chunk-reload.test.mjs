/**
 * Ricaricamento dopo un chunk sparito (src/lib/chunkReload.js): una volta sì,
 * subito dopo no — prima il flag si azzerava al montaggio di App e un chunk
 * che mancava anche dopo il ricaricamento faceva ricaricare in loop.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { claimChunkReload, isChunkLoadError, RELOAD_WINDOW_MS } from '../src/lib/chunkReload.js'

function memoryStorage() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }
}

test('riconosce i messaggi di chunk spariti dei vari browser', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: https://chiamamibi.com/assets/HomeFeedV4-EOo61D-k.js',
    "'text/html' is not a valid JavaScript MIME type.",
    'error loading dynamically imported module: https://chiamamibi.com/assets/AuthCallback-Ce0UJqSf.js',
    'Importing a module script failed.',
    'Unable to preload CSS for https://chiamamibi.com/assets/ChiediPage-HA7OL_fP.css',
  ]) assert.equal(isChunkLoadError(new Error(message)), true, message)
  assert.equal(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')")), false)
  assert.equal(isChunkLoadError(null), false)
})

test('ricarica una volta, non di nuovo subito dopo', () => {
  const s = memoryStorage()
  const t = 1_000_000
  assert.equal(claimChunkReload(s, t), true)
  assert.equal(claimChunkReload(s, t + 2_000), false)
  assert.equal(claimChunkReload(s, t + RELOAD_WINDOW_MS - 1), false)
})

test('a un deploy successivo, nella stessa scheda, ricarica di nuovo', () => {
  const s = memoryStorage()
  assert.equal(claimChunkReload(s, 1), true)
  assert.equal(claimChunkReload(s, 1 + 60 * 60 * 1000), true)
})

test('senza storage non ricarica da solo (non potrebbe fermare un loop)', () => {
  const broken = { getItem() { throw new Error('SecurityError') }, setItem() { throw new Error('SecurityError') } }
  assert.equal(claimChunkReload(broken, 1), false)
  assert.equal(claimChunkReload(undefined, 1), false) // in Node sessionStorage non c'è
})
