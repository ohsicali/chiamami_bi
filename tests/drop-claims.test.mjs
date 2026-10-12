/**
 * Drop coi giorni contati (12/10): chi prende un drop ha 7 giorni per usarlo,
 * poi il posto passa al primo in lista d'attesa. Qui:
 *   - i conti del tempo che resta (barra, countdown, «I miei vantaggi»);
 *   - le email a tappe: "hai 7 giorni", "4 giorni", "2 giorni", "24 ore",
 *     "l'hai perso" — una volta sola ciascuna, mai fuori ordine, mai di notte
 *     (tranne la ricevuta di chi ha appena sbloccato), i promemoria solo a chi
 *     ha "I miei sconti" acceso.
 *
 *   node --test tests/drop-claims.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  claimDeadline, claimTimeLeft, claimUrgency, formatClaimDeadline, formatClaimDeadlineShort,
  formatClaimLeft, formatClaimLeftShort, hasClaimWindow, isClaimExpired, splitMyRedemptions,
} from '../src/lib/dropClaim.js'
import { dueStage, planDropClaimEmails, dropClaimProps, DROP_CLAIM_KINDS, DROP_CLAIM_RULES } from '../api/_email/dropClaims.js'
import { dropClaimEmail, discountClaimedEmail, SAMPLE } from '../api/_email/templates.js'
import { dropCtaState, waitlistJoinMessage, waitlistJoinedCopy } from '../src/lib/dropWaitlist.js'
import { dropPeopleFromRows, dropPeopleNotes, dropPeopleSummary } from '../src/lib/dropStats.js'

// Lunedì 12 ottobre 2026, 15:00 a Roma.
const NOW = new Date('2026-10-12T13:00:00Z')
const H = 3_600_000
const D = 24 * H
const at = (msFromNow) => new Date(NOW.getTime() + msFromNow).toISOString()

let seq = 0
/** Un riscatto di un drop da 7 giorni preso `ageH` ore fa. */
function claim({ ageH = 1, days = 7, user = 'u1', status = 'generated', discount = {} } = {}) {
  seq += 1
  const gen = NOW.getTime() - ageH * H
  return {
    id: `r${seq}`,
    user_id: user,
    discount_id: `d${seq}`,
    status,
    short_code: 'K48213',
    generated_at: new Date(gen).toISOString(),
    expires_at: new Date(gen + days * D).toISOString(),
    discount: {
      id: `d${seq}`, is_drop: true, is_active: true, claim_window_days: days,
      valid_until: null, drop_ends_at: null, discount_type: 'percentage', discount_value: '30', title: '30% di sconto',
      restaurant_id: `rest${seq}`, restaurant: { name: 'Shoro', is_published: true, city: 'Torino' },
      ...discount,
    },
  }
}

const people = (opts = {}) => new Map(['u1', 'u2'].map((id) => [id, {
  email: `${id}@example.com`, name: 'Giulia Rossi', token: `tok-${id}`, myDiscounts: true, ...opts,
}]))
const plan = (input) => planDropClaimEmails({ recipients: people(), now: NOW, ...input })

/* ── I conti ─────────────────────────────────────────────────────── */

test('solo i drop nuovi hanno i giorni contati', () => {
  assert.equal(hasClaimWindow({ is_drop: true, claim_window_days: 7 }), true)
  assert.equal(hasClaimWindow({ is_drop: true, claim_window_days: null }), false, 'i drop di prima no')
  assert.equal(hasClaimWindow({ is_drop: false, claim_window_days: 7 }), false, 'le convenzioni no')
})

test('il tempo che resta: barra piena appena preso, vuota a scadenza', () => {
  const fresh = claimTimeLeft(claim({ ageH: 0 }), undefined, NOW)
  assert.equal(fresh.fraction, 1)
  assert.equal(fresh.days, 7)
  assert.equal(fresh.urgency, 'calm')
  const half = claimTimeLeft(claim({ ageH: 84 }), undefined, NOW)
  assert.equal(half.fraction, 0.5)
  assert.equal(half.urgency, 'soon')
  const last = claimTimeLeft(claim({ ageH: 150 }), undefined, NOW)
  assert.equal(last.urgency, 'urgent')
  const gone = claimTimeLeft(claim({ ageH: 170 }), undefined, NOW)
  assert.equal(gone.expired, true)
  assert.equal(gone.fraction, 0)
})

test('se il drop finisce prima dei 7 giorni, vale fino alla fine del drop', () => {
  const r = claim({ ageH: 1, discount: { drop_ends_at: at(2 * D), valid_until: at(2 * D) } })
  assert.equal(claimDeadline(r).toISOString(), at(2 * D))
})

