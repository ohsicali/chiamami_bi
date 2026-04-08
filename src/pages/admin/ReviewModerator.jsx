import { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useAllReviews } from '../../lib/hooks/useReviews'
import AdminLayout from '../../components/Layout/AdminLayout'

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Oggi'
  if (days === 1) return 'Ieri'
  if (days < 7) return `${days}gg fa`
  if (days < 30) return `${Math.floor(days / 7)}sett fa`
  return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

function StatCard({ label, value, color = '#1a1a1f' }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #eee',
      borderRadius: 12,
      padding: '16px 18px',
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 11, color: '#999', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 6 }}>
        {value}
      </div>
    </div>
  )
}

function Stars({ rating }) {
  return (
    <div style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= rating ? '#f59e0b' : '#e5e5e5', fontSize: 13 }}>★</span>
      ))}
    </div>
  )
}

export default function ReviewModerator() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { reviews, loading, fetchError, updateStatus, deleteReview } = useAllReviews()
  const [tab, setTab] = useState('pending')
  const [actionLoading, setActionLoading] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const { pending, published, rejected } = useMemo(() => ({
    pending: reviews.filter(r => r.status !== 'published' && r.status !== 'rejected'),
    published: reviews.filter(r => r.status === 'published'),
    rejected: reviews.filter(r => r.status === 'rejected'),
  }), [reviews])

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

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setActionLoading(deleteConfirm.id)
    await deleteReview(deleteConfirm.id)
    setDeleteConfirm(null)
    setActionLoading(null)
  }

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Recensioni">
      <div style={{ padding: '20px 28px', fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1f', margin: 0 }}>Recensioni</h1>
          <p style={{ fontSize: 13, color: '#999', margin: '4px 0 0' }}>
            Modera le recensioni pubblicate dagli utenti
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatCard label="Da moderare" value={pending.length} color="#b45309" />
          <StatCard label="Pubblicate" value={published.length} color="#059669" />
          <StatCard label="Rifiutate" value={rejected.length} color="#999" />
          <StatCard label="Totali" value={reviews.length} />
        </div>

        {/* Error banner */}
        {fetchError && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', margin: 0 }}>
              Errore caricamento recensioni
            </p>
            <p style={{ fontSize: 12, color: '#991b1b', margin: '2px 0 0' }}>{fetchError}</p>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { key: 'pending', label: 'Da moderare', count: pending.length },
            { key: 'published', label: 'Pubblicate', count: published.length },
            { key: 'rejected', label: 'Rifiutate', count: rejected.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '9px 14px',
                borderRadius: 10,
                border: '1px solid',
                borderColor: tab === t.key ? '#1a1a1f' : '#e5e5e5',
                background: tab === t.key ? '#1a1a1f' : '#fff',
                color: tab === t.key ? '#fff' : '#1a1a1f',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {t.label}
              <span style={{
                background: tab === t.key ? 'rgba(255,255,255,0.2)' : '#f3f3f3',
                color: tab === t.key ? '#fff' : '#666',
                borderRadius: 10,
                padding: '2px 7px',
                fontSize: 10,
                fontWeight: 700,
              }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999', fontSize: 13 }}>
            Caricamento...
          </div>
        ) : currentList.length === 0 ? (
          <div style={{
            background: '#fff',
            border: '1px solid #eee',
            borderRadius: 12,
            padding: 60,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>
              {tab === 'pending' ? 'Nessuna recensione da moderare' :
               tab === 'published' ? 'Nessuna recensione pubblicata' :
               'Nessuna recensione rifiutata'}
            </p>
            <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
              Le nuove recensioni appariranno qui
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentList.map(review => (
              <motion.div
                key={review.id}
                layout
                style={{
                  background: '#fff',
                  border: '1px solid #eee',
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                {/* Header: user + status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    {review.user?.avatar_url ? (
                      <img
                        src={review.user.avatar_url}
                        alt=""
                        style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: '#f3f3f3', color: '#666',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, flexShrink: 0,
                      }}>
                        {(review.user?.full_name || review.user?.email || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {review.user?.full_name || review.user?.email || 'Utente'}
                      </div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {review.restaurant?.name || '—'} · {timeAgo(review.created_at)}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 9px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    background: review.status === 'published' ? '#ecfdf5' : review.status === 'rejected' ? '#f3f3f3' : '#fef3c7',
                    color: review.status === 'published' ? '#059669' : review.status === 'rejected' ? '#666' : '#b45309',
                    flexShrink: 0,
                  }}>
                    {review.status === 'published' ? 'Pubblicata' :
                     review.status === 'rejected' ? 'Rifiutata' : 'In attesa'}
                  </span>
                </div>

                {/* Rating */}
                {review.rating != null && (
                  <div style={{ marginBottom: 8 }}>
                    <Stars rating={review.rating} />
                  </div>
                )}

                {/* Comment */}
                {review.comment && (
                  <p style={{ fontSize: 13, lineHeight: 1.55, color: '#1a1a1f', margin: '0 0 12px' }}>
                    {review.comment}
                  </p>
                )}

                {/* AI reason */}
                {review.ai_reason && (
                  <div style={{
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: 8,
                    padding: '8px 12px',
                    marginBottom: 12,
                  }}>
                    <p style={{ fontSize: 11, color: '#b45309', margin: 0 }}>
                      <strong>AI ({review.ai_sentiment}):</strong> {review.ai_reason}
                    </p>
                  </div>
                )}

                {/* Photos */}
                {review.photos?.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {review.photos.map(photo => (
                      <img
                        key={photo.id}
                        src={photo.photo_url}
                        alt=""
                        style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', border: '1px solid #eee' }}
                      />
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #f3f3f3' }}>
                  {review.status !== 'published' && (
                    <button
                      onClick={() => handleApprove(review.id)}
                      disabled={actionLoading === review.id}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#ecfdf5',
                        color: '#059669',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        opacity: actionLoading === review.id ? 0.5 : 1,
                      }}
                    >
                      Approva
                    </button>
                  )}
                  {review.status !== 'rejected' && (
                    <button
                      onClick={() => handleReject(review.id)}
                      disabled={actionLoading === review.id}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#fef3c7',
                        color: '#b45309',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        opacity: actionLoading === review.id ? 0.5 : 1,
                      }}
                    >
                      {review.status === 'published' ? 'Rimuovi' : 'Rifiuta'}
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteConfirm(review)}
                    disabled={actionLoading === review.id}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#fef2f2',
                      color: '#dc2626',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      marginLeft: 'auto',
                      opacity: actionLoading === review.id ? 0.5 : 1,
                    }}
                  >
                    Elimina
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Delete confirm modal */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 20,
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  padding: 24,
                  maxWidth: 400,
                  width: '100%',
                  border: '1px solid #eee',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1f', margin: 0 }}>
                  Eliminare recensione?
                </h3>
                <p style={{ fontSize: 13, color: '#666', margin: '8px 0 20px' }}>
                  Questa azione non è reversibile. La recensione verrà rimossa definitivamente.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 10,
                      border: '1px solid #e5e5e5',
                      background: '#fff',
                      color: '#1a1a1f',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleDelete}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#dc2626',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Elimina
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  )
}
