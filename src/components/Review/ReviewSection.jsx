import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useRestaurantReviews, useUserReview } from '../../lib/hooks/useReviews'
import { useAuth } from '../../lib/hooks/useAuth'
import ReviewCard from './ReviewCard'
import ReviewForm from './ReviewForm'

export default function ReviewSection({ restaurantId }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { reviews, loading, refetch } = useRestaurantReviews(restaurantId)
  const { review: userReview } = useUserReview(restaurantId, user?.id)
  const [showAll, setShowAll] = useState(false)

  const displayedReviews = showAll ? reviews : reviews.slice(0, 3)
  const hasMore = reviews.length > 3

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-primary">
          La community dice
        </h2>
        {reviews.length > 0 && (
          <span className="text-xs text-secondary">
            {reviews.length} recension{reviews.length === 1 ? 'e' : 'i'}
          </span>
        )}
      </div>

      {/* Review form / CTA */}
      {user ? (
        <ReviewForm
          restaurantId={restaurantId}
          userId={user.id}
          existingReview={userReview}
          onSubmitted={refetch}
        />
      ) : (
        <motion.button
          onClick={() => navigate('/login', { state: { from: window.location.pathname } })}
          className="rounded-xl bg-accent/10 py-3 text-sm font-semibold text-accent"
          whileTap={{ scale: 0.97 }}
        >
          Registrati per lasciare una recensione
        </motion.button>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-2">
          {[1, 2].map(i => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      )}

      {/* Reviews list */}
      {!loading && reviews.length === 0 && (
        <div className="rounded-xl bg-card/40 p-6 text-center">
          <p className="text-sm text-secondary">
            Nessuno ha ancora detto la sua! Sei stato qui? Sii il primo a raccontarlo
          </p>
        </div>
      )}

      {!loading && reviews.length > 0 && (
        <div className="flex flex-col gap-2">
          {displayedReviews.map(review => (
            <ReviewCard key={review.id} review={review} />
          ))}

          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm font-medium text-accent text-center py-2"
            >
              Mostra tutte ({reviews.length})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
