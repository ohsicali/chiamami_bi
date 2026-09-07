/**
 * Campagne finte per vedere i tre formati a schermo senza creare annunci veri.
 *
 * Servono perché preview e produzione condividono lo stesso database: una
 * campagna di prova creata per guardare come viene finirebbe anche su
 * chiamamibi.com. Si attivano aggiungendo `?demo=ads` a qualsiasi pagina
 * (`/?demo=ads`, `/list?demo=ads`) e non toccano nessuna riga in DB.
 *
 * Tutte puntano a un link esterno e nessuna ha uno slug: così nessun bottone
 * porta alla scheda di un ristorante che non esiste.
 */

const FOREVER = { start_at: '2020-01-01T00:00:00Z', end_at: '2099-01-01T00:00:00Z', active: true, weight: 5 }

export const DEMO_ADS = [
  {
    ...FOREVER,
    id: 'demo-hero',
    slot: 'home_hero',
    variant: 'restaurant_discount',
    link_type: 'external',
    cta_url: 'https://chiamamibi.com',
    client_name: 'Demo',
    headline: 'Smashers',
    subtitle: 'Smash burger senza compromessi. Doppio con cheddar, la cosa da prendere.',
    cover_image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80',
    restaurant: {
      id: 'demo-r1',
      name: 'Smashers',
      cuisine_type: 'Burger',
      category: ['Burger'],
      price_range: 2,
      address: 'Vanchiglia, Torino',
      tagline: 'Smash burger senza compromessi.',
      hours_cache: null,
      photos: [],
    },
    discount: {
      id: 'demo-d1',
      title: 'Sconto Smashers',
      description: 'Doppio con cheddar, la cosa da prendere.',
      discount_type: 'percentage',
      discount_value: '15',
    },
  },
  {
    ...FOREVER,
    id: 'demo-deals',
    slot: 'deals_mid',
    variant: 'brand',
    link_type: 'external',
    cta_url: 'https://chiamamibi.com',
    client_name: 'Demo',
    brand_name: 'Vini Crosetti',
    headline: '20% sulle Barbera biologiche',
    subtitle: 'Consegna in 24h a Torino · codice BI20',
    cta_label: 'Vai allo shop',
  },
  {
    ...FOREVER,
    id: 'demo-list',
    slot: 'list_inline',
    variant: 'brand',
    link_type: 'external',
    cta_url: 'https://chiamamibi.com',
    client_name: 'Demo',
    brand_name: 'Cascina Torricelli',
    brand_subtitle: 'Bianchi del Monferrato · vendita diretta',
  },
]

/** `?demo=ads` nella query corrente. */
export function isDemoAds(search) {
  return new URLSearchParams(search || '').get('demo') === 'ads'
}

/**
 * `?demo=ads` nell'indirizzo con cui è stata aperta l'app.
 *
 * Serve perché su `/esplora` la pagina mappa ricostruisce la query da zero
 * per tenere i filtri in sincronia con l'URL (HomePage.jsx), e nel farlo
 * butta via `demo` un istante dopo il caricamento: senza questo controllo la
 * demo si spegnerebbe da sola proprio sulla pagina con la mappa. Letto una
 * volta sola al mount del provider, resta valido per tutta la navigazione.
 */
export function isDemoAdsAtLoad() {
  if (typeof window === 'undefined') return false
  return isDemoAds(window.location.search)
}
