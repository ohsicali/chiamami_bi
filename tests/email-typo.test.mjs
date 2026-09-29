/**
 * "Intendevi …@libero.it?" — il suggerimento sotto il campo email.
 *
 * Il caso: chi scrive male il dominio si registra lo stesso e aspetta un
 * codice che va a un indirizzo inesistente. Il 29/09 tre dei 21 account mai
 * confermati degli ultimi otto giorni erano libeto.it, gmsil.com, libero.com.
 *
 * L'invariante: un indirizzo giusto non riceve MAI un suggerimento — un
 * "intendevi" sbagliato è peggio di nessuno.
 *
 *   node --test tests/email-typo.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestEmailFix } from '../src/lib/utils/emailTypo.js'

test('i tre casi veri del 29/09', () => {
  assert.equal(suggestEmailFix('mario@libeto.it'), 'mario@libero.it')
  assert.equal(suggestEmailFix('mario@gmsil.com'), 'mario@gmail.com')
  assert.equal(suggestEmailFix('mario@libero.com'), 'mario@libero.it')
})

test('lettere scambiate o mancanti nei provider comuni', () => {
  assert.equal(suggestEmailFix('a@gmai.com'), 'a@gmail.com')
  assert.equal(suggestEmailFix('a@hotmial.it'), 'a@hotmail.it')
  assert.equal(suggestEmailFix('a@icoud.com'), 'a@icloud.com')
  assert.equal(suggestEmailFix('a@outlok.com'), 'a@outlook.com')
  assert.equal(suggestEmailFix('a@gmail.it'), 'a@gmail.com')
})

test('estensione sbagliata', () => {
  assert.equal(suggestEmailFix('a@hotmail.con'), 'a@hotmail.com')
  assert.equal(suggestEmailFix('a@libero.ti'), 'a@libero.it')
  assert.equal(suggestEmailFix('a@gmial.con'), 'a@gmail.com')
})

test('la parte prima della chiocciola resta com’è', () => {
  assert.equal(suggestEmailFix('Mario.Rossi@Gmail.con'), 'Mario.Rossi@gmail.com')
})

test('indirizzi giusti: nessun suggerimento', () => {
  for (const e of [
    'a@gmail.com', 'a@libero.it', 'a@icloud.com', 'a@hotmail.it', 'a@hotmail.com',
    'a@tim.it', 'a@tin.it', 'a@alice.it', 'a@live.it', 'a@me.com',
    // stesso provider, altro paese: esistono
    'a@hotmail.fr', 'a@yahoo.es', 'a@outlook.de', 'a@yahoo.co.uk',
    // domini di aziende, università, ospedali
    'a@cittadellasalute.to.it', 'a@studenti.unito.it', 'a@azienda.com', 'a@aruba.it',
  ]) {
    assert.equal(suggestEmailFix(e), null, e)
  }
})

test('email non finita o vuota: niente', () => {
  for (const e of ['', null, undefined, 'mario', 'mario@', 'mario@gmail', 'mario@gmail.c']) {
    assert.equal(suggestEmailFix(e), null, String(e))
  }
})
