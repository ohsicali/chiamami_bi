import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'
import { getDistance } from '../utils/distance'
import { isOpenForMoment } from '../hours'

// Re-export from useCategories for backwards compatibility
export { getCategoryInfo, DEFAULT_CATEGORIES as CUISINE_CATEGORIES, useCategories } from './useCategories'

export const PRICE_LABELS = ['', '€', '€€', '€€€', '€€€€']

// Stale-while-revalidate cache for the restaurants list. On repeat visits we
// can paint the previous list immediately while a fresh fetch runs in the
// background, eliminating the "Caricamento…" flash on the home and list pages.
// Bump the key version when the select shape or mapping changes.
// v5: bump dopo aver tolto i textHints (matching su free-text generava
// falsi positivi: il filtro "Pesce" pescava brunch/pizza solo perché la
// recensione menzionava "salmone" o "pesce"). Ora il match si basa solo su
// categories + recommended_for (tag strutturati lato admin).
const RESTAURANTS_CACHE_KEY = 'cb_restaurants_v5'
function readRestaurantsCache() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(RESTAURANTS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.data) ? parsed.data : null
  } catch { return null }
}
function writeRestaurantsCache(data) {
  try { localStorage.setItem(RESTAURANTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })) } catch { /* quota / private mode */ }
}