test('scaduto: segnato dal giro, o già passato prima del giro', () => {
  assert.equal(isClaimExpired(claim({ status: 'expired' }), NOW), true)
  assert.equal(isClaimExpired(claim({ ageH: 169 }), NOW), true, 'il giro passa ogni 10 minuti: conta l’ora')
  assert.equal(isClaimExpired(claim({ ageH: 100 }), NOW), false)
  assert.equal(isClaimExpired({ status: 'generated', expires_at: null }, NOW), false, 'senza limite non scade')
})

test('il tempo detto a parole e in breve', () => {
  assert.equal(formatClaimLeft(6 * D + 4 * H + 30_000), '6 giorni e 4 ore')
  assert.equal(formatClaimLeft(D), '1 giorno')
  assert.equal(formatClaimLeft(23 * H + 59 * 60_000), '23 ore')
  assert.equal(formatClaimLeft(45 * 60_000), '45 minuti')
  assert.equal(formatClaimLeft(0), null)
  assert.equal(formatClaimLeftShort(6 * D + 4 * H), '6g 04h')
  assert.equal(formatClaimLeftShort(5 * H + 7 * 60_000), '5h 07m')
  assert.equal(formatClaimLeftShort(4 * 60_000 + 12_000), '04m 12s')
  assert.equal(claimUrgency(-1), 'over')
})

test('la data di scadenza, all’ora di Roma', () => {
  assert.equal(formatClaimDeadline('2026-10-19T19:00:00Z'), 'lunedì 19 ottobre alle 21:00')
  assert.equal(formatClaimDeadlineShort('2026-10-19T19:00:00Z'), 'lun 19 ott, 21:00')
})

test('«I miei vantaggi»: i drop coi giorni in cima, il più vicino a scadere per primo', () => {
  const conv = { id: 'c', status: 'generated', expires_at: null, discount: { is_drop: false } }
  const lontano = claim({ ageH: 1 })
  const vicino = claim({ ageH: 150 })
  const usato = { ...claim(), status: 'redeemed' }
  const perso = claim({ status: 'expired', ageH: 200 })
  const { active, used, expired } = splitMyRedemptions([conv, lontano, usato, vicino, perso], NOW)
  assert.deepEqual(active.map((r) => r.id), [vicino.id, lontano.id, 'c'])
  assert.deepEqual(used.map((r) => r.id), [usato.id])
  assert.deepEqual(expired.map((r) => r.id), [perso.id])
})

/* ── Le tappe ─────────────────────────────────────────────────────── */

test('le tappe di un drop da 7 giorni: partenza, 4, 2, 1 giorno, perso', () => {
  assert.equal(dueStage(claim({ ageH: 0.01 }), NOW), null, 'nei primi minuti no: la ricevuta del Bi Club arriva prima')
  assert.equal(dueStage(claim({ ageH: 1 }), NOW), 'start')
  assert.equal(dueStage(claim({ ageH: 30 }), NOW), null, 'il giorno dopo la partenza non serve più')
  assert.equal(dueStage(claim({ ageH: 72.5 }), NOW), 'left4')
  assert.equal(dueStage(claim({ ageH: 120.5 }), NOW), 'left2')
  assert.equal(dueStage(claim({ ageH: 144.5 }), NOW), 'left1')
  assert.equal(dueStage(claim({ ageH: 169 }), NOW), 'expired')
  assert.equal(dueStage(claim({ ageH: 169, status: 'expired' }), NOW), 'expired')
  assert.equal(dueStage(claim({ ageH: 168 + DROP_CLAIM_RULES.expiredMaxAgeHours + 1 }), NOW), null, 'tre giorni dopo: acqua passata')
})

test('usato: niente più email', () => {
  assert.equal(dueStage({ ...claim({ ageH: 144.5 }), status: 'redeemed' }, NOW), null)
})

test('drop corto: le tappe troppo vicine allo sblocco si saltano', () => {
  // Due giorni per usarlo: "ti restano 2 giorni" cadrebbe insieme a "hai 2 giorni".
  assert.equal(dueStage(claim({ days: 2, ageH: 1 }), NOW), 'start')
  assert.equal(dueStage(claim({ days: 2, ageH: 24.5 }), NOW), 'left1')
})

