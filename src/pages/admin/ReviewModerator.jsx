import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useAllReviews } from '../../lib/hooks/useReviews'
import AdminLayout from '../../components/Layout/AdminLayout'

function timeAgo(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffDays = Math.floor((now - date) / 86400000)
  if (diffDays < 1) return 'Oggi'
  if (diffDays === 1) return 'Ieri'
  if (diffDays < 7) return `${diffDays} giorni fa`
  return new Date(dateStr).toLocaleDateString('it-IT')
}

export default function ReviewModerator() {
  const { user, loading: authLoading } = useAuth()
  const { reviews, loading, updateStatus, deleteReview } = useAllReviews()
  const [tab, setTab] = useState('pending')
  const [actionLoading, setActionLoading] = useState(null)

  const pending = reviews.filter(r => r.status !== 'published' && r.status !== 'rejected')
  const published = reviews.filter(r => r.status === 'published')
  const rejected = reviews.filter(r => r.status === 'rejected')

  const currentList = tab === 'pending' ? pending : tab === 'published' ? published : rejected

  const handleApprove = async (id) => {
    setActionLoading(id)
    await updateStatus(id, 'published')
    setActionLoading(null)
  }

  const handleReject = async (id) => {
    setActionLoading(id)
    await updateStatus(id, 'rejected')
    setActionLoading(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questa recensione?')) return
    setActionLoading(id)
    await deleteReview(id)
    setActionLoading(null)
  }

  if (authLoading || loading) return null

  return (
    <AdminLayout title="Recensioni">
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary" style={{ fontFamily: "'TAN Songbird', serif" }}>
          Moderazione Recensioni
        </h1>
        <p className="text-sm text-secondary mt-0.5">
          {pending.length} da moderare · {published.length} pubblicate · {rejected.length} rifiutate
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'pending', label: 'Da moderare', count: pending.length, color: 'bg-amber-100 text-amber-700' },
          { key: 'published', label: 'Pubblicate', count: published.length, color: 'bg-green-100 text-green-700' },
          { key: 'rejected', label: 'Rifiutate', count: rejected.length, color: 'bg-red-100 text-red-600' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-accent text-white' : 'bg-gray-100 text-secondary'
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
              tab === t.key ? 'bg-white/20 text-white' : t.color
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Reviews list */}
      {currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-card p-10 text-center shadow-sm">
          <span className="text-4xl mb-3">
            {tab === 'pending' ? '✅' : tab === 'published' ? '💬' : '🗑️'}
          </span>
          <p className="text-base font-semibold text-primary">
            {tab === 'pending' ? 'Nessuna recensione da moderare' : tab === 'published' ? 'Nessuna recensione pubblicata' : 'Nessuna recensione rifiutata'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {currentList.map(review => (
            <motion.div
              key={review.id}
              className="rounded-2xl bg-card p-4 shadow-sm"
              layout
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {review.user?.avatar_url ? (
                    <img
                      src={review.user.avatar_url}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600 flex-shrink-0">
                      {(review.user?.full_name || '?')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">
                      {review.user?.full_name || review.user?.email || 'Utente'}
                    </p>
                    <p className="text-xs text-secondary">
                      {review.restaurant?.name} · {timeAgo(review.created_at)}
                    </p>
                  </div>
                </div>

                {/* Status badge */}
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  review.status === 'published' ? 'bg-green-100 text-green-700' :
                  review.status === 'rejected' ? 'bg-red-100 text-red-600' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {review.status === 'published' ? 'Pubblicata' :
                   review.status === 'rejected' ? 'Rifiutata' : 'In attesa'}
                </span>
              </div>

              {/* Comment */}
              <p className="text-sm leading-relaxed text-primary mb-2">
                {review.comment}
              </p>

              {/* AI reason if present */}
              {review.ai_reason && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 mb-2">
                  <p className="text-xs text-amber-800">
                    <strong>AI:</strong> {review.ai_sentiment} — {review.ai_reason}
                  </p>
                </div>
              )}

              {/* Photos */}
              {review.photos?.length > 0 && (
                <div className="flex gap-2 mb-3">
                  {review.photos.map(photo => (
                    <img
                      key={photo.id}
                      src={photo.photo_url}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {review.status !== 'published' && review.status !== 'rejected' && (
                  <>
                    <motion.button
                      onClick={() => handleApprove(review.id)}
                      disabled={actionLoading === review.id}
                      className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 disabled:opacity-50"
                      whileTap={{ scale: 0.95 }}
                    >
                      ✅ Approva
                    </motion.button>
                    <motion.button
                      onClick={() => handleReject(review.id)}
                      disabled={actionLoading === review.id}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 disabled:opacity-50"
                      whileTap={{ scale: 0.95 }}
                    >
                      ❌ Rifiuta
                    </motion.button>
                  </>
                )}
                {review.status === 'published' && (
                  <motion.button
                    onClick={() => handleReject(review.id)}
                    disabled={actionLoading === review.id}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 disabled:opacity-50"
                    whileTap={{ scale: 0.95 }}
                  >
                    Rimuovi
                  </motion.button>
                )}
                {review.status === 'rejected' && (
                  <>
                    <motion.button
                      onClick={() => handleApprove(review.id)}
                      disabled={actionLoading === review.id}
                      className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 disabled:opacity-50"
                      whileTap={{ scale: 0.95 }}
                    >
                      Ripristina
                    </motion.button>
                    <motion.button
                      onClick={() => handleDelete(review.id)}
                      disabled={actionLoading === review.id}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 disabled:opacity-50"
                      whileTap={{ scale: 0.95 }}
                    >
                      Elimina
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
    </AdminLayout>
  )
}
