/**
 * I template delle email che manda Supabase.
 *
 * Queste due mail non passano da api/_email/ quando vengono spedite: vivono
 * incollate nel dashboard di Supabase. Il rischio è che il sistema grafico
 * cambi — un colore, il logo, il carattere — e questi restino indietro senza
 * che nessuno se ne accorga, perché nulla nel codice li importa.
 *
 * La prova che conta è l'ultima: rigenera i template in memoria e li
 * confronta con i file su disco. Se qualcuno tocca render.js o blocks.js e
 * non rilancia build.mjs, diventa rosso.
 *
 *   node --test tests/supabase-templates.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TEMPLATES } from '../supabase/email-templates/build.mjs'

const letto = (file) =>
  readFileSync(new URL(`../supabase/email-templates/${file}`, import.meta.url), 'utf8')

test('ci sono tutti i template', () => {
  const files = TEMPLATES.map((t) => t.file).sort()
  assert.deepEqual(files, ['change-email.html', 'conferma-registrazione.html', 'reset-password.html'])
})

test('ognuno porta il proprio segnaposto di Supabase', () => {
  for (const t of TEMPLATES) {
    assert.ok(t.contenuto.includes(t.segnaposto), `${t.file} ha perso ${t.segnaposto}`)
  }
})

test('la conferma manda il codice, non il link', () => {
  // Se qui ricomparisse ConfirmationURL vorrebbe dire che siamo tornati al
  // link, e la schermata del codice sul sito resterebbe lì a vuoto.
  const t = TEMPLATES.find((x) => x.file === 'conferma-registrazione.html')
  assert.ok(t.contenuto.includes('{{ .Token }}'))
  assert.ok(!t.contenuto.includes('{{ .ConfirmationURL }}'))
})

test('in cima c\'è il cartello che dice dove incollarli', () => {
  for (const t of TEMPLATES) {
    assert.match(t.contenuto, /^<!--\s*\n\s*Template per Supabase: /)
    assert.ok(t.contenuto.includes(`Subject: ${t.oggetto}`))
  }
})

test('reggono dove i client di posta sono severi', () => {
  for (const t of TEMPLATES) {
    // Il corpo, senza il commento di istruzioni: lì dentro c'è testo libero.
    const body = t.contenuto.slice(t.contenuto.indexOf('-->') + 3)
    assert.ok(!/rgba\(/.test(body), `${t.file}: rgba() — Outlook lo scarta`)
    assert.ok(!/display:\s*flex/.test(body), `${t.file}: flex non esiste nella posta`)
    assert.ok(!/display:\s*grid/.test(body), `${t.file}: grid non esiste nella posta`)
    assert.ok(body.includes('email-assets/'), `${t.file}: manca il logo`)
    assert.ok(body.includes('Poppins'), `${t.file}: manca il carattere del sito`)
  }
})

test('i file su disco sono allineati a build.mjs', () => {
  for (const t of TEMPLATES) {
    assert.equal(
      letto(t.file),
      t.contenuto,
      `${t.file} è disallineato: rilancia "node supabase/email-templates/build.mjs"`
    )
  }
})
