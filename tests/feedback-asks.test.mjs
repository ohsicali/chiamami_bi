/**
 * Il feedback dopo lo sconto convalidato: quando si apre nell'app, cosa va
 * al DB, e le due email "com'è andata?" — chi le riceve, quando, e chi no.
 *
 * Il rischio che queste prove tengono d'occhio: chiedere due volte la
 * stessa cosa, scrivere di notte, o scrivere a chi ha già risposto.
 *
 *   node --test tests/feedback-asks.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FEEDBACK_KINDS, FEEDBACK_RULES, feedbackAskProps, feedbackUrl, isQuietHour, planFeedbackAsks, romeHour,
} from '../api/_email/feedback.js'
import { feedbackAskEmail, SAMPLE } from '../api/_email/templates.js'
import {
  CELEBRATE_WINDOW_MS, IN_APP_WINDOW_MS, buildAnswers, hasFeedbackContent, isFeedbackAllowedOnPath,
  likedQuestion, parseFeedbackToken, parseStars, ratingCopy, shouldCelebrate, shouldOpenFeedback,
} from '../src/lib/redemptionFeedback.js'

// Martedì 29 settembre 2026, 21:00 a Roma (19:00 UTC).
const NOW = new Date('2026-09-29T19:00:00Z')
const MIN = 60_000
const H = 60 * MIN
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString()
const TOKEN = '11111111-2222-3333-4444-555555555555'

let seq = 0
function row({ user = 'u1', age = 40 * MIN, ...rest } = {}) {
  seq += 1
  return {
    redemption_id: `r${seq}`, user_id: user, token: TOKEN, redeemed_at: ago(age),
    rating: null, completed_at: null,
    restaurant: { name: 'Shoro', city: 'Torino' },
    discount: { discount_type: 'percentage', discount_value: '20' },
    ...rest,
  }
}
const who = (...ids) => new Map(ids.map((id) => [id, { email: `${id}@example.com`, name: 'Giulia Rossi', token: 'tok' }]))

/* ── Nell'app ─────────────────────────────────────────────────────────── */

test('si apre da solo: convalida recente, senza stelle, non finito', () => {
  const now = Date.parse('2026-09-29T19:00:00Z')
  const base = { token: TOKEN, redeemed_at: new Date(now - 10_000).toISOString(), rating: null, completed_at: null }
  assert.equal(shouldOpenFeedback(base, now), true)
  assert.equal(shouldOpenFeedback({ ...base, rating: 4 }, now), false, 'le stelle date: il resto lo chiedono le email')
  assert.equal(shouldOpenFeedback({ ...base, completed_at: new Date(now).toISOString() }, now), false)
  assert.equal(shouldOpenFeedback({ ...base, redeemed_at: new Date(now - IN_APP_WINDOW_MS - 1).toISOString() }, now), false)
  assert.equal(shouldOpenFeedback({ ...base, token: null }, now), false)
  assert.equal(shouldOpenFeedback(null, now), false)
})

test('la festa solo se la convalida è appena successa e non è già stata mostrata', () => {
  const now = Date.parse('2026-09-29T19:00:00Z')
  const fresh = { redeemed_at: new Date(now - 20_000).toISOString() }
  assert.equal(shouldCelebrate(fresh, { now }), true)
  assert.equal(shouldCelebrate(fresh, { now, shown: true }), false)
  assert.equal(shouldCelebrate({ redeemed_at: new Date(now - CELEBRATE_WINDOW_MS - 1).toISOString() }, { now }), false)
})

test('mai sopra login, admin, /verify e la pagina del feedback stessa', () => {
  for (const p of ['/login', '/auth/callback', '/verify', '/admin', '/admin/sconti', '/feedback', '/partner']) {
    assert.equal(isFeedbackAllowedOnPath(p), false, p)
  }
  for (const p of ['/', '/sconti', '/esplora', '/restaurant/shoro']) assert.equal(isFeedbackAllowedOnPath(p), true, p)
})

