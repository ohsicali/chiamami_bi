/**
 * I prodotti dello sconto — foto di cosa l'offerta copre davvero.
 *
 * Quello che questi test tengono fermo è che la stessa lista si legga uguale
 * nei tre punti che la mostrano (scheda sconto, riga del Bi Club, banner sul
 * locale): stesso ordine, stessi scarti, stessa didascalia. È esattamente il
 * tipo di cosa che diverge in silenzio quando ogni punto si arrangia da solo
 * — la lezione del Blocco 0, vedi `discounts.test.mjs`.
 *
 *   node --test tests/discount-products.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProducts, productsSummary } from '../src/lib/utils/discountProducts.js'

const FOTO = 'https://x.supabase.co/storage/v1/object/public/photos/discounts/a/1.webp'
const THUMB = 'https://x.supabase.co/storage/v1/object/public/photos/discounts/a/1-thumb.webp'

/* ── normalizeProducts ── */

test('ordina per sort_order, non per ordine di arrivo dal DB', () => {
  const out = normalizeProducts([
    { id: 'c', name: 'Chai', sort_order: 2 },
    { id: 'a', name: 'Matcha', sort_order: 0 },
    { id: 'b', name: 'Iced', sort_order: 1 },
  ])
  assert.deepEqual(out.map((p) => p.name), ['Matcha', 'Iced', 'Chai'])
})

test('sort_order mancante non manda in fondo la riga', () => {
  // Una riga inserita a mano nel DB può non avere sort_order: vale 0, cioè
  // sta davanti, invece di sparire in coda in un ordine imprevedibile.
  const out = normalizeProducts([
    { id: 'b', name: 'Secondo', sort_order: 1 },
    { id: 'a', name: 'Senza ordine' },
  ])
  assert.deepEqual(out.map((p) => p.name), ['Senza ordine', 'Secondo'])
})

test('la foto piena vince sulla thumb, ma la thumb basta da sola', () => {
  assert.equal(normalizeProducts([{ id: '1', name: 'x', photo_url: FOTO, thumb_url: THUMB }])[0].photo, FOTO)
  assert.equal(normalizeProducts([{ id: '1', name: 'x', thumb_url: THUMB }])[0].photo, THUMB)
  assert.equal(normalizeProducts([{ id: '1', name: 'x' }])[0].photo, null)
})

test('scarta le righe che non hanno niente da mostrare', () => {
  const out = normalizeProducts([
    { id: '1', name: 'Matcha' },
    { id: '2', name: '', note: 'solo una nota' },
    { id: '3', photo_url: FOTO },
    null,
    undefined,
  ])
  assert.deepEqual(out.map((p) => p.key), ['1', '3'])
})

test('non tocca l\'array che riceve', () => {
  // Il join di Supabase è condiviso fra le card della lista: riordinarlo sul
  // posto cambierebbe l'ordine anche a chi lo sta già leggendo.
  const input = [{ id: 'b', name: 'B', sort_order: 1 }, { id: 'a', name: 'A', sort_order: 0 }]
  normalizeProducts(input)
  assert.deepEqual(input.map((p) => p.id), ['b', 'a'])
})

test('uno sconto senza prodotti dà lista vuota, non esplode', () => {
  assert.deepEqual(normalizeProducts(null), [])
  assert.deepEqual(normalizeProducts(undefined), [])
  assert.deepEqual(normalizeProducts([]), [])
  assert.deepEqual(normalizeProducts('non un array'), [])
})

/* ── productsSummary ── */

test('la didascalia nomina due prodotti e conta gli altri', () => {
  const items = normalizeProducts(
    ['Matcha latte', 'Chai', 'Cold brew', 'Apple spicy', 'Hot chocolate']
      .map((name, i) => ({ id: String(i), name, sort_order: i }))
  )
  assert.equal(productsSummary(items), 'Matcha latte, Chai e altri 3')
})

test('con un prodotto in più dice "un altro", non "altri 1"', () => {
  const items = normalizeProducts(
    ['Matcha', 'Chai', 'Cold brew'].map((name, i) => ({ id: String(i), name, sort_order: i }))
  )
  assert.equal(productsSummary(items), 'Matcha, Chai e un altro')
})

test('uno o due prodotti: solo i nomi, nessun conteggio', () => {
  const uno = normalizeProducts([{ id: '1', name: 'Matcha' }])
  const due = normalizeProducts([{ id: '1', name: 'Matcha' }, { id: '2', name: 'Chai', sort_order: 1 }])
  assert.equal(productsSummary(uno), 'Matcha')
  assert.equal(productsSummary(due), 'Matcha, Chai')
})

test('prodotti con la sola foto e nessun nome non producono didascalia', () => {
  const items = normalizeProducts([{ id: '1', photo_url: FOTO }, { id: '2', photo_url: FOTO, sort_order: 1 }])
  assert.equal(items.length, 2)
  assert.equal(productsSummary(items), null)
})

test('i senza nome non gonfiano il conteggio degli altri', () => {
  const items = normalizeProducts([
    { id: '1', name: 'Matcha', sort_order: 0 },
    { id: '2', name: 'Chai', sort_order: 1 },
    { id: '3', photo_url: FOTO, sort_order: 2 },
  ])
  // Il terzo si vede in foto ma non ha un nome da leggere: contarlo darebbe
  // «e un altro» senza che ci sia un altro nome da cercare.
  assert.equal(productsSummary(items), 'Matcha, Chai')
})
