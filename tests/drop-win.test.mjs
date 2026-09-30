/**
 * "Ce l'hai fatta!" dopo un drop preso (src/lib/dropWin.js): le parole
 * giuste per ogni posto, e il QR che non resta mai appeso alla festa.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { DOTS_MAX, DROP_WIN_EVENT, celebrateClaim, dropWinCopy, isFirstClaim } from '../src/lib/dropWin.js'

test('il numero X su 20, col nome del locale', () => {
  const c = dropWinCopy({ rank: 7, total: 20, restaurantName: 'Gelateria Borghese' })
  assert.equal(c.title, "Ce l'hai fatta!")
  assert.equal(c.line, 'Sei il numero 7 su 20 ad aver preso il drop di Gelateria Borghese.')
  assert.equal(c.outro, 'Goditelo!')
  assert.equal(c.rank, 7)
  assert.equal(c.total, 20)
  assert.equal(c.showDots, true)
})

test('il primo e l\'ultimo hanno la loro frase', () => {
  assert.equal(dropWinCopy({ rank: 1, total: 20 }).title, 'Primo posto!')
  assert.match(dropWinCopy({ rank: 1, total: 20 }).line, /^Sei il numero 1 su 20/)
  assert.equal(dropWinCopy({ rank: 20, total: 20 }).title, 'Preso al volo!')
  assert.match(dropWinCopy({ rank: 20, total: 20, restaurantName: 'X' }).line, /ultimo posto del drop di X/)
})

test('mai "21 su 20": un riscatto in più (admin) si ferma al totale', () => {
  const c = dropWinCopy({ rank: 21, total: 20 })
  assert.equal(c.rank, 20)
  assert.doesNotMatch(c.line, /21/)
})

test('senza numero (DB lento o drop senza posti) la festa c\'è lo stesso', () => {
  const none = dropWinCopy({ restaurantName: 'Shoro' })
  assert.equal(none.rank, null)
  assert.equal(none.showDots, false)
  assert.equal(none.line, 'Il drop di Shoro è tuo.')
  const noCap = dropWinCopy({ rank: 12, total: null })
  assert.equal(noCap.line, 'Sei il numero 12 ad aver preso il drop.')
  assert.equal(noCap.showDots, false)
})

test('i pallini solo finché si contano a colpo d\'occhio', () => {
  assert.equal(dropWinCopy({ rank: 3, total: DOTS_MAX }).showDots, true)
  assert.equal(dropWinCopy({ rank: 3, total: DOTS_MAX + 1 }).showDots, false)
})

// celebrateClaim usa window: un finto window basta.
function withWindow(fn) {
  const target = new EventTarget()
  globalThis.window = target
  globalThis.CustomEvent ??= class extends Event { constructor(t, o) { super(t); this.detail = o?.detail } }
  return Promise.resolve(fn(target)).finally(() => { delete globalThis.window })
}

test('convenzione: il Gate la sente (per il primo sblocco), niente festa, il QR si apre', () => withWindow(async (w) => {
  let heard = false
  w.addEventListener(DROP_WIN_EVENT, (e) => { heard = true; e.detail.take(); e.detail.done() })
  const res = await celebrateClaim({ redemptionId: 'r1', deal: { is_drop: false } })
  assert.equal(heard, true)
  assert.equal(res.shown, false)
}))

test('"Come si usa lo sconto" solo al primo sconto sbloccato', () => {
  assert.equal(isFirstClaim({ claimCount: 1 }), true)
  assert.equal(isFirstClaim({ claimCount: 2 }), false, 'ne aveva già sbloccati altri')
  assert.equal(isFirstClaim({ claimCount: 7 }), false)
  assert.equal(isFirstClaim({ claimCount: 1, seen: true }), false, 'già visto su questo browser')
  assert.equal(isFirstClaim({ claimCount: null }), false, 'conteggio non riuscito: meglio niente')
  assert.equal(isFirstClaim({ claimCount: 0 }), false)
})

test('nessuno ascolta: lo sblocco non resta appeso', () => withWindow(async () => {
  const res = await celebrateClaim({ redemptionId: 'r1', deal: { is_drop: true } })
  assert.equal(res.shown, false)
}))

test('il Gate decide che non è un drop: come se la festa non ci fosse', () => withWindow(async (w) => {
  w.addEventListener(DROP_WIN_EVENT, (e) => { e.detail.take(); e.detail.done() })
  const res = await celebrateClaim({ redemptionId: 'r1' })
  assert.deepEqual({ ...res }, { shown: false, action: null })
}))

test('con la festa aperta si aspetta che si chiuda', () => withWindow(async (w) => {
  let close
  w.addEventListener(DROP_WIN_EVENT, (e) => { e.detail.take(); close = e.detail.done })
  let resolved = false
  const p = celebrateClaim({ redemptionId: 'r1', deal: { is_drop: true } }).then(() => { resolved = true })
  await new Promise((r) => setTimeout(r, 10))
  assert.equal(resolved, false)
  close({ shown: true, action: 'tutorial' })
  await p
  assert.equal(resolved, true)
}))

test('dopo la festa si sa com\'è finita: tutorial o chiudi, e niente QR', () => withWindow(async (w) => {
  w.addEventListener(DROP_WIN_EVENT, (e) => { e.detail.take(); e.detail.done({ shown: true, action: 'close' }) })
  const res = await celebrateClaim({ redemptionId: 'r1', deal: { is_drop: true } })
  assert.deepEqual(res, { shown: true, action: 'close' })
}))
