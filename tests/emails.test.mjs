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
  discountClaimedEmail, discountUsedEmail, discountReminderEmail, SAMPLE,
} from '../api/_email/templates.js'
import { KINDS, unsubscribeUrl, oneClickUrl, listUnsubscribeHeaders } from '../api/_email/send.js'

const UNSUB = 'https://chiamamibi.com/preferenze-email?t=abc'

const ANNUNCI = [
  ['benvenuto', () => welcomeEmail({ ...SAMPLE.welcome, unsubscribeUrl: UNSUB })],
  ['nuovo sconto', () => newDiscountEmail({ ...SAMPLE.newDiscount, unsubscribeUrl: UNSUB })],
  ['nuovo locale', () => newRestaurantEmail({ ...SAMPLE.newRestaurant, unsubscribeUrl: UNSUB })],
  // Il promemoria non risponde a un gesto di adesso: è un annuncio, e si spegne.
  ['promemoria convenzione', () => discountReminderEmail({ ...SAMPLE.discountReminder, unsubscribeUrl: UNSUB })],
  ['promemoria drop', () => discountReminderEmail({
    ...SAMPLE.discountReminder, isDrop: true, endsAt: '2026-09-26T20:00:00Z', unsubscribeUrl: UNSUB,
  })],
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
  // L'oggetto non porta il prefisso "Drop:": un prefisso fisso su ogni
  // messaggio è la firma delle email automatiche, e in elenco il nome del
  // locale è la cosa che fa aprire. Il drop è un evento ("ho acceso"), la
  // convenzione è un possesso ("da oggi hai"): è la differenza che deve
  // leggersi in elenco, prima ancora di aprire.
  assert.match(drop.subject, /^Ho acceso un drop da /, 'il drop è un evento')
  assert.match(conv.subject, /^Da oggi /, 'la convenzione è un possesso, non un evento')
  assert.ok(!/drop/i.test(conv.subject), 'una convenzione non va annunciata come drop')
  assert.match(drop.subject, /Bar Stampa/)
  assert.match(conv.subject, /Bar Stampa/)
  // E la fretta finisce nel preheader, che è la riga che decide se aprono.
  assert.match(drop.html, /Quando finiscono, finiscono/)
  assert.match(conv.html, /Valido solo a pranzo, dal lunedì al venerdì, ogni volta che ci vai\. Nessuna scadenza\./)
})

/* ── Il colore dice il tipo di sconto ──────────────────────────────── */

