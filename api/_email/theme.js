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
  // L'inchiostro un filo più chiaro del nero pieno: serve per le due fasce
  // scure (la card dell'offerta, il riquadro del codice) quando stanno una
  // sopra l'altra e un nero unico le farebbe sembrare un blocco solo.
  inkSoft: '#2C2126',
  ink70: '#5C5359',
  ink45: '#8A8388',
  page: '#F3EDE4',
  cream: '#F7F2E9',
  creamDeep: '#F1EBE0',
  white: '#FFFFFF',
  line: '#E6E1D8',
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
  instagram: 'https://instagram.com/chiamamibi',
  contact: 'info@chiamamibi.com',
}

/** Larghezza della colonna: 600px è il massimo che Outlook mostra intero. */
export const WIDTH = 600

/**
 * La fascia della foto in cima: 600×250, cioè 2.4 a 1.
 *
 * Il numero non è estetico, è la lamentela che ha fatto nascere questa
 * revisione: la foto arrivava con le sue proporzioni native — spesso un
 * fotogramma verticale di un video, bande nere comprese — e su un telefono
 * si mangiava due schermate intere prima che si leggesse una parola. Con un
 * rapporto fisso la foto è una fascia, il messaggio comincia subito sotto,
 * e il ritaglio al centro butta via le bande nere invece di mostrarle.
 *
 * Il taglio lo fa /api/img (vedi `photoUrl` in blocks.js), non il client di
 * posta: `object-fit` in Outlook non esiste e lì l'immagine si schiaccerebbe.
 */
export const HERO = { w: 600, h: 250 }
