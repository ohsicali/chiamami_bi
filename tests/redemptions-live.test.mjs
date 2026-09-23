/**
 * Pannello "In diretta" e contatori delle card in admin/Sconti.
 *
 * L'invariante: feed, "oggi" e contatori per card escono dalla stessa mappa
 * e restano coerenti evento dopo evento — uno sconto preso alza "presi" una
 * volta sola, la convalida alza "utilizzati" una volta sola, anche se il
 * realtime ripete l'evento.
 *
 *   node --test tests/redemptions-live.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRedemptionChange, deriveRedemptionStats, FEED_SIZE } from '../src/lib/redemptionsLive.js'

const NOW = new Date(2026, 8, 22, 15, 0).getTime() // 22/09 15:00 locali
const at = (h, m = 0, day = 22) => new Date(2026, 8, day, h, m).toISOString()

const insert = (row) => ({ eventType: 'INSERT', new: row, old: {} })
const update = (row) => ({ eventType: 'UPDATE', new: row, old: { id: row.id } })

test('preso → utilizzato: contatori, oggi e feed', () => {
  const rows = new Map()
  const r = { id: 'r1', discount_id: 'd1', status: 'generated', generated_at: at(14), redeemed_at: null, user_name: 'Giulia' }

  assert.deepEqual(applyRedemptionChange(rows, insert(r)), { kind: 'taken', id: 'r1', discount_id: 'd1' })
  let s = deriveRedemptionStats(rows, NOW)
  assert.deepEqual(s.byDiscount.d1, { taken: 1, used: 0 })
  assert.deepEqual(s.today, { taken: 1, used: 0 })
  assert.equal(s.events.length, 1)

  const redeemed = { ...r, status: 'redeemed', redeemed_at: at(14, 30) }
  assert.deepEqual(applyRedemptionChange(rows, update(redeemed)), { kind: 'used', id: 'r1', discount_id: 'd1' })
  s = deriveRedemptionStats(rows, NOW)
  assert.deepEqual(s.byDiscount.d1, { taken: 1, used: 1 })
  assert.deepEqual(s.today, { taken: 1, used: 1 })
  assert.deepEqual(s.events.map((e) => e.key), ['used:r1', 'taken:r1'])
})

test('eventi ripetuti non contano due volte', () => {
  const rows = new Map()
  const r = { id: 'r1', discount_id: 'd1', status: 'generated', generated_at: at(10) }
  applyRedemptionChange(rows, insert(r))
  assert.equal(applyRedemptionChange(rows, insert(r)), null)
  const red = { ...r, status: 'redeemed', redeemed_at: at(11) }
  applyRedemptionChange(rows, update(red))
  assert.equal(applyRedemptionChange(rows, update(red)), null)
  assert.deepEqual(deriveRedemptionStats(rows, NOW).byDiscount.d1, { taken: 1, used: 1 })
})

test('UPDATE di una riga mai vista (INSERT perso) conta presa e utilizzata', () => {
  const rows = new Map()
  const change = applyRedemptionChange(rows, update({ id: 'r9', discount_id: 'd2', status: 'redeemed', generated_at: at(9), redeemed_at: at(12) }))
  assert.equal(change.kind, 'used')
  assert.deepEqual(deriveRedemptionStats(rows, NOW).byDiscount.d2, { taken: 1, used: 1 })
})

test('DELETE toglie la riga dai contatori (old porta solo l\'id)', () => {
  const rows = new Map([['r1', { id: 'r1', discount_id: 'd1', status: 'generated', generated_at: at(10) }]])
  assert.deepEqual(applyRedemptionChange(rows, { eventType: 'DELETE', new: {}, old: { id: 'r1' } }), { kind: 'delete' })
  assert.equal(applyRedemptionChange(rows, { eventType: 'DELETE', new: {}, old: { id: 'r1' } }), null)
  assert.equal(deriveRedemptionStats(rows, NOW).byDiscount.d1, undefined)
})

test('"oggi" parte dalla mezzanotte locale, i contatori per card no', () => {
  const rows = new Map([
    ['a', { id: 'a', discount_id: 'd1', status: 'redeemed', generated_at: at(20, 0, 21), redeemed_at: at(9) }],
    ['b', { id: 'b', discount_id: 'd1', status: 'generated', generated_at: at(23, 59, 21) }],
  ])
  const s = deriveRedemptionStats(rows, NOW)
  assert.deepEqual(s.today, { taken: 0, used: 1 })
  assert.deepEqual(s.byDiscount.d1, { taken: 2, used: 1 })
})

test('il feed tiene solo gli ultimi FEED_SIZE eventi', () => {
  const rows = new Map()
  for (let i = 0; i < FEED_SIZE + 10; i++) {
    rows.set(`r${i}`, { id: `r${i}`, discount_id: 'd1', status: 'generated', generated_at: new Date(NOW - i * 60000).toISOString() })
  }
  const { events, byDiscount } = deriveRedemptionStats(rows, NOW)
  assert.equal(events.length, FEED_SIZE)
  assert.equal(events[0].key, 'taken:r0')
  assert.equal(byDiscount.d1.taken, FEED_SIZE + 10)
})
