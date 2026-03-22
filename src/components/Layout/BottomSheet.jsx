import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'
import { useDrag } from '@use-gesture/react'

export const SNAP_PEEK = 0
export const SNAP_HALF = 1
export const SNAP_FULL = 2

function getSnapPoints() {
  const h = typeof window !== 'undefined' ? window.innerHeight : 800
  return [
    h - 80,    // PEEK: sheet peeks 80px from bottom
    h * 0.5,   // HALF: 50vh from top
    h * 0.1,   // FULL: 90vh visible (10% from top)
  ]
}

function closestSnap(y, points) {
  let minDist = Infinity
  let idx = 0
  for (let i = 0; i < points.length; i++) {
    const d = Math.abs(y - points[i])
    if (d < minDist) {
      minDist = d
      idx = i
    }
  }
  return idx
}

export default function BottomSheet({ children, onSnapChange }) {
  const [snapIndex, setSnapIndex] = useState(SNAP_PEEK)
  const [snapPoints, setSnapPoints] = useState(getSnapPoints)
  const y = useMotionValue(snapPoints[SNAP_PEEK])
  const contentRef = useRef(null)
  const sheetRef = useRef(null)
  const isDragging = useRef(false)

  // Recalculate snap points on resize
  useEffect(() => {
    function handleResize() {
      const pts = getSnapPoints()
      setSnapPoints(pts)
      // Re-snap to current position
      animate(y, pts[snapIndex], {
        type: 'spring',
        stiffness: 400,
        damping: 35,
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [snapIndex, y])

  const snapTo = useCallback(
    (index) => {
      const clamped = Math.max(SNAP_PEEK, Math.min(SNAP_FULL, index))
      setSnapIndex(clamped)
      animate(y, snapPoints[clamped], {
        type: 'spring',
        stiffness: 400,
        damping: 35,
      })
      onSnapChange?.(clamped)
    },
    [snapPoints, y, onSnapChange]
  )

  const bind = useDrag(
    ({ movement: [, my], velocity: [, vy], direction: [, dy], active, cancel, event }) => {
      if (active) {
        isDragging.current = true
        // If sheet is at FULL and content is scrolled, don't drag
        if (snapIndex === SNAP_FULL && contentRef.current) {
          const scrollTop = contentRef.current.scrollTop
          if (scrollTop > 0 && dy < 0) {
            // User is scrolling up inside content, don't interfere
            cancel()
            return
          }
          if (scrollTop > 0 && dy > 0) {
            // Let content scroll down first before dragging sheet
            cancel()
            return
          }
        }

        const startY = snapPoints[snapIndex]
        const newY = Math.max(
          snapPoints[SNAP_FULL],
          Math.min(snapPoints[SNAP_PEEK] + 40, startY + my)
        )
        y.set(newY)
      } else {
        isDragging.current = false
        const currentY = y.get()
        const VELOCITY_THRESHOLD = 0.5

        // Velocity-aware snapping
        if (Math.abs(vy) > VELOCITY_THRESHOLD) {
          // Fast swipe: go to next snap in swipe direction
          if (dy > 0) {
            // Swiping down
            snapTo(Math.max(SNAP_PEEK, snapIndex - 1))
          } else {
            // Swiping up
            snapTo(Math.min(SNAP_FULL, snapIndex + 1))
          }
        } else {
          // Slow drag: snap to closest point
          const nearest = closestSnap(currentY, snapPoints)
          snapTo(nearest)
        }
      }
    },
    {
      from: () => [0, y.get()],
      filterTaps: true,
      rubberband: 0.15,
      axis: 'y',
      pointer: { touch: true },
    }
  )

  // Prevent body scroll when sheet is not at full
  useEffect(() => {
    if (snapIndex !== SNAP_FULL) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [snapIndex])

  const canScroll = snapIndex === SNAP_FULL

  return (
    <motion.div
      ref={sheetRef}
      {...bind()}
      style={{
        y,
        touchAction: 'none',
        position: 'fixed',
        left: 0,
        right: 0,
        height: '100dvh',
        zIndex: 30,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.08), 0 -1px 4px rgba(0, 0, 0, 0.04)',
      }}
      className="glass"
    >
      {/* Drag handle */}
      <div className="flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
        <div
          className="bg-gray-300 rounded-full"
          style={{ width: 40, height: 5, borderRadius: 2.5 }}
        />
      </div>

      {/* Content area */}
      <div
        ref={contentRef}
        className="px-4 pb-8"
        style={{
          overflowY: canScroll ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          height: 'calc(100% - 40px)',
        }}
        onTouchStart={(e) => {
          // Prevent drag gesture from interfering with scroll at FULL
          if (canScroll && contentRef.current && contentRef.current.scrollTop > 0) {
            e.stopPropagation()
          }
        }}
      >
        {children}
      </div>
    </motion.div>
  )
}
