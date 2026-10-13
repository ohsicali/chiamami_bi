/**
 * Sedi di un locale e in quali vale uno sconto (src/lib/utils/restaurantLocations.js).
 * Dal 13/10 la scheda del locale non dice più "lo sconto vale in entrambe":
 * lo dice lo sconto, con `discounts.valid_location_ids`.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getAllLocations,
  discountLocationScope,
  discountLocationLine,
  locationMapsUrl,
  locationStreet,
  locationsArea,
  PRIMARY_LOCATION_ID,
} from '../src/lib/utils/restaurantLocations.js'

const TACO = {
  name: 'Taco Bang',
  city: 'Torino',
  location_label: 'San Salvario',
  address: 'Via Madama Cristina 76, 10126 Torino Turin, Italy',
  google_maps_url: 'https://maps.app.goo.gl/taco',
  locations: [
    { id: 'l-francia', label: 'Corso Francia', address: 'C.so Francia, 21/N, 10138 Torino TO' },
    { id: 'l-gasperi', label: 'Corso De Gasperi', address: 'Corso Alcide De Gasperi, 63, 10129 Torino TO' },
    { id: 'l-rivoli', label: 'Rivoli', address: 'Via Rita Levi Montalcini, 1/a, 10098 Rivoli TO' },
  ],
}

test('le sedi: la principale per prima, poi le altre; la join grezza si ordina', () => {
  assert.deepEqual(getAllLocations(TACO).map((l) => l.id), [PRIMARY_LOCATION_ID, 'l-francia', 'l-gasperi', 'l-rivoli'])
  const raw = {
    address: 'Via X 1',
    restaurant_locations: [
      { id: 'b', address: 'Via B', sort_order: 2 },
      { id: 'a', address: 'Via A', sort_order: 1 },
    ],
  }
  assert.deepEqual(getAllLocations(raw).map((l) => l.id), [PRIMARY_LOCATION_ID, 'a', 'b'])
})

test('sconto senza sedi scelte: vale in tutte', () => {
  const scope = discountLocationScope({ valid_location_ids: null }, TACO)
  assert.equal(scope.all, true)
  assert.equal(scope.total, 4)
  assert.equal(discountLocationLine(scope), 'Vale in tutte le 4 sedi')
})

test('sconto in una sede sola', () => {
  const scope = discountLocationScope({ valid_location_ids: ['primary'] }, TACO)
  assert.equal(scope.all, false)
  assert.deepEqual(scope.locations.map((l) => l.name), ['San Salvario'])
  assert.equal(scope.every.length, 4)
  assert.equal(discountLocationLine(scope), 'Vale solo nella sede San Salvario')
})

test('sconto in due sedi', () => {
  const scope = discountLocationScope({ valid_location_ids: ['l-francia', 'l-rivoli'] }, TACO)
  assert.equal(discountLocationLine(scope), 'Vale solo nelle sedi Corso Francia e Rivoli')
})

test('tutte spuntate = tutte', () => {
  const scope = discountLocationScope({ valid_location_ids: ['primary', 'l-francia', 'l-gasperi', 'l-rivoli'] }, TACO)
  assert.equal(scope.all, true)
})

test('niente da dire: locale con una sede, o sedi scelte che non ci sono più', () => {
  assert.equal(discountLocationScope({ valid_location_ids: null }, { address: 'Via X 1' }), null)
  assert.equal(discountLocationScope({ valid_location_ids: ['sparita'] }, TACO), null)
  assert.equal(discountLocationScope({ valid_location_ids: null }, null), null)
})

test('indirizzi: via e civico, il comune solo se fuori città', () => {
  assert.equal(locationStreet('C.so Francia, 21/N, 10138 Torino TO', 'Torino'), 'C.so Francia 21/N')
  assert.equal(locationStreet('Via Madama Cristina 76, 10126 Torino Turin, Italy', 'Torino'), 'Via Madama Cristina 76')
  assert.equal(locationStreet('Via Catania, 11 A, 10153 Torino TO, Italia', 'Torino'), 'Via Catania 11 A')
  assert.equal(locationStreet('Via Rita Levi Montalcini, 1/a, 10098 Rivoli TO', 'Torino'), 'Via Rita Levi Montalcini 1/a · Rivoli')
})

test('"a Torino" o "a Torino e dintorni"', () => {
  assert.equal(locationsArea(getAllLocations(TACO), 'Torino'), 'a Torino e dintorni')
  assert.equal(locationsArea(getAllLocations({ ...TACO, locations: TACO.locations.slice(0, 2) }), 'Torino'), 'a Torino')
  assert.equal(locationsArea(getAllLocations(TACO), ''), '')
})

test('Google Maps: il link del locale per la principale, nome + indirizzo per le altre', () => {
  const [primary, francia] = getAllLocations(TACO)
  assert.equal(locationMapsUrl(primary, TACO.name), 'https://maps.app.goo.gl/taco')
  const url = new URL(locationMapsUrl(francia, TACO.name))
  assert.equal(url.searchParams.get('query'), 'Taco Bang, C.so Francia, 21/N, 10138 Torino TO')
})