test('drop spento o finito: niente promemoria e niente "l’hai perso"', () => {
  assert.equal(dueStage(claim({ ageH: 72.5, discount: { is_active: false } }), NOW), null)
  assert.equal(dueStage(claim({ ageH: 72.5, discount: { restaurant: { is_published: false } } }), NOW), null)
  // Finito prima dei suoi 7 giorni: a chiuderlo è stata la fine del drop.
  const finito = claim({ ageH: 169, discount: { drop_ends_at: at(-3 * D) } })
  assert.equal(dueStage(finito, NOW), null)
})

test('ogni tappa una volta sola, e mai una tappa dopo una più avanti', () => {
  const r = claim({ ageH: 72.5 })
  assert.equal(plan({ rows: [r] })[0].kind, DROP_CLAIM_KINDS.left4)
  assert.equal(plan({ rows: [r], sent: new Map([[r.id, new Set(['left4'])]]) }).length, 0)
  assert.equal(plan({ rows: [r], sent: new Map([[r.id, new Set(['left2'])]]) }).length, 0, 'il 4 giorni dopo il 2 giorni no')
})

test('la partenza non parte a chi ha già la ricevuta col codice, a meno che il posto venga dalla lista', () => {
  const r = claim({ ageH: 1 })
  assert.equal(plan({ rows: [r], receipts: new Set([r.id]) }).length, 0)
  const out = plan({ rows: [r], receipts: new Set([r.id]), promoted: new Set([r.id]) })
  assert.equal(out.length, 1)
  assert.equal(out[0].promoted, true)
})

test('di notte niente, tranne la ricevuta di chi ha appena sbloccato', () => {
  const notte = new Date('2026-10-12T23:30:00Z') // 01:30 a Roma
  const preso = claim({ ageH: 0 })
  preso.generated_at = new Date(notte.getTime() - H).toISOString()
  preso.expires_at = new Date(notte.getTime() - H + 7 * D).toISOString()
  const quattro = claim({ ageH: 0 })
  quattro.generated_at = new Date(notte.getTime() - 72.5 * H).toISOString()
  quattro.expires_at = new Date(notte.getTime() - 72.5 * H + 7 * D).toISOString()
  const dallaLista = { ...preso, id: 'lista', user_id: 'u2' }
  const out = planDropClaimEmails({ rows: [preso, quattro, dallaLista], promoted: new Set(['lista']), recipients: people(), now: notte })
  assert.deepEqual(out.map((i) => i.stage), ['start'], 'solo la ricevuta: il posto dalla lista aspetta le 8')
  assert.equal(out[0].row.id, preso.id)
})

test('i promemoria solo a chi ha "I miei sconti" acceso; la partenza a tutti', () => {
  const recipients = people({ myDiscounts: false })
  assert.equal(planDropClaimEmails({ rows: [claim({ ageH: 72.5 })], recipients, now: NOW }).length, 0)
  assert.equal(planDropClaimEmails({ rows: [claim({ ageH: 169 })], recipients, now: NOW }).length, 0)
  assert.equal(planDropClaimEmails({ rows: [claim({ ageH: 1 })], recipients, now: NOW }).length, 1)
})

test('una email per persona a giro: la tappa più avanti', () => {
  const out = plan({ rows: [claim({ ageH: 1 }), claim({ ageH: 144.5 }), claim({ ageH: 72.5 })] })
  assert.equal(out.length, 1)
  assert.equal(out[0].stage, 'left1')
})

/* ── Le email ─────────────────────────────────────────────────────── */

test('le cinque email: oggetto giusto, niente buchi, codice da dettare', () => {
  const cases = [
    ['start', /Hai 7 giorni per usare il drop da Shoro/],
    ['left4', /Ti restano 4 giorni per il drop da Shoro/],
    ['left2', /Mancano 2 giorni/],
    ['left1', /Ultime 24 ore per il drop da Shoro/],
    ['expired', /Il drop da Shoro è scaduto/],
  ]
  for (const [stage, subject] of cases) {
    const m = dropClaimEmail({ ...SAMPLE.dropClaim, stage, unsubscribeUrl: 'https://x/u' })
    assert.match(m.subject, subject, stage)
    assert.ok(!/undefined|null|NaN/.test(m.html), `${stage}: niente buchi`)
    assert.ok(!/undefined|null|NaN/.test(m.text), `${stage}: niente buchi nel testo`)
    if (stage !== 'expired') {
      assert.ok(m.html.includes('K48 213'), `${stage}: il codice da dettare`)
      assert.ok(m.html.includes('TEMPO PER USARLO'), `${stage}: la barra del tempo`)
    }
  }
})

