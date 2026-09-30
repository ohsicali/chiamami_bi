/**
 * Test di regressione del Blocco 0 (handoff v10).
 *
 * Il bug: l'admin segnava 6 sconti attivi, il Bi Club pubblico ne mostrava 4.
 * Causa — un filtro città in `SconteRedesignPage` che confrontava
 * `restaurant.city` con la città selezionata, escludendo Shoro (Poirino) e
 * Birrificio Casa Del Popolo (Anzola d'Ossola) a chi aveva Torino attiva.
 *
 * L'invariante che questi test proteggono:
 *   numero sconti attivi in admin === numero sconti in Bi Club pubblico
 * Se un giorno questo test fallisce, è sempre un bug — mai una scelta di
 * design da assecondare cambiando l'asserzione.
 *
 *   node --test tests/discounts.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isActiveDiscount, isActiveDrop, isConvention, isSoldOut, isExpired,
  isVisibleDrop, filterActive, filterActiveDrops, filterActiveConventions,
  filterVisibleDrops, sortByExpiry, remainingCount, formatCountdown,
  findUnreachableDiscounts, pickFeaturedDeal, filterShownDrops,
  chooseFeaturedDeal, canFeatureInHome, activeDiscountsFor, discountByRestaurant,
} from '../src/lib/discounts.js'

const NOW = new Date('2026-09-08T12:00:00Z')

function d(over = {}) {
  return {
    id: over.id || Math.random().toString(36).slice(2),
    is_active: true,
    is_drop: false,
    is_featured: false,
    drop_ends_at: null,
    valid_until: '2026-12-31T00:00:00Z',
    max_quantity: null,
    claimed_count: 0,
    max_redemptions: null,
    total_redeemed: 0,
    restaurants: { name: 'Locale', city: 'Torino', is_published: true },
    ...over,
  }
}

/* ── Lo scenario reale che ha prodotto il bug (dati DB del 2026-09-08) ── */
const DB_SNAPSHOT = [
  d({ id: 'birrificio', title: '20% sul pranzo', valid_until: '2026-09-21T00:00:00Z',
      restaurants: { name: 'Birrificio Casa Del Popolo', city: 'Anzola d’Ossola', is_published: true } }),
  d({ id: 'stampa', title: '50%', is_drop: true, drop_ends_at: '2026-09-14T17:00:00Z',
      valid_until: '2026-09-14T17:00:00Z', max_quantity: 10, claimed_count: 0,
      restaurants: { name: 'Bar Stampa', city: 'Torino', is_published: true } }),
  d({ id: 'orma', title: 'Sconto 10% sul menu tapas', valid_until: '2026-09-29T00:00:00Z',
      restaurants: { name: 'Orma', city: 'Torino', is_published: true } }),
  d({ id: 'brasa', title: '30% sulla cena', valid_until: '2026-09-30T00:00:00Z',
      restaurants: { name: 'Al Brasà', city: 'Torino', is_published: true } }),
  d({ id: 'shoro', title: '20% sulla cena', is_drop: true, drop_ends_at: '2026-09-14T17:00:00Z',
      valid_until: '2026-09-14T17:00:00Z', max_quantity: 30, claimed_count: 0,
      restaurants: { name: 'Shoro', city: 'Poirino', is_published: true } }),
  d({ id: 'smashers', title: 'Sconto Smashers -15%', valid_until: '2026-10-29T00:00:00Z',
      total_redeemed: 3, restaurants: { name: 'Smashers', city: 'Torino', is_published: true } }),
]

test('BLOCCO 0 — admin e Bi Club contano gli stessi sconti attivi', () => {
  // Ciò che conta l'admin (dashboard) e ciò che mostra il Bi Club sono la
  // stessa chiamata: è questo che rende l'invariante vera per costruzione.
  const admin = filterActive(DB_SNAPSHOT, NOW)
  const biClub = filterActive(DB_SNAPSHOT, NOW)
  assert.equal(admin.length, biClub.length)
  assert.equal(biClub.length, 6, 'tutti e 6 gli sconti attivi devono essere visibili')
})

test('BLOCCO 0 — gli sconti fuori Torino NON vengono esclusi', () => {
  const visibili = filterActive(DB_SNAPSHOT, NOW).map((x) => x.id)
  assert.ok(visibili.includes('shoro'), 'Shoro (Poirino) deve comparire in Bi Club')
  assert.ok(visibili.includes('birrificio'), 'Birrificio (Anzola) deve comparire in Bi Club')
})

