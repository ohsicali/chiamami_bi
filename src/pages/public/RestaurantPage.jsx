import { useEffect } from 'react'
import { useNavigate, useLocation, matchPath } from 'react-router-dom'
import RestaurantSheet from '../../components/Restaurant/RestaurantSheet'
import DesktopRestaurantSheet from '../../components/Restaurant/DesktopRestaurantSheet'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
import { LogoLoader } from '../../components/UI/Logo'
import MetaTags from '../../components/SEO/MetaTags'
import JsonLd from '../../components/SEO/JsonLd'
import { proxyImg } from '../../lib/supabase'

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
  const isDesktop = useIsDesktop()

  const restaurant = allRestaurants.find((r) => r.slug === slug || slugify(r.name) === slug)

  // Preload the first photo as soon as we know which restaurant we're
  // showing — this kicks off the network fetch ~50-150ms before the
  // PhotoCarousel mounts, so the LCP image lands faster.
  useEffect(() => {
    const first = restaurant?.photos?.[0]
    if (!first) return
    const fullUrl = typeof first === 'string' ? first : (first.photo_url || first.url)
    if (!fullUrl) return
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = proxyImg(fullUrl, { w: 1200 })
    link.imageSrcset = [
      `${proxyImg(fullUrl, { w: 800 })} 800w`,
      `${proxyImg(fullUrl, { w: 1200 })} 1200w`,
      `${proxyImg(fullUrl, { w: 1600 })} 1600w`,
    ].join(', ')
    link.imageSizes = '(max-width: 768px) 100vw, 1200px'
    link.fetchPriority = 'high'
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [restaurant?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
            style={{ fontFamily: "var(--font-sans)" }}
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
      {isDesktop ? (
        <DesktopRestaurantSheet
          restaurant={restaurant}
          onClose={handleBack}
          allRestaurants={allRestaurants}
          onSelectNearby={handleSelectNearby}
          saved={isSaved(restaurant.id)}
          onSaveToggle={handleSaveToggle}
        />
      ) : (
        <RestaurantSheet
          restaurant={restaurant}
          onClose={handleBack}
          allRestaurants={allRestaurants}
          onSelectNearby={handleSelectNearby}
          saved={isSaved(restaurant.id)}
          onSaveToggle={handleSaveToggle}
        />
      )}
    </>
  )
}
