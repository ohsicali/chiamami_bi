import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { useUserDiscounts } from '../../lib/hooks/useDiscounts'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { LogoFull } from '../../components/UI/Logo'
import Footer from '../../components/Layout/Footer'
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

/* ── Swipeable discount card ── */
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
        className={`relative rounded-2xl bg-card shadow-sm ${r.status === 'generated' ? 'cursor-pointer' : 'opacity-60'}`}
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -90, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onClick={() => r.status === 'generated' && onShowQR()}
      >
        <div className="flex items-center gap-3 p-3">
          {photo ? (
            <img src={photo} alt="" className="h-16 w-16 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-accent/10 text-2xl flex-shrink-0">🏷️</div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-primary truncate">{restaurant?.name || 'Ristorante'}</h3>
            <p className={`font-semibold text-sm ${r.status === 'redeemed' ? 'text-secondary line-through' : 'text-accent'}`}>{r.discount?.discount_value}</p>
            <p className="text-xs text-secondary truncate">{r.discount?.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                r.status === 'generated' ? 'bg-green-100 text-green-700' :
                r.status === 'redeemed' ? 'bg-gray-100 text-gray-500' :
                'bg-red-100 text-red-500'
              }`}>
                {r.status === 'generated' ? 'Attivo' :
                 r.status === 'redeemed' ? `✓ Utilizzato il ${new Date(r.redeemed_at || r.generated_at).toLocaleDateString('it-IT')}` :
                 'Scaduto'}
              </span>
            </div>
          </div>
          {r.status === 'generated' && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M9 18l6-6-6-6" />
            </svg>
          )}
        </div>
      </motion.div>
    </div>
  )
}

/* ── Delete Account Modal ── */
function DeleteAccountModal({ onConfirm, onClose }) {
  const [step, setStep] = useState(1) // 1 = "Sei sicuro?", 2 = "Digita ELIMINA"
  const [confirmText, setConfirmText] = useState('')

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="mx-4 w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        onClick={e => e.stopPropagation()}
      >
        {step === 1 ? (
          <>
            <div className="text-center mb-5">
              <span className="text-4xl">⚠️</span>
              <h3 className="text-lg font-bold text-primary mt-3" style={{ fontFamily: "'TAN Songbird', serif" }}>
                Sei sicuro?
              </h3>
              <p className="text-sm text-secondary mt-2">
                Tutti i tuoi dati verranno eliminati permanentemente: profilo, salvati, sconti e recensioni.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-secondary"
              >
                Annulla
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white"
              >
                Continua
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-5">
              <h3 className="text-lg font-bold text-red-600" style={{ fontFamily: "'TAN Songbird', serif" }}>
                Conferma cancellazione
              </h3>
              <p className="text-sm text-secondary mt-2">
                Digita <strong className="text-red-600">ELIMINA</strong> per confermare.
              </p>
            </div>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Digita ELIMINA"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-sm text-center font-semibold text-primary focus:border-red-400 focus:outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-secondary"
              >
                Annulla
              </button>
              <button
                onClick={onConfirm}
                disabled={confirmText !== 'ELIMINA'}
                className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Elimina account
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

/* ── Settings Section ── */
function SettingsSection({ user, profile, onLogout, onBack, onRefreshProfile }) {
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newsletterEnabled, setNewsletterEnabled] = useState(true)
  const [loadingNewsletter, setLoadingNewsletter] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [passwordMsg, setPasswordMsg] = useState(null)
  const navigate = useNavigate()

  // Check newsletter status
  useEffect(() => {
    if (!user?.email || !isSupabaseConfigured()) {
      setLoadingNewsletter(false)
      return
    }
    supabase
      .from('newsletter_subscribers')
      .select('id')
      .eq('email', user.email)
      .single()
      .then(({ data }) => {
        setNewsletterEnabled(!!data)
        setLoadingNewsletter(false)
      })
  }, [user?.email])

  const handleSaveName = async () => {
    if (!fullName.trim() || !isSupabaseConfigured()) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id)
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onRefreshProfile?.()
    }
  }

  const handleToggleNewsletter = async () => {
    if (!user?.email || !isSupabaseConfigured()) return
    const newState = !newsletterEnabled
    setNewsletterEnabled(newState)
    if (newState) {
      await supabase.from('newsletter_subscribers').upsert({ email: user.email, source: 'profile_toggle' }, { onConflict: 'email' })
    } else {
      await supabase.from('newsletter_subscribers').delete().eq('email', user.email)
    }
  }

  const handleChangePassword = async () => {
    setPasswordMsg(null)
    if (passwordForm.new.length < 6) {
      setPasswordMsg({ type: 'error', text: 'La password deve avere almeno 6 caratteri.' })
      return
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMsg({ type: 'error', text: 'Le password non coincidono.' })
      return
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new })
      if (error) throw error
      setPasswordMsg({ type: 'success', text: 'Password aggiornata!' })
      setPasswordForm({ current: '', new: '', confirm: '' })
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Errore nel cambio password.' })
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    try {
      await Promise.all([
        supabase.from('saved_restaurants').delete().eq('user_id', user.id),
        supabase.from('discount_redemptions').delete().eq('user_id', user.id),
        supabase.from('user_reviews').delete().eq('user_id', user.id),
        supabase.from('newsletter_subscribers').delete().eq('email', user.email),
        supabase.from('profiles').delete().eq('id', user.id),
      ])
      await onLogout()
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Account deletion failed:', err)
      alert('Errore durante la cancellazione. Contatta info@chiamamibi.com')
    }
  }

  const inputClasses = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-primary placeholder:text-gray-400 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors'

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col gap-6"
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-secondary self-start"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
        </svg>
        Torna al profilo
      </button>

      <h2 className="text-xl font-bold text-primary" style={{ fontFamily: "'TAN Songbird', serif" }}>
        Impostazioni
      </h2>

      {/* Edit name */}
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-primary mb-3">Nome</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className={inputClasses}
            placeholder="Il tuo nome"
          />
          <motion.button
            onClick={handleSaveName}
            disabled={saving || !fullName.trim()}
            className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white whitespace-nowrap disabled:opacity-50"
            whileTap={{ scale: 0.95 }}
          >
            {saved ? '✓' : saving ? '...' : 'Salva'}
          </motion.button>
        </div>
      </div>

      {/* Email (read-only) */}
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-primary mb-3">Email</h3>
        <input
          type="email"
          value={user?.email || ''}
          readOnly
          className={`${inputClasses} bg-gray-100 cursor-not-allowed`}
        />
        <p className="text-xs text-secondary mt-2">L'email non puo' essere modificata.</p>
      </div>

      {/* Change password */}
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-primary mb-3">Cambia password</h3>
        <div className="flex flex-col gap-3">
          <input
            type="password"
            value={passwordForm.new}
            onChange={e => setPasswordForm(p => ({ ...p, new: e.target.value }))}
            className={inputClasses}
            placeholder="Nuova password"
          />
          <input
            type="password"
            value={passwordForm.confirm}
            onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
            className={inputClasses}
            placeholder="Conferma password"
          />
          <motion.button
            onClick={handleChangePassword}
            disabled={!passwordForm.new || !passwordForm.confirm}
            className="rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
            whileTap={{ scale: 0.95 }}
          >
            Aggiorna password
          </motion.button>
          {passwordMsg && (
            <p className={`text-xs font-medium ${passwordMsg.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
              {passwordMsg.text}
            </p>
          )}
        </div>
      </div>

      {/* Newsletter toggle */}
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-primary">Newsletter</h3>
            <p className="text-xs text-secondary mt-0.5">Ricevi novita' e offerte esclusive</p>
          </div>
          <button
            onClick={handleToggleNewsletter}
            disabled={loadingNewsletter}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              newsletterEnabled ? 'bg-accent' : 'bg-gray-300'
            }`}
          >
            <motion.div
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm"
              animate={{ left: newsletterEnabled ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </div>

      {/* Delete account */}
      <button
        onClick={() => setShowDeleteModal(true)}
        className="w-full rounded-2xl bg-card py-4 text-sm font-medium text-red-500 shadow-sm text-left px-5 flex items-center gap-3"
      >
        <span className="text-base">🗑️</span>
        Cancella il mio account
      </button>

      {/* Delete modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <DeleteAccountModal
            onConfirm={handleDeleteAccount}
            onClose={() => setShowDeleteModal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ── Main Profile Page ── */
export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, signOut, refreshProfile } = useAuth()
  const { savedIds, toggleSave } = useSavedRestaurants(user?.id)
  const { redemptions, loading: discountsLoading } = useUserDiscounts(user?.id)
  const [savedRestaurants, setSavedRestaurants] = useState([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [showQR, setShowQR] = useState(null)
  const [localRedemptions, setLocalRedemptions] = useState([])
  const [activeTab, setActiveTab] = useState('saved') // 'saved' | 'discounts'
  const [discountSubTab, setDiscountSubTab] = useState('active') // 'active' | 'used'
  const [showSettings, setShowSettings] = useState(false)

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

  const handleDeleteRedemption = async (redemptionId) => {
    setLocalRedemptions(prev => prev.filter(r => r.id !== redemptionId))
    try {
      await supabase.from('discount_redemptions').delete().eq('id', redemptionId)
    } catch {
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

  const activeRedemptions = localRedemptions.filter(r => r.status === 'generated')
  const usedRedemptions = localRedemptions.filter(r => r.status === 'redeemed')

  return (
    <div className="min-h-dvh bg-bg">
      {/* Header bar */}
      <nav className="sticky top-0 z-40 glass">
        <div className="flex items-center justify-between px-4 py-3 max-w-screen-lg mx-auto">
          <button
            onClick={() => showSettings ? setShowSettings(false) : navigate(-1)}
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
        <AnimatePresence mode="wait">
          {showSettings ? (
            <SettingsSection
              key="settings"
              user={user}
              profile={profile}
              onLogout={signOut}
              onRefreshProfile={refreshProfile}
              onBack={() => setShowSettings(false)}
            />
          ) : (
            <motion.div
              key="profile"
              className="flex flex-col gap-6"
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
                <div className="flex-1">
                  <h1
                    className="text-xl font-bold text-primary"
                    style={{ fontFamily: "'TAN Songbird', serif" }}
                  >
                    {displayName}
                  </h1>
                  <p className="text-sm text-secondary">{user?.email}</p>
                </div>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                  aria-label="Impostazioni"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>
              </motion.div>

              {/* Main tabs: Salvati / Sconti */}
              <motion.div variants={itemVariants} className="flex gap-2">
                <button
                  onClick={() => setActiveTab('saved')}
                  className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
                    activeTab === 'saved'
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-card text-secondary shadow-sm'
                  }`}
                >
                  ❤️ Salvati ({savedRestaurants.length})
                </button>
                <button
                  onClick={() => setActiveTab('discounts')}
                  className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
                    activeTab === 'discounts'
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-card text-secondary shadow-sm'
                  }`}
                >
                  🏷️ Sconti ({localRedemptions.length})
                </button>
              </motion.div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                {activeTab === 'saved' ? (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-primary" style={{ fontFamily: "'TAN Songbird', serif" }}>
                        I miei salvati
                      </h2>
                      {savedRestaurants.length > 0 && (
                        <Link to="/?filter=saved" className="text-sm font-medium text-accent">
                          Vedi sulla mappa
                        </Link>
                      )}
                    </div>

                    {loadingRestaurants ? (
                      <div className="flex flex-col gap-3">
                        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
                      </div>
                    ) : savedRestaurants.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl bg-card p-10 text-center shadow-sm">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                        </svg>
                        <p className="text-base font-semibold text-primary mt-3">Non hai ancora salvato nessun posto!</p>
                        <p className="mt-1 text-sm text-secondary">Esplora la mappa e salva i ristoranti che ti incuriosiscono</p>
                        <Link to="/" className="mt-5 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm">
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
                              onClick={() => navigate(`/restaurant/${restaurant.slug || slugify(restaurant.name)}`)}
                            />
                            <div className="absolute top-3 right-3 z-10">
                              <SaveButton saved={true} onClick={() => toggleSave(restaurant.id)} size="sm" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="discounts"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    {/* Sub-tabs: Attivi / Utilizzati */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setDiscountSubTab('active')}
                        className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                          discountSubTab === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-secondary'
                        }`}
                      >
                        Attivi ({activeRedemptions.length})
                      </button>
                      <button
                        onClick={() => setDiscountSubTab('used')}
                        className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                          discountSubTab === 'used'
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-gray-100 text-secondary'
                        }`}
                      >
                        Utilizzati ({usedRedemptions.length})
                      </button>
                    </div>

                    {discountsLoading ? (
                      <div className="flex flex-col gap-3">
                        {[1, 2].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
                      </div>
                    ) : (
                      <>
                        {discountSubTab === 'active' ? (
                          activeRedemptions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl bg-card p-8 text-center shadow-sm">
                              <span className="text-3xl mb-2">🏷️</span>
                              <p className="text-sm font-semibold text-primary">Nessuno sconto attivo</p>
                              <p className="mt-1 text-xs text-secondary">Scopri gli sconti esclusivi nella sezione dedicata</p>
                              <Link to="/deals" className="mt-4 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm">
                                Vedi sconti
                              </Link>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {activeRedemptions.map(r => (
                                <SwipeableRedemptionCard
                                  key={r.id}
                                  redemption={r}
                                  onShowQR={() => setShowQR(r)}
                                  onDelete={handleDeleteRedemption}
                                />
                              ))}
                            </div>
                          )
                        ) : (
                          usedRedemptions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl bg-card p-8 text-center shadow-sm">
                              <span className="text-3xl mb-2">✅</span>
                              <p className="text-sm font-semibold text-primary">Nessuno sconto utilizzato</p>
                              <p className="mt-1 text-xs text-secondary">I tuoi sconti riscattati appariranno qui</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {usedRedemptions.map(r => (
                                <SwipeableRedemptionCard
                                  key={r.id}
                                  redemption={r}
                                  onShowQR={() => {}}
                                  onDelete={handleDeleteRedemption}
                                />
                              ))}
                            </div>
                          )
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Logout button */}
              <motion.div variants={itemVariants} className="pt-2 pb-4">
                <button
                  onClick={handleLogout}
                  className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-500 transition-colors hover:bg-red-100"
                >
                  Esci dall'account
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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

      <Footer />
    </div>
  )
}