const MOCK_RESTAURANTS = [
  {
    id: '1',
    name: 'Trattoria del Corso',
    slug: 'trattoria-del-corso',
    city: 'Torino',
    country: 'Italia',
    address: 'Corso Vittorio Emanuele II, 48, 10123 Torino',
    latitude: 45.0703,
    longitude: 7.6869,
    phone: '+39 011 543 210',
    google_maps_url: 'https://maps.google.com/?q=Trattoria+del+Corso+Torino',
    website: null,
    category: ['Piemontese', 'Tradizionale'],
    cuisine_type: 'Piemontese',
    price_range: 2,
    our_rating: 4.5,
    our_review: 'Un angolo di tradizione piemontese autentica. Gli agnolotti del plin sono i migliori che abbia provato a Torino — fatti a mano ogni giorno. L\'atmosfera è calda e familiare, il personale ti fa sentire a casa.',
    our_tip: 'Provate gli agnolotti del plin con il sugo d\'arrosto. E non perdetevi il bunet!',
    recommended_for: ['Cena romantica', 'Famiglia', 'Tradizione'],
    tiktok_url: 'https://www.tiktok.com/@chiamamibi/video/trattoria-del-corso',
    is_published: true,
    created_at: '2025-06-15T10:00:00Z',
    updated_at: '2025-12-01T10:00:00Z',
    photos: [
      { id: 'p1', photo_url: 'https://picsum.photos/seed/trattoria1/800/600', caption: 'Agnolotti del plin', sort_order: 0 },
      { id: 'p2', photo_url: 'https://picsum.photos/seed/trattoria2/800/600', caption: 'Interno accogliente', sort_order: 1 },
      { id: 'p3', photo_url: 'https://picsum.photos/seed/trattoria3/800/600', caption: 'Bunet della casa', sort_order: 2 },
    ],
  },
  {
    id: '2',
    name: 'Sushi Zen',
    slug: 'sushi-zen',
    city: 'Torino',
    country: 'Italia',
    address: 'Via Lagrange, 35, 10123 Torino',
    latitude: 45.0654,
    longitude: 7.6784,
    phone: '+39 011 876 543',
    google_maps_url: 'https://maps.google.com/?q=Sushi+Zen+Torino',
    website: 'https://www.sushizen.it',
    category: ['Giapponese', 'Sushi'],
    cuisine_type: 'Giapponese',
    price_range: 3,
    our_rating: 4.0,
    our_review: 'Il sushi più fresco di Torino, preparato da veri chef giapponesi. L\'omakase è un\'esperienza: ti affidi allo chef e ogni pezzo è una sorpresa. Il locale è piccolo e intimo, perfetto per una serata speciale.',
    our_tip: 'L\'omakase va prenotato con anticipo. Sedetevi al bancone per vedere lo chef al lavoro!',
    recommended_for: ['Appuntamento', 'Esperienza unica'],
    tiktok_url: 'https://www.tiktok.com/@chiamamibi/video/sushi-zen',
    is_published: true,
    created_at: '2025-07-01T10:00:00Z',
    updated_at: '2025-11-15T10:00:00Z',
    photos: [
      { id: 'p4', photo_url: 'https://picsum.photos/seed/sushi1/800/600', caption: 'Selezione omakase', sort_order: 0 },
      { id: 'p5', photo_url: 'https://picsum.photos/seed/sushi2/800/600', caption: 'Nigiri di salmone', sort_order: 1 },
      { id: 'p6', photo_url: 'https://picsum.photos/seed/sushi3/800/600', caption: 'Il bancone', sort_order: 2 },
    ],
  },
  {
    id: '3',
    name: 'Pizzeria Da Michele',
    slug: 'pizzeria-da-michele',
    city: 'Torino',
    country: 'Italia',
    address: 'Via Garibaldi, 22, 10122 Torino',
    latitude: 45.0735,
    longitude: 7.6915,
    phone: '+39 011 432 109',
    google_maps_url: 'https://maps.google.com/?q=Pizzeria+Da+Michele+Torino',
    website: null,
    category: ['Pizza', 'Napoletana'],
    cuisine_type: 'Pizza',
    price_range: 1,
    our_rating: 5.0,
    our_review: 'LA pizza a Torino, punto. Impasto a lunga lievitazione, forno a legna, ingredienti DOP. La margherita è perfetta nella sua semplicità. C\'è sempre coda, ma ne vale ogni minuto d\'attesa.',
    our_tip: 'Arrivate presto! La margherita è un must assoluto. Il fritto misto di antipasto è pazzesco.',
    is_published: true,
    created_at: '2025-05-20T10:00:00Z',
    updated_at: '2025-12-05T10:00:00Z',
    photos: [
      { id: 'p7', photo_url: 'https://picsum.photos/seed/pizza1/800/600', caption: 'Margherita perfetta', sort_order: 0 },
      { id: 'p8', photo_url: 'https://picsum.photos/seed/pizza2/800/600', caption: 'Il forno a legna', sort_order: 1 },
      { id: 'p9', photo_url: 'https://picsum.photos/seed/pizza3/800/600', caption: 'Fritto misto', sort_order: 2 },
    ],
  },
  {
    id: '4',
    name: 'Ristorante Del Cambio',
    slug: 'ristorante-del-cambio',
    city: 'Torino',
    country: 'Italia',
    address: 'Piazza Carignano, 2, 10123 Torino',
    latitude: 45.0677,
    longitude: 7.6826,
    phone: '+39 011 546 690',
    google_maps_url: 'https://maps.google.com/?q=Del+Cambio+Torino',
    website: 'https://www.delcambio.it',
    category: ['Fine Dining', 'Piemontese'],
    cuisine_type: 'Fine Dining',
    price_range: 4,
    our_rating: 4.5,
    our_review: 'Un pezzo di storia torinese dal 1757. Qui cenava Cavour e l\'atmosfera è rimasta magica: affreschi, lampadari, un\'eleganza senza tempo. La cucina è piemontese raffinata, ogni piatto è un\'opera d\'arte.',
    our_tip: 'Prenotate con almeno una settimana di anticipo e chiedete il tavolo nella sala storica. Il finanziera è imperdibile.',
    is_published: true,
    created_at: '2025-06-01T10:00:00Z',
    updated_at: '2025-11-22T10:00:00Z',
    photos: [
      { id: 'p10', photo_url: 'https://picsum.photos/seed/cambio1/800/600', caption: 'Sala storica', sort_order: 0 },
      { id: 'p11', photo_url: 'https://picsum.photos/seed/cambio2/800/600', caption: 'Finanziera rivisitata', sort_order: 1 },
      { id: 'p12', photo_url: 'https://picsum.photos/seed/cambio3/800/600', caption: 'Dettaglio affreschi', sort_order: 2 },
    ],
  },
  {
    id: '5',
    name: 'Osteria del Borghese',
    slug: 'osteria-del-borghese',
    city: 'Torino',
    country: 'Italia',
    address: 'Via Borgo Dora, 8, 10152 Torino',
    latitude: 45.0762,
    longitude: 7.6752,
    phone: '+39 011 521 876',
    google_maps_url: 'https://maps.google.com/?q=Osteria+del+Borghese+Torino',
    website: null,
    category: ['Italiana', 'Tradizionale'],
    cuisine_type: 'Italiana',
    price_range: 2,
    our_rating: 4.0,
    our_review: 'Cucina casalinga vera, come quella della nonna. Nel cuore di Porta Palazzo, questo posto è un rifugio di sapori autentici. Il brasato al Barolo si scioglie in bocca, la pasta è fatta in casa ogni mattina.',
    our_tip: 'Il pranzo del giorno è un affare incredibile. Provate i dolci della casa, li fa la nonna del proprietario!',
    is_published: true,
    created_at: '2025-08-10T10:00:00Z',
    updated_at: '2025-12-10T10:00:00Z',
    photos: [
      { id: 'p13', photo_url: 'https://picsum.photos/seed/osteria1/800/600', caption: 'Brasato al Barolo', sort_order: 0 },
      { id: 'p14', photo_url: 'https://picsum.photos/seed/osteria2/800/600', caption: 'L\'ingresso', sort_order: 1 },
      { id: 'p15', photo_url: 'https://picsum.photos/seed/osteria3/800/600', caption: 'Pasta fresca', sort_order: 2 },
    ],
  },
  {
    id: '6',
    name: 'Ramen House',
    slug: 'ramen-house',
    city: 'Torino',
    country: 'Italia',
    address: 'Via San Secondo, 67, 10128 Torino',
    latitude: 45.0618,
    longitude: 7.6802,
    phone: '+39 011 765 432',
    google_maps_url: 'https://maps.google.com/?q=Ramen+House+Torino',
    website: null,
    category: ['Giapponese', 'Ramen'],
    cuisine_type: 'Giapponese',
    price_range: 2,
    our_rating: 4.5,
    our_review: 'Ramen artigianale con brodo preparato per 18 ore. Ogni ciotola è un abbraccio caldo. Il tonkotsu è denso, cremoso, pieno di umami. Posto piccolo e un po\' spartano, ma il ramen compensa tutto.',
    our_tip: 'Il tonkotsu è il più richiesto e per buone ragioni. A pranzo c\'è il menu speciale a prezzo ridotto!',
    is_published: true,
    created_at: '2025-09-01T10:00:00Z',
    updated_at: '2025-12-08T10:00:00Z',
    photos: [
      { id: 'p16', photo_url: 'https://picsum.photos/seed/ramen1/800/600', caption: 'Tonkotsu ramen', sort_order: 0 },
      { id: 'p17', photo_url: 'https://picsum.photos/seed/ramen2/800/600', caption: 'Gyoza croccanti', sort_order: 1 },
      { id: 'p18', photo_url: 'https://picsum.photos/seed/ramen3/800/600', caption: 'L\'atmosfera zen', sort_order: 2 },
    ],
  },
  {
    id: '7',
    name: 'La Piola',
    slug: 'la-piola',
    city: 'Torino',
    country: 'Italia',
    address: 'Via Barbaroux, 15, 10122 Torino',
    latitude: 45.0745,
    longitude: 7.6883,
    phone: '+39 011 345 678',
    google_maps_url: 'https://maps.google.com/?q=La+Piola+Torino',
    website: null,
    category: ['Piemontese', 'Osteria'],
    cuisine_type: 'Piemontese',
    price_range: 1,
    our_rating: 4.0,
    our_review: 'La piola come una volta: tovaglie a quadri, vino sfuso e piatti della tradizione. Il vitello tonnato è il migliore che abbia mangiato, cremoso e delicato. Ambiente conviviale, prezzi onestissimi.',
    our_tip: 'Il vitello tonnato è il piatto forte! Chiedete il vino sfuso della casa, è sorprendentemente buono.',
    is_published: true,
    created_at: '2025-07-20T10:00:00Z',
    updated_at: '2025-11-30T10:00:00Z',
    photos: [
      { id: 'p19', photo_url: 'https://picsum.photos/seed/piola1/800/600', caption: 'Vitello tonnato', sort_order: 0 },
      { id: 'p20', photo_url: 'https://picsum.photos/seed/piola2/800/600', caption: 'Interno caratteristico', sort_order: 1 },
      { id: 'p21', photo_url: 'https://picsum.photos/seed/piola3/800/600', caption: 'Tagliere di salumi', sort_order: 2 },
    ],
  },
  {
    id: '8',
    name: 'Gelateria Pepino',
    slug: 'gelateria-pepino',
    city: 'Torino',
    country: 'Italia',
    address: 'Piazza Carignano, 8, 10123 Torino',
    latitude: 45.0688,
    longitude: 7.6862,
    phone: '+39 011 542 009',
    google_maps_url: 'https://maps.google.com/?q=Gelateria+Pepino+Torino',
    website: 'https://www.pepino.it',
    category: ['Gelateria'],
    cuisine_type: 'Gelateria',
    price_range: 1,
    our_rating: 5.0,
    our_review: 'Il gelato più buono di Torino, punto. Pepino dal 1884 è un\'istituzione. Il Pinguino (il loro gelato ricoperto di cioccolato) è leggendario. I gusti alla nocciola e gianduia sono sublimi.',
    our_tip: 'Il Pinguino è il loro gelato iconico — DOVETE provarlo. La nocciola Piemonte è divina.',
    is_published: true,
    created_at: '2025-05-01T10:00:00Z',
    updated_at: '2025-12-12T10:00:00Z',
    photos: [
      { id: 'p22', photo_url: 'https://picsum.photos/seed/pepino1/800/600', caption: 'Il Pinguino', sort_order: 0 },
      { id: 'p23', photo_url: 'https://picsum.photos/seed/pepino2/800/600', caption: 'Vetrina gelati', sort_order: 1 },
      { id: 'p24', photo_url: 'https://picsum.photos/seed/pepino3/800/600', caption: 'Lo storico locale', sort_order: 2 },
    ],
  },
  {
    id: '9',
    name: 'Eataly Torino',
    slug: 'eataly-torino',
    city: 'Torino',
    country: 'Italia',
    address: 'Via Nizza, 230/14, 10126 Torino',
    latitude: 45.0584,
    longitude: 7.6710,
    phone: '+39 011 195 06801',
    google_maps_url: 'https://maps.google.com/?q=Eataly+Torino+Lingotto',
    website: 'https://www.eataly.net',
    category: ['Food Hall', 'Italiana'],
    cuisine_type: 'Food Hall',
    price_range: 2,
    our_rating: 3.5,
    our_review: 'Il primo Eataly al mondo, nato qui a Torino nel Lingotto. Più che un ristorante, è un\'esperienza: mercato, botteghe artigianali e diversi ristoranti tematici. Qualità altalenante ma il reparto formaggi e salumi è top.',
    our_tip: 'Visitate il reparto formaggi e salumi, è spettacolare. Il ristorante di pesce al piano superiore è il migliore.',
    is_published: true,
    created_at: '2025-08-01T10:00:00Z',
    updated_at: '2025-12-02T10:00:00Z',
    photos: [
      { id: 'p25', photo_url: 'https://picsum.photos/seed/eataly1/800/600', caption: 'L\'ingresso', sort_order: 0 },
      { id: 'p26', photo_url: 'https://picsum.photos/seed/eataly2/800/600', caption: 'Reparto formaggi', sort_order: 1 },
      { id: 'p27', photo_url: 'https://picsum.photos/seed/eataly3/800/600', caption: 'Pasta fresca', sort_order: 2 },
    ],
  },
  {
    id: '10',
    name: 'Casa Vicina',
    slug: 'casa-vicina',
    city: 'Torino',
    country: 'Italia',
    address: 'Via Massimo D\'Azeglio, 4, 10126 Torino',
    latitude: 45.0590,
    longitude: 7.6718,
    phone: '+39 011 195 06840',
    google_maps_url: 'https://maps.google.com/?q=Casa+Vicina+Torino',
    website: 'https://www.casavicina.com',
    category: ['Fine Dining', 'Creativa'],
    cuisine_type: 'Fine Dining',
    price_range: 4,
    our_rating: 5.0,
    our_review: 'Stellato Michelin e lo merita tutto. Lo chef Claudio Vicina crea piatti che raccontano il Piemonte in chiave moderna. Ogni portata è un\'opera d\'arte. Il menu degustazione è un viaggio nei sapori che non dimenticherete.',
    our_tip: 'Il menu degustazione con abbinamento vini è IMPERDIBILE. Prenotate con largo anticipo, i posti sono pochi.',
    is_published: true,
    created_at: '2025-06-20T10:00:00Z',
    updated_at: '2025-12-06T10:00:00Z',
    photos: [
      { id: 'p28', photo_url: 'https://picsum.photos/seed/vicina1/800/600', caption: 'Piatto dello chef', sort_order: 0 },
      { id: 'p29', photo_url: 'https://picsum.photos/seed/vicina2/800/600', caption: 'La sala', sort_order: 1 },
      { id: 'p30', photo_url: 'https://picsum.photos/seed/vicina3/800/600', caption: 'Dessert artistico', sort_order: 2 },
    ],
  },
  {
    id: '11',
    name: 'Scannabue',
    slug: 'scannabue',
    city: 'Torino',
    country: 'Italia',
    address: 'Largo Saluzzo, 25, 10125 Torino',
    latitude: 45.0720,
    longitude: 7.6940,
    phone: '+39 011 669 7693',
    google_maps_url: 'https://maps.google.com/?q=Scannabue+Torino',
    website: null,
    category: ['Piemontese', 'Contemporanea'],
    cuisine_type: 'Piemontese',
    price_range: 2,
    our_rating: 4.5,
    our_review: 'Piemontese moderno al suo meglio. Ingredienti a km zero, menu che cambia con le stagioni. Il tajarin al tartufo è da lacrime di gioia. Ottima selezione di vini naturali. Ambiente informale ma curato nei dettagli.',
    our_tip: 'Chiedete i piatti fuori menu, spesso sono le cose migliori. La selezione di vini naturali è eccellente!',
    is_published: true,
    created_at: '2025-09-15T10:00:00Z',
    updated_at: '2025-12-11T10:00:00Z',
    photos: [
      { id: 'p31', photo_url: 'https://picsum.photos/seed/scannabue1/800/600', caption: 'Tajarin al tartufo', sort_order: 0 },
      { id: 'p32', photo_url: 'https://picsum.photos/seed/scannabue2/800/600', caption: 'Il locale', sort_order: 1 },
      { id: 'p33', photo_url: 'https://picsum.photos/seed/scannabue3/800/600', caption: 'Selezione vini', sort_order: 2 },
    ],
  },
  {
    id: '12',
    name: 'Grom',
    slug: 'grom',
    city: 'Torino',
    country: 'Italia',
    address: 'Via Accademia delle Scienze, 4, 10123 Torino',
    latitude: 45.0710,
    longitude: 7.6845,
    phone: '+39 011 511 9067',
    google_maps_url: 'https://maps.google.com/?q=Grom+Torino',
    website: 'https://www.grom.it',
    category: ['Gelateria'],
    cuisine_type: 'Gelateria',
    price_range: 1,
    our_rating: 4.0,
    our_review: 'Nato a Torino nel 2003, Grom è diventato famoso in tutto il mondo. Gelato con ingredienti biologici, senza coloranti né aromi artificiali. Il Crema di Grom è il mio preferito. Una garanzia sempre.',
    our_tip: 'I gusti stagionali cambiano spesso e sono sempre una bella sorpresa. Il Crema di Grom è il must.',
    is_published: true,
    created_at: '2025-07-10T10:00:00Z',
    updated_at: '2025-12-09T10:00:00Z',
    photos: [
      { id: 'p34', photo_url: 'https://picsum.photos/seed/grom1/800/600', caption: 'Coni gelato', sort_order: 0 },
      { id: 'p35', photo_url: 'https://picsum.photos/seed/grom2/800/600', caption: 'Il banco', sort_order: 1 },
      { id: 'p36', photo_url: 'https://picsum.photos/seed/grom3/800/600', caption: 'Gusti del giorno', sort_order: 2 },
    ],
  },
]

