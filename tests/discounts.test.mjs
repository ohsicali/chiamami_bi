/**
 * Test di regressione del Blocco 0 (handoff v10).
 *
 * Il bug: l'admin segnava 6 sconti attivi, il Bi Club pubblico ne mostrava 4.
 * Causa — un filtro città in `SconteRedesignPage` che confrontava
 * `restaurant.city` con la città selezionata, escludendo Shoro (Poirino) e
 * Birrificio Casa Del Popolo (Anzola d'Ossola) a chi aveva Torino attiva.
 *
 * L'invariante che questi test proteggono:
 *   numero sconti attivi in admin === numero sconti in Bi Club pubblico
 * Se un giorno questo test fallisce, è sempre un bug — mai una scelta di
 * design da assecondare cambiando l'asserzione.
 *
 *   node --test tests/discounts.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isActiveDiscount, isActiveDrop, isConvention, isSoldOut, isExpired,
  filterActive, filterActiveDrops, filterActiveConventions,
  sortByExpiry, remainingCount, formatCountdown, findUnreachableDiscounts,
} from '../src/lib/discounts.js'

const NOW = new Date('2026-09-08T12:00:00Z')

function d(over = {}) {
  return {
    id: over.id || Math.random().toString(36).slice(2),
    is_active: true,
    is_drop: false,
    is_featured: false,
    drop_ends_at: null,
    valid_until: '2026-12-31T00:00:00Z',
    max_quantity: null,
    claimed_count: 0,
    max_redemptions: null,
    total_redeemed: 0,
    restaurants: { name: 'Locale', city: 'Torino', is_published: true },
    ...over,
  }
}

/* ── Lo scenario reale che ha prodotto il bug (dati DB del 2026-09-08) ── */
const DB_SNAPSHOT = [
  d({ id: 'birrificio', title: '20% sul pranzo', valid_until: '2026-09-21T00:00:00Z',
      restaurants: { name: 'Birrificio Casa Del Popolo', city: 'Anzola d’Ossola', is_published: true } }),
  d({ id: 'stampa', title: '50%', is_drop: true, drop_ends_at: '2026-09-14T17:00:00Z',
      valid_until: '2026-09-14T17:00:00Z', max_quantity: 10, claimed_count: 0,
      restaurants: { name: 'Bar Stampa', city: 'Torino', is_published: true } }),
  d({ id: 'orma', title: 'Sconto 10% sul menu tapas', valid_until: '2026-09-29T00:00:00Z',
      restaurants: { name: 'Orma', city: 'Torino', is_published: true } }),
  d({ id: 'brasa', title: '30% sulla cena', valid_until: '2026-09-30T00:00:00Z',
      restaurants: { name: 'Al Brasà', city: 'Torino', is_published: true } }),
  d({ id: 'shoro', title: '20% sulla cena', is_drop: true, drop_ends_at: '2026-09-14T17:00:00Z',
      valid_until: '2026-09-14T17:00:00Z', max_quantity: 30, claimed_count: 0,
      restaurants: { name: 'Shoro', city: 'Poirino', is_published: true } }),
  d({ id: 'smashers', title: 'Sconto Smashers -15%', valid_until: '2026-10-29T00:00:00Z',
      total_redeemed: 3, restaurants: { name: 'Smashers', city: 'Torino', is_published: true } }),
]

test('BLOCCO 0 — admin e Bi Club contano gli stessi sconti attivi', () => {
  // Ciò che conta l'admin (dashboard) e ciò che mostra il Bi Club sono la
  // stessa chiamata: è questo che rende l'invariante vera per costruzione.
  const admin = filterActive(DB_SNAPSHOT, NOW)
  const biClub = filterActive(DB_SNAPSHOT, NOW)
  assert.equal(admin.length, biClub.length)
  assert.equal(biClub.length, 6, 'tutti e 6 gli sconti attivi devono essere visibili')
})

test('BLOCCO 0 — gli sconti fuori Torino NON vengono esclusi', () => {
  const visibili = filterActive(DB_SNAPSHOT, NOW).map((x) => x.id)
  assert.ok(visibili.includes('shoro'), 'Shoro (Poirino) deve comparire in Bi Club')
  assert.ok(visibili.includes('birrificio'), 'Birrificio (Anzola) deve comparire in Bi Club')
})

test('BLOCCO 0 — la città non compare da nessuna parte nella logica di filtro', () => {
  // Stessa lista, città inventate: il risultato non deve cambiare di una riga.
  const altrove = DB_SNAPSHOT.map((x) => ({
    ...x,
    restaurants: { ...x.restaurants, city: 'Palermo' },
  }))
  assert.equal(filterActive(altrove, NOW).length, filterActive(DB_SNAPSHOT, NOW).length)
})

test('BLOCCO 8 — il conteggio drop non dipende da drop_time (campo legacy)', () => {
  // Il bug della dashboard: contava i drop con `drop_time IS NOT NULL`, ma sul
  // DB `drop_time` è null su tutte le righe → "0 drop attivi" con 2 drop live.
  DB_SNAPSHOT.forEach((x) => assert.equal(x.drop_time, undefined))
  assert.equal(filterActiveDrops(DB_SNAPSHOT, NOW).length, 2)
})

