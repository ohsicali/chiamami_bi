import { useNavigate, useLocation, matchPath } from 'react-router-dom'
import RestaurantSheet from '../../components/Restaurant/RestaurantSheet'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { LogoLoader } from '../../components/UI/Logo'
import MetaTags from '../../components/SEO/MetaTags'
import JsonLd from '../../components/SEO/JsonLd'

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
  const { allRestaurants, loading } = useRestaurants()
  const { user } = useAuth()
  const { isSaved, toggleSave } = useSavedRestaurants(user?.id)

  const restaurant = allRestaurants.find((r) => r.slug === slug || slugify(r.name) === slug)

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  const handleSelectNearby = (nearby) => {
    navigate(`/restaurant/${nearby.slug || slugify(nearby.name)}`)
  }

  const handleSaveToggle = () => {
    if (!user) {
      navigate('/login')
      return
    }
    if (restaurant) {
      toggleSave(restaurant.id)
    }
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
            style={{ fontFamily: "'DM Sans', sans-serif" }}
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

  const restaurantUrl = `https://chiamamibi.com/restaurant/${restaurant.slug || slugify(restaurant.name)}`

  return (
    <>
      <MetaTags
        title={`${restaurant.name} — ChiamamiBi`}
        description={restaurant.description || `Scopri ${restaurant.name} su ChiamamiBi`}
        image={restaurant.image || '/og-image.png'}
        url={restaurantUrl}
        type="restaurant"
      />
      <JsonLd
        name={restaurant.name}
        address={restaurant.address}
        telephone={restaurant.phone}
        url={restaurantUrl}
        priceRange={restaurant.priceRange}
        servesCuisine={restaurant.cuisine}
        image={restaurant.image}
      />
      <RestaurantSheet
        restaurant={restaurant}
        onClose={handleBack}
        allRestaurants={allRestaurants}
        onSelectNearby={handleSelectNearby}
        saved={isSaved(restaurant.id)}
        onSaveToggle={handleSaveToggle}
      />
    </>
  )
}
