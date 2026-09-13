/**
 * Le email: che si costruiscano, e che non perdano pezzi per strada.
 *
 * Queste prove non mandano niente — verificano quello che si rompe in
 * silenzio e che nessuno si accorge finché un cliente non se ne lamenta:
 * un apostrofo di un nome che spacca l'HTML, il link per disiscriversi che
 * sparisce da un annuncio, una `rgba()` che Outlook butta via, il codice
 * dello sconto che non finisce nel messaggio.
 *
 *   node --test tests/emails.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  welcomeEmail, newDiscountEmail, newRestaurantEmail,
  discountClaimedEmail, discountUsedEmail, SAMPLE,
} from '../api/_email/templates.js'
import { KINDS, unsubscribeUrl, listUnsubscribeHeaders } from '../api/_email/send.js'

const UNSUB = 'https://chiamamibi.com/preferenze-email?t=abc'

const ANNUNCI = [
  ['benvenuto', () => welcomeEmail({ ...SAMPLE.welcome, unsubscribeUrl: UNSUB })],
  ['nuovo sconto', () => newDiscountEmail({ ...SAMPLE.newDiscount, unsubscribeUrl: UNSUB })],
  ['nuovo locale', () => newRestaurantEmail({ ...SAMPLE.newRestaurant, unsubscribeUrl: UNSUB })],
]
const RICEVUTE = [
  ['sconto preso', () => discountClaimedEmail(SAMPLE.discountClaimed)],
  ['sconto usato', () => discountUsedEmail(SAMPLE.discountUsed)],
]
const TUTTE = [...ANNUNCI, ...RICEVUTE]

/* ── Struttura ─────────────────────────────────────────────────────── */