test('il corallo pieno è solo dei drop, la convenzione è crema e oro', () => {
  // Non è decorazione: vestire da drop uno sconto che non scade brucia
  // l'urgenza anche sui drop veri, e dopo due email non funziona più
  // nemmeno quando la scadenza c'è davvero.
  const drop = newDiscountEmail({ ...SAMPLE.newDiscount, isDrop: true, taken: 4, left: 6, countdown: '3 giorni', unsubscribeUrl: UNSUB })
  const conv = newDiscountEmail({ ...SAMPLE.newDiscount, isDrop: false, countdown: null, unsubscribeUrl: UNSUB })

  assert.match(drop.html, /background-color:#E8453C/i, 'il drop ha la card corallo piena')
  assert.match(drop.html, /DROP LIVE · SCADE TRA 3 GIORNI/, 'la scadenza sta nella pill')
  assert.match(drop.html, /6 rimasti/, 'la barra dei posti è quello che spinge davvero')

  assert.ok(!/background-color:#E8453C/i.test(conv.html), 'la convenzione non indossa il corallo pieno')
  assert.match(conv.html, /border-left:4px solid #8E6B3E/i, 'la convenzione ha il filetto oro')
  assert.match(conv.html, /✓ VALIDO SOLO A PRANZO, DAL LUNEDÌ AL VENERDÌ · NESSUNA SCADENZA/)
  assert.ok(!/DROP LIVE|rimasti|SCADE TRA/.test(conv.html), 'niente barra, niente countdown, niente posti')
  // Il bottone invece resta corallo in tutti e due: il corallo è il colore
  // dell'azione, cambia il blocco dello sconto, non la chiamata.
  assert.match(conv.html, /bgcolor="#E8453C"/i)
  assert.match(drop.html, /Prendilo adesso/)
  assert.match(conv.html, /Aggiungilo ai tuoi sconti/)
})

test('la convenzione dice quando vale, non "sempre valido"', () => {
  // Locanda Bellezia: il chip diceva "sempre valido" e la riga accanto
  // "valido solo il mercoledì e il giovedì" — e sul database vale pure solo
  // a cena, fino al 30 novembre. "Sempre" voleva dire "non scade", ma si
  // leggeva "a ogni ora".
  const base = { ...SAMPLE.newDiscount, isDrop: false, countdown: null, unsubscribeUrl: UNSUB }
  const bellezia = newDiscountEmail({
    ...base,
    conditions: 'Valido solo il mercoledì e il giovedì',
    validity: { days: [3, 4], slots: ['cena'], until: '2026-11-30T00:00:00Z' },
  })
  assert.ok(!/SEMPRE VALIDO|Sempre valido/.test(bellezia.html), 'niente "sempre" su uno sconto che ha giorni e orari')
  assert.ok(!/nessuna scadenza/i.test(bellezia.html), 'con una scadenza vera non si scrive "nessuna scadenza"')
  // I giorni sono già nelle condizioni: il chip non li ripete.
  assert.match(bellezia.html, /✓ VALIDO SOLO A CENA · FINO\u00A0AL\u00A030\u00A0NOVEMBRE</)
  assert.match(bellezia.text, /Valido solo a cena, fino\u00A0al\u00A030\u00A0novembre\./)

  const dueFasce = newDiscountEmail({ ...base, conditions: null, validity: { slots: ['cena', 'pranzo'] } })
  assert.match(dueFasce.html, /✓ VALIDO A PRANZO E A CENA · NESSUNA SCADENZA/, 'le fasce in ordine di orologio')

  const orario = newDiscountEmail({ ...base, conditions: null, validity: { days: [1, 2, 3, 4], timeFrom: '19:00:00', timeTo: '23:00:00' } })
  assert.match(orario.html, /VALIDO DALLE 19:00 ALLE 23:00, DAL LUNEDÌ AL GIOVEDÌ/)

  const libero = newDiscountEmail({ ...base, validity: undefined })
  assert.match(libero.html, /✓ VALIDO TUTTI I GIORNI · NESSUNA SCADENZA/)
})

test('anche il drop dice la fascia, se ce n’è una', () => {
  // Il drop di Shoro vale solo a cena, ma la mail mostrava solo le
  // condizioni scritte a mano ("da lunedì a giovedì").
  const base = { ...SAMPLE.newDiscount, isDrop: true, unsubscribeUrl: UNSUB }
  const cena = newDiscountEmail({
    ...base,
    conditions: 'Valido sul menù AYCE da Lunedì a Giovedì',
    validity: { days: [1, 2, 3, 4], slots: ['cena'] },
  })
  assert.match(cena.html, /da Lunedì a Giovedì · Valido solo a cena/)
  assert.match(cena.text, /Valido solo a cena\./)

  const libero = newDiscountEmail({ ...base, validity: undefined })
  assert.ok(!/Valido tutti i giorni|Valido tutto il giorno/.test(libero.html), 'senza limiti nessuna riga in più')
})

test('un drop senza tetto non disegna una scarsità che non esiste', () => {
  const m = newDiscountEmail({ ...SAMPLE.newDiscount, isDrop: true, taken: null, left: null, unsubscribeUrl: UNSUB })
  assert.ok(!/rimasti|presi/.test(m.html), 'senza un tetto la barra racconterebbe una bugia')
  assert.match(m.html, /DROP LIVE/, 'ma resta un drop')
})

test('lo sconto è detto una volta sola, non due', () => {
  // Sul database metà dei titoli sono la percentuale e basta ("30% di
  // sconto"): il badge faceva "−30%" e la riga sotto "30% di sconto", che
  // non aggiunge niente e diluisce la prima. La riga resta solo quando dice
  // davvero qualcosa in più.
  const base = { ...SAMPLE.newDiscount, unsubscribeUrl: UNSUB }

  for (const isDrop of [true, false]) {
    const muto = newDiscountEmail({ ...base, value: '−30%', perk: '30% di sconto', isDrop })
    assert.ok(!/30% di sconto/.test(muto.html), 'il valore ripetuto va tolto')
    assert.ok(!/30% di sconto/.test(muto.text), 'anche dalla versione a solo testo')

    const parlante = newDiscountEmail({ ...base, value: '−1€', perk: '1€ di sconto sui tramezzini', isDrop })
    assert.match(parlante.html, /sui tramezzini/, 'un titolo che dice di più resta')
  }
})

/* ── I bug di contenuto che si vedevano a occhio nudo ──────────────── */

test('il testo di Bi non si taglia mai a metà parola', () => {
  // In posta si leggeva "…paella (sempre di pesce, carne, verdu…" e
  // "…Menzione d'onore anche ai p…": tagliare a caso non fa sembrare il
  // testo lungo, fa sembrare il prodotto rotto.
  const lungo = 'Ristorantino spagnolo molto carino, dentro intimo e con un bel dehor sulla piazza che d’estate è la cosa migliore. Tapas di carne, pesce o verdure a prezzi più che onesti, e la paella del sabato vale il viaggio. Menzione d’onore anche ai panini.'
  for (const m of [
    newRestaurantEmail({ ...SAMPLE.newRestaurant, review: lungo, unsubscribeUrl: UNSUB }),
    newDiscountEmail({ ...SAMPLE.newDiscount, review: lungo, unsubscribeUrl: UNSUB }),
  ]) {
    const tagliato = m.text.split('\n').find((r) => r.startsWith('Ristorantino'))
    assert.ok(tagliato, 'il testo di Bi deve esserci')
    assert.ok(!/…/.test(tagliato), `taglio a metà parola: ${tagliato.slice(-40)}`)
    assert.match(tagliato, /[.!?]$/, 'si taglia su una frase intera')
    assert.ok(tagliato.length <= 180, `troppo lungo: ${tagliato.length}`)
  }
})

test('la fascia di prezzo esce in €, non come numero grezzo', () => {
  // In posta si leggeva "Spagnolo · 2 · Torino".
  const m = newRestaurantEmail({
    ...SAMPLE.newRestaurant, price: undefined, priceRange: 2,
    address: 'Piazza Madama Cristina 5, 10125 Torino TO, Italy',
    unsubscribeUrl: UNSUB,
  })
  assert.match(m.html, /Sushi · €€ · Piazza Madama Cristina 5/)
  // E l'indirizzo passa da formatAddress: niente CAP, niente "Torino TO, Italy".
  assert.ok(!/10125|Italy/.test(m.html), 'il CAP e la coda di Google non vanno in posta')
})

/* ── Il mosaico ────────────────────────────────────────────────────── */

test('il mosaico gestisce tutti e quattro i casi di fallback', () => {
  const foto = (n) => Array.from({ length: n }, (_, i) => `https://x.supabase.co/storage/v1/f${i}.jpg`)
  const build = (n, total) => newRestaurantEmail({
    ...SAMPLE.newRestaurant, photos: foto(n), photoCount: total ?? n, unsubscribeUrl: UNSUB,
  })
  const conta = (html) => (html.match(/<img/g) || []).length

  // 0 foto → fondo caldo con l'emoji, mai un rettangolo grigio.
  const vuoto = build(0)
  assert.equal(conta(vuoto.html), 0)
  assert.match(vuoto.html, /linear-gradient/, 'serve il fondo caldo di ripiego')
  assert.match(vuoto.html, /background-color:#/, 'e il colore pieno per Outlook, che il gradiente lo ignora')

  // La riga sotto si divide in parti uguali fra le tessere che ci sono: mai
  // una tessera vuota, mai un buco a destra.
  assert.equal(conta(build(1).html), 1, '1 foto → solo la grande, niente riga sotto')
  assert.ok(!/width="100%" style="width:100%;padding:0/.test(build(1).html))
  assert.equal(conta(build(2).html), 2, '2 foto → grande + una fascia sotto')
  assert.equal(conta(build(3).html), 3, '3 foto → grande + due al 50%')
  assert.match(build(3).html, /width="50%"/)
  assert.equal(conta(build(4).html), 4, '4 o più → mosaico pieno')
  assert.match(build(4).html, /width="33.33%"/)

  // "+N" è totale − 4, e sotto zero non si mette.
  assert.match(build(4, 7).html, />\+3</, 'con altre tre foto il badge dice +3')
  assert.ok(!/>\+\d/.test(build(4, 4).html), 'senza altre foto niente badge')
  assert.ok(!/>\+\d/.test(build(3, 3).html))
})

test('ogni immagine porta un alt: con le foto spente resta il nome del locale', () => {
  const m = newRestaurantEmail({
    ...SAMPLE.newRestaurant,
    photos: ['https://x.supabase.co/storage/v1/a.jpg'],
    unsubscribeUrl: UNSUB,
  })
  for (const tag of m.html.match(/<img[^>]*>/g) || []) {
    assert.match(tag, /alt="/, `immagine senza alt: ${tag.slice(0, 70)}`)
  }
  assert.match(m.html, /alt="Bomaki Murazzi"/)
})

/* ── Il guscio condiviso ───────────────────────────────────────────── */

test('un logo solo, e il piè di pagina non ne porta un secondo', () => {
  // Prima ce n'erano due: "LA GUIDA DI BI · BY CHIAMAMI BI" in cima e lo
  // stesso marchio in fondo, cioè un piè di pagina che si era messo il
  // vestito della testata.
  for (const [nome, build] of TUTTE) {
    const { html } = build()
    assert.equal((html.match(/LA GUIDA DI BI/g) || []).length, 1, `${nome}: il marchio compare più di una volta`)
    assert.ok(!/email-assets\/guida-bi/.test(html), `${nome}: il logo PNG è tornato`)
  }
})

test('un solo divisore per email: quello sotto la testata', () => {
  for (const [nome, build] of TUTTE) {
    const { html } = build()
    const filetti = (html.match(/border-bottom:1px solid #EEE7DA/gi) || []).length
    assert.equal(filetti, 1, `${nome}: ${filetti} divisori invece di uno`)
  }
})

test('il claim sostituisce il secondo logo, in fondo a ogni email', () => {
  const m = newRestaurantEmail({ ...SAMPLE.newRestaurant, unsubscribeUrl: UNSUB })
  assert.match(m.html, /Ci sono stato, ho pagato il conto e ci tornerei/)
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