test('le risposte: solo chiavi conosciute, niente di vuoto', () => {
  assert.deepEqual(buildAnswers({ liked: ['cibo', 'cibo', 'boh'], sconto: 'liscio', tornare: 'forse' }),
    { liked: ['cibo'], sconto: 'liscio', tornare: 'forse' })
  assert.deepEqual(buildAnswers({ liked: [], sconto: 'x', tornare: null }), {})
  assert.equal(hasFeedbackContent({ answers: {}, comment: '   ' }), false)
  assert.equal(hasFeedbackContent({ answers: { tornare: 'si' }, comment: '' }), true)
  assert.equal(hasFeedbackContent({ answers: {}, comment: 'buono' }), true)
})

test('voto → faccia di Bi, e la domanda cambia sotto le tre stelle', () => {
  assert.equal(ratingCopy(1).mood, 'sad')
  assert.equal(ratingCopy(5).mood, 'love')
  assert.equal(ratingCopy(null).mood, 'idle')
  assert.equal(likedQuestion(2), 'Cosa non è andato?')
  assert.equal(likedQuestion(4), 'Cosa ti è piaciuto?')
})

test('link dell\'email: token uuid e stelle 1–5, il resto si scarta', () => {
  assert.equal(parseFeedbackToken(TOKEN.toUpperCase()), TOKEN)
  assert.equal(parseFeedbackToken('abc'), null)
  assert.equal(parseStars('4'), 4)
  assert.equal(parseStars('0'), null)
  assert.equal(parseStars('9'), null)
  assert.equal(parseStars(null), null)
})

/* ── Le email ─────────────────────────────────────────────────────────── */

test('la prima parte dopo 30 minuti, non prima', () => {
  const r = row({ age: 29 * MIN })
  assert.equal(planFeedbackAsks({ rows: [r], recipients: who('u1'), now: NOW }).length, 0)
  const plan = planFeedbackAsks({ rows: [row({ age: 31 * MIN })], recipients: who('u1'), now: NOW })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].round, 1)
  assert.equal(plan[0].kind, FEEDBACK_KINDS.first)
})

test('niente email a chi ha finito, né a chi ha spento "I miei sconti"', () => {
  const done = row({ completed_at: ago(5 * MIN) })
  assert.equal(planFeedbackAsks({ rows: [done], recipients: who('u1'), now: NOW }).length, 0)
  assert.equal(planFeedbackAsks({ rows: [row()], recipients: new Map(), now: NOW }).length, 0)
})

test('chi ha dato solo le stelle riceve lo stesso le email (versione "raccontami")', () => {
  const plan = planFeedbackAsks({ rows: [row({ rating: 4 })], recipients: who('u1'), now: NOW })
  assert.equal(plan.length, 1)
})

test('la prima non si ripete; la seconda dopo un giorno, una volta sola', () => {
  const r = row({ age: 25 * H })
  const firstSent = new Map([[r.redemption_id, { [FEEDBACK_KINDS.first]: ago(24 * H) }]])
  const plan = planFeedbackAsks({ rows: [r], sent: firstSent, recipients: who('u1'), now: NOW })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].round, 2)

  const both = new Map([[r.redemption_id, { [FEEDBACK_KINDS.first]: ago(24 * H), [FEEDBACK_KINDS.second]: ago(1 * H) }]])
  assert.equal(planFeedbackAsks({ rows: [r], sent: both, recipients: who('u1'), now: NOW }).length, 0)

  const r2 = row({ age: 2 * H })
  const onlyFirst = new Map([[r2.redemption_id, { [FEEDBACK_KINDS.first]: ago(90 * MIN) }]])
  assert.equal(planFeedbackAsks({ rows: [r2], sent: onlyFirst, recipients: who('u1'), now: NOW }).length, 0)
})

