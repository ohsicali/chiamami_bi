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
import { slugify } from '../../lib/utils/slug'


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

  const resolvedSlug = restaurant.slug || slugify(restaurant.name)
  const restaurantUrl = `https://chiamamibi.com/restaurant/${resolvedSlug}`
  const firstPhoto = restaurant.photos?.[0]
  const ogImage =
    (firstPhoto && (firstPhoto.photo_url || firstPhoto.thumb_url)) ||
    restaurant.image ||
    '/og-image.png'
  const photoImages = (restaurant.photos || [])
    .map(p => p.photo_url || p.thumb_url)
    .filter(Boolean)
    .slice(0, 6)
  const seoDescription =
    restaurant.tagline ||
    (restaurant.our_review || '').slice(0, 240) ||
    restaurant.description ||
    `Scopri ${restaurant.name} a ${restaurant.city || 'Torino'}: orari, indirizzo e la recensione di Bi su ChiamamiBi.`
  const seoTitle = `${restaurant.name}${
    restaurant.cuisine_type ? ' · ' + restaurant.cuisine_type : ''
  } a ${restaurant.city || 'Torino'} — ChiamamiBi`

  return (
    <>
      <MetaTags
        title={seoTitle}
        description={seoDescription}
        image={ogImage}
        url={restaurantUrl}
        canonical={restaurantUrl}
        type="restaurant.restaurant"
      />
      <JsonLd
        name={restaurant.name}
        description={seoDescription}
        address={restaurant.address}
        city={restaurant.city}
        country={restaurant.country}
        telephone={restaurant.phone}
        url={restaurantUrl}
        priceRange={restaurant.price_range || restaurant.priceRange}
        servesCuisine={restaurant.cuisine_type || restaurant.cuisine}
        image={photoImages.length ? photoImages : ogImage}
        latitude={restaurant.latitude}
        longitude={restaurant.longitude}
        sameAs={[restaurant.website, restaurant.google_maps_url, restaurant.tiktok_url, restaurant.instagram_reel].filter(Boolean)}
        hoursCache={restaurant.hours_cache}
        rating={restaurant.our_rating}
      />
      <JsonLd
        type="breadcrumb"
        items={[
          { name: 'Home', url: 'https://chiamamibi.com/' },
          { name: 'Ristoranti', url: 'https://chiamamibi.com/list' },
          { name: restaurant.name, url: restaurantUrl },
        ]}
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
