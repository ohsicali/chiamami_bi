/**
 * Il codice corto del riscatto — una lettera e cinque cifre, es. `K48213`.
 *
 * Il formato vive in tre posti che devono restare allineati:
 *   - il DB, che lo genera e lo vincola
 *     (`supabase/short-code-redemptions-2026-09-18.sql`);
 *   - `src/lib/shortCode.js`, per l'app;
 *   - `api/_short-code.js`, per PDF ed email.
 * Questi test tengono insieme gli ultimi due e fissano le regole del primo.
 *
 * Quello che proteggono davvero è il momento al bancone: il cliente detta
 * sei caratteri e il ristoratore li digita. Se `normalizeShortCode` smette
 * di perdonare spazi e minuscole, o se `isValidShortCodeChar` lascia
 * passare una I che si legge come un 1, quel passaggio si rompe.
 *
 *   node --test tests/short-code.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SHORT_CODE_LENGTH,
  SHORT_CODE_LETTERS,
  normalizeShortCode,
  isShortCode,
  isValidShortCodeChar,
  formatShortCode,
} from '../src/lib/shortCode.js'
import {
  normalizeShortCode as apiNormalize,
  formatShortCode as apiFormat,
  isShortCode as apiIsShortCode,
} from '../api/_short-code.js'

/* Lo stesso vincolo che ha il DB (CHECK discount_redemptions_short_code_format). */
const DB_FORMAT = /^[A-HJ-NP-Z][0-9]{5}$/

test('il formato è una lettera e cinque cifre', () => {
  assert.equal(SHORT_CODE_LENGTH, 6)
  assert.ok(isShortCode('K48213'))
  assert.ok(!isShortCode('KK4821'), 'due lettere non vanno')
  assert.ok(!isShortCode('448213'), 'la prima deve essere una lettera')
  assert.ok(!isShortCode('K4821'), 'cinque caratteri non bastano')
  assert.ok(!isShortCode('K482134'), 'sette sono troppi')
  assert.ok(!isShortCode(''), 'la stringa vuota non è un codice')
  assert.ok(!isShortCode(null))
})

test('I e O non esistono: si confondono con 1 e 0', () => {
  assert.ok(!SHORT_CODE_LETTERS.includes('I'))
  assert.ok(!SHORT_CODE_LETTERS.includes('O'))
  assert.equal(SHORT_CODE_LETTERS.length, 24)
  assert.ok(!isShortCode('I48213'))
  assert.ok(!isShortCode('O48213'))
  // E l'alfabeto ammesso è esattamente quello che accetta il DB.
  for (const letter of SHORT_CODE_LETTERS) {
    assert.ok(DB_FORMAT.test(`${letter}12345`), `${letter} dovrebbe essere ammessa`)
  }
})

test('quello che digita il ristoratore viene perdonato', () => {
  // Minuscole, spazi, trattini: al bancone si scrive come viene.
  assert.equal(normalizeShortCode('k48213'), 'K48213')
  assert.equal(normalizeShortCode('K48 213'), 'K48213')
  assert.equal(normalizeShortCode('  k48-213  '), 'K48213')
  assert.equal(normalizeShortCode('K.4.8.2.1.3'), 'K48213')
  assert.ok(isShortCode(' k48 213 '))
})

test('normalizeShortCode ripulisce ma non taglia', () => {
  // Spazi e minuscole sono rumore di chi digita e si tolgono; un carattere
  // in più invece resta, così `isShortCode` lo può bocciare. Se qui
  // tagliassimo, 'K482134' verrebbe letto come 'K48213' e andremmo a
  // cercare nel DB un codice che nessuno ha mai dettato.
  assert.equal(normalizeShortCode('K482139999'), 'K482139999')
  assert.ok(!isShortCode('K482139999'))
  assert.equal(normalizeShortCode(''), '')
  assert.equal(normalizeShortCode(undefined), '')
  assert.equal(normalizeShortCode(null), '')
})

test('ogni posizione accetta solo quello che può starci', () => {
  // Prima posizione: lettera.
  assert.ok(isValidShortCodeChar('K', 0))
  assert.ok(isValidShortCodeChar('k', 0), 'la minuscola vale come la maiuscola')
  assert.ok(!isValidShortCodeChar('4', 0), 'niente cifre in prima posizione')
  assert.ok(!isValidShortCodeChar('I', 0))
  assert.ok(!isValidShortCodeChar('O', 0))

  // Le altre cinque: cifre.
  for (let i = 1; i < SHORT_CODE_LENGTH; i += 1) {
    assert.ok(isValidShortCodeChar('7', i))
    assert.ok(isValidShortCodeChar('0', i))
    assert.ok(!isValidShortCodeChar('K', i), `nessuna lettera in posizione ${i}`)
  }
  assert.ok(!isValidShortCodeChar('', 0))
  assert.ok(!isValidShortCodeChar(null, 3))
})

test('a schermo il codice si spezza in due gruppi di tre', () => {
  assert.equal(formatShortCode('K48213'), 'K48 213')
  assert.equal(formatShortCode('k48213'), 'K48 213')
  // Mentre si scrive il codice è ancora parziale: niente spazio finché non
  // serve, altrimenti la riga sotto le caselle sfarfalla a ogni tasto.
  assert.equal(formatShortCode('K4'), 'K4')
  assert.equal(formatShortCode('K48'), 'K48')
  assert.equal(formatShortCode('K482'), 'K48 2')
  assert.equal(formatShortCode(''), '')
})

test('il gemello lato server si comporta identico', () => {
  // `api/_short-code.js` è una copia perché le funzioni serverless non
  // importano da `src/`. Se le due versioni divergono, PDF ed email
  // mostrano un codice diverso da quello dell'app.
  const casi = ['K48213', 'k48 213', '  z00000  ', 'A1', '', 'K48-213', 'I12345', 'K482134']
  for (const c of casi) {
    assert.equal(apiNormalize(c), normalizeShortCode(c), `normalize divergente su "${c}"`)
    assert.equal(apiFormat(c), formatShortCode(c), `format divergente su "${c}"`)
    assert.equal(apiIsShortCode(c), isShortCode(c), `isShortCode divergente su "${c}"`)
  }
})

test('un codice normalizzato passa sempre il CHECK del DB', () => {
  // Le due regole devono coincidere: se `isShortCode` dice sì e il DB dice
  // no, la verifica al bancone fallisce senza spiegazione.
  const campioni = [
    'K48213', 'a00000', 'Z99999', 'H01251', 'N76938', 'v37892',
    'I12345', 'O12345', '112345', 'KK4821', 'K4821',
  ]
  for (const c of campioni) {
    assert.equal(
      isShortCode(c),
      DB_FORMAT.test(normalizeShortCode(c)),
      `disaccordo fra isShortCode e il CHECK del DB su "${c}"`,
    )
  }
})