test('BLOCCO 0 — la città non compare da nessuna parte nella logica di filtro', () => {
  // Stessa lista, città inventate: il risultato non deve cambiare di una riga.
  const altrove = DB_SNAPSHOT.map((x) => ({
    ...x,
    restaurants: { ...x.restaurants, city: 'Palermo' },
  }))
  assert.equal(filterActive(altrove, NOW).length, filterActive(DB_SNAPSHOT, NOW).length)
})

test('BLOCCO 8 — il conteggio drop non dipende da drop_time (campo legacy)', () => {
  // Il bug della dashboard: contava i drop con `drop_time IS NOT NULL`, ma sul
  // DB `drop_time` è null su tutte le righe → "0 drop attivi" con 2 drop live.
  DB_SNAPSHOT.forEach((x) => assert.equal(x.drop_time, undefined))
  assert.equal(filterActiveDrops(DB_SNAPSHOT, NOW).length, 2)
})

test('drop e convenzioni si dividono senza sovrapposizioni né buchi', () => {
  const attivi = filterActive(DB_SNAPSHOT, NOW)
  const drops = filterActiveDrops(DB_SNAPSHOT, NOW)
  const conv = filterActiveConventions(DB_SNAPSHOT, NOW)
  assert.equal(drops.length + conv.length, attivi.length)
  assert.equal(drops.filter(isConvention).length, 0)
})

/* ── La definizione di "attivo", caso per caso ── */

test('is_active false esclude', () => {
  assert.equal(isActiveDiscount(d({ is_active: false }), NOW), false)
})

test('scaduto esclude, in scadenza no', () => {
  assert.equal(isActiveDiscount(d({ valid_until: '2026-09-07T00:00:00Z' }), NOW), false)
  assert.equal(isActiveDiscount(d({ valid_until: '2026-09-09T00:00:00Z' }), NOW), true)
})

test('per un drop vale drop_ends_at, non valid_until', () => {
  const drop = d({ is_drop: true, drop_ends_at: '2026-09-07T00:00:00Z', valid_until: '2027-01-01T00:00:00Z' })
  assert.equal(isExpired(drop, NOW), true)
  assert.equal(isActiveDrop(drop, NOW), false)
})

test('sconto o drop senza data di fine non è mai "scaduto"', () => {
  // La richiesta: poter non mettere una data di fine. `valid_until` e
  // `drop_ends_at` nulli non devono leggersi come "scaduto da sempre"
  // (rischio concreto: `new Date(null)` è l'epoca 1970).
  assert.equal(isExpired(d({ valid_until: null }), NOW), false)
  assert.equal(isActiveDiscount(d({ valid_until: null }), NOW), true)
  const dropSenzaFine = d({ is_drop: true, drop_ends_at: null, valid_until: null })
  assert.equal(isExpired(dropSenzaFine, NOW), false)
  assert.equal(isActiveDrop(dropSenzaFine, NOW), true)
})

test('esaurito esclude; senza tetto non è mai esaurito', () => {
  assert.equal(isSoldOut(d({ max_quantity: 10, claimed_count: 10 })), true)
  assert.equal(isSoldOut(d({ max_quantity: 10, claimed_count: 3 })), false)
  assert.equal(isSoldOut(d({ max_quantity: null, claimed_count: 999 })), false)
})

test('max_redemptions/total_redeemed sono gli alias storici di quantità e presi', () => {
  assert.equal(remainingCount(d({ max_quantity: null, max_redemptions: 10, claimed_count: null, total_redeemed: 4 })), 6)
  assert.equal(remainingCount(d({ max_quantity: null, max_redemptions: null })), null)
})

test('claimed_count fermo a 0 non nasconde i riscatti reali', () => {
  // Nessuno incrementa `claimed_count` sul DB: resta a 0 mentre
  // `total_redeemed` sale a ogni QR validato. Prendendo la maggiore delle due,
  // un drop da 10 con 10 riscatti risulta esaurito invece che pieno di posti.
  assert.equal(remainingCount(d({ max_quantity: 10, claimed_count: 0, total_redeemed: 7 })), 3)
  assert.equal(isSoldOut(d({ max_quantity: 10, claimed_count: 0, total_redeemed: 10 })), true)
  assert.equal(isActiveDiscount(d({ max_quantity: 10, claimed_count: 0, total_redeemed: 10 }), NOW), false)
})

/* ── Drop esaurito: non è attivo, ma resta visibile col "sold out" ── */