test('la prima non parte oltre la sua finestra; oltre i 3 giorni niente', () => {
  const tardi = row({ age: (FEEDBACK_RULES.firstMaxAgeHours + 1) * H })
  assert.equal(planFeedbackAsks({ rows: [tardi], recipients: who('u1'), now: NOW }).length, 0)
  const vecchia = row({ age: (FEEDBACK_RULES.secondMaxAgeHours + 1) * H })
  assert.equal(planFeedbackAsks({ rows: [vecchia], recipients: who('u1'), now: NOW }).length, 0)
})

test('fra la prima e la seconda almeno 12 ore', () => {
  const r = row({ age: 25 * H })
  const lateFirst = new Map([[r.redemption_id, { [FEEDBACK_KINDS.first]: ago(3 * H) }]])
  assert.equal(planFeedbackAsks({ rows: [r], sent: lateFirst, recipients: who('u1'), now: NOW }).length, 0)
})

test('di notte non parte niente (23–8, ora di Roma)', () => {
  const night = new Date('2026-09-29T22:30:00Z') // 00:30 a Roma
  assert.equal(romeHour(night), 0)
  assert.equal(isQuietHour(night), true)
  assert.equal(isQuietHour(NOW), false)
  const r = { ...row(), redeemed_at: new Date(night.getTime() - 40 * MIN).toISOString() }
  assert.equal(planFeedbackAsks({ rows: [r], recipients: who('u1'), now: night }).length, 0)
})

test('due convalide della stessa persona: una email a giro, per la più recente', () => {
  const a = row({ age: 50 * MIN })
  const b = row({ age: 35 * MIN })
  const c = row({ user: 'u2', age: 45 * MIN })
  const plan = planFeedbackAsks({ rows: [a, b, c], recipients: who('u1', 'u2'), now: NOW })
  assert.equal(plan.length, 2)
  assert.equal(plan.find((p) => p.row.user_id === 'u1').row.redemption_id, b.redemption_id)
})

test('i link delle stelle portano a /feedback col voto', () => {
  assert.equal(feedbackUrl(TOKEN, 5), `https://chiamamibi.com/feedback?t=${TOKEN}&stelle=5`)
  const props = feedbackAskProps({ row: row(), round: 1, recipient: { name: 'Giulia Rossi' } })
  assert.equal(props.name, 'Giulia')
  assert.equal(props.value, '−20%')
  assert.match(props.starHref(3), /stelle=3$/)
})

test('email senza stelle: cinque link, oggetto col locale, disiscrizione', () => {
  const mail = feedbackAskEmail({ ...SAMPLE.feedbackAsk, unsubscribeUrl: 'https://chiamamibi.com/preferenze-email?t=x' })
  assert.equal(mail.subject, 'Com’è andata da Bar Stampa?')
  assert.ok(mail.subject.length < 50)
  for (let n = 1; n <= 5; n += 1) assert.ok(mail.html.includes(`stelle=${n}`), `stella ${n}`)
  assert.ok(mail.html.includes('Scegli cosa ricevere'))
  assert.ok(!/rgba\(/.test(mail.html))
  assert.match(mail.text, /stelle=5/)
})

test('email con le stelle già date: niente link alle stelle, bottone al modulo, "ieri" al secondo giro', () => {
  const mail = feedbackAskEmail({ ...SAMPLE.feedbackAskRated, unsubscribeUrl: 'https://chiamamibi.com/preferenze-email?t=x' })
  assert.equal(mail.subject, 'Ieri da Bar Stampa: mi racconti di più?')
  assert.ok(!mail.html.includes('stelle=1'))
  assert.ok(mail.html.includes('Racconta a Bi'))
  assert.match(mail.text, /4 stelle/)
})

test('senza nome la frase comincia con la maiuscola', () => {
  const mail = feedbackAskEmail({ ...SAMPLE.feedbackAsk, name: '' })
  assert.match(mail.text, /^Poco fa hai usato/)
})