/**
 * Mapping fra le label "umbrella" dei bubble della Home / del selettore
 * /esplora e i segnali strutturati del DB.
 *
 * Per ogni label la regola è OR fra:
 *   - categories:     ANY presente in restaurants.category
 *   - recommendedFor: ANY presente in restaurants.recommended_for
 *
 * Niente match su free-text (our_review/tip/tagline/name): generava falsi
 * positivi grossolani — es. il filtro "Pesce" pescava una brunch room solo
 * perché la recensione menzionava "salmone", "Carne" pescava bar/aperitivo
 * solo per un "tartare" o "manzo" di passaggio. Niente match su moments:
 * sono indicatori di orario (un giapponese aperto in aperitivo non è un
 * cocktail bar).
 *
 * Le label che non sono qui ricadono sul comportamento legacy (match esatto
 * su category/cuisine_type) — necessario per le categorie admin dinamiche.
 */
const HOME_CATEGORY_MAP = {
  Aperitivo:  { categories: ['Aperitivo'],                          recommendedFor: ['Aperitivo'] },
  Piemontese: { categories: ['Piemontese'] },
  Pizza:      { categories: ['Pizza'] },
  Giapponese: { categories: ['Giapponese', 'Sushi', 'Ramen'] },
  Pesce:      { categories: ['Pesce'] },
  Colazione:  { categories: ['Brunch', 'Bar', 'Matcha', 'Dolce', 'Gelateria'], recommendedFor: ['Brunch'] },
  Carne:      { categories: ['Barbecue', 'Carne'],                  recommendedFor: ['Carne'] },
  // "Italiana" è un cappello regionale: pizza/panineria hanno il loro bubble.
  Italiana:   { categories: ['Italiana', 'Piemontese', 'Pasta', 'Piadina', 'Tramezzini'] },
  Vegano:     { categories: ['Vegano'],                             recommendedFor: ['Vegetariano'] },
  Cocktail:   { categories: ['Cocktail'] },
}

