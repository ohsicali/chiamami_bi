/**
 * Il promemoria degli sconti presi e non usati: chi lo riceve, quando, e
 * soprattutto chi NON lo riceve.
 *
 * Il rischio che queste prove tengono d'occhio è uno solo: chi prende dieci
 * sconti in due minuti non deve ricevere dieci email in un giorno. Poi le
 * cose che renderebbero il promemoria una bugia — uno sconto scaduto, già
 * usato, di un locale tolto dalla guida.
 *
 *   node --test tests/discount-reminders.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { planReminders, REMINDER_RULES, REMINDER_KIND, romeWeekday, reminderProps } from '../api/_email/reminders.js'
import { discountReminderEmail, SAMPLE } from '../api/_email/templates.js'
import { claimedWords } from '../api/_email/content.js'

// Giovedì 24 settembre 2026, 11:00 a Roma.
const NOW = new Date('2026-09-24T09:00:00Z')
const H = 3_600_000
const ago = (h) => new Date(NOW.getTime() - h * H).toISOString()
const inH = (h) => new Date(NOW.getTime() + h * H).toISOString()

let seq = 0
function red({ user = 'u1', discount, hoursAgo = 72, ...d } = {}) {
  seq += 1
  const discountId = discount || `d${seq}`
  return {
    id: `r${seq}`,
    user_id: user,
    discount_id: discountId,
    short_code: 'K48213',
    generated_at: ago(hoursAgo),
    discount: {
      id: discountId, is_active: true, is_drop: false, valid_until: null, drop_ends_at: null,
      valid_days: null, discount_value: '20', discount_type: 'percentage', title: '20% di sconto',
      restaurant_id: `rest-${discountId}`,
      restaurant: { name: `Locale ${discountId}`, slug: `locale-${discountId}`, is_published: true },
      ...d,
    },
  }
}
const people = (...ids) => new Map(ids.map((id) => [id, { email: `${id}@example.com`, name: id, token: `tok-${id}` }]))
const plan = (input) => planReminders({ recipients: people('u1', 'u2'), now: NOW, ...input })

test('uno sconto preso da meno di 48 ore non si ricorda', () => {
  assert.equal(plan({ pending: [red({ hoursAgo: 47 })] }).length, 0)
  assert.equal(plan({ pending: [red({ hoursAgo: 49 })] }).length, 1)
})

test('dieci sconti presi insieme: un promemoria solo, e dice quanti ne restano', () => {
  const pending = Array.from({ length: 10 }, (_, i) => red({ hoursAgo: 72 + i / 60 }))
  const out = plan({ pending })
  assert.equal(out.length, 1, 'mai più di un promemoria al giorno per persona')
  assert.equal(out[0].others, 9)
})

test('fra un promemoria e il successivo passano almeno tre giorni', () => {
  const pending = [red({ hoursAgo: 200 }), red({ hoursAgo: 200 })]
  const reminded = new Set([pending[0].id])
  const dopo = (h) => new Map([['u1', [{ kind: REMINDER_KIND, sent_at: ago(h) }]]])
  assert.equal(plan({ pending, reminded, history: dopo(24) }).length, 0, 'ieri: no')
  assert.equal(plan({ pending, reminded, history: dopo(48) }).length, 0, 'due giorni fa: no')
  // Il cron parte "entro l'ora": 71 ore devono bastare come 72.
  const out = plan({ pending, reminded, history: dopo(71) })
  assert.equal(out.length, 1, 'tre giorni fa: sì')
  assert.equal(out[0].redemption.id, pending[1].id, 'quello già ricordato non si ripete')
})

test('uno sconto già ricordato non si ricorda una seconda volta', () => {
  const r = red()
  assert.equal(plan({ pending: [r], reminded: new Set([r.id]) }).length, 0)
})

test('al massimo quattro promemoria in trenta giorni', () => {
  const pending = [red({ hoursAgo: 100 })]
  const log = [300, 400, 500, 600].map((h) => ({ kind: REMINDER_KIND, sent_at: ago(h) }))
  assert.equal(REMINDER_RULES.maxPer30Days, 4)
  assert.equal(plan({ pending, history: new Map([['u1', log]]) }).length, 0)
  assert.equal(plan({ pending, history: new Map([['u1', log.slice(0, 3)]]) }).length, 1)
})

test('se le abbiamo appena scritto per altro, il promemoria aspetta domani', () => {
  const pending = [red()]
  const history = new Map([['u1', [{ kind: 'discount-claimed', sent_at: ago(3) }]]])
  assert.equal(plan({ pending, history }).length, 0)
})

test('un drop che scade entro 48 ore passa davanti e salta l’attesa', () => {
  const vecchio = red({ hoursAgo: 300 })
  const drop = red({ hoursAgo: 60, is_drop: true, drop_ends_at: inH(30) })
  const reminded = new Set()
  const history = new Map([['u1', [{ kind: REMINDER_KIND, sent_at: ago(30) }]]])
  const out = plan({ pending: [vecchio, drop], reminded, history })
  assert.equal(out.length, 1)
  assert.equal(out[0].redemption.id, drop.id)
  assert.ok(out[0].urgent)
  // Ma non salta la regola del "una al giorno".
  const ieri = new Map([['u1', [{ kind: REMINDER_KIND, sent_at: ago(5) }]]])
  assert.equal(plan({ pending: [drop], history: ieri }).length, 0)
})

test('a parità, prima uno sconto che vale oggi, poi il più vecchio', () => {
  const oggi = romeWeekday(NOW)
  assert.equal(oggi, 4, 'il 24/09/2026 è giovedì')
  const nonOggi = red({ hoursAgo: 300, valid_days: [1] })
  const valeOggi = red({ hoursAgo: 100, valid_days: [3, 4, 5] })
  const vecchio = red({ hoursAgo: 200 })
  const out = plan({ pending: [nonOggi, vecchio, valeOggi] })
  assert.equal(out[0].redemption.id, vecchio.id, 'fra quelli che valgono oggi vince il più vecchio')
  const soloDue = plan({ pending: [nonOggi, valeOggi] })
  assert.equal(soloDue[0].redemption.id, valeOggi.id)
})

test('niente promemoria per sconti scaduti, spenti, già usati o di locali tolti', () => {
  assert.equal(plan({ pending: [red({ valid_until: ago(1) })] }).length, 0, 'scaduto')
  assert.equal(plan({ pending: [red({ is_drop: true, drop_ends_at: ago(1) })] }).length, 0, 'drop finito')
  assert.equal(plan({ pending: [red({ is_active: false })] }).length, 0, 'spento')
  const nascosto = red()
  nascosto.discount.restaurant.is_published = false
  assert.equal(plan({ pending: [nascosto] }).length, 0, 'locale non pubblicato')
  const usato = red({ discount: 'dx' })
  assert.equal(plan({ pending: [usato], redeemed: new Set(['u1:dx']) }).length, 0, 'già usato con un altro codice')
})

test('chi ha spento "I miei sconti" non riceve niente', () => {
  const out = planReminders({ pending: [red({ user: 'u3' })], recipients: people('u1'), now: NOW })
  assert.equal(out.length, 0)
})

test('oltre i trenta giorni uno sconto non si ricorda più', () => {
  assert.equal(plan({ pending: [red({ hoursAgo: 31 * 24 })] }).length, 0)
})

test('due persone, un promemoria ciascuna', () => {
  const out = plan({ pending: [red({ user: 'u1' }), red({ user: 'u1' }), red({ user: 'u2' })] })
  assert.deepEqual(out.map((o) => o.userId).sort(), ['u1', 'u2'])
})

test('lo stesso sconto preso due volte conta uno', () => {
  const out = plan({ pending: [red({ discount: 'dd', hoursAgo: 80 }), red({ discount: 'dd', hoursAgo: 90 })] })
  assert.equal(out.length, 1)
  assert.equal(out[0].others, 0)
})

/* ── L'email ───────────────────────────────────────────────────────── */

