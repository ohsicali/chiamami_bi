import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { submitReview, compressImage } from '../../lib/hooks/useReviews'

export default function ReviewForm({ restaurantId, userId, existingReview, onSubmitted }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(existingReview?.rating || 0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState(existingReview?.comment || '')
  const [photos, setPhotos] = useState([])
  const [previews, setPreviews] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const maxChars = 500

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const compressed = await Promise.all(
      files.slice(0, 4 - photos.length).map(f => compressImage(f))
    )

    setPhotos(prev => [...prev, ...compressed])

    // Generate previews
    compressed.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setPreviews(prev => [...prev, ev.target.result])
      }
      reader.readAsDataURL(file)
    })
  }

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!comment.trim() || comment.length > maxChars || rating === 0) return

    setSubmitting(true)
    setError(null)

    try {
      await submitReview({
        restaurantId,
        userId,
        rating,
        comment: comment.trim(),
        photoFiles: photos,
      })
      setSuccess(true)
      setOpen(false)
      setComment('')
      setPhotos([])
      setPreviews([])
      onSubmitted?.()
    } catch (err) {
      setError(t('restaurant.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  // Success feedback
  if (success) {
    return (
      <motion.div
        className="rounded-xl bg-green-50 p-4 text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <p className="text-sm font-semibold text-green-700">
          {existingReview ? t('restaurant.reviewUpdated') : t('restaurant.reviewPublished')}
        </p>
      </motion.div>
    )
  }

  return (
    <div>
      {/* Toggle button */}
      {!open && (
        <motion.button
          onClick={() => setOpen(true)}
          className="w-full rounded-xl bg-accent/10 py-3 text-sm font-semibold text-accent"
          whileTap={{ scale: 0.97 }}
        >
          {existingReview ? `✏️ ${t('restaurant.editReview')}` : `💬 ${t('restaurant.writeReview')}`}
        </motion.button>
      )}

      {/* Form */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-sm"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {/* Rating stars */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-2xl transition-transform hover:scale-110"
                >
                  <span className={star <= (hoverRating || rating) ? 'text-yellow-400' : 'text-gray-300'}>
                    ★
                  </span>
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-xs text-secondary">{rating}/5</span>
              )}
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value.slice(0, maxChars))}
                placeholder={t('restaurant.tellYourExperience')}
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-primary resize-none focus:border-accent focus:outline-none"
              />
              <span className={`absolute bottom-2 right-3 text-[11px] ${
                comment.length > maxChars * 0.9 ? 'text-red-400' : 'text-secondary'
              }`}>
                {comment.length}/{maxChars}
              </span>
            </div>

            {/* Photo previews */}
            {previews.length > 0 && (
              <div className="flex gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative">
                    <img
                      src={src}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Add photo */}
              {photos.length < 4 && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-secondary"
                  >
                    📷 {t('restaurant.photo')}
                  </button>
                </>
              )}

              <div className="flex-1" />

              {/* Cancel */}
              <button
                onClick={() => { setOpen(false); setComment(existingReview?.comment || ''); setPhotos([]); setPreviews([]) }}
                className="rounded-lg px-3 py-2 text-xs font-medium text-secondary"
              >
                {t('restaurant.cancel')}
              </button>

              {/* Submit */}
              <motion.button
                onClick={handleSubmit}
                disabled={!comment.trim() || rating === 0 || submitting}
                className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                whileTap={{ scale: 0.95 }}
              >
                {submitting ? '...' : t('restaurant.publish')}
              </motion.button>
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
