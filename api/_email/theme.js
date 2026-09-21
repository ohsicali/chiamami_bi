/**
 * I colori e le misure delle email, presi dal sito.
 *
 * Sta a parte da globals.css perché nelle email le custom property CSS non
 * esistono: Outlook e Gmail le ignorano, e ogni valore va scritto per esteso
 * dentro l'attributo `style` di ogni singolo elemento. Qui li teniamo in un
 * posto solo, così quando il corallo del sito cambia non si va a caccia di
 * "#E8453C" in mezzo a settecento righe di HTML.
 *
 * Sui caratteri: Poppins è quello del sito, e nelle email si carica solo
 * dove il client accetta i webfont — Apple Mail e la posta di iPhone sì,
 * Gmail e Outlook no, e non è aggirabile. Quindi lo chiediamo con un
 * @font-face (vedi render.js) e subito dietro mettiamo una pila di sans di
 * sistema: dove Poppins arriva il messaggio somiglia al sito, dove non
 * arriva resta comunque un sans pulito. La cosa da non fare è lasciare
 * `serif` in coda, perché Outlook ci si aggrappa e ribalta tutto in Times.
 *
 * I woff2 stanno su chiamamibi.com/fonts (gli stessi che serve il sito, non
 * Google) e il marchio lo porta l'immagine del logo, che si vede ovunque.
 */

export const COLORS = {
  corallo: '#E8453C',
  coralloInk: '#C53A33',
  coralloWash: '#FDEDEB',
  ink: '#22181C',
  // Il grigio del corpo del testo. Più caldo di un grigio neutro: accanto
  // all'inchiostro del titolo non fa il salto che fa un #555.
  body: '#4A4044',
  // L'inchiostro un filo più chiaro del nero pieno: serve per le due fasce
  // scure (la card dell'offerta, il riquadro del codice) quando stanno una
  // sopra l'altra e un nero unico le farebbe sembrare un blocco solo.
  inkSoft: '#2C2126',
  ink70: '#5C5359',
  ink45: '#8A8388',
  // I tre grigi del piè di pagina e della testata, dal chiaro allo
  // scurissimo: città in testata, claim in corsivo, riga di servizio.
  mastheadCity: '#A79B8C',
  footerClaim: '#9A8E80',
  footerFine: '#B3A898',
  // Il fondo della pagina e il filo sotto la testata: due valori soli, e
  // sono quelli della revisione v11. Il crema chiaro (`cream`) è il fondo
  // dei blocchi dentro il corpo — il riquadro della convenzione, la
  // tabellina delle email interne.
  page: '#F5F0E4',
  cream: '#FAF7F2',
  creamDeep: '#F1EBE0',
  white: '#FFFFFF',
  line: '#EEE7DA',
  // Il filo d'oro è la cosa che il sito ha e le email non avevano: è quello
  // che separa un messaggio scritto bene da un volantino. Su fondo chiaro
  // serve `oro`, su fondo scuro `oroLight` — l'oro del sito sull'inchiostro
  // diventa marrone e non si legge più.
  oro: '#B08954',
  oroDeep: '#8E6B3E',
  oroLight: '#D9B476',
  // Il crema sull'inchiostro: il bianco pieno su fondo scuro "vibra", questo no.
  onInk: '#F6F1E8',
  onInk70: '#B7ADA0',
  mint: '#AEF3C2',
  mint2: '#7EE5A0',
  // I bianchi "trasparenti" della card drop, già fusi sul corallo.
  // `rgba()` in Outlook non esiste e al suo posto non mette niente: la
  // pillola della scadenza diventerebbe testo bianco su fondo bianco.
  onCoral: '#FDF0EF',
  onCoralSoft: '#FBDEDC',
  onCoralFill: '#ED6A63',
  onCoralTrack: '#EE746D',
  mintInk: '#1A4731',
  verde: '#3F9D63',
}

