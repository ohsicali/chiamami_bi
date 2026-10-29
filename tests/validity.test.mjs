/**
 * Quando il locale può convalidare uno sconto (29/10): la fascia scritta più
 * il tempo di pagare il conto, e dopo mezzanotte conta ancora la sera prima.
 * Regole in src/lib/validity.js, verità nel DB
 * (supabase/verify-meal-windows-2026-10-29.sql), che deve dire lo stesso.
 *
 *   node --test tests/validity.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MEAL_SLOTS, REDEEM_GRACE_MIN, ALL_DAY_REDEEM_TO_MIN,
  checkValidity, redeemRanges, redeemServiceDay,
} from '../src/lib/validity.js'

// Ora di Roma (in ottobre fino al 25 è +02:00, poi +01:00).
const rome = (s) => new Date(`${s}+01:00`)

// Locanda Bellezia: mercoledì e giovedì, solo a cena.
const bellezia = { valid_days: [3, 4], valid_meal_slots: ['cena'], valid_until: '2026-11-30T00:00:00Z' }

test('giovedì 23:33, ancora a cena: vale (era il bug del 29/10)', () => {
  assert.equal(checkValidity(bellezia, rome('2026-10-29T23:33:00')), 'valid_now')
  assert.equal(redeemServiceDay(bellezia, rome('2026-10-29T23:33:00')), 4)
})

test('dopo mezzanotte la cena del giovedì è ancora giovedì', () => {
  assert.equal(redeemServiceDay(bellezia, rome('2026-10-30T00:40:00')), 4)
  assert.equal(checkValidity(bellezia, rome('2026-10-30T02:30:00')), 'valid_now')
  assert.equal(checkValidity(bellezia, rome('2026-10-30T02:31:00')), 'valid_other_day')
  // venerdì sera no: il venerdì non è tra i giorni
  assert.equal(checkValidity(bellezia, rome('2026-10-30T21:00:00')), 'valid_other_day')
})

test('la cena non vale a pranzo, e prima di cena è "più tardi"', () => {
  assert.equal(checkValidity(bellezia, rome('2026-10-29T13:00:00')), 'valid_today_later')
  assert.equal(checkValidity(bellezia, rome('2026-10-29T18:29:00')), 'valid_today_later')
  assert.equal(checkValidity(bellezia, rome('2026-10-29T18:30:00')), 'valid_now')
})

test('il pranzo si paga anche alle 16', () => {
  const pranzo = { valid_days: [1, 2, 3, 4, 5], valid_meal_slots: ['pranzo'] }
  assert.equal(checkValidity(pranzo, rome('2026-10-29T16:10:00')), 'valid_now')
  assert.equal(checkValidity(pranzo, rome('2026-10-29T19:00:00')), 'valid_other_day')
  assert.equal(checkValidity(pranzo, rome('2026-10-29T10:00:00')), 'valid_today_later')
})

test('senza fascia: tutto il giorno e fino alle 3 di notte', () => {
  const gio = { valid_days: [4] }
  assert.equal(checkValidity(gio, rome('2026-10-29T08:00:00')), 'valid_now')
  assert.equal(checkValidity(gio, rome('2026-10-30T02:59:00')), 'valid_now')
  assert.equal(checkValidity(gio, rome('2026-10-30T03:01:00')), 'valid_other_day')
  assert.equal(checkValidity({}, rome('2026-10-30T04:00:00')), 'valid_now')
})

test('orario scritto a mano: mezz\'ora prima, un\'ora dopo, anche oltre mezzanotte', () => {
  const sera = { valid_days: [4], valid_time_from: '22:00:00', valid_time_to: '01:00:00' }
  assert.deepEqual(redeemRanges(sera), [{ fromMin: 21 * 60 + 30, toMin: 26 * 60 }])
  assert.equal(checkValidity(sera, rome('2026-10-30T01:45:00')), 'valid_now')
  assert.equal(checkValidity(sera, rome('2026-10-30T02:01:00')), 'valid_other_day')
})

test('conta l\'ora di Roma, non quella del telefono', () => {
  // 22:40 UTC = 23:40 a Roma, giovedì
  assert.equal(checkValidity(bellezia, new Date('2026-10-29T22:40:00Z')), 'valid_now')
})

test('le finestre del DB sono quelle dell\'app', () => {
  const sql = readFileSync(new URL('../supabase/verify-meal-windows-2026-10-29.sql', import.meta.url), 'utf8')
  const toMin = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m }
  const pick = (block, slot) => {
    const m = block.match(new RegExp(`WHEN '${slot}'\\s+THEN (\\d+)\\*60(?:\\+(\\d+))?`))
    assert.ok(m, `fascia ${slot} nel SQL`)
    return +m[1] * 60 + +(m[2] || 0)
  }
  const fromBlock = sql.slice(sql.indexOf('from_min := CASE v_slot'), sql.indexOf('to_min := CASE v_slot'))
  const toBlock = sql.slice(sql.indexOf('to_min := CASE v_slot'), sql.indexOf('IF from_min IS NOT NULL'))
  for (const [slot, m] of Object.entries(MEAL_SLOTS)) {
    assert.equal(pick(fromBlock, slot), toMin(m.redeemFrom), `${slot} da`)
    assert.equal(pick(toBlock, slot), toMin(m.redeemTo), `${slot} a`)
    assert.ok(toMin(m.redeemFrom) <= toMin(m.from) && toMin(m.redeemTo) >= toMin(m.to), `${slot} contiene l'orario scritto`)
  }
  assert.match(sql, new RegExp(`from_min := v_from - ${REDEEM_GRACE_MIN.before};`))
  assert.match(sql, new RegExp(`to_min   := v_to \\+ ${REDEEM_GRACE_MIN.after};`))
  assert.match(sql, new RegExp(`to_min   := ${ALL_DAY_REDEEM_TO_MIN / 60}\\*60;`))
})
