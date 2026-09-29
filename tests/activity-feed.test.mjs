import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createActivityFeed, dayLabel, dayKey } from '../src/lib/activityFeed.js'

// Fonte finta: righe già ordinate dal più recente, servite a pezzi come
// farebbe `range()` di PostgREST. Conta le chiamate per vedere che non si
// scarica più del necessario.
function source(type, minutesAgo, now = Date.UTC(2026, 8, 28, 12)) {
  const rows = minutesAgo
    .map((m, i) => ({ id: `${type}${i}`, at: new Date(now - m * 60000).toISOString() }))
    .sort((a, b) => b.at.localeCompare(a.at))
  const src = {
    calls: 0,
    fetch: async (offset, limit) => {
      src.calls += 1
      return rows.slice(offset, offset + limit)
    },
    toItem: (r) => ({ key: `${type}:${r.id}`, type, at: r.at }),
  }
  return src
}

test('mescola le fonti in ordine di tempo, anche fra una pagina e l’altra', async () => {
  const a = source('a', [1, 4, 5, 9, 20, 21])
  const b = source('b', [2, 3, 10, 11, 30])
  const feed = createActivityFeed([a, b], { batch: 2 })
  const p1 = await feed.next(4)
  const p2 = await feed.next(4)
  const p3 = await feed.next(4)
  const all = [...p1.items, ...p2.items, ...p3.items]
  assert.equal(all.length, 11)
  const times = all.map((i) => new Date(i.at).getTime())
  assert.deepEqual(times, [...times].sort((x, y) => y - x))
  assert.equal(p1.done, false)
  assert.equal(p3.done, true)
})

test('arriva fino in fondo: tutta la cronologia, niente doppioni', async () => {
  const mins = Array.from({ length: 137 }, (_, i) => i * 7)
  const feed = createActivityFeed([source('x', mins), source('y', mins.map((m) => m + 3))], { batch: 25 })
  const keys = []
  let done = false
  while (!done) {
    const page = await feed.next(25)
    keys.push(...page.items.map((i) => i.key))
    done = page.done
  }
  assert.equal(keys.length, 274)
  assert.equal(new Set(keys).size, 274)
})

test('una fonte si riscarica solo quando il suo blocco finisce', async () => {
  const a = source('a', Array.from({ length: 50 }, (_, i) => i))
  const b = source('b', [1000])
  const feed = createActivityFeed([a, b], { batch: 10 })
  await feed.next(5)
  assert.equal(a.calls, 1)
  assert.equal(b.calls, 1)
  await feed.next(10)
  assert.equal(a.calls, 2)
  assert.equal(b.calls, 1) // il suo blocco non si è ancora svuotato
})

test('una riga ripetuta (entrata una nuova in cima fra due pagine) esce una volta', async () => {
  const rows = [{ id: 'n', m: 0 }, { id: 'p', m: 1 }, { id: 'q', m: 2 }]
  const now = Date.now()
  let offsetShift = 0
  const src = {
    fetch: async (offset, limit) => {
      const out = rows.slice(offset - offsetShift, offset - offsetShift + limit)
      offsetShift = 1 // dalla seconda pagina "è arrivata" una riga in cima
      return out
    },
    toItem: (r) => ({ key: r.id, at: new Date(now - r.m * 60000).toISOString() }),
  }
  const feed = createActivityFeed([src], { batch: 2 })
  const p1 = await feed.next(2)
  const p2 = await feed.next(2)
  assert.deepEqual([...p1.items, ...p2.items].map((i) => i.key), ['n', 'p', 'q'])
})

test('una fonte che fallisce non ferma le altre', async () => {
  const errors = []
  const broken = { fetch: async () => { throw new Error('rls') }, toItem: (r) => r }
  const feed = createActivityFeed([broken, source('ok', [1, 2, 3])], { batch: 10, onError: (e) => errors.push(e.message) })
  const page = await feed.next(10)
  assert.equal(page.items.length, 3)
  assert.equal(page.done, true)
  assert.deepEqual(errors, ['rls'])
})

test('chiamate sovrapposte vanno in fila e non si rubano righe', async () => {
  const feed = createActivityFeed([source('a', Array.from({ length: 30 }, (_, i) => i))], { batch: 7 })
  const [p1, p2] = await Promise.all([feed.next(10), feed.next(10)])
  const keys = [...p1.items, ...p2.items].map((i) => i.key)
  assert.equal(keys.length, 20)
  assert.equal(new Set(keys).size, 20)
})

test('intestazioni di giorno', () => {
  const now = new Date(2026, 8, 28, 15, 0).getTime()
  assert.equal(dayLabel(new Date(2026, 8, 28, 0, 5).toISOString(), now), 'Oggi')
  assert.equal(dayLabel(new Date(2026, 8, 27, 23, 59).toISOString(), now), 'Ieri')
  assert.match(dayLabel(new Date(2026, 8, 22, 12).toISOString(), now), /^Martedì 22 settembre$/)
  assert.match(dayLabel(new Date(2025, 11, 31, 12).toISOString(), now), /2025/)
  assert.equal(dayKey(new Date(2026, 8, 28, 1).toISOString()), dayKey(new Date(2026, 8, 28, 23).toISOString()))
})