const UNSUB = 'https://chiamamibi.com/preferenze-email?t=abc'

test('il promemoria porta il link per scegliere cosa ricevere', () => {
  const m = discountReminderEmail({ ...SAMPLE.discountReminder, unsubscribeUrl: UNSUB })
  assert.ok(m.html.includes(UNSUB))
  assert.ok(m.text.includes(UNSUB))
})

test('la convenzione ricordata resta crema: niente countdown, niente corallo pieno', () => {
  const m = discountReminderEmail({ ...SAMPLE.discountReminder, unsubscribeUrl: UNSUB })
  assert.ok(!/DROP LIVE|SCADE TRA/.test(m.html))
  assert.ok(!/drop/i.test(m.subject))
  assert.match(m.html, /VALIDO SOLO A CENA/)
})

test('il drop ricordato ha la card corallo e dice quando scade', () => {
  const m = discountReminderEmail({
    ...SAMPLE.discountReminder, isDrop: true, endsAt: inH(40), unsubscribeUrl: UNSUB,
  })
  assert.match(m.subject, /scade tra un giorno/)
  assert.match(m.html, /DROP LIVE · SCADE TRA UN GIORNO/)
  assert.ok(!/rimasti|presi</.test(m.html), 'i posti rimasti non riguardano chi il codice ce l’ha già')
})

test('il promemoria dice il codice da dettare e apre il QR giusto', () => {
  const item = { redemption: red({ discount: 'abc-123' }), others: 2 }
  const props = reminderProps(item, { now: NOW })
  assert.equal(props.code, 'K48 213')
  assert.match(props.href, /\/sconti\?tab=miei&open=abc-123$/)
  const m = discountReminderEmail(props)
  assert.ok(m.html.includes('K48 213'))
  assert.ok(!m.html.includes('BiSc-'), 'mai il qr_code per esteso')
  assert.match(m.text, /altri 2 sconti presi/)
})

test('senza altri sconti la riga "hai altri N" non compare', () => {
  const m = discountReminderEmail({ ...SAMPLE.discountReminder, others: 0 })
  assert.ok(!/altri \d+ sconti|un altro sconto/.test(m.html))
  assert.ok(!/undefined|null|NaN/.test(m.html))
})

test('quando l’hai preso, detto a parole', () => {
  assert.equal(claimedWords(ago(46), NOW), 'l’altro ieri')
  assert.equal(claimedWords('2026-09-20T18:40:00Z', NOW), 'domenica')
  assert.equal(claimedWords('2026-09-12T10:00:00Z', NOW), 'il 12 settembre')
  assert.equal(claimedWords('2026-09-08T10:00:00Z', NOW), 'l’8 settembre')
  assert.equal(claimedWords(null, NOW), null)
})
