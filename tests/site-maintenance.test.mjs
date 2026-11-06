import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSiteLocked, isMaintenanceExempt } from '../src/lib/siteMaintenance.js'

test('in manutenzione il sito è chiuso a chi non è admin', () => {
  for (const pathname of ['/', '/esplora', '/sconti', '/restaurant/shoro', '/verify', '/login', '/feedback', '/partner']) {
    assert.equal(isSiteLocked({ pathname, isAdmin: false, enabled: true }), true, pathname)
  }
})

test("l'admin vede tutto il sito", () => {
  for (const pathname of ['/', '/esplora', '/verify', '/admin']) {
    assert.equal(isSiteLocked({ pathname, isAdmin: true, enabled: true }), false, pathname)
  }
})

test('il pannello e il ritorno dal login restano aperti per poter entrare', () => {
  for (const pathname of ['/admin', '/admin/login', '/admin/discounts', '/auth/callback']) {
    assert.equal(isMaintenanceExempt(pathname), true, pathname)
    assert.equal(isSiteLocked({ pathname, isAdmin: false, enabled: true }), false, pathname)
  }
  assert.equal(isMaintenanceExempt('/administrator'), false)
})

test('spenta la manutenzione non si chiude niente', () => {
  assert.equal(isSiteLocked({ pathname: '/', isAdmin: false, enabled: false }), false)
})