test('il posto dalla lista d’attesa: lo dice nell’oggetto, ed è una ricevuta', () => {
  const m = dropClaimEmail({ ...SAMPLE.dropClaim, stage: 'start', promoted: true, unsubscribeUrl: 'https://x/u' })
  assert.match(m.subject, /Si è liberato un posto: il drop da Shoro è tuo/)
  assert.ok(!m.html.includes('https://x/u'), 'una ricevuta non porta il link di disiscrizione')
})

test('il drop perso non è corallo: il drop non è più vivo', () => {
  const m = dropClaimEmail({ ...SAMPLE.dropClaim, stage: 'expired', passedOn: true })
  assert.ok(!m.html.includes('#E8453C 0%'), 'niente card corallo')
  assert.match(m.text, /passato a chi era in lista/)
  const libero = dropClaimEmail({ ...SAMPLE.dropClaim, stage: 'expired', passedOn: false })
  assert.match(libero.text, /tornato libero/)
})

test('le parole dell’email vengono dal riscatto vero', () => {
  const r = claim({ ageH: 120.5 })
  const item = { row: r, stage: 'left2', kind: DROP_CLAIM_KINDS.left2, recipient: { name: 'Giulia Rossi' }, promoted: false }
  const props = dropClaimProps(item, { now: NOW })
  assert.equal(props.name, 'Giulia')
  assert.equal(props.windowDays, 7)
  assert.equal(props.leftWords, '1 giorno e 23 ore')
  assert.equal(props.pct, 28)
  assert.equal(props.code, 'K48 213')
  assert.match(props.href, new RegExp(`/sconti\\?tab=miei&open=${r.discount_id}$`))
  assert.match(props.deadline, /^(lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica) \d+ \w+ alle \d\d:\d\d$/)
})

test('la ricevuta col codice di un drop coi giorni dice fin quando vale', () => {
  const m = discountClaimedEmail({ ...SAMPLE.discountClaimed, claimWindow: { days: 7, deadline: 'lunedì 19 ottobre alle 21:00' } })
  assert.match(m.subject, /hai 7 giorni/)
  assert.match(m.text, /Hai 7 giorni per usarlo: vale fino a lunedì 19 ottobre alle 21:00/)
  const senza = discountClaimedEmail(SAMPLE.discountClaimed)
  assert.ok(!/giorni per usarlo/.test(senza.text), 'gli sconti senza limite restano come prima')
})

/* ── Il bottone del drop ─────────────────────────────────────────── */

const drop = (over = {}) => ({
  id: 'd', is_drop: true, is_active: true, claim_window_days: 7,
  max_quantity: 20, total_redeemed: 5, ...over,
})

test('drop con posti: "Sblocca", e la riga dice dei 7 giorni', () => {
  const c = dropCtaState({ deal: drop(), now: NOW })
  assert.equal(c.kind, 'claim')
  assert.equal(c.disabled, false)
  assert.match(c.note, /hai 7 giorni per usarlo/)
  assert.equal(dropCtaState({ deal: drop({ claim_window_days: null }), now: NOW }).note, null, 'i drop di prima non lo dicono')
})

test('drop esaurito coi giorni contati: «Mettiti in lista», non un bottone spento', () => {
  const full = drop({ total_redeemed: 20 })
  const c = dropCtaState({ deal: full, now: NOW })
  assert.equal(c.kind, 'waitlist')
  assert.equal(c.disabled, false)
  assert.match(c.note, /passa al primo in lista/)
  assert.match(c.note, /Più sei in alto, prima tocca a te/, 'deve essere chiaro che conta la posizione')
  assert.match(dropCtaState({ deal: full, wait: { waiting: 3 }, now: NOW }).note, /Ci sono già 3 persone in lista/)
  const inFila = dropCtaState({ deal: full, wait: { waiting: 3, my_position: 2, my_status: 'waiting' }, now: NOW })
  assert.equal(inFila.kind, 'waiting')
  assert.equal(inFila.label, 'In lista · sei il n° 2')
  assert.equal(inFila.canLeave, true)
  // I drop di prima, esauriti, restano "Esaurito" e spenti.
  const vecchio = dropCtaState({ deal: drop({ total_redeemed: 20, claim_window_days: null }), now: NOW })
  assert.deepEqual([vecchio.kind, vecchio.disabled], ['soldout', true])
})

