import { useParams, useNavigate } from 'react-router-dom'
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

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}

const sheetVariants = {
  hidden: { y: '100%' },
  visible: { y: 0 },
  exit: { y: '100%' },
}

export default function RestaurantPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
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
      <>
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-black/30"
          style={{ willChange: 'opacity' }}
        />
        <motion.div
          variants={sheetVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={slideTransition}
          className="fixed inset-0 z-50 bg-bg"
          style={{ willChange: 'transform' }}
        >
          <div className="flex h-full items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#E85D3A] border-t-transparent" />
          </div>
        </motion.div>
      </>
    )
  }

  // 404 state
  if (!restaurant) {
    return (
      <>
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-black/30"
          style={{ willChange: 'opacity' }}
          onClick={handleBack}
        />
        <motion.div
          variants={sheetVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
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
      </>
    )
  }

  // Full screen RestaurantSheet with Apple-style slide up
  return (
    <>
      {/* Backdrop fade */}
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/30"
        style={{ willChange: 'opacity' }}
        onClick={handleBack}
      />

      {/* Sheet slide-up */}
      <motion.div
        variants={sheetVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={slideTransition}
        style={{ willChange: 'transform' }}
      >
        <RestaurantSheet
          restaurant={restaurant}
          onClose={handleBack}
          allRestaurants={restaurants}
          onSelectNearby={handleSelectNearby}
        />
      </motion.div>
    </>
  )
}
