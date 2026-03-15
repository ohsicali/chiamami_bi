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
  phone: string;
  lat: number;
  lng: number;
  photos: string[];
  rating: number;
  openingHours: string;
  website?: string;
}

export const restaurants: Restaurant[] = [
  {
    id: 1,
    name: "Osteria della Piazza",
    description: "Cucina tradizionale italiana con ingredienti freschi a km zero. Un luogo accogliente nel cuore della città.",
    category: "Osteria",
    cuisine: "Italiana",
    priceRange: "€€",
    address: "Via Roma 12, Milano",
    phone: "+39 02 1234567",
    lat: 45.464,
    lng: 9.191,
    photos: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    ],
    rating: 4.5,
    openingHours: "Lun-Dom 12:00–15:00, 19:00–23:00",
  },
  {
    id: 2,
    name: "Pizza & Passione",
    description: "Le migliori pizze napoletane, con impasto a lunga lievitazione e ingredienti DOP.",
    category: "Pizzeria",
    cuisine: "Napoletana",
    priceRange: "€",
    address: "Corso Buenos Aires 45, Milano",
    phone: "+39 02 9876543",
    lat: 45.473,
    lng: 9.207,
    photos: [
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
    ],
    rating: 4.8,
    openingHours: "Mar-Dom 12:00–14:30, 18:30–23:30",
  },
  {
    id: 3,
    name: "Trattoria da Nonna Maria",
    description: "Ricette della tradizione lombarda tramandate di generazione in generazione. Casoeûla, risotto e tanto amore.",
    category: "Trattoria",
    cuisine: "Lombarda",
    priceRange: "€€",
    address: "Via Brera 8, Milano",
    phone: "+39 02 4561230",
    lat: 45.471,
    lng: 9.186,
    photos: [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
      "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80",
    ],
    rating: 4.6,
    openingHours: "Lun-Sab 12:00–14:30, 19:30–22:30",
  },
  {
    id: 4,
    name: "Sakura Sushi",
    description: "Autentica cucina giapponese con pesce freschissimo, nigiri e rolls creativi preparati da chef esperti.",
    category: "Sushi",
    cuisine: "Giapponese",
    priceRange: "€€€",
    address: "Via Montenapoleone 3, Milano",
    phone: "+39 02 7654321",
    lat: 45.468,
    lng: 9.196,
    photos: [
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80",
      "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=800&q=80",
    ],
    rating: 4.7,
    openingHours: "Lun-Dom 12:30–15:00, 19:00–23:00",
  },
  {
    id: 5,
    name: "Ristorante Il Sigillo",
    description: "Alta cucina italiana in un'atmosfera elegante. Perfetto per occasioni speciali e cene di lavoro.",
    category: "Ristorante",
    cuisine: "Alta cucina italiana",
    priceRange: "€€€€",
    address: "Via della Spiga 18, Milano",
    phone: "+39 02 3210987",
    lat: 45.470,
    lng: 9.199,
    photos: [
      "https://images.unsplash.com/photo-1550966871-3ed3cfd0b13f?w=800&q=80",
      "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80",
    ],
    rating: 4.9,
    openingHours: "Mar-Sab 19:30–23:30",
    website: "https://ilsigillo.it",
  },
  {
    id: 6,
    name: "Bistrot Fusion Milano",
    description: "Un viaggio tra le cucine del mondo: contaminazioni creative tra sapori mediterranei e orientali.",
    category: "Fusion",
    cuisine: "Fusion",
    priceRange: "€€€",
    address: "Via Tortona 22, Milano",
    phone: "+39 02 1122334",
    lat: 45.458,
    lng: 9.170,
    photos: [
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80",
    ],
    rating: 4.4,
    openingHours: "Lun-Dom 12:00–23:30",
  },
];

export const categories: Category[] = ["Ristorante", "Trattoria", "Pizzeria", "Osteria", "Bistrot", "Sushi", "Fusion"];
export const priceRanges: PriceRange[] = ["€", "€€", "€€€", "€€€€"];
export const cuisines = [...new Set(restaurants.map((r) => r.cuisine))];
