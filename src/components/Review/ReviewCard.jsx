import { motion } from 'framer-motion'

function timeAgo(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffMins < 1) return 'Adesso'
  if (diffMins < 60) return `${diffMins} min fa`
  if (diffHours < 24) return `${diffHours} or${diffHours === 1 ? 'a' : 'e'} fa`
  if (diffDays < 7) return `${diffDays} giorn${diffDays === 1 ? 'o' : 'i'} fa`
  if (diffWeeks < 5) return `${diffWeeks} settiman${diffWeeks === 1 ? 'a' : 'e'} fa`
  return `${diffMonths} mes${diffMonths === 1 ? 'e' : 'i'} fa`
}

export default function ReviewCard({ review }) {
  const user = review.user
  const photos = (review.photos || []).sort((a, b) => a.sort_order - b.sort_order)
  const initials = (user?.full_name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <motion.div
      className="rounded-xl bg-card/60 p-3.5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header: avatar + name + time */}
      <div className="flex items-center gap-2.5 mb-2">
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.full_name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary truncate">
            {user?.full_name || 'Utente'}
          </p>
          <p className="text-[11px] text-secondary">
            {timeAgo(review.created_at)}
          </p>
        </div>
      </div>

      {/* Comment */}
      <p className="text-sm leading-relaxed text-secondary">
        {review.comment}
      </p>

      {/* Photos */}
      {photos.length > 0 && (
        <div
          className="flex gap-2 mt-2.5 overflow-x-auto -mx-1 px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {photos.map(photo => (
            <img
              key={photo.id}
              src={photo.photo_url}
              alt=""
              className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}
