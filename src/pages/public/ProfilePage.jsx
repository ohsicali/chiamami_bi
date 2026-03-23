import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
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

function SwipeableRedemptionCard({ redemption: r, onShowQR, onDelete }) {
  const x = useMotionValue(0)
  const deleteOpacity = useTransform(x, [-120, -60], [1, 0])
  const deleteScale = useTransform(x, [-120, -60], [1, 0.8])
  const restaurant = r.discount?.restaurant
  const photo = restaurant?.photos?.[0]?.photo_url

  const handleDragEnd = (_, info) => {
    if (info.offset.x < -80) {
      animate(x, -90, { type: 'spring', stiffness: 400, damping: 30 })
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
    }
  }

  const handleDeleteClick = () => {
    animate(x, -300, { duration: 0.2 }).then(() => onDelete(r.id))
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete button behind */}
      <motion.div
        className="absolute right-0 inset-y-0 flex items-center justify-center w-24 bg-red-500 rounded-2xl"
        style={{ opacity: deleteOpacity, scale: deleteScale }}
      >
        <button onClick={handleDeleteClick} className="flex flex-col items-center gap-1 text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          <span className="text-xs font-semibold">Elimina</span>
        </button>
      </motion.div>

      {/* Swipeable card */}
      <motion.div
        className="relative rounded-2xl bg-card shadow-sm cursor-pointer"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -90, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onClick={() => onShowQR()}
      >
        <div className="flex items-center gap-3 p-3">
          {photo ? (
            <img src={photo} alt="" className="h-16 w-16 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-accent/10 text-2xl flex-shrink-0">🏷️</div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-primary truncate">{restaurant?.name || 'Ristorante'}</h3>
            <p className="text-accent font-semibold text-sm">{r.discount?.discount_value}</p>
            <p className="text-xs text-secondary truncate">{r.discount?.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                r.status === 'generated' ? 'bg-green-100 text-green-700' :
                r.status === 'redeemed' ? 'bg-gray-100 text-gray-500' :
                'bg-red-100 text-red-500'
              }`}>
                {r.status === 'generated' ? 'Attivo' : r.status === 'redeemed' ? 'Usato' : 'Scaduto'}
              </span>
              <span className="text-[10px] text-secondary">
                {new Date(r.generated_at).toLocaleDateString('it-IT')}
              </span>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </motion.div>
    </div>
  )
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const { savedIds, toggleSave } = useSavedRestaurants(user?.id)
  const { redemptions, loading: discountsLoading } = useUserDiscounts(user?.id)
  const [savedRestaurants, setSavedRestaurants] = useState([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [showQR, setShowQR] = useState(null)
  const [localRedemptions, setLocalRedemptions] = useState([])

  // Sync localRedemptions with fetched data
  useEffect(() => {
    setLocalRedemptions(redemptions)
  }, [redemptions])

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

  const handleDownloadData = async () => {
    if (!user) return
    const [
      { data: profileData },
      { data: savedData },
      { data: redemptionData },
      { data: reviewData },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('saved_restaurants').select('*, restaurant:restaurants(name)').eq('user_id', user.id),
      supabase.from('discount_redemptions').select('*, discount:discounts(title, discount_value)').eq('user_id', user.id),
      supabase.from('user_reviews').select('*, restaurant:restaurants(name)').eq('user_id', user.id),
    ])
    const exportData = {
      profile: profileData,
      email: user.email,
      saved_restaurants: savedData || [],
      discount_redemptions: redemptionData || [],
      reviews: reviewData || [],
      exported_at: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chiamamibi-dati-${user.email}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    const confirmed = window.confirm('Sei sicuro di voler cancellare il tuo account? Tutti i tuoi dati verranno eliminati permanentemente.')
    if (!confirmed) return
    const doubleConfirm = window.confirm('Questa azione è irreversibile. Confermi la cancellazione?')
    if (!doubleConfirm) return
    try {
      // Delete user data
      await Promise.all([
        supabase.from('saved_restaurants').delete().eq('user_id', user.id),
        supabase.from('discount_redemptions').delete().eq('user_id', user.id),
        supabase.from('user_reviews').delete().eq('user_id', user.id),
        supabase.from('newsletter_subscribers').delete().eq('email', user.email),
        supabase.from('profiles').delete().eq('id', user.id),
      ])
      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Account deletion failed:', err)
      alert('Errore durante la cancellazione. Contatta info@chiamamibi.com')
    }
  }

  const handleDeleteRedemption = async (redemptionId) => {
    // Optimistic UI update
    setLocalRedemptions(prev => prev.filter(r => r.id !== redemptionId))
    try {
      await supabase.from('discount_redemptions').delete().eq('id', redemptionId)
    } catch (err) {
      console.error('Failed to delete redemption:', err)
      // Revert on failure
      setLocalRedemptions(redemptions)
    }
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
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Indietro"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <Link to="/">
            <LogoFull height={28} />
          </Link>
          <div className="w-10" />
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
            ) : localRedemptions.length === 0 ? (
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
                {localRedemptions.map(r => (
                  <SwipeableRedemptionCard
                    key={r.id}
                    redemption={r}
                    onShowQR={() => setShowQR(r)}
                    onDelete={handleDeleteRedemption}
                  />
                ))}
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

          {/* GDPR / Account management */}
          <motion.div variants={itemVariants}>
            <h2
              className="text-lg font-semibold text-primary mb-4"
              style={{ fontFamily: "'TAN Songbird', serif" }}
            >
              Il tuo account
            </h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDownloadData}
                className="w-full rounded-xl bg-card py-3 text-sm font-medium text-primary shadow-sm text-left px-4 flex items-center gap-3"
              >
                <span className="text-base">📥</span>
                Scarica i miei dati
              </button>
              <button
                onClick={handleDeleteAccount}
                className="w-full rounded-xl bg-card py-3 text-sm font-medium text-red-500 shadow-sm text-left px-4 flex items-center gap-3"
              >
                <span className="text-base">🗑️</span>
                Cancella il mio account
              </button>
            </div>
          </motion.div>

          {/* Logout button at bottom */}
          <motion.div variants={itemVariants} className="pt-2 pb-4">
            <button
              onClick={handleLogout}
              className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-500 transition-colors hover:bg-red-100"
            >
              Esci dall'account
            </button>
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