test('drop e convenzioni si dividono senza sovrapposizioni né buchi', () => {
  const attivi = filterActive(DB_SNAPSHOT, NOW)
  const drops = filterActiveDrops(DB_SNAPSHOT, NOW)
  const conv = filterActiveConventions(DB_SNAPSHOT, NOW)
  assert.equal(drops.length + conv.length, attivi.length)
  assert.equal(drops.filter(isConvention).length, 0)
})

/* ── La definizione di "attivo", caso per caso ── */

test('is_active false esclude', () => {
  assert.equal(isActiveDiscount(d({ is_active: false }), NOW), false)
})

test('scaduto esclude, in scadenza no', () => {
  assert.equal(isActiveDiscount(d({ valid_until: '2026-09-07T00:00:00Z' }), NOW), false)
  assert.equal(isActiveDiscount(d({ valid_until: '2026-09-09T00:00:00Z' }), NOW), true)
})

test('per un drop vale drop_ends_at, non valid_until', () => {
  const drop = d({ is_drop: true, drop_ends_at: '2026-09-07T00:00:00Z', valid_until: '2027-01-01T00:00:00Z' })
  assert.equal(isExpired(drop, NOW), true)
  assert.equal(isActiveDrop(drop, NOW), false)
})

test('esaurito esclude; senza tetto non è mai esaurito', () => {
  assert.equal(isSoldOut(d({ max_quantity: 10, claimed_count: 10 })), true)
  assert.equal(isSoldOut(d({ max_quantity: 10, claimed_count: 3 })), false)
  assert.equal(isSoldOut(d({ max_quantity: null, claimed_count: 999 })), false)
})

test('max_redemptions/total_redeemed sono gli alias storici di quantità e presi', () => {
  assert.equal(remainingCount(d({ max_quantity: null, max_redemptions: 10, claimed_count: null, total_redeemed: 4 })), 6)
  assert.equal(remainingCount(d({ max_quantity: null, max_redemptions: null })), null)
})

test('claimed_count fermo a 0 non nasconde i riscatti reali', () => {
  // Nessuno incrementa `claimed_count` sul DB: resta a 0 mentre
  // `total_redeemed` sale a ogni QR validato. Prendendo la maggiore delle due,
  // un drop da 10 con 10 riscatti risulta esaurito invece che pieno di posti.
  assert.equal(remainingCount(d({ max_quantity: 10, claimed_count: 0, total_redeemed: 7 })), 3)
  assert.equal(isSoldOut(d({ max_quantity: 10, claimed_count: 0, total_redeemed: 10 })), true)
  assert.equal(isActiveDiscount(d({ max_quantity: 10, claimed_count: 0, total_redeemed: 10 }), NOW), false)
})

/* ── Ordinamento e countdown ── */

test('sortByExpiry: il primo a scadere in testa, chi non scade in fondo', () => {
  const list = [
    d({ id: 'tardi', valid_until: '2026-10-01T00:00:00Z' }),
    d({ id: 'mai', valid_until: null }),
    d({ id: 'presto', valid_until: '2026-09-10T00:00:00Z' }),
  ]
  assert.deepEqual(sortByExpiry(list).map((x) => x.id), ['presto', 'tardi', 'mai'])
})

test('sortByExpiry non muta la lista di partenza', () => {
  const list = [d({ id: 'b', valid_until: '2026-10-01T00:00:00Z' }), d({ id: 'a', valid_until: '2026-09-10T00:00:00Z' })]
  sortByExpiry(list)
  assert.deepEqual(list.map((x) => x.id), ['b', 'a'])
})

test('formatCountdown produce la pill del drop', () => {
  assert.equal(formatCountdown(d({ valid_until: '2026-09-14T07:00:00Z' }), NOW), '5G 19H')
  assert.equal(formatCountdown(d({ valid_until: '2026-09-08T14:30:00Z' }), NOW), '2H 30M')
  assert.equal(formatCountdown(d({ valid_until: '2026-09-08T12:20:00Z' }), NOW), '20M')
  assert.equal(formatCountdown(d({ valid_until: '2026-09-01T00:00:00Z' }), NOW), null)
  assert.equal(formatCountdown(d({ valid_until: null }), NOW), null)
})

/* ── Rete di sicurezza admin ── */

test('findUnreachableDiscounts è vuota sullo stato sano', () => {
  assert.deepEqual(findUnreachableDiscounts(filterActive(DB_SNAPSHOT, NOW)), [])
})

test('findUnreachableDiscounts segnala uno sconto attivo su locale non pubblicato', () => {
  const rotto = d({ id: 'x', restaurants: { name: 'Fantasma', city: 'Torino', is_published: false } })
  const found = findUnreachableDiscounts([rotto])
  assert.equal(found.length, 1)
  assert.match(found[0].reason, /non è pubblicato/)
})
