/**
 * La nota personale sui salvati.
 *
 * Il punto fragile non è la formattazione: è che il limite di lunghezza vive
 * in due posti che non si parlano — il vincolo CHECK in Postgres e il codice
 * che scrive. Se si scollano, chi scrive una nota lunga la vede sparire senza
 * un messaggio. L'ultima prova qui sotto legge il file SQL e confronta i due
 * numeri, così scollarli diventa un test rosso invece di una segnalazione.
 *
 *   node --test tests/saved-notes.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NOTE_MAX, normalizeNote, noteForDb } from '../src/lib/utils/savedNote.js'

test('gli spazi ai bordi non diventano una nota', () => {
  assert.equal(normalizeNote('   '), '')
  assert.equal(normalizeNote('\n\t  ciao  \n'), 'ciao')
})

test('niente e nulla danno la stessa cosa', () => {
  assert.equal(normalizeNote(undefined), '')
  assert.equal(normalizeNote(null), '')
  assert.equal(normalizeNote(0), '0')   // uno 0 scritto davvero resta
})

test('una nota lunghissima viene tagliata invece di essere rifiutata', () => {
  const lunga = 'a'.repeat(NOTE_MAX + 500)
  assert.equal(normalizeNote(lunga).length, NOTE_MAX)
})

test('cancellare la nota manda null, non stringa vuota', () => {
  // Postgres distingue: '' resterebbe una nota, e la card mostrerebbe un
  // riquadro vuoto invece dell'invito a scriverne una.
  assert.equal(noteForDb(''), null)
  assert.equal(noteForDb('   '), null)
  assert.equal(noteForDb('il tavolo in fondo'), 'il tavolo in fondo')
})

test('il limite del codice è lo stesso del vincolo in database', () => {
  const sql = readFileSync(new URL('../supabase/saved-notes-2026-09-13.sql', import.meta.url), 'utf8')
  const m = sql.match(/char_length\(note\)\s*<=\s*(\d+)/)
  assert.ok(m, 'il file SQL deve avere un CHECK sulla lunghezza della nota')
  assert.equal(Number(m[1]), NOTE_MAX)
})

test('la migrazione non dimentica il WITH CHECK sulla policy', () => {
  // Senza, un UPDATE su una riga propria poteva riscriverne lo user_id.
  const sql = readFileSync(new URL('../supabase/saved-notes-2026-09-13.sql', import.meta.url), 'utf8')
  const policy = sql.slice(sql.indexOf('CREATE POLICY "Users manage own saves"'))
  assert.match(policy, /USING \(auth\.uid\(\) = user_id\)/)
  assert.match(policy, /WITH CHECK \(auth\.uid\(\) = user_id\)/)
})