test('un drop esaurito non è più "attivo" ma resta "visibile"', () => {
  const esaurito = d({ is_drop: true, drop_ends_at: '2026-12-01T00:00:00Z', max_quantity: 10, claimed_count: 10 })
  assert.equal(isActiveDrop(esaurito, NOW), false, 'esaurito non conta più come attivo (conteggi)')
  assert.equal(isVisibleDrop(esaurito, NOW), true, 'ma resta in home e Bi Club con lo stato sold out')
})

/* ── La vetrina in home: drop attivo, poi il drop esaurito (sold out), poi la convenzione ── */

test('pickFeaturedDeal: il drop attivo va in vetrina', () => {
  const drop = d({ id: 'drop', is_drop: true, restaurant_id: 'a', valid_until: '2026-12-01T00:00:00Z', max_quantity: 10 })
  const conv = d({ id: 'conv', restaurant_id: 'b', valid_until: '2026-10-01T00:00:00Z' })
  assert.equal(pickFeaturedDeal([conv, drop], NOW).id, 'drop')
})

test('pickFeaturedDeal: drop esaurito → resta in vetrina (sold out)', () => {
  const list = [
    d({ id: 'shoro-drop', is_drop: true, restaurant_id: 'shoro', valid_until: null, max_quantity: 10, total_redeemed: 12 }),
    d({ id: 'papalele', restaurant_id: 'papalele', valid_until: '2026-10-30T00:00:00Z' }),
    d({ id: 'shoro-20', restaurant_id: 'shoro', valid_until: '2026-11-30T00:00:00Z' }),
  ]
  assert.equal(pickFeaturedDeal(list, NOW).id, 'shoro-drop')
})

test('filterShownDrops: dei drop esauriti resta solo l\'ultimo uscito (Borghese sì, Shoro no)', () => {
  const list = [
    d({ id: 'shoro', is_drop: true, valid_until: null, drop_starts_at: '2026-09-22T17:00:00Z', max_quantity: 10, total_redeemed: 12 }),
    d({ id: 'borghese', is_drop: true, valid_until: null, drop_starts_at: '2026-09-30T17:00:00Z', max_quantity: 20, total_redeemed: 20 }),
    d({ id: 'live', is_drop: true, drop_starts_at: '2026-09-01T00:00:00Z', max_quantity: 10, claimed_count: 2 }),
    d({ id: 'conv' }),
  ]
  assert.deepEqual(filterShownDrops(list, NOW).map((x) => x.id).sort(), ['borghese', 'live'])
  const OGGI = new Date('2026-10-01T12:00:00Z')
  assert.equal(pickFeaturedDeal(list.filter((x) => x.id !== 'live'), OGGI).id, 'borghese')
})

test('pickFeaturedDeal: esce un drop nuovo → prende il posto del precedente (anche se quello ha ancora posti)', () => {
  const list = [
    d({ id: 'vecchio', is_drop: true, drop_starts_at: '2026-09-01T17:00:00Z', max_quantity: 10, claimed_count: 3 }),
    d({ id: 'nuovo', is_drop: true, drop_starts_at: '2026-09-07T17:00:00Z', max_quantity: 20, total_redeemed: 20 }),
  ]
  assert.equal(pickFeaturedDeal(list, NOW).id, 'nuovo')
  assert.equal(chooseFeaturedDeal(list, NOW).reason, 'drop')
})

test('pickFeaturedDeal: un drop programmato che non è ancora iniziato non va in vetrina', () => {
  const list = [
    d({ id: 'uscito', is_drop: true, drop_starts_at: '2026-09-01T17:00:00Z', max_quantity: 10 }),
    d({ id: 'domani', is_drop: true, drop_starts_at: '2026-09-09T17:00:00Z', max_quantity: 10 }),
  ]
  assert.equal(pickFeaturedDeal(list, NOW).id, 'uscito')
})

/* ── Vetrina scelta a mano dal pannello (home_featured_at) ── */

const BORGHESE = d({ id: 'borghese', is_drop: true, valid_until: null, drop_starts_at: '2026-09-05T17:00:00Z', max_quantity: 20, total_redeemed: 20 })

test('scelta a mano: lo sconto scelto dopo l\'ultimo drop va in vetrina al suo posto', () => {
  const conv = d({ id: 'papalele', home_featured_at: '2026-09-07T10:00:00Z' })
  const { deal, reason } = chooseFeaturedDeal([BORGHESE, conv], NOW)
  assert.equal(deal.id, 'papalele')
  assert.equal(reason, 'pinned')
})

