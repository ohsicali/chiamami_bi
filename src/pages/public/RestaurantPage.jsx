import { useNavigate, useLocation, matchPath } from 'react-router-dom'
import RestaurantSheet from '../../components/Restaurant/RestaurantSheet'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import { LogoLoader } from '../../components/UI/Logo'

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function RestaurantPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const match = matchPath('/restaurant/:slug', location.pathname)
  const slug = match?.params?.slug
  const { restaurants, loading } = useRestaurants()

  const restaurant = restaurants.find((r) => r.slug === slug || slugify(r.name) === slug)

  const handleBack = () => {
    navigate('/')
  }

  const handleSelectNearby = (nearby) => {
    navigate(`/restaurant/${nearby.slug || slugify(nearby.name)}`)
  }

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-bg flex items-center justify-center">
        <LogoLoader size={48} />
      </div>
    )
  }

  // 404 state
  if (!restaurant) {
    return (
      <div className="fixed inset-0 z-50 bg-bg">
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 text-6xl">🍽️</div>
          <h1
            className="mb-2 text-2xl font-bold text-primary"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Ristorante non trovato
          </h1>
          <p className="mb-6 text-secondary">
            Il ristorante che cerchi non esiste o è stato rimosso.
          </p>
          <button
            onClick={handleBack}
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-md transition-transform active:scale-95"
          >
            Torna alla mappa
          </button>
        </div>
      </div>
    )
  }

  // RestaurantSheet already handles its own animations (backdrop + slide-up spring)
  return (
    <RestaurantSheet
      restaurant={restaurant}
      onClose={handleBack}
      allRestaurants={restaurants}
      onSelectNearby={handleSelectNearby}
    />
  )
}
