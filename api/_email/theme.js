/**
 * I colori e le misure delle email, presi dal sito.
 *
 * Sta a parte da globals.css perché nelle email le custom property CSS non
 * esistono: Outlook e Gmail le ignorano, e ogni valore va scritto per esteso
 * dentro l'attributo `style` di ogni singolo elemento. Qui li teniamo in un
 * posto solo, così quando il corallo del sito cambia non si va a caccia di
 * "#E8453C" in mezzo a settecento righe di HTML.
 *
 * Il carattere del sito (Poppins, Alfa Slab One) nelle email non si può
 * usare: i webfont non si caricano su Gmail, Outlook e la posta di iOS, e
 * quando non si caricano il ripiego è un Times New Roman che non somiglia a
 * niente. Il marchio lo porta l'immagine del logo (già ospitata su
 * chiamamibi.com/email-assets), il resto lo tiene la pila di sistema.
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

// Georgia in apertura è voluto: è l'unico serif con grazie presente su
// Windows, macOS, iOS e Android, e dà ai titoli lo stacco che sul sito dà
// Alfa Slab One. Il corpo resta senza grazie.
export const FONT_DISPLAY = "Georgia, 'Times New Roman', serif"
export const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
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