// Titoli e corpo usano la stessa pila: sul sito è così (--font-sans e
// --font-display sono tutti e due Poppins), il peso fa la differenza.
const SANS_FALLBACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
export const FONT_DISPLAY = `'Poppins', ${SANS_FALLBACK}`
export const FONT_BODY = `'Poppins', ${SANS_FALLBACK}`

/** Le quattro varianti che le email usano davvero, servite dal sito. */
export const FONT_FILES = [400, 600, 700, 900]
export const FONT_MONO = "'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"

export const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://chiamamibi.com'
export const ASSETS = `${SITE_URL}/email-assets`

export const LOGO = {
  white: `${ASSETS}/guida-bi-white.png`,
  ink: `${ASSETS}/guida-bi-ink.png`,
  coral: `${ASSETS}/guida-bi-coral.png`,
}

/**
 * Chi manda, scritto per esteso in fondo a ogni email.
 *
 * Non è burocrazia: un messaggio pubblicitario che non dice chi lo manda e
 * da dove è, per il filtro di Gmail, indistinguibile da uno mandato da
 * chiunque altro. L'indirizzo vero si mette in `EMAIL_POSTAL_ADDRESS` su
 * Vercel — finché non c'è, in fondo compare la sola città, che è meglio di
 * niente ma non quanto una via e un numero civico.
 */
export const BRAND = {
  name: 'ChiamamiBi',
  tagline: 'La guida ai posti dove tornerei, a Torino.',
  postal: process.env.EMAIL_POSTAL_ADDRESS || 'ChiamamiBi · Torino, Italia',
  instagram: 'https://www.instagram.com/chiamami_bi/',
  contact: 'info@chiamamibi.com',
}

/** Larghezza della colonna: 600px è il massimo che Outlook mostra intero. */
export const WIDTH = 600

/**
 * Il ritaglio di ripiego, quando chi chiama non dice che misura vuole.
 *
 * La vecchia fascia in cima da 600×250 non esiste più: al suo posto c'è il
 * mosaico (`MOSAIC`) negli annunci e la foto dentro la card del drop
 * (`DROP_PHOTO`). Resta un quadrato piccolo perché `croppedPhoto` lo usano
 * anche le miniature delle righe locale, che una misura la vogliono comunque.
 */
export const THUMB = { w: 72, h: 72 }

/**
 * Il mosaico 1+3: una foto grande in rapporto 16:9 e sotto tre quadrate,
 * staccate da tre pixel di bianco.
 *
 * Le misure sono quelle che chiediamo al proxy, non quelle a cui la foto
 * viene mostrata: il doppio dei punti finali, perché gli schermi dei
 * telefoni ne hanno il doppio. La qualità scende a 78 per un motivo solo —
 * Gmail tronca il messaggio (e nasconde il piè di pagina) quando l'HTML più
 * le immagini superano una certa soglia, e quattro foto piene sono il modo
 * più rapido per arrivarci. A 78 la differenza non si vede, il peso sì.
 */
export const MOSAIC = {
  // La grande: 600×338 a video, cioè 16:9.
  big: { w: 1200, h: 676, q: 78 },
  // Le tessere: (600 − 6) / 3 ≈ 198 a video, quadrate.
  tile: { w: 420, h: 420, q: 78 },
  gutter: 3,
}

/** La foto dentro la card corallo del drop: una sola, 568 di larghezza utile. */
export const DROP_PHOTO = { w: 1136, h: 640, q: 78 }

/**
 * Il claim del piè di pagina.
 *
 * Non è il tagline di prima ("La guida ai posti dove tornerei"): è la frase
 * che stava dentro il corpo dell'email del locale nuovo, e che adesso fa da
 * promessa in fondo a ogni messaggio. Vale il posto di un secondo logo,
 * che è quello che c'era prima e che diceva una cosa già detta in cima.
 */
export const CLAIM = {
  utenti: 'Ci sono stato, ho pagato il conto e ci tornerei.<br />È l\'unico motivo per cui un posto finisce qui dentro.',
  club: 'Rispondi pure a questa email: dall\'altra parte ci sono io.',
}