export function matchesHomeCategory(restaurant, label) {
  if (!label) return true
  const map = HOME_CATEGORY_MAP[label]
  const cats = restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : [])
  if (!map) {
    // Fallback: label custom (es. da admin) → match esatto come prima.
    return cats.includes(label)
  }
  if (map.categories?.some(c => cats.includes(c))) return true
  if (map.recommendedFor?.some(t => (restaurant.recommended_for || []).includes(t))) return true
  return false
}

export function useRestaurants(userPosition = null) {
  const cachedRestaurants = typeof window !== 'undefined' ? readRestaurantsCache() : null
  const [allRestaurants, setAllRestaurants] = useState(cachedRestaurants || [])
  const [loading, setLoading] = useState(!cachedRestaurants)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    category: null,
    priceRange: null,
    moment: null, // 'colazione'|'pranzo'|'aperitivo'|'cena'|'dopocena' — gemello dei pill home
    sortBy: 'name',
  })
  const [searchQuery, setSearchQuery] = useState('')

  const fetchRestaurants = useCallback(async () => {
    // If we already painted from cache, keep loading=false so the UI doesn't
    // flash a spinner while we revalidate in the background.
    const hasCache = readRestaurantsCache() != null
    if (!hasCache) setLoading(true)
    setError(null)
    try {
      if (isSupabaseConfigured()) {
        // Narrow the SELECT to columns actually consumed by public components.
        // `*` pulled ~30+ unused fields per row, including long text columns
        // (`our_review`, etc.) that aren't read on list views.
        const RESTAURANT_COLUMNS = [
          'id', 'name', 'slug', 'city', 'country', 'address', 'neighborhood',
          'latitude', 'longitude', 'phone', 'website', 'google_maps_url',
          'category', 'cuisine_type', 'price_range', 'our_rating',
          'our_review', 'our_tip', 'recommended_for', 'tagline',
          'tiktok_url', 'instagram_reel', 'hours_cache', 'moments',
          'place_id', 'place_id_verified_at', 'opening_hours',
          'is_published', 'created_at', 'updated_at',
        ].join(', ')
        const { data, error: dbError } = await supabase
          .from('restaurants')
          .select(`${RESTAURANT_COLUMNS}, restaurant_photos(id, photo_url, thumb_url, sort_order)`)
          .eq('is_published', true)
          .order('name')
        if (dbError) {
          // eslint-disable-next-line no-console
          console.error('[useRestaurants] Supabase error:', dbError)
          throw dbError
        }
        const mapped = (data || []).map(r => {
          const { restaurant_photos, ...rest } = r
          return {
            ...rest,
            photos: (restaurant_photos || []).sort((a, b) => a.sort_order - b.sort_order),
          }
        })
        setAllRestaurants(mapped)
        writeRestaurantsCache(mapped)
      } else {
        // Only use mocks when Supabase is NOT configured (local dev without env vars)
        await new Promise(r => setTimeout(r, 300))
        setAllRestaurants(MOCK_RESTAURANTS)
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[useRestaurants] Fetch failed:', err)
      setError(err.message || 'Errore nel caricamento dei ristoranti')
      // Do NOT fallback to MOCK_RESTAURANTS in production — it hides real errors.
      // If we have cached data already painted, keep it; otherwise show empty.
      if (!readRestaurantsCache()) setAllRestaurants([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRestaurants() }, [fetchRestaurants])

  const restaurants = useMemo(() => {
    let result = [...allRestaurants]

    // Filter out unpublished for public view
    result = result.filter(r => r.is_published)

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.cuisine_type?.toLowerCase().includes(q) ||
        (r.category || []).some(c => c.toLowerCase().includes(q)) ||
        (r.recommended_for || []).some(tag => tag.toLowerCase().includes(q))
      )
    }

    if (filters.category) {
      const selected = Array.isArray(filters.category) ? filters.category : [filters.category]
      result = result.filter(r => selected.some(s => matchesHomeCategory(r, s)))
    }

    if (filters.priceRange) {
      result = result.filter(r => r.price_range === filters.priceRange)
    }

    if (filters.moment) {
      result = result.filter(r => isOpenForMoment(r.hours_cache, filters.moment, undefined, r.moments).match)
    }

    // Sort
    if (filters.sortBy === 'distance' && userPosition) {
      result.sort((a, b) => {
        const dA = getDistance(userPosition.lat, userPosition.lng, a.latitude, a.longitude)
        const dB = getDistance(userPosition.lat, userPosition.lng, b.latitude, b.longitude)
        return dA - dB
      })
    } else if (filters.sortBy === 'recent') {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name, 'it'))
    }

    return result
  }, [allRestaurants, searchQuery, filters, userPosition])

  return {
    restaurants,
    allRestaurants,
    loading,
    error,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    refetch: fetchRestaurants,
  }
}
