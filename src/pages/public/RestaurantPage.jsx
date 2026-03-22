import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import RestaurantSheet from '../../components/Restaurant/RestaurantSheet'
import { useRestaurants } from '../../lib/hooks/useRestaurants'

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

// Apple-style spring: fast, snappy, minimal overshoot
const slideTransition = {
  type: 'spring',
  stiffness: 500,
  damping: 40,
  mass: 0.8,
}

export default function RestaurantPage({ slug: slugProp }) {
  const navigate = useNavigate()
  const { restaurants, loading } = useRestaurants()

  const slug = slugProp
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-40"
        style={{ willChange: 'opacity' }}
      >
        <div className="absolute inset-0 bg-black/30" onClick={handleBack} />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={slideTransition}
          className="fixed inset-0 z-50 bg-bg"
          style={{ willChange: 'transform' }}
        >
          <div className="flex h-full items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#E85D3A] border-t-transparent" />
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // 404 state
  if (!restaurant) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-40"
        style={{ willChange: 'opacity' }}
      >
        <div className="absolute inset-0 bg-black/30" onClick={handleBack} />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={slideTransition}
          className="fixed inset-0 z-50 bg-bg"
          style={{ willChange: 'transform' }}
        >
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
        </motion.div>
      </motion.div>
    )
  }

  // Full screen RestaurantSheet with Apple-style slide up
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-40"
      style={{ willChange: 'opacity' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={handleBack} />

      {/* Sheet slide-up */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={slideTransition}
        className="relative z-10"
        style={{ willChange: 'transform' }}
      >
        <RestaurantSheet
          restaurant={restaurant}
          onClose={handleBack}
          allRestaurants={restaurants}
          onSelectNearby={handleSelectNearby}
        />
      </motion.div>
    </motion.div>
  )
}
