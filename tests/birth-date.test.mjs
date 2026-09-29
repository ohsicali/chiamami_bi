/**
 * Data di nascita (src/lib/birthDate.js): la registrazione la chiede, il
 * popup la chiede una volta per visita a chi non l'ha messa, e la regola
 * dell'età è quella dei Termini (almeno 16 anni) — la stessa del DB
 * (supabase/profiles-birth-date-2026-09-29.sql).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MAX_AGE,
  MIN_AGE,
  ageOn,
  birthDateError,
  daysInMonth,
  fromIsoDate,
  isBirthDateAskAllowedOnPath,
  selectableYears,
  shouldAskBirthDate,
  toIsoDate,
} from '../src/lib/birthDate.js'

const NOW = new Date(2026, 8, 29, 12) // 29 settembre 2026, ora locale

test('le tre scelte diventano una data, solo se il giorno esiste', () => {
  assert.equal(toIsoDate({ day: '5', month: '3', year: '1994' }), '1994-03-05')
  assert.equal(toIsoDate({ day: '29', month: '2', year: '2000' }), '2000-02-29')
  assert.equal(toIsoDate({ day: '29', month: '2', year: '2001' }), null)
  assert.equal(toIsoDate({ day: '31', month: '4', year: '1990' }), null)
  assert.equal(toIsoDate({ day: '', month: '4', year: '1990' }), null)
  assert.deepEqual(fromIsoDate('1994-03-05'), { day: '5', month: '3', year: '1994' })
  assert.deepEqual(fromIsoDate(null), { day: '', month: '', year: '' })
})

test('febbraio ha 29 giorni finché non si sceglie un anno non bisestile', () => {
  assert.equal(daysInMonth(2), 29)
  assert.equal(daysInMonth(2, 2001), 28)
  assert.equal(daysInMonth(0), 31)
})

test("l'età si conta sul calendario: chi compie gli anni oggi li ha già", () => {
  assert.equal(ageOn('2010-09-29', NOW), 16)
  assert.equal(ageOn('2010-09-30', NOW), 15)
  assert.equal(ageOn('1994-03-05', NOW), 32)
})

test('almeno 16 anni, come i Termini di Servizio', () => {
  assert.equal(MIN_AGE, 16)
  assert.equal(birthDateError({ day: '29', month: '9', year: '2010' }, NOW), null)
  assert.match(birthDateError({ day: '30', month: '9', year: '2010' }, NOW), /almeno 16 anni/)
})

test('manca un pezzo, il giorno non esiste, anno impossibile: si dice cosa', () => {
  assert.match(birthDateError({ day: '', month: '3', year: '1994' }, NOW), /giorno, mese e anno/)
  assert.match(birthDateError({ day: '31', month: '2', year: '1994' }, NOW), /non esiste/)
  assert.match(birthDateError({ day: '1', month: '1', year: String(2026 - MAX_AGE - 1) }, NOW), /anno/)
})

test("gli anni fra cui scegliere partono dall'ultimo che ha 16 anni", () => {
  const years = selectableYears(NOW)
  assert.equal(years[0], 2026 - MIN_AGE)
  assert.equal(years.at(-1), 2026 - MAX_AGE)
})

const user = { id: 'u1' }
const profile = { id: 'u1', birth_date: null }
const base = { user, profile, pathname: '/', askedThisVisit: false, tourPending: false }

test('il popup si apre a chi non ha la data', () => {
  assert.equal(shouldAskBirthDate(base), true)
})

test('non si apre a chi la data ce l’ha già', () => {
  assert.equal(shouldAskBirthDate({ ...base, profile: { id: 'u1', birth_date: '1994-03-05' } }), false)
})

test('non si apre prima che arrivi il profilo di questo utente', () => {
  assert.equal(shouldAskBirthDate({ ...base, profile: null }), false)
  assert.equal(shouldAskBirthDate({ ...base, profile: { id: 'altro', birth_date: null } }), false)
  assert.equal(shouldAskBirthDate({ ...base, user: null }), false)
})

test('una volta per visita, e mai sopra il tutorial di benvenuto', () => {
  assert.equal(shouldAskBirthDate({ ...base, askedThisVisit: true }), false)
  assert.equal(shouldAskBirthDate({ ...base, tourPending: true }), false)
})

test('mai sopra login, admin, ristoratori, feedback e pagine legali', () => {
  for (const p of ['/login', '/auth/callback', '/admin', '/admin/users', '/verify', '/partner', '/feedback', '/privacy', '/terms', '/chiedi']) {
    assert.equal(isBirthDateAskAllowedOnPath(p), false, p)
  }
  for (const p of ['/', '/esplora', '/sconti', '/restaurant/da-bi', '/settings']) {
    assert.equal(isBirthDateAskAllowedOnPath(p), true, p)
  }
})

test("il DB usa gli stessi limiti d'età dell'app", () => {
  const sql = readFileSync(new URL('../supabase/profiles-birth-date-2026-09-29.sql', import.meta.url), 'utf8')
  assert.match(sql, new RegExp(`current_date - interval '${MIN_AGE} years'`))
  assert.match(sql, new RegExp(`current_date - interval '${MAX_AGE} years'`))
  // Senza il grant di colonna il select('*') del profilo fallisce per tutti.
  assert.match(sql, /GRANT SELECT \(birth_date\)[\s\S]*TO authenticated/)
})
