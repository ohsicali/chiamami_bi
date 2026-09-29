/**
 * Uscite programmate: chi va online a che ora, e soprattutto chi aspetta.
 *
 * Il caso che conta: locale e sconto preparati insieme per "lunedì alle
 * 18". Lo sconto non deve accendersi (e annunciarsi) prima del suo locale,
 * né restare indietro quando escono nello stesso giro.
 *
 *   node --test tests/scheduled-publish.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { planScheduledPublish, isDue, runScheduledPublish } from '../api/_scheduled-publish.js'
import {
  toLocalInput, fromLocalInput, publishAtError, formatPublishAt, isScheduled,
} from '../src/lib/scheduledPublish.js'

const NOW = new Date('2026-10-05T16:00:00Z') // lunedì 5 ottobre, 18:00 a Roma
const MIN = 60_000
const at = (m) => new Date(NOW.getTime() + m * MIN).toISOString()

test('isDue: solo con una data già passata (o uguale ad adesso)', () => {
  assert.equal(isDue({ publish_at: at(-1) }, NOW), true)
  assert.equal(isDue({ publish_at: at(0) }, NOW), true)
  assert.equal(isDue({ publish_at: at(1) }, NOW), false)
  assert.equal(isDue({ publish_at: null }, NOW), false)
  assert.equal(isDue({ publish_at: 'non una data' }, NOW), false)
  assert.equal(isDue(null, NOW), false)
})

test('un locale programmato esce alla sua ora, non prima', () => {
  const plan = planScheduledPublish({
    now: NOW,
    restaurants: [
      { id: 'r1', is_published: false, publish_at: at(-3) },
      { id: 'r2', is_published: false, publish_at: at(60) },
    ],
  })
  assert.deepEqual(plan.restaurants.map((r) => r.id), ['r1'])
})

test('lo sconto esce insieme al suo locale programmato alla stessa ora', () => {
  const plan = planScheduledPublish({
    now: NOW,
    restaurants: [{ id: 'r1', is_published: false, publish_at: at(-2) }],
    discounts: [{ id: 'd1', restaurant_id: 'r1', publish_at: at(-2), restaurant: { is_published: false } }],
  })
  assert.deepEqual(plan.discounts.map((d) => d.id), ['d1'])
  assert.deepEqual(plan.waiting, [])
})

test('lo sconto aspetta finché il suo locale non è online', () => {
  const plan = planScheduledPublish({
    now: NOW,
    restaurants: [{ id: 'r1', is_published: false, publish_at: at(120) }],
    discounts: [
      { id: 'd1', restaurant_id: 'r1', publish_at: at(-10), restaurant: { is_published: false } },
      // locale in bozza e senza data: aspetta anche lui
      { id: 'd2', restaurant_id: 'r9', publish_at: at(-10), restaurant: { is_published: false } },
    ],
  })
  assert.deepEqual(plan.discounts, [])
  assert.deepEqual(plan.waiting.map((d) => d.id), ['d1', 'd2'])
})

test('lo sconto di un locale già online esce alla sua ora', () => {
  const plan = planScheduledPublish({
    now: NOW,
    discounts: [
      { id: 'd1', restaurant_id: 'r1', publish_at: at(-1), restaurant: { is_published: true } },
      { id: 'd2', restaurant_id: 'r1', publish_at: at(30), restaurant: { is_published: true } },
    ],
  })
  assert.deepEqual(plan.discounts.map((d) => d.id), ['d1'])
  assert.deepEqual(plan.waiting, [])
})

/* -------- il giro, con un finto Supabase: chi viene preso e cosa parte -------- */

