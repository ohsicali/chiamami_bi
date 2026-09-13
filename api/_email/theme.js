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
  ink70: '#5C5359',
  ink45: '#8A8388',
  page: '#FAF7F2',
  cream: '#F5F0E4',
  creamDeep: '#F1EBE0',
  white: '#FFFFFF',
  line: '#E6E1D8',
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

/** Larghezza della colonna: 600px è il massimo che Outlook mostra intero. */
export const WIDTH = 600
