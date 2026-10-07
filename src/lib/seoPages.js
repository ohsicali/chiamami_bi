// Titolo e descrizione delle sezioni principali, come le vede Google.
//
// Una fonte sola per due posti: le pagine li mettono nel <head> quando si
// aprono (MetaTags), e `scripts/seo-pages.mjs` li scrive già nell'HTML che
// Vercel serve per quell'indirizzo. Prima ogni sezione arrivava con il titolo
// della home e il canonical verso "/": per Google /sconti ed /esplora erano
// doppioni della home, e non potevano uscire come link sotto il risultato
// (i "sitelink": "Promozioni ristoranti Torino", "I migliori ristoranti…").
//
// Il titolo è anche il nome che Google dà al sitelink: la parte prima di
// " | " o " — " deve dire da sola dove porta.

export const SITE_URL = 'https://chiamamibi.com'

export const SEO_PAGES = {
  '/': {
    title: 'Dove mangiare a Torino — I migliori ristoranti consigliati da ChiamamiBi',
    description: 'La guida personale di Bi ai migliori ristoranti, bar e locali di Torino. Mappa interattiva, recensioni curate, sconti esclusivi e i drop del giorno.',
  },
  '/esplora': {
    name: 'I migliori ristoranti di Torino',
    title: 'I migliori ristoranti di Torino sulla mappa | ChiamamiBi',
    description: 'La mappa dei migliori ristoranti, bar e locali di Torino scelti da Bi. Cerca vicino a te, filtra per categoria e prezzo e scopri dove mangiare stasera.',
  },
  '/sconti': {
    name: 'Promozioni ristoranti Torino',
    title: 'Promozioni ristoranti Torino — Sconti del Bi Club | ChiamamiBi',
    description: 'Promozioni e sconti nei ristoranti di Torino scelti da Bi: drop a tempo con posti limitati e convenzioni sempre attive. Sblocchi lo sconto e lo mostri in cassa.',
  },
  '/list': {
    name: 'Tutti i ristoranti',
    title: 'Tutti i ristoranti di Torino consigliati da Bi | ChiamamiBi',
    description: 'La lista completa dei ristoranti, bar e locali consigliati da Bi a Torino. Filtra per categoria, fascia di prezzo e momento della giornata.',
  },
  '/about': {
    name: 'Chi è Bi',
    title: 'Chi è Bi — La guida ristoranti di Torino | ChiamamiBi',
    description: 'Bi è una community di food lover di Torino: 130k+ su Instagram, 50k+ su TikTok, oltre 400 ristoranti consigliati. Scopri la storia dietro ChiamamiBi.',
  },
  '/partner': {
    name: 'Per i ristoratori',
    title: 'Diventa partner ChiamamiBi — Porta il tuo ristorante nella guida di Bi',
    description: 'Vuoi entrare nella guida ristoranti di Bi a Torino? Candidati come partner: visibilità a 3M+ persone al mese, recensione curata, sconti e drop dedicati.',
  },
  // Pagine legali: sono nella sitemap, quindi anche loro vogliono il proprio
  // canonical già nell'HTML. Con quello della home (index.html) Search Console
  // le dava come "Pagina alternativa con tag canonical appropriato".
  '/privacy': {
    name: 'Privacy',
    title: 'Privacy Policy — ChiamamiBi',
    description: 'Informativa sulla privacy di ChiamamiBi: come trattiamo i dati personali in conformità al GDPR.',
  },
  '/terms': {
    name: 'Termini e condizioni',
    title: 'Termini e Condizioni — ChiamamiBi',
    description: 'Termini di utilizzo del servizio ChiamamiBi: regole di accesso, contenuti, sconti e responsabilità.',
  },
}

// Le props per <MetaTags> di una sezione.
export function seoMeta(path) {
  const page = SEO_PAGES[path]
  const url = `${SITE_URL}${path}`
  return { title: page.title, description: page.description, url, canonical: url, type: 'website' }
}
