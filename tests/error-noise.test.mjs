/**
 * Il filtro degli errori che PostHog non deve ricevere (src/lib/errorNoise.js):
 * i messaggi presi da Error tracking il 28/09 vanno via, un errore nostro no.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { isNoiseException } from '../src/lib/errorNoise.js'

const exc = (type, value) => ({
  event: '$exception',
  properties: { $exception_list: [{ type, value }] },
})

test('gli errori dei browser dentro le app non partono', () => {
  assert.equal(isNoiseException(exc('Error', 'Error invoking postMessage: Java object is gone')), true)
  assert.equal(isNoiseException(exc('TypeError',
    "undefined is not an object (evaluating 'window.webkit.messageHandlers')")), true)
  assert.equal(isNoiseException(exc('Error', 'Script error.')), true)
  assert.equal(isNoiseException({ event: '$exception', properties: { $exception_message: 'Script error.' } }), true)
})

test('gli errori veri partono', () => {
  assert.equal(isNoiseException(exc('DOMException',
    "Failed to execute 'remove' on 'DOMTokenList': The token provided ('  cb-marker--show') contains HTML space characters")), false)
  assert.equal(isNoiseException(exc('TypeError', "Cannot read properties of undefined (reading 'map')")), false)
  assert.equal(isNoiseException(exc('Error', 'Script error while loading chunk')), false)
})

test('gli eventi che non sono errori non si toccano', () => {
  assert.equal(isNoiseException({ event: '$pageview', properties: { $exception_message: 'Script error.' } }), false)
  assert.equal(isNoiseException(null), false)
})
