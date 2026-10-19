/**
 * I destinatari degli annunci: tutti, non i primi 1000.
 *
 * Supabase restituisce al massimo 1000 righe per richiesta. Fino al 12/10
 * `recipientsFor` ne faceva una sola, e con più di 1000 utenti ogni annuncio
 * (drop, sconti, locali nuovi) partiva solo ai primi 1000.
 *
 *   node --test tests/email-recipients.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { recipientsFor, RECIPIENTS_PAGE } from '../api/_email/send.js'

/** Un client finto che, come Supabase, non dà mai più di 1000 righe. */
function fakeAdmin(total) {
  const all = Array.from({ length: total }, (_, i) => ({
    user_id: String(i).padStart(6, '0'),
    unsubscribe_token: `t${i}`,
    profiles: { email: `u${i}@example.com`, full_name: '' },
  }))
  return {
    from() {
      let lo = 0
      let hi = Infinity
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        range: (a, b) => { lo = a; hi = b; return q },
        then: (resolve) => resolve({ data: all.slice(lo, Math.min(hi + 1, lo + 1000)), error: null }),
      }
      return q
    },
  }
}

test('con 1803 utenti li prende tutti', async () => {
  const out = await recipientsFor(fakeAdmin(1803), 'new-discount')
  assert.equal(out.length, 1803)
  assert.equal(new Set(out.map((r) => r.email)).size, 1803)
})

test('esattamente una pagina piena, e nessuno', async () => {
  assert.equal((await recipientsFor(fakeAdmin(RECIPIENTS_PAGE), 'new-place')).length, RECIPIENTS_PAGE)
  assert.equal((await recipientsFor(fakeAdmin(0), 'new-place')).length, 0)
})
