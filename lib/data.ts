export type PriceRange = "€" | "€€" | "€€€" | "€€€€";
export type Category = "Ristorante" | "Trattoria" | "Pizzeria" | "Osteria" | "Bistrot" | "Sushi" | "Fusion";

export interface Restaurant {
  id: number;
  name: string;
  description: string;
  category: Category;
  cuisine: string;
  priceRange: PriceRange;
  address: string;
  neighborhood: string;
  phone: string;
  lat: number;
  lng: number;
  photos: string[];
  rating: number;
  reviewCount: number;
  openingHours: string;
  avgPrice: number;
  website?: string;
}

export const restaurants: Restaurant[] = [
  {
    id: 1,
    name: "Del Cambio",
    description: "Storico ristorante torinese fondato nel 1757, eleganza sabauda e alta cucina piemontese in un ambiente di rara bellezza.",
    category: "Ristorante",
    cuisine: "Piemontese",
    priceRange: "€€€€",
    address: "Piazza Carignano 2",
    neighborhood: "Centro Storico",
    phone: "+39 011 543760",
    lat: 45.0693,
    lng: 7.6860,
    photos: [
      "https://images.unsplash.com/photo-1550966871-3ed3cfd0b13f?w=800&q=80",
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    ],
    rating: 4.9,
    reviewCount: 847,
    openingHours: "Mar–Sab 12:30–14:30, 19:30–22:30",
    avgPrice: 90,
    website: "https://www.delcambio.it",
  },
  {
    id: 2,
    name: "Osteria Antiche Sere",
    description: "Autentica osteria piemontese nel cuore di Cit Turin. Tajarin al ragù, bagna cauda e una carta vini da sogno.",
    category: "Osteria",
    cuisine: "Piemontese",
    priceRange: "€€",
    address: "Via Cenischia 9",
    neighborhood: "Cit Turin",
    phone: "+39 011 3854347",
    lat: 45.0740,
    lng: 7.6620,
    photos: [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
      "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80",
    ],
    rating: 4.7,
    reviewCount: 1203,
    openingHours: "Lun–Sab 19:30–23:00",
    avgPrice: 35,
  },
  {
    id: 3,
    name: "Porto di Savona",
    description: "Trattoria storica con vista su Piazza Vittorio. Cucina casalinga piemontese, vitello tonnato, finanziera e bollito.",
    category: "Trattoria",
    cuisine: "Piemontese",
    priceRange: "€€",
    address: "Piazza Vittorio Veneto 2",
    neighborhood: "Borgo Po",
    phone: "+39 011 8173500",
    lat: 45.0653,
    lng: 7.6942,
    photos: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    ],
    rating: 4.5,
    reviewCount: 920,
    openingHours: "Lun–Dom 12:00–15:00, 19:00–23:00",
    avgPrice: 40,
  },
  {
    id: 4,
    name: "Pizzeria Gennaro Esposito",
    description: "La vera pizza napoletana a Torino. Impasto a 48h di lievitazione, pomodoro San Marzano DOP, fior di latte d'Agerola.",
    category: "Pizzeria",
    cuisine: "Napoletana",
    priceRange: "€",
    address: "Via Nizza 67",
    neighborhood: "Nizza Millefonti",
    phone: "+39 011 6690414",
    lat: 45.0510,
    lng: 7.6750,
    photos: [
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
    ],
    rating: 4.8,
    reviewCount: 2140,
    openingHours: "Mar–Dom 12:00–14:30, 18:30–23:30",
    avgPrice: 18,
  },
  {
    id: 5,
    name: "Kido Sushi & Asian Fusion",
    description: "Il meglio della cucina giapponese e asiatica in chiave moderna. Omakase su richiesta, menu degustazione e cocktail bar.",
    category: "Sushi",
    cuisine: "Giapponese",
    priceRange: "€€€",
    address: "Via Carlo Alberto 14",
    neighborhood: "Centro",
    phone: "+39 011 0702050",
    lat: 45.0670,
    lng: 7.6875,
    photos: [
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80",
      "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=800&q=80",
    ],
    rating: 4.6,
    reviewCount: 615,
    openingHours: "Lun–Dom 12:30–15:00, 19:00–23:30",
    avgPrice: 55,
  },
  {
    id: 6,
    name: "Bistrot Cannavacciuolo",
    description: "Il bistrot firmato Antonino Cannavacciuolo porta a Torino una cucina gourmet accessibile, con ingredienti di eccellenza.",
    category: "Bistrot",
    cuisine: "Italiana Gourmet",
    priceRange: "€€€",
    address: "Via Roma 1",
    neighborhood: "Centro",
    phone: "+39 011 19506010",
    lat: 45.0710,
    lng: 7.6830,
    photos: [
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
      "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80",
    ],
    rating: 4.8,
    reviewCount: 1876,
    openingHours: "Lun–Dom 12:00–15:00, 19:00–23:00",
    avgPrice: 65,
  },
  {
    id: 7,
    name: "Trattoria Valenza",
    description: "Dal 1901, la trattoria più amata dai torinesi. Agnolotti del plin, risotto al Barolo e la miglior panna cotta della città.",
    category: "Trattoria",
    cuisine: "Piemontese",
    priceRange: "€€",
    address: "Via Borgo Dora 39",
    neighborhood: "Borgo Dora",
    phone: "+39 011 4369931",
    lat: 45.0820,
    lng: 7.6810,
    photos: [
      "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80",
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
    ],
    rating: 4.6,
    reviewCount: 743,
    openingHours: "Mar–Dom 12:00–14:30, 19:30–22:30",
    avgPrice: 38,
  },
  {
    id: 8,
    name: "Fusion 45",
    description: "Cucina creativa che mescola sapori mediterranei, orientali e sudamericani. Menu che cambia ogni settimana seguendo la stagionalità.",
    category: "Fusion",
    cuisine: "Fusion Creativo",
    priceRange: "€€€",
    address: "Via Lagrange 22",
    neighborhood: "Centro",
    phone: "+39 011 5621834",
    lat: 45.0660,
    lng: 7.6818,
    photos: [
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80",
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
    ],
    rating: 4.4,
    reviewCount: 389,
    openingHours: "Mar–Dom 19:00–23:30",
    avgPrice: 58,
  },
];

export const categories: Category[] = ["Ristorante", "Trattoria", "Pizzeria", "Osteria", "Bistrot", "Sushi", "Fusion"];
export const priceRanges: PriceRange[] = ["€", "€€", "€€€", "€€€€"];
export const neighborhoods = [...new Set(restaurants.map((r) => r.neighborhood))];
export const cuisines = [...new Set(restaurants.map((r) => r.cuisine))];
