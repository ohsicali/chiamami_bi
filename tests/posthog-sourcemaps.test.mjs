/**
 * Mappe del codice per PostHog (scripts/posthog-sourcemaps.mjs): si generano
 * e si caricano solo con tutte e due le chiavi, e importare lo script (lo fa
 * vite.config.js) non deve farlo partire.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { hasPostHogKeys } from '../scripts/posthog-sourcemaps.mjs'

test('servono tutte e due le chiavi', () => {
  assert.equal(hasPostHogKeys({}), false)
  assert.equal(hasPostHogKeys({ POSTHOG_CLI_API_KEY: 'phx_x' }), false)
  assert.equal(hasPostHogKeys({ POSTHOG_CLI_PROJECT_ID: '1' }), false)
  assert.equal(hasPostHogKeys({ POSTHOG_CLI_API_KEY: 'phx_x', POSTHOG_CLI_PROJECT_ID: '1' }), true)
})
