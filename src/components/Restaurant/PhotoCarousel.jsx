import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDrag } from '@use-gesture/react'

const swipeThreshold = 50

export default function PhotoCarousel({ photos = [], height = '300px', restaurantName = '', city = '' }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [loadedImages, setLoadedImages] = useState({})
  const [direction, setDirection] = useState(0)
  const containerRef = useRef(null)

  const normalizedPhotos = photos.map((p) =>
    typeof p === 'string' ? { photo_url: p, caption: '' } : p
  )

  const hasPhotos = normalizedPhotos.length > 0

  const goTo = useCallback(
    (newIndex, dir) => {
      if (newIndex < 0 || newIndex >= normalizedPhotos.length) return
      setDirection(dir)
      setCurrentIndex(newIndex)
    },
    [normalizedPhotos.length]
  )

  const bind = useDrag(
    ({ down, movement: [mx], velocity: [vx], direction: [dx], cancel }) => {
      if (down) {
        setDragX(mx)
        return
      }

      setDragX(0)

      const swipedLeft = mx < -swipeThreshold || (vx > 0.3 && dx < 0)
      const swipedRight = mx > swipeThreshold || (vx > 0.3 && dx > 0)

      if (swipedLeft && currentIndex < normalizedPhotos.length - 1) {
        goTo(currentIndex + 1, 1)
      } else if (swipedRight && currentIndex > 0) {
        goTo(currentIndex - 1, -1)
      }
    },
    { axis: 'x', filterTaps: true }
  )

  const handleImageLoad = useCallback((index) => {
    setLoadedImages((prev) => ({ ...prev, [index]: true }))
  }, [])

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  if (!hasPhotos) {
    return (
      <div
        className="flex w-full items-center justify-center bg-accent-light"
        style={{ height }}
      >
        <div className="flex flex-col items-center gap-2 text-secondary">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7h18a1 1 0 011 1v11a2 2 0 01-2 2H4a2 2 0 01-2-2V8a1 1 0 011-1z" />
            <path d="M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2" />
            <circle cx="12" cy="14" r="3" />
          </svg>
          <span className="text-sm">Nessuna foto</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full select-none" style={{ height }}>
      {/* Images */}
      <div
        ref={containerRef}
        {...bind()}
        className="relative h-full w-full overflow-hidden touch-pan-y"
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-0"
          >
            {/* Placeholder background */}
            <div className="absolute inset-0 skeleton" />

            <img
              src={normalizedPhotos[currentIndex].photo_url}
              alt={normalizedPhotos[currentIndex].caption || `${restaurantName}${city ? ` - ${city}` : ''}${normalizedPhotos.length > 1 ? ` - Foto ${currentIndex + 1}` : ''}`}
              loading={currentIndex === 0 ? 'eager' : 'lazy'}
              onLoad={() => handleImageLoad(currentIndex)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                loadedImages[currentIndex] ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                transform: `translateX(${dragX * 0.1}px)`,
              }}
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      {normalizedPhotos.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
          {normalizedPhotos.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > currentIndex ? 1 : -1)}
              className="h-2 rounded-full transition-all duration-300 ease-out"
              style={{
                width: i === currentIndex ? 24 : 8,
                backgroundColor: i === currentIndex ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.5)',
              }}
              aria-label={`Go to photo ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Photo counter */}
      {normalizedPhotos.length > 1 && (
        <div className="absolute top-3 right-3 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {currentIndex + 1}/{normalizedPhotos.length}
        </div>
      )}
    </div>
  )
}