for (const [nome, build] of TUTTE) {
  test(`${nome}: oggetto, HTML e versione testo ci sono tutti`, () => {
    const m = build()
    assert.ok(m.subject && m.subject.length > 5, 'serve un oggetto')
    assert.ok(m.subject.length <= 78, `oggetto troppo lungo (${m.subject.length}): viene tagliato in elenco`)
    assert.ok(m.html.startsWith('<!DOCTYPE'), 'serve il doctype')
    assert.ok(m.html.includes('</html>'), 'HTML non chiuso')
    // Senza versione a solo testo i filtri antispam penalizzano il messaggio.
    assert.ok(m.text && m.text.length > 40, 'serve la versione a solo testo')
  })

  test(`${nome}: niente costrutti che i client di posta buttano via`, () => {
    const { html } = build()
    assert.ok(!/rgba\(/.test(html), 'Outlook ignora rgba(): serve un esadecimale')
    assert.ok(!/display:\s*flex/.test(html), 'Outlook non conosce flexbox')
    assert.ok(!/display:\s*grid/.test(html), 'Outlook non conosce grid')
    assert.ok(!/<script/i.test(html), 'niente script nelle email')
    // Gmail taglia <style> quando si inoltra: lo stile che conta va in linea.
    assert.ok(html.includes('style="'), 'lo stile deve essere in linea')
  })

  test(`${nome}: la riga di anteprima non è vuota`, () => {
    const { html } = build()
    // Senza, in elenco Gmail pesca le prime parole del corpo — che è il logo.
    assert.match(html, /mso-hide:all/, 'manca il blocco di anteprima')
  })
}

/* ── Disiscrizione ─────────────────────────────────────────────────── */

for (const [nome, build] of ANNUNCI) {
  test(`${nome}: porta il link per scegliere cosa ricevere`, () => {
    const m = build()
    assert.ok(m.html.includes(UNSUB), 'un annuncio senza via d’uscita è fuori legge in UE')
    assert.ok(m.text.includes(UNSUB), 'anche la versione testo deve averlo')
  })
}

for (const [nome, build] of RICEVUTE) {
  test(`${nome}: NON porta il link di disiscrizione`, () => {
    const m = build()
    // Sono ricevute, non annunci: si può spegnere quello che si riceve
    // senza aver chiesto niente, non la risposta a un proprio gesto.
    assert.ok(!m.html.includes('preferenze-email'), 'una ricevuta non si disiscrive')
  })
}

test('le intestazioni List-Unsubscribe ci sono quando c’è il token', () => {
  const h = listUnsubscribeHeaders('abc-123')
  assert.match(h['List-Unsubscribe'], /preferenze-email\?t=abc-123/)
  assert.match(h['List-Unsubscribe'], /mailto:/)
  // È questa che rende il link a un clic invece di una pagina da compilare.
  assert.equal(h['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
})

test('senza token non si inventa un link finto', () => {
  assert.equal(unsubscribeUrl(null), null)
  assert.deepEqual(listUnsubscribeHeaders(null), {})
})

/* ── Contenuto ─────────────────────────────────────────────────────── */

test('la ricevuta contiene il codice, in HTML e in testo', () => {
  const m = discountClaimedEmail(SAMPLE.discountClaimed)
  const code = SAMPLE.discountClaimed.code
  assert.ok(m.html.includes(code), 'senza il codice la ricevuta non serve a niente')
  assert.ok(m.text.includes(code), 'anche chi legge in solo testo deve averlo')
  assert.ok(m.html.includes(SAMPLE.discountClaimed.restaurantName))
})

test('l’oggetto dice la cosa concreta, non la categoria', () => {
  assert.match(newDiscountEmail({ ...SAMPLE.newDiscount, unsubscribeUrl: UNSUB }).subject, /Bar Stampa/)
  assert.match(discountClaimedEmail(SAMPLE.discountClaimed).subject, /Bar Stampa/)
  assert.match(newRestaurantEmail({ ...SAMPLE.newRestaurant, unsubscribeUrl: UNSUB }).subject, /Bomaki/)
})

test('un drop si annuncia come drop, una convenzione no', () => {
  const drop = newDiscountEmail({ ...SAMPLE.newDiscount, isDrop: true, unsubscribeUrl: UNSUB })
  const conv = newDiscountEmail({ ...SAMPLE.newDiscount, isDrop: false, countdown: null, unsubscribeUrl: UNSUB })
  assert.match(drop.subject, /^Drop:/)
  assert.ok(!/^Drop:/.test(conv.subject), 'una convenzione non scade, non va annunciata come drop')
})

/* ── Testo che arriva dal database ─────────────────────────────────── */

test('gli apostrofi e i segni di un nome non spaccano l’HTML', () => {
  const m = newDiscountEmail({
    ...SAMPLE.newDiscount,
    restaurantName: `L'Osteria <b>"da Gino"</b> & Co`,
    perk: '5€ <script>alert(1)</script>',
    unsubscribeUrl: UNSUB,
  })
  assert.ok(!m.html.includes('<script>'), 'lo script va neutralizzato')
  assert.ok(!m.html.includes('<b>"da Gino"'), 'i tag vanno neutralizzati')
  assert.ok(m.html.includes('&lt;script&gt;'), 'deve comparire come testo')
  assert.ok(m.html.includes('L&#39;Osteria'), 'l’apostrofo deve restare leggibile')
})

test('i campi facoltativi mancanti non lasciano buchi né "undefined"', () => {
  const m = newRestaurantEmail({
    restaurantName: 'Posto Nudo',
    href: 'https://chiamamibi.com/restaurant/posto-nudo',
    unsubscribeUrl: UNSUB,
  })
  assert.ok(!/undefined|null|NaN/.test(m.html), 'un campo vuoto non deve stampare "undefined"')
  assert.ok(m.html.includes('Posto Nudo'))
})

test('il nome di battesimo si prende dal nome completo', () => {
  assert.match(welcomeEmail({ name: 'Giulia Rossi' }).subject, /^Giulia,/)
  // Senza nome non si scrive "undefined, benvenuta".
  assert.ok(!/undefined/.test(welcomeEmail({}).subject))
})

/* ── Destinatari ───────────────────────────────────────────────────── */

test('ogni tipo di annuncio ha il suo interruttore', () => {
  assert.equal(KINDS['new-discount'], 'new_discounts')
  assert.equal(KINDS['new-place'], 'new_places')
  assert.equal(KINDS['my-discounts'], 'my_discounts')
  // Le ricevute non hanno interruttore: se un giorno ne comparisse uno,
  // qualcuno potrebbe restare senza il proprio codice sconto.
  assert.equal(KINDS['discount-claimed'], undefined)
  assert.equal(KINDS['discount-used'], undefined)
})