test('scelta a mano: esce un drop più nuovo della scelta → torna il drop', () => {
  const conv = d({ id: 'papalele', home_featured_at: '2026-09-07T10:00:00Z' })
  const nuovo = d({ id: 'nuovo', is_drop: true, drop_starts_at: '2026-09-08T09:00:00Z', max_quantity: 10 })
  assert.equal(pickFeaturedDeal([BORGHESE, conv, nuovo], NOW).id, 'nuovo')
})

test('scelta a mano: vale l\'ultima scelta; una scelta in pausa, scaduta, esaurita o di prova non conta', () => {
  const list = [
    BORGHESE,
    d({ id: 'prima', home_featured_at: '2026-09-06T10:00:00Z' }),
    d({ id: 'dopo', home_featured_at: '2026-09-07T10:00:00Z' }),
    d({ id: 'pausa', is_active: false, home_featured_at: '2026-09-07T11:00:00Z' }),
    d({ id: 'scaduta', valid_until: '2026-09-01T00:00:00Z', home_featured_at: '2026-09-07T12:00:00Z' }),
    d({ id: 'finita', max_redemptions: 5, total_redeemed: 5, home_featured_at: '2026-09-07T13:00:00Z' }),
    d({ id: 'prova', is_test: true, home_featured_at: '2026-09-07T14:00:00Z' }),
  ]
  assert.equal(pickFeaturedDeal(list, NOW).id, 'dopo')
})

test('scelta a mano: tolta la scelta si torna all\'ultimo drop', () => {
  const conv = d({ id: 'papalele', home_featured_at: null })
  assert.equal(pickFeaturedDeal([BORGHESE, conv], NOW).id, 'borghese')
})

test('canFeatureInHome: un drop esaurito si può scegliere, una convenzione esaurita no', () => {
  assert.equal(canFeatureInHome(BORGHESE, NOW), true)
  assert.equal(canFeatureInHome(d({ max_redemptions: 5, total_redeemed: 5 }), NOW), false)
  assert.equal(canFeatureInHome(d({ is_test: true }), NOW), false)
})

test('pickFeaturedDeal: drop esaurito ma disattivato o scaduto → non va in vetrina', () => {
  const conv = d({ id: 'conv', restaurant_id: 'b', valid_until: '2026-10-30T00:00:00Z' })
  const spento = d({ id: 'spento', is_drop: true, restaurant_id: 'a', is_active: false, max_quantity: 10, claimed_count: 10 })
  const scaduto = d({ id: 'scaduto', is_drop: true, restaurant_id: 'a', valid_until: '2026-09-01T00:00:00Z', max_quantity: 10, claimed_count: 10 })
  assert.equal(pickFeaturedDeal([spento, scaduto, conv], NOW).id, 'conv')
})

test('pickFeaturedDeal: nessun drop → la convenzione più vicina a scadere', () => {
  const list = [
    d({ id: 'tardi', restaurant_id: 'a', valid_until: '2026-11-30T00:00:00Z' }),
    d({ id: 'presto', restaurant_id: 'b', valid_until: '2026-10-30T00:00:00Z' }),
  ]
  assert.equal(pickFeaturedDeal(list, NOW).id, 'presto')
  assert.equal(pickFeaturedDeal([], NOW), null)
})

test('un drop scaduto o disattivato invece sparisce anche da "visibile"', () => {
  const scaduto = d({ is_drop: true, drop_ends_at: '2026-09-01T00:00:00Z', max_quantity: 10, claimed_count: 10 })
  const disattivato = d({ is_drop: true, is_active: false, drop_ends_at: '2026-12-01T00:00:00Z' })
  assert.equal(isVisibleDrop(scaduto, NOW), false)
  assert.equal(isVisibleDrop(disattivato, NOW), false)
})

test('filterVisibleDrops include i drop esauriti in più rispetto a filterActiveDrops', () => {
  const conMaxRaggiunto = [
    ...DB_SNAPSHOT,
    d({ id: 'esaurito', is_drop: true, drop_ends_at: '2026-09-14T17:00:00Z',
        valid_until: '2026-09-14T17:00:00Z', max_quantity: 5, claimed_count: 5,
        restaurants: { name: 'Tutto Preso', city: 'Torino', is_published: true } }),
  ]
  const attivi = filterActiveDrops(conMaxRaggiunto, NOW).map((x) => x.id)
  const visibili = filterVisibleDrops(conMaxRaggiunto, NOW).map((x) => x.id)
  assert.ok(!attivi.includes('esaurito'))
  assert.ok(visibili.includes('esaurito'))
  assert.equal(visibili.length, attivi.length + 1)
})

