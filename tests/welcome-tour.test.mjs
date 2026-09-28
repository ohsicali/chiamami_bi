/**
 * Tutorial di benvenuto (src/lib/welcomeTour.js): parte a chi ha appena
 * creato l'account, una volta sola, e mai sopra login, admin, ristoratori o
 * Chiedi a Bi.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TOUR_WINDOW_MS,
  greetingName,
  isFreshAccount,
  isTourAllowedOnPath,
  shouldShowTour,
} from '../src/lib/welcomeTour.js'

const NOW = Date.parse('2026-09-28T12:00:00Z')
const ago = (ms) => new Date(NOW - ms).toISOString()
const newUser = { id: 'u1', created_at: ago(2 * 60 * 1000) }
const oldUser = { id: 'u2', created_at: ago(90 * 24 * 60 * 60 * 1000) }

test('parte a chi si è appena registrato', () => {
  assert.equal(shouldShowTour({ user: newUser, pathname: '/', seen: false, now: NOW }), true)
  assert.equal(shouldShowTour({ user: newUser, pathname: '/restaurant/da-bi', seen: false, now: NOW }), true)
})

test('non parte a chi ha già un account (es. un nuovo accesso con Google)', () => {
  assert.equal(shouldShowTour({ user: oldUser, pathname: '/', seen: false, now: NOW }), false)
})

test('una volta sola: visto o saltato, non torna', () => {
  assert.equal(shouldShowTour({ user: newUser, pathname: '/', seen: true, now: NOW }), false)
})

test('senza utente non parte', () => {
  assert.equal(shouldShowTour({ user: null, pathname: '/', seen: false, now: NOW }), false)
})

test('mai sopra login, callback, admin, ristoratori e Chiedi a Bi', () => {
  for (const p of ['/login', '/auth/callback', '/reset-password', '/admin', '/admin/discounts', '/verify', '/partner', '/chiedi', '/chiedi/abc', '/preferenze-email']) {
    assert.equal(isTourAllowedOnPath(p), false, p)
    assert.equal(shouldShowTour({ user: newUser, pathname: p, seen: false, now: NOW }), false, p)
  }
  for (const p of ['/', '/esplora', '/deals', '/saved', '/profile', '/settings']) {
    assert.equal(isTourAllowedOnPath(p), true, p)
  }
})

test('la finestra di "appena creato"', () => {
  assert.equal(isFreshAccount({ created_at: ago(TOUR_WINDOW_MS - 1000) }, NOW), true)
  assert.equal(isFreshAccount({ created_at: ago(TOUR_WINDOW_MS + 1000) }, NOW), false)
  // orologio del telefono un po' indietro
  assert.equal(isFreshAccount({ created_at: ago(-60 * 1000) }, NOW), true)
  assert.equal(isFreshAccount({ created_at: 'boh' }, NOW), false)
  assert.equal(isFreshAccount({}, NOW), false)
})

test('il saluto usa il primo nome, mai un indirizzo email', () => {
  assert.equal(greetingName({}, { full_name: 'marta rossi' }), 'Marta')
  assert.equal(greetingName({ user_metadata: { full_name: 'Luca Bianchi' } }, null), 'Luca')
  assert.equal(greetingName({ user_metadata: { name: 'Giulia' } }, {}), 'Giulia')
  assert.equal(greetingName({ user_metadata: { full_name: 'marta@example.com' } }, null), '')
  assert.equal(greetingName(null, null), '')
})