function fakeAdmin({ restaurants = [], discounts = [] }) {
  const tables = { restaurants, discounts }
  const updates = []
  function query(table) {
    const q = { table, filters: [], patch: null }
    const api = {
      select() { return api },
      update(patch) { q.patch = patch; return api },
      eq(col, val) { q.filters.push((r) => r[col] === val); return api },
      not(col, op, val) { if (op === 'is' && val === null) q.filters.push((r) => r[col] != null); return api },
      lte(col, val) { q.filters.push((r) => r[col] != null && r[col] <= val); return api },
      in() { return api },
      order() { return api },
      limit() { return api },
      then(resolve) {
        const rows = tables[table] || []
        const hit = rows.filter((r) => q.filters.every((f) => f(r)))
        if (q.patch) {
          hit.forEach((r) => Object.assign(r, q.patch))
          updates.push({ table, ids: hit.map((r) => r.id), patch: q.patch })
          return resolve({ data: hit.map((r) => ({ id: r.id })), error: null })
        }
        return resolve({ data: hit.map((r) => ({ ...r })), error: null })
      },
    }
    return api
  }
  return { from: query, updates }
}

test('dryRun non tocca niente e dice cosa uscirebbe', async () => {
  const admin = fakeAdmin({
    restaurants: [{ id: 'r1', name: 'Shoro', is_published: false, publish_at: at(-1), notify_on_publish: true }],
    discounts: [{ id: 'd1', title: '-20%', restaurant_id: 'r1', publish_at: at(-1), notify_on_publish: true, restaurant: { name: 'Shoro', is_published: false } }],
  })
  const out = await runScheduledPublish(admin, { dryRun: true, now: NOW })
  assert.equal(admin.updates.length, 0)
  assert.deepEqual(out.published.map((p) => `${p.kind}:${p.id}`), ['restaurant:r1', 'discount:d1'])
})

test('senza email da mandare: accende e toglie la data, una volta sola', async () => {
  const rows = {
    restaurants: [{ id: 'r1', name: 'Shoro', is_published: false, publish_at: at(-1), notify_on_publish: false }],
    discounts: [
      { id: 'd1', title: '-20%', restaurant_id: 'r1', is_active: false, publish_at: at(-1), notify_on_publish: false, restaurant: { name: 'Shoro', is_published: false } },
      { id: 'd2', title: '-10%', restaurant_id: 'r1', is_active: false, publish_at: at(90), notify_on_publish: false, restaurant: { name: 'Shoro', is_published: false } },
    ],
  }
  const admin = fakeAdmin(rows)
  const out = await runScheduledPublish(admin, { now: NOW })
  assert.equal(rows.restaurants[0].is_published, true)
  assert.equal(rows.restaurants[0].publish_at, null)
  assert.equal(rows.discounts[0].is_active, true)
  assert.equal(rows.discounts[0].publish_at, null)
  // quello di dopo resta com'era
  assert.equal(rows.discounts[1].is_active, false)
  assert.equal(rows.discounts[1].publish_at, at(90))
  assert.deepEqual(out.published.map((p) => p.id), ['r1', 'd1'])
  assert.deepEqual(out.errors, [])

  // Il giro dopo non trova più niente da fare.
  const again = await runScheduledPublish(admin, { now: NOW })
  assert.deepEqual(again.published, [])
})

/* -------- il lato admin: la data scritta nel form -------- */

test('data del form: andata e ritorno senza spostarsi di un minuto', () => {
  const iso = '2026-10-05T16:00:00.000Z'
  assert.equal(fromLocalInput(toLocalInput(iso)), iso)
  assert.equal(toLocalInput(null), '')
  assert.equal(fromLocalInput(''), null)
  assert.equal(fromLocalInput('boh'), null)
})

test('la data di uscita va scelta, e nel futuro', () => {
  assert.match(publishAtError('', NOW), /Scegli/)
  assert.match(publishAtError(toLocalInput(at(-5)), NOW), /futuro/)
  assert.equal(publishAtError(toLocalInput(at(10)), NOW), null)
})

test('formatPublishAt parla italiano, all’ora di Roma', () => {
  const s = formatPublishAt('2026-10-05T16:00:00Z')
  assert.match(s, /5 ott/)
  assert.match(s, /18:00/)
  assert.equal(formatPublishAt(null), '')
})

test('isScheduled: data piena = programmato', () => {
  assert.equal(isScheduled({ publish_at: at(10) }), true)
  assert.equal(isScheduled({ publish_at: null }), false)
  assert.equal(isScheduled(null), false)
})

test('l’endpoint si carica con tutta la catena di import', async () => {
  const mod = await import('../api/notify-subscribers.js')
  assert.equal(typeof mod.default, 'function')
})
