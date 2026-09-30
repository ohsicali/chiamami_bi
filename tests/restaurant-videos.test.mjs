/**
 * Video di Bea nella scheda del locale (src/lib/restaurantVideos.js): un
 * bottone per Instagram, uno per TikTok, nessun riquadro se non c'è niente.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { restaurantVideos } from '../src/lib/restaurantVideos.js'

const REEL = 'https://www.instagram.com/reel/DZZvs_aAtR4/?utm_source=ig_web_copy_link'
const OLD_REEL = 'https://www.instagram.com/reel/DLhYm7coe6e/'
const TIKTOK = 'https://vm.tiktok.com/ZNRVkE1gj/'

test('il reel messo dal pannello nuovo (instagram_url) si vede', () => {
  assert.deepEqual(restaurantVideos({ instagram_url: REEL }), { instagram: REEL, tiktok: null })
})

test('il reel del vecchio form (instagram_reel) si vede ancora', () => {
  assert.deepEqual(restaurantVideos({ instagram_reel: OLD_REEL }), { instagram: OLD_REEL, tiktok: null })
})

test('con tutti e due vince il campo del pannello, che è quello che si modifica', () => {
  assert.equal(restaurantVideos({ instagram_url: REEL, instagram_reel: OLD_REEL }).instagram, REEL)
})

test('solo TikTok: un bottone solo', () => {
  assert.deepEqual(restaurantVideos({ tiktok_url: TIKTOK }), { instagram: null, tiktok: TIKTOK })
})

test('niente link, niente riquadro', () => {
  assert.deepEqual(restaurantVideos({}), { instagram: null, tiktok: null })
  assert.deepEqual(restaurantVideos({ instagram_url: '  ', tiktok_url: '' }), { instagram: null, tiktok: null })
  assert.deepEqual(restaurantVideos(null), { instagram: null, tiktok: null })
})

test('link senza https: si completa; javascript: non passa', () => {
  assert.equal(restaurantVideos({ tiktok_url: 'vm.tiktok.com/ZNRVkE1gj/' }).tiktok, 'https://vm.tiktok.com/ZNRVkE1gj/')
  assert.equal(restaurantVideos({ instagram_url: 'javascript:alert(1)' }).instagram, null)
})