test('già preso: "Apri il QR" col tempo che resta; non usato in tempo: "Tempo scaduto"', () => {
  const open = dropCtaState({ deal: drop({ total_redeemed: 20 }), redemption: claim({ ageH: 24 }), now: NOW })
  assert.equal(open.kind, 'open', 'chi l’ha preso apre il QR anche se il drop è esaurito')
  assert.match(open.note, /Ti restano 6 giorni per usarlo/)
  const scaduto = dropCtaState({ deal: drop(), redemption: claim({ ageH: 170 }), now: NOW })
  assert.deepEqual([scaduto.kind, scaduto.disabled], ['expired', true])
  const usato = dropCtaState({ deal: drop(), redemption: { ...claim(), status: 'redeemed' }, now: NOW })
  assert.equal(usato.kind, 'used')
})

test('dopo «Mettiti in lista»: le parole giuste per ogni risposta del DB', () => {
  assert.match(waitlistJoinMessage({ status: 'joined', position: 4 }).text, /sei il n° 4/)
  assert.equal(waitlistJoinMessage({ status: 'claim_available' }).claim, true)
  assert.match(waitlistJoinMessage({ status: 'already_claimed' }).text, /I miei vantaggi/)
  assert.match(waitlistJoinMessage({ status: 'error' }).text, /Riprova/)
})

test('in lista: la schermata dice il numero, i 7 giorni e buona fortuna', () => {
  const c = waitlistJoinedCopy({ position: 134, waiting: 140, days: 7, restaurantName: 'Gelateria Borghese' })
  assert.equal(c.position, 134)
  assert.equal(c.title, 'Sei il numero 134 nella lista d’attesa')
  assert.match(c.body, /Gelateria Borghese non lo usa entro 7 giorni/)
  assert.match(c.body, /passerai tu/)
  assert.match(c.after, /Dietro di te ci sono 6 persone/)
  assert.match(c.luck, /Buona fortuna/)
  assert.equal(waitlistJoinedCopy({ position: 1, waiting: 1, days: 7 }).title, 'Sei il primo della lista!')
  assert.match(waitlistJoinedCopy({ position: 1, waiting: 1, days: 7 }).body, /il primo posto che si libera è tuo/)
  assert.doesNotMatch(waitlistJoinedCopy({ position: 3, waiting: 3, days: 7 }).after, /Dietro di te/, 'ultimo della fila: nessuno dietro')
  assert.equal(waitlistJoinedCopy({}).position, null, 'senza posto (DB lento) niente numero')
})

test('numeri del drop per il locale e l’admin: presi, usati, da usare, persi, in lista', () => {
  // Dalla RPC verify_drops_overview.
  const s = dropPeopleSummary({ total: 50, claim_window_days: 7, used: 12, to_use: 38, lost: 8, waiting: 133, from_waitlist: 8, next_expiry: at(2 * D) })
  assert.deepEqual(
    [s.taken, s.total, s.free, s.soldOut, s.pct, s.waiting, s.lost, s.windowed],
    [50, 50, 0, true, 100, 133, 8, true],
  )
  const notes = dropPeopleNotes(s)
  assert.match(notes[0], /7 giorni per usarlo/)
  assert.match(notes[1], /il primo posto si libera mercoledì 14 ottobre alle 15:00/)
  assert.match(notes[2], /8 posti sono già passati a chi era in lista/)
  // Un drop di prima, senza giorni contati: niente righe sulla lista.
  assert.deepEqual(dropPeopleNotes(dropPeopleSummary({ total: 20, used: 6, to_use: 14 })), [])
  assert.equal(dropPeopleSummary({ total: 20, used: 6, to_use: 10 }).free, 4)
})

test('l’admin conta dalle righe come il DB: scaduto = perso, il posto torna libero', () => {
  const deal = drop({ max_quantity: 5, max_redemptions: 5 })
  const rows = [
    { status: 'redeemed', expires_at: at(3 * D) },
    { status: 'generated', expires_at: at(2 * D) },
    { status: 'generated', expires_at: at(-H) }, // scaduto, il giro non è ancora passato
    { status: 'expired', expires_at: at(-D) },
    { status: 'generated', expires_at: at(5 * D) },
  ]
  const it = dropPeopleFromRows(deal, rows, { waiting: 4, promoted: 1 }, NOW)
  assert.deepEqual(
    [it.total, it.claims, it.used, it.to_use, it.lost, it.taken, it.waiting, it.from_waitlist, it.next_expiry],
    [5, 5, 1, 2, 2, 3, 4, 1, at(2 * D)],
  )
  const s = dropPeopleSummary(it)
  assert.deepEqual([s.soldOut, s.free], [false, 2])
  assert.deepEqual(dropPeopleFromRows(deal, undefined, null, NOW).taken, 0, 'nessun riscatto: zero, non un errore')
})
