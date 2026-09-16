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
import { KINDS, unsubscribeUrl, oneClickUrl, listUnsubscribeHeaders } from '../api/_email/send.js'

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
  assert.match(h['List-Unsubscribe'], /mailto:/)
  // È questa che rende il link a un clic invece di una pagina da compilare.
  assert.equal(h['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
})

test('la disiscrizione a un clic punta a un endpoint, non alla pagina React', () => {
  // Gmail non apre quell'indirizzo: ci fa una POST e si aspetta che il
  // lavoro sia fatto. Alla pagina React la POST tornava 200 con l'HTML del
  // sito dentro — "disiscritto" per Gmail, ancora iscritto per davvero.
  const h = listUnsubscribeHeaders('abc-123')
  assert.match(h['List-Unsubscribe'], /\/api\/send-email\?unsub=abc-123/)
  assert.ok(!/preferenze-email/.test(h['List-Unsubscribe']), 'l’intestazione non deve puntare alla pagina')
  assert.equal(oneClickUrl(null), null)
  // Il link visibile nel piè di pagina, invece, resta quello bello.
  assert.match(unsubscribeUrl('abc-123'), /preferenze-email\?t=abc-123/)
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
  // L'oggetto non porta più il prefisso "Drop:": un prefisso fisso su ogni
  // messaggio è la firma delle email automatiche, e in elenco il nome del
  // locale è la cosa che fa aprire. La fretta resta, ma detta a parole.
  assert.match(drop.subject, /finché dura/, 'un drop scade, e l’oggetto deve dirlo')
  assert.ok(!/finché dura/.test(conv.subject), 'una convenzione non scade, non va annunciata come drop')
  assert.match(drop.subject, /Bar Stampa/)
  assert.match(conv.subject, /Bar Stampa/)
})

test('l’oggetto non comincia con il segno meno o la percentuale', () => {
  // "−50% da Bar Stampa" in elenco sembra un volantino, e i filtri
  // guardano proprio l'inizio dell'oggetto. Il valore ci sta, ma in mezzo.
  for (const [nome, build] of ANNUNCI) {
    const { subject } = build()
    assert.ok(!/^[−\-%€\d]/.test(subject), `${nome}: l’oggetto comincia con "${subject[0]}"`)
    assert.equal(subject, subject.replace(/\s{2,}/g, ' '), `${nome}: spazi doppi nell’oggetto`)
  }
})

test('ogni email dice perché è arrivata, in HTML e in testo', () => {
  // È la riga che manca a chi manda pubblicità non richiesta, e la prima
  // che guarda chi sta decidendo se segnalarci.
  for (const [nome, build] of TUTTE) {
    const m = build()
    assert.match(m.html, /Ricevi questa email perché/, `${nome}: manca il motivo nell’HTML`)
    assert.match(m.text, /Ricevi questa email perché/, `${nome}: manca il motivo nel testo`)
  }
})

test('ogni email dice chi la manda e da dove', () => {
  for (const [nome, build] of TUTTE) {
    const m = build()
    assert.match(m.html, /Torino/, `${nome}: manca l’identità del mittente`)
    assert.match(m.text, /Torino/, `${nome}: manca l’identità del mittente nel testo`)
  }
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

test('uno sconto senza valore leggibile non lascia un oggetto monco', () => {
  // Succede con un omaggio salvato senza titolo: prima usciva
  // "Senza Valore: , da oggi nel Club".
  const drop = newDiscountEmail({ value: '', restaurantName: 'Bar Senza', href: 'x', isDrop: true, unsubscribeUrl: UNSUB })
  const conv = newDiscountEmail({ value: '', restaurantName: 'Bar Senza', href: 'x', isDrop: false, unsubscribeUrl: UNSUB })
  for (const m of [drop, conv]) {
    assert.ok(!/:\s*,/.test(m.subject), `oggetto monco: ${m.subject}`)
    assert.match(m.subject, /Bar Senza/)
  }
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
