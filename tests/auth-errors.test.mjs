/**
 * I messaggi d'errore dell'accesso e della registrazione.
 *
 * Il bug: la pagina di accesso mostrava `err.message` così com'è. Quello che
 * arriva da Supabase è inglese e tecnico, e nel caso più frequente del
 * momento — la posta di conferma che non parte, 500 "Error sending
 * confirmation email" — chi si stava registrando leggeva una frase inglese
 * che non spiegava niente e non suggeriva niente.
 *
 * L'invariante che questi test proteggono: dalla pagina non esce MAI una
 * stringa tecnica inglese. Se un caso non è riconosciuto si mostra una frase
 * generica in italiano, non il messaggio del server.
 *
 *   node --test tests/auth-errors.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { authErrorMessage } from '../src/lib/utils/authErrors.js'

const isItalianSentence = (s) => {
  assert.ok(typeof s === 'string' && s.length > 0, 'deve essere una frase')
  // Nessuno dei termini tecnici che arrivano dal server deve passare.
  for (const leak of ['fetch', 'error sending', 'invalid login', 'rate limit', 'unexpected_failure', 'token']) {
    assert.ok(!s.toLowerCase().includes(leak), `non deve contenere "${leak}": ${s}`)
  }
  assert.ok(/[.!?]$/.test(s), `deve finire con una punteggiatura: ${s}`)
}

test('la posta di conferma che non parte non è colpa di chi si registra', () => {
  const m = authErrorMessage({ message: 'Error sending confirmation email' })
  isItalianSentence(m)
  assert.match(m, /problema nostro/i)
  assert.match(m, /info@chiamamibi\.com/)
})

test('credenziali sbagliate: si dice cosa è sbagliato', () => {
  const m = authErrorMessage({ message: 'Invalid login credentials' })
  isItalianSentence(m)
  assert.match(m, /Email o password/i)
})

test('email già registrata: si indica la mossa successiva', () => {
  const m = authErrorMessage({ message: 'User already registered' })
  isItalianSentence(m)
  assert.match(m, /accedere/i)
})

test('rete assente: si dice di controllare la connessione', () => {
  for (const msg of ['Failed to fetch', 'NetworkError when attempting to fetch resource', 'Load failed']) {
    const m = authErrorMessage({ message: msg })
    isItalianSentence(m)
    assert.match(m, /[Cc]onnessione/)
  }
})

test('email non confermata: si dice dove guardare', () => {
  const m = authErrorMessage({ message: 'Email not confirmed' })
  isItalianSentence(m)
  assert.match(m, /spam/i)
})

test('password troppo corta', () => {
  const m = authErrorMessage({ message: 'Password should be at least 6 characters' })
  isItalianSentence(m)
  assert.match(m, /password/i)
})

test('un 5xx senza messaggio noto resta un problema nostro', () => {
  const m = authErrorMessage({ message: 'boom', status: 503 })
  isItalianSentence(m)
  assert.match(m, /problema nostro/i)
})

test('un errore sconosciuto non fa trapelare il messaggio del server', () => {
  const m = authErrorMessage({ message: 'Something exploded in the gateway' })
  isItalianSentence(m)
  assert.ok(!m.includes('exploded'), 'il messaggio del server non deve arrivare in pagina')
})

test('errore vuoto o assente: comunque una frase', () => {
  for (const e of [null, undefined, {}, { message: '' }, '']) {
    isItalianSentence(authErrorMessage(e))
  }
})

test('il fallback personalizzato viene usato quando non riconosciamo nulla', () => {
  const m = authErrorMessage({ message: 'whatever' }, 'Accesso con Google non riuscito.')
  assert.equal(m, 'Accesso con Google non riuscito.')
})
