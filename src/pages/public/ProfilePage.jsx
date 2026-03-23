import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { LogoFull } from '../../components/UI/Logo'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'
import SaveButton from '../../components/Restaurant/SaveButton'

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

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const { savedIds, toggleSave } = useSavedRestaurants(user?.id)
  const [savedRestaurants, setSavedRestaurants] = useState([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true })
    }
  }, [user, authLoading, navigate])

  // Fetch saved restaurant details
  useEffect(() => {
    if (!user || savedIds.size === 0 || !isSupabaseConfigured()) {
      setSavedRestaurants([])
      setLoadingRestaurants(false)
      return
    }

    const ids = [...savedIds]
    setLoadingRestaurants(true)

    supabase
      .from('restaurants')
      .select('*, photos:restaurant_photos(id, photo_url, sort_order)')
      .in('id', ids)
      .eq('is_published', true)
      .order('name')
      .then(({ data }) => {
        setSavedRestaurants(data || [])
        setLoadingRestaurants(false)
      })
  }, [user, savedIds])

  const handleLogout = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  if (authLoading) return null

  const avatar = profile?.avatar_url
  const displayName = profile?.full_name || user?.email?.split('@')[0] || ''
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-dvh bg-bg">
      {/* Header bar */}
      <nav className="sticky top-0 z-40 glass">
        <div className="flex items-center justify-between px-4 py-3 max-w-screen-lg mx-auto">
          <Link to="/">
            <LogoFull height={28} />
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-secondary hover:text-accent transition-colors"
          >
            Esci
          </button>
        </div>
      </nav>

      <div className="max-w-screen-lg mx-auto px-5 py-8">
        <motion.div
          className="flex flex-col gap-8"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {/* Profile header */}
          <motion.div
            className="flex items-center gap-4"
            variants={itemVariants}
          >
            {avatar ? (
              <img
                src={avatar}
                alt={displayName}
                className="h-16 w-16 rounded-full object-cover shadow-md"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-xl font-bold text-white shadow-md">
                {initials || '?'}
              </div>
            )}
            <div>
              <h1
                className="text-xl font-bold text-primary"
                style={{ fontFamily: "'TAN Songbird', serif" }}
              >
                {displayName}
              </h1>
              <p className="text-sm text-secondary">{user?.email}</p>
            </div>
          </motion.div>

          {/* Saved restaurants section */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-lg font-semibold text-primary"
                style={{ fontFamily: "'TAN Songbird', serif" }}
              >
                I miei salvati
              </h2>
              {savedRestaurants.length > 0 && (
                <Link
                  to="/?filter=saved"
                  className="text-sm font-medium text-accent"
                >
                  Vedi sulla mappa
                </Link>
              )}
            </div>

            {loadingRestaurants ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-24 rounded-2xl" />
                ))}
              </div>
            ) : savedRestaurants.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-card p-10 text-center shadow-sm">
                <div className="mb-3 text-4xl">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-primary">
                  Non hai ancora salvato nessun posto!
                </p>
                <p className="mt-1 text-sm text-secondary">
                  Esplora la mappa e salva i ristoranti che ti incuriosiscono
                </p>
                <Link
                  to="/"
                  className="mt-5 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm"
                >
                  Esplora la mappa
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {savedRestaurants.map((restaurant, index) => (
                  <div key={restaurant.id} className="relative">
                    <RestaurantCard
                      restaurant={restaurant}
                      index={index}
                      onClick={() =>
                        navigate(
                          `/restaurant/${restaurant.slug || slugify(restaurant.name)}`
                        )
                      }
                    />
                    {/* Heart overlay */}
                    <div className="absolute top-3 right-3 z-10">
                      <SaveButton
                        saved={true}
                        onClick={() => toggleSave(restaurant.id)}
                        size="sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