/* ── Ordinamento e countdown ── */

test('sortByExpiry: il primo a scadere in testa, chi non scade in fondo', () => {
  const list = [
    d({ id: 'tardi', valid_until: '2026-10-01T00:00:00Z' }),
    d({ id: 'mai', valid_until: null }),
    d({ id: 'presto', valid_until: '2026-09-10T00:00:00Z' }),
  ]
  assert.deepEqual(sortByExpiry(list).map((x) => x.id), ['presto', 'tardi', 'mai'])
})

test('sortByExpiry non muta la lista di partenza', () => {
  const list = [d({ id: 'b', valid_until: '2026-10-01T00:00:00Z' }), d({ id: 'a', valid_until: '2026-09-10T00:00:00Z' })]
  sortByExpiry(list)
  assert.deepEqual(list.map((x) => x.id), ['b', 'a'])
})

test('formatCountdown produce la pill del drop', () => {
  assert.equal(formatCountdown(d({ valid_until: '2026-09-14T07:00:00Z' }), NOW), '5G 19H')
  assert.equal(formatCountdown(d({ valid_until: '2026-09-08T14:30:00Z' }), NOW), '2H 30M')
  assert.equal(formatCountdown(d({ valid_until: '2026-09-08T12:20:00Z' }), NOW), '20M')
  assert.equal(formatCountdown(d({ valid_until: '2026-09-01T00:00:00Z' }), NOW), null)
  assert.equal(formatCountdown(d({ valid_until: null }), NOW), null)
})

/* ── Rete di sicurezza admin ── */

test('findUnreachableDiscounts è vuota sullo stato sano', () => {
  assert.deepEqual(findUnreachableDiscounts(filterActive(DB_SNAPSHOT, NOW)), [])
})

test('findUnreachableDiscounts segnala uno sconto attivo su locale non pubblicato', () => {
  const rotto = d({ id: 'x', restaurants: { name: 'Fantasma', city: 'Torino', is_published: false } })
  const found = findUnreachableDiscounts([rotto])
  assert.equal(found.length, 1)
  assert.match(found[0].reason, /non è pubblicato/)
})

test('claimRefusal: i rifiuti del trigger diventano un messaggio, il resto no', async () => {
  const { claimRefusal } = await import('../src/lib/discounts.js')
  assert.equal(claimRefusal({ message: 'sold_out' }).title, 'Posti finiti')
  assert.equal(claimRefusal(new Error('discount_expired')).title, 'Sconto scaduto')
  assert.equal(claimRefusal({ message: 'discount_not_available' }).title, 'Sconto non disponibile')
  assert.equal(claimRefusal({ message: 'Failed to fetch' }), null)
  assert.equal(claimRefusal(null), null)
})

/* ── Scheda del locale: il drop esaurito non va sulla foto (30/09) ── */
// Dati DB di Shoro del 30/09: drop -30% (10 posti, 12 presi) più recente
// della convenzione -20%. La foto diceva 30%, la barra in fondo 20%.
const SHORO_30_09 = [
  d({ id: 'shoro-drop', restaurant_id: 'shoro', title: '30% di sconto', is_drop: true,
      valid_until: null, max_quantity: 10, max_redemptions: 10, claimed_count: 0, total_redeemed: 12 }),
  d({ id: 'shoro-conv', restaurant_id: 'shoro', title: '20% di sconto', total_redeemed: 248 }),
  d({ id: 'altro', restaurant_id: 'altro', title: '10%' }),
]

test('activeDiscountsFor: sulla scheda il drop esaurito non c\'è, resta la convenzione', () => {
  const list = activeDiscountsFor(SHORO_30_09, 'shoro', NOW)
  assert.deepEqual(list.map((x) => x.id), ['shoro-conv'])
  assert.deepEqual(activeDiscountsFor(SHORO_30_09, null, NOW), [])
})

test('discountByRestaurant: pin e card raccontano lo stesso sconto della scheda', () => {
  const map = discountByRestaurant(SHORO_30_09, NOW)
  assert.equal(map.shoro.id, activeDiscountsFor(SHORO_30_09, 'shoro', NOW)[0].id)
  assert.equal(map.altro.id, 'altro')
  // Con solo il drop esaurito il locale non ha sconto da raccontare.
  assert.equal(discountByRestaurant([SHORO_30_09[0]], NOW).shoro, undefined)
})
