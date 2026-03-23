import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useUserDiscounts } from '../../lib/hooks/useDiscounts'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { LogoFull } from '../../components/UI/Logo'
import RestaurantCard from '../../components/Restaurant/RestaurantCard'
import SaveButton from '../../components/Restaurant/SaveButton'
import QRCodeDisplay from '../../components/Discount/QRCodeDisplay'

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
  const { redemptions, loading: discountsLoading } = useUserDiscounts(user?.id)
  const [savedRestaurants, setSavedRestaurants] = useState([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [showQR, setShowQR] = useState(null)

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

          {/* My discounts section */}
          <motion.div variants={itemVariants}>
            <h2
              className="text-lg font-semibold text-primary mb-4"
              style={{ fontFamily: "'TAN Songbird', serif" }}
            >
              I miei sconti
            </h2>

            {discountsLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2].map(i => (
                  <div key={i} className="skeleton h-28 rounded-2xl" />
                ))}
              </div>
            ) : redemptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-card p-8 text-center shadow-sm">
                <span className="text-3xl mb-2">🏷️</span>
                <p className="text-sm font-semibold text-primary">Nessuno sconto sbloccato</p>
                <p className="mt-1 text-xs text-secondary">
                  Scopri gli sconti esclusivi nella sezione dedicata
                </p>
                <Link
                  to="/deals"
                  className="mt-4 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm"
                >
                  Vedi sconti
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {redemptions.map(r => {
                  const discount = r.discount
                  const restaurant = discount?.restaurant
                  const photo = restaurant?.photos?.sort((a, b) => a.sort_order - b.sort_order)?.[0]
                  const isRedeemed = r.status === 'redeemed'
                  const isExpired = r.status === 'expired' || (discount?.valid_until && new Date(discount.valid_until) < new Date())

                  let statusBadge
                  if (isRedeemed) {
                    statusBadge = { text: 'Utilizzato', color: 'bg-gray-100 text-gray-600' }
                  } else if (isExpired) {
                    statusBadge = { text: 'Scaduto', color: 'bg-gray-100 text-gray-500' }
                  } else {
                    statusBadge = { text: 'Attivo', color: 'bg-green-100 text-green-700' }
                  }

                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm"
                    >
                      {/* Photo */}
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl">
                        {photo ? (
                          <img
                            src={photo.photo_url}
                            alt={restaurant?.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-gray-100 flex items-center justify-center text-2xl">
                            🍽️
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-primary truncate">
                          {restaurant?.name || 'Ristorante'}
                        </p>
                        <p className="text-sm font-semibold text-accent mt-0.5">
                          {discount?.discount_value}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge.color}`}>
                            {statusBadge.text}
                          </span>
                        </div>
                      </div>

                      {/* QR button */}
                      {!isRedeemed && !isExpired && (
                        <motion.button
                          onClick={() => setShowQR(r)}
                          className="flex-shrink-0 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white"
                          whileTap={{ scale: 0.95 }}
                        >
                          QR
                        </motion.button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
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

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQR && (
          <QRCodeDisplay
            qrCode={showQR.qr_code}
            discountTitle={showQR.discount?.title}
            discountValue={showQR.discount?.discount_value}
            onClose={() => setShowQR(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
