/**
 * Sconto a fasce (15/10): "30% in settimana, 15% dal venerdì alla domenica".
 * Uno sconto solo, che si usa una volta e alla cassa vale la fascia del
 * giorno. Regole in src/lib/dayTiers.js, cifre in discountFormat.js.
 *
 *   node --test tests/day-tiers.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  romeWeekday, dayTiers, hasDayTiers, tierForDay, todayTier, currentTier, tierDeal,
  dealToday, usedDeal, tierDaysShort, tierDaysLong, weekRuns, dayTierProblems,
  normalizeDayTiers, formUsesDayTiers, presetDayTiers, dayTiersUnion,
} from '../src/lib/dayTiers.js'
import {
  formatDiscountBadge, formatDiscountBadgeShort, formatDiscountValue, tierChips,
  formatTierSummary, formatTierLine,
} from '../src/lib/utils/discountFormat.js'

// 12/10/2026 è lunedì: 15 giovedì, 16 venerdì, 17 sabato, 18 domenica.
const MON = new Date('2026-10-12T12:00:00Z')
const THU = new Date('2026-10-15T12:00:00Z')
const FRI = new Date('2026-10-16T12:00:00Z')
const SAT = new Date('2026-10-17T12:00:00Z')
const SUN = new Date('2026-10-18T12:00:00Z')

function deal(over = {}) {
  return {
    id: 'd1',
    title: 'Sconto sul conto',
    discount_type: 'percentage',
    discount_value: '30',
    is_drop: false,
    valid_days: [1, 2, 3, 4, 5, 6, 7],
    day_tiers: [
      { days: [5, 6, 7], value: '15' },
      { days: [1, 2, 3, 4], value: '30' },
    ],
    ...over,
  }
}

test('il giorno è quello di Roma, anche a cavallo della mezzanotte', () => {
  assert.equal(romeWeekday(MON), 1)
  assert.equal(romeWeekday(THU), 4)
  assert.equal(romeWeekday(SUN), 7)
  // Giovedì 22:30 UTC = venerdì 00:30 a Roma: alla cassa è già weekend.
  assert.equal(romeWeekday(new Date('2026-10-15T22:30:00Z')), 5)
})

test('le fasce escono in ordine di giorno, la settimana prima del weekend', () => {
  const tiers = dayTiers(deal())
  assert.deepEqual(tiers.map((t) => [t.days, t.value, t.index]), [
    [[1, 2, 3, 4], '30', 0],
    [[5, 6, 7], '15', 1],
  ])
  assert.equal(hasDayTiers(deal()), true)
})

test('non è a fasce: uno sconto normale, una fascia sola, un drop, un omaggio', () => {
  assert.equal(hasDayTiers(deal({ day_tiers: null })), false)
  assert.equal(hasDayTiers(deal({ day_tiers: [{ days: [1, 2], value: '30' }] })), false)
  assert.equal(hasDayTiers(deal({ is_drop: true })), false)
  assert.equal(hasDayTiers(deal({ discount_type: 'freebie' })), false)
  assert.equal(hasDayTiers(deal({ discount_type: 'fixed' })), true)
})

test('un giorno sta in una fascia sola, i giorni sbagliati si scartano', () => {
  const tiers = dayTiers(deal({
    day_tiers: [{ days: [1, 2, 9, 2], value: '30' }, { days: [2, 3], value: '15' }],
  }))
  assert.deepEqual(tiers.map((t) => t.days), [[1, 2], [3]])
})

test('arrivano anche come testo JSON (PostgREST li manda come jsonb, ma non si sa mai)', () => {
  const raw = JSON.stringify(deal().day_tiers)
  assert.equal(dayTiers(deal({ day_tiers: raw })).length, 2)
  assert.equal(dayTiers(deal({ day_tiers: '{rotto' })).length, 0)
})

test('la fascia di oggi: giovedì il 30, sabato il 15', () => {
  assert.equal(todayTier(deal(), THU).value, '30')
  assert.equal(todayTier(deal(), SAT).value, '15')
  assert.equal(tierForDay(deal(), 5).value, '15')
})

test('locale chiuso la domenica: oggi niente, il badge dice la prossima fascia', () => {
  const closed = deal({ day_tiers: [{ days: [2, 3, 4], value: '30' }, { days: [5, 6], value: '15' }] })
  assert.equal(todayTier(closed, SUN), null)
  assert.equal(currentTier(closed, SUN).value, '30') // martedì
  assert.equal(currentTier(closed, MON).value, '30')
  assert.equal(formatDiscountBadge(closed, SUN), '−30%')
})

test('il badge di ogni punto del sito dice la cifra di oggi', () => {
  assert.equal(formatDiscountBadge(deal(), THU), '−30%')
  assert.equal(formatDiscountBadge(deal(), FRI), '−15%')
  assert.equal(formatDiscountBadgeShort(deal(), SAT), '−15%')
  assert.equal(formatDiscountValue(deal(), MON), '30%')
  assert.equal(formatDiscountBadge(deal({ discount_type: 'fixed', day_tiers: [{ days: [1, 2, 3, 4], value: '5' }, { days: [5, 6, 7], value: '3' }] }), SAT), '−3€')
  // Uno sconto normale non cambia.
  assert.equal(formatDiscountBadge(deal({ day_tiers: null }), SAT), '−30%')
})

test('tierDeal e dealToday: un oggetto normale, senza fasce dentro', () => {
  const sat = dealToday(deal(), SAT)
  assert.equal(sat.discount_value, '15')
  assert.deepEqual(sat.valid_days, [5, 6, 7])
  assert.equal(sat.day_tiers, null)
  assert.equal(hasDayTiers(sat), false)
  const plain = deal({ day_tiers: null })
  assert.equal(dealToday(plain, SAT), plain)
  assert.equal(tierDeal(plain, null), plain)
})

test('le fasce da mostrare: tutte e due le cifre, quella di oggi accesa', () => {
  const chips = tierChips(deal(), SAT)
  assert.deepEqual(chips.map((c) => [c.badge, c.daysShort, c.today]), [
    ['−30%', 'lun–gio', false],
    ['−15%', 'ven–dom', true],
  ])
  assert.equal(chips[1].daysLong, 'dal venerdì alla domenica')
  assert.deepEqual(tierChips(deal({ day_tiers: null }), SAT), [])
})

test('le fasce in una riga e in una frase', () => {
  assert.equal(formatTierSummary(deal(), THU), '−30% lun–gio · −15% ven–dom')
  assert.equal(formatTierLine(deal(), THU), 'Oggi −30% · −15% dal venerdì alla domenica')
  assert.equal(formatTierLine(deal(), SAT), 'Oggi −15% · −30% dal lunedì al giovedì')
  const closed = deal({ day_tiers: [{ days: [2, 3, 4], value: '30' }, { days: [5, 6], value: '15' }] })
  assert.equal(formatTierLine(closed, SUN), 'Oggi non vale · −30% dal martedì al giovedì, −15% venerdì e sabato')
  assert.equal(formatTierLine(deal({ day_tiers: null }), SAT), '')
})

test('i giorni in parole', () => {
  const cases = [
    [[1, 2, 3, 4], 'lun–gio', 'dal lunedì al giovedì'],
    [[5, 6, 7], 'ven–dom', 'dal venerdì alla domenica'],
    [[6, 7], 'sab e dom', 'sabato e domenica'],
    [[1, 3, 5], 'lun, mer e ven', 'lunedì, mercoledì e venerdì'],
    [[1, 5, 6, 7], 'ven–lun', 'dal venerdì al lunedì'],
    [[7], 'dom', 'la domenica'],
    [[2], 'mar', 'il martedì'],
    [[1, 2, 3, 4, 5, 6, 7], 'tutti i giorni', 'tutti i giorni'],
    [[], '', ''],
  ]
  for (const [days, short, long] of cases) {
    assert.equal(tierDaysShort(days), short, JSON.stringify(days))
    assert.equal(tierDaysLong(days), long, JSON.stringify(days))
  }
})

test('il calendario della settimana a pezzi', () => {
  assert.deepEqual(weekRuns(deal()).map((r) => [r.start, r.end, r.tier?.value ?? null]), [
    [1, 4, '30'],
    [5, 7, '15'],
  ])
  const closed = deal({ day_tiers: [{ days: [2, 3, 4], value: '30' }, { days: [5, 6], value: '15' }] })
  assert.deepEqual(weekRuns(closed).map((r) => [r.start, r.end, r.tier?.value ?? null]), [
    [1, 1, null],
    [2, 4, '30'],
    [5, 6, '15'],
    [7, 7, null],
  ])
})

test('usato alla cassa: vale la cifra scritta dalla cassa, non quella di oggi', () => {
  const r = { status: 'redeemed', applied_value: '15', redeemed_at: '2026-10-17T20:00:00Z', discount: deal() }
  const used = usedDeal(r)
  assert.equal(formatDiscountBadge(used, MON), '−15%')
  assert.equal(hasDayTiers(used), false)
  // Senza applied_value (convalidato prima delle fasce): il giorno della convalida.
  assert.equal(formatDiscountBadge(usedDeal({ ...r, applied_value: null }), MON), '−15%')
  // Non ancora usato: lo sconto intero, con le sue fasce.
  assert.equal(hasDayTiers(usedDeal({ ...r, status: 'generated' })), true)
})

test('il modulo del pannello: cosa manca prima di salvare', () => {
  assert.deepEqual(dayTierProblems([{ days: [1, 2, 3, 4], value: '30' }, { days: [5, 6, 7], value: '15%' }], { type: 'percentage' }), [])
  assert.match(dayTierProblems([{ days: [1], value: '30' }], { type: 'percentage' }).join(' '), /almeno due fasce/)
  assert.match(dayTierProblems(deal().day_tiers, { type: 'freebie' }).join(' '), /percentuale o in euro/)
  assert.match(dayTierProblems([{ days: [1, 5], value: '30' }, { days: [5], value: '15' }], { type: 'percentage' }).join(' '), /Venerdì è in due fasce/)
  assert.match(dayTierProblems([{ days: [], value: '30' }, { days: [5], value: '' }], { type: 'percentage' }).join(' '), /scegli almeno un giorno.*manca il valore|manca il valore.*scegli almeno un giorno/)
  assert.match(dayTierProblems([{ days: [1], value: 'tanto' }, { days: [5], value: '15' }], { type: 'percentage' }).join(' '), /è un numero/)
})

test('le fasce pronte per il DB: valori puliti e in ordine', () => {
  assert.deepEqual(normalizeDayTiers([{ days: [7, 5, 6], value: '−15%' }, { days: [4, 1, 2, 3], value: ' 30 ' }]), [
    { days: [1, 2, 3, 4], value: '30' },
    { days: [5, 6, 7], value: '15' },
  ])
})

test('il pannello: quando le fasce si possono usare, da dove partono', () => {
  assert.equal(formUsesDayTiers({ tiers_on: true, kind: 'discount', discount_type: 'percentage' }), true)
  assert.equal(formUsesDayTiers({ tiers_on: true, kind: 'featured', discount_type: 'fixed' }), true)
  assert.equal(formUsesDayTiers({ tiers_on: true, kind: 'drop', discount_type: 'percentage' }), false)
  assert.equal(formUsesDayTiers({ tiers_on: true, kind: 'discount', discount_type: 'freebie' }), false)
  assert.equal(formUsesDayTiers({ tiers_on: false, kind: 'discount', discount_type: 'percentage' }), false)
  assert.deepEqual(presetDayTiers('30'), [{ days: [1, 2, 3, 4], value: '30' }, { days: [5, 6, 7], value: '' }])
  assert.deepEqual(dayTiersUnion([{ days: [5, 6] }, { days: [2, 3, 4] }]), [2, 3, 4, 5, 6])
})

// Le stesse regole stanno nel trigger del DB: se una cambia, cambia l'altra.
test('il trigger del DB dice le stesse regole', () => {
  const sql = readFileSync(new URL('../supabase/discount-day-tiers-2026-10-15.sql', import.meta.url), 'utf8')
  assert.match(sql, /day_tiers_drop/)
  assert.match(sql, /'percentage',\s*'fixed'/)
  assert.match(sql, /jsonb_array_length\(NEW\.day_tiers\)\s*<\s*2/)
  assert.match(sql, /applied_value/)
  // La cassa sceglie la fascia col giorno di Roma.
  assert.match(sql, /ISODOW FROM \(now\(\) AT TIME ZONE 'Europe\/Rome'\)/)
})
