import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import Footer from '../../components/Layout/Footer'
import { LogoFull } from '../../components/UI/Logo'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { useAuth } from '../../lib/hooks/useAuth'
import { PRICE_LABELS } from '../../lib/hooks/useRestaurants'

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

export default function DealsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discounts, loading } = useActiveDiscounts()

  return (
    <div className="flex flex-col min-h-dvh bg-bg">
      {/* Header */}
      <nav className="sticky top-0 z-40 glass">
        <div className="flex items-center justify-between px-4 py-3 max-w-screen-lg mx-auto">
          <Link to="/">
            <LogoFull height={28} />
          </Link>
          <Link
            to={user ? '/profile' : '/login'}
            className="text-sm font-medium text-accent"
          >
            {user ? 'Profilo' : 'Accedi'}
          </Link>
        </div>
      </nav>

      <div className="flex-1 max-w-screen-lg mx-auto px-5 py-8">
        <motion.div
          className="flex flex-col gap-6"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {/* Title */}
          <motion.div variants={itemVariants}>
            <h1
              className="text-2xl font-bold text-primary"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Sconti esclusivi
            </h1>
            <p className="text-sm text-secondary mt-1">
              Sconti speciali nei ristoranti preferiti di Bi, solo per te
            </p>
          </motion.div>

          {/* CTA for non-logged users */}
          {!user && (
            <motion.div
              variants={itemVariants}
              className="rounded-2xl p-5"
              style={{ background: 'linear-gradient(135deg, #FFF0F0, #FFE0E0)' }}
            >
              <p className="text-sm font-semibold text-primary mb-2">
                Registrati per sbloccare gli sconti
              </p>
              <p className="text-xs text-secondary mb-3">
                Crea un account gratuito per accedere a sconti esclusivi nei migliori ristoranti di Torino
              </p>
              <Link
                to="/login"
                className="inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
              >
                Registrati gratis
              </Link>
            </motion.div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton h-48 rounded-2xl" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && discounts.length === 0 && (
            <motion.div
              variants={itemVariants}
              className="flex flex-col items-center justify-center rounded-2xl bg-card p-10 text-center shadow-sm"
            >
              <span className="text-4xl mb-3">🏷️</span>
              <p className="text-base font-semibold text-primary">
                Nessuno sconto attivo al momento
              </p>
              <p className="mt-1 text-sm text-secondary">
                Torna presto, Bi sta preparando nuove offerte!
              </p>
              <Link
                to="/"
                className="mt-5 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm"
              >
                Esplora i ristoranti
              </Link>
            </motion.div>
          )}

          {/* Deals list */}
          {!loading && discounts.length > 0 && (
            <div className="flex flex-col gap-4">
              {discounts.map((deal, index) => {
                const restaurant = deal.restaurant
                const photo = restaurant?.photos?.sort((a, b) => a.sort_order - b.sort_order)?.[0]
                const slug = restaurant?.slug || slugify(restaurant?.name || '')
                const validUntil = new Date(deal.valid_until).toLocaleDateString('it-IT', {
                  day: 'numeric',
                  month: 'long',
                })

                return (
                  <motion.div
                    key={deal.id}
                    variants={itemVariants}
                    className="overflow-hidden rounded-2xl bg-card shadow-sm"
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Photo + discount badge */}
                    <div
                      className="relative h-40 cursor-pointer"
                      onClick={() => navigate(`/restaurant/${slug}`)}
                    >
                      {photo ? (
                        <img
                          src={photo.photo_url}
                          alt={restaurant?.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gray-100 flex items-center justify-center text-4xl">
                          🍽️
                        </div>
                      )}
                      {/* Discount badge */}
                      <div className="absolute bottom-3 left-3 rounded-lg bg-accent px-3 py-1.5 shadow-md">
                        <span className="text-sm font-bold text-white">{deal.discount_value}</span>
                      </div>
                    </div>

                    {/* Info */}
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => navigate(`/restaurant/${slug}`)}
                    >
                      <h3 className="text-base font-bold text-primary">{restaurant?.name}</h3>
                      <p className="text-sm text-secondary mt-0.5">
                        {restaurant?.city} · {PRICE_LABELS[restaurant?.price_range] || ''}
                      </p>
                      <p className="text-sm font-medium text-accent mt-2">{deal.title}</p>
                      {deal.conditions && (
                        <p className="text-xs text-secondary mt-1">{deal.conditions}</p>
                      )}
                      <p className="text-xs text-secondary mt-2">
                        Valido fino al {validUntil}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>

      <Footer />
    </div>
  )
}
