import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'
import { useDrag } from '@use-gesture/react'

export const SNAP_PEEK = 0
export const SNAP_HALF = 1
export const SNAP_FULL = 2

const SIDE_MARGIN = 10
const BOTTOM_MARGIN = 10
const TOP_MIN = 70 // leave space for navbar

// Snap points are now HEIGHTS (how tall the visible sheet is)
function getSnapHeights() {
  const h = typeof window !== 'undefined' ? window.innerHeight : 800
  return [
    86,                          // PEEK: handle + search bar + bottom padding
    h * 0.55,                    // HALF: categories + some results
    h - TOP_MIN - BOTTOM_MARGIN, // FULL: nearly full screen
  ]
}

function closestSnap(val, points) {
  let minDist = Infinity
  let idx = 0
  for (let i = 0; i < points.length; i++) {
    const d = Math.abs(val - points[i])
    if (d < minDist) {
      minDist = d
      idx = i
    }
  }
  return idx
}

const BottomSheet = forwardRef(function BottomSheet({ children, onSnapChange }, ref) {
  const [snapIndex, setSnapIndex] = useState(SNAP_PEEK)
  const [snapHeights, setSnapHeights] = useState(getSnapHeights)
  const sheetHeight = useMotionValue(snapHeights[SNAP_PEEK])
  const contentRef = useRef(null)
  const sheetRef = useRef(null)
  const isDragging = useRef(false)
  const snapIndexRef = useRef(snapIndex)
  snapIndexRef.current = snapIndex

  // Recalculate on resize
  useEffect(() => {
    function handleResize() {
      const pts = getSnapHeights()
      setSnapHeights(pts)
      animate(sheetHeight, pts[snapIndex], {
        type: 'spring',
        stiffness: 400,
        damping: 35,
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [snapIndex, sheetHeight])

  const snapTo = useCallback(
    (index) => {
      const clamped = Math.max(SNAP_PEEK, Math.min(SNAP_FULL, index))
      setSnapIndex(clamped)
      animate(sheetHeight, snapHeights[clamped], {
        type: 'spring',
        stiffness: 400,
        damping: 35,
      })
      onSnapChange?.(clamped)
    },
    [snapHeights, sheetHeight, onSnapChange]
  )

  useImperativeHandle(ref, () => ({
    snapTo: (index) => snapTo(index),
    getSnapIndex: () => snapIndexRef.current,
  }), [snapTo])

  const bind = useDrag(
    ({ movement: [, my], velocity: [, vy], direction: [, dy], active, cancel }) => {
      if (active) {
        isDragging.current = true

        // If at FULL and content is scrolled, don't drag
        if (snapIndex === SNAP_FULL && contentRef.current) {
          if (contentRef.current.scrollTop > 0) {
            cancel()
            return
          }
        }

        // Dragging up (negative my) = increase height
        const startH = snapHeights[snapIndex]
        const newH = Math.max(
          snapHeights[SNAP_PEEK] - 20,
          Math.min(snapHeights[SNAP_FULL] + 30, startH - my)
        )
        sheetHeight.set(newH)
      } else {
        isDragging.current = false
        const VELOCITY_THRESHOLD = 0.5

        if (Math.abs(vy) > VELOCITY_THRESHOLD) {
          // dy > 0 means dragging down = decrease height = lower snap
          if (dy > 0) {
            snapTo(Math.max(SNAP_PEEK, snapIndex - 1))
          } else {
            snapTo(Math.min(SNAP_FULL, snapIndex + 1))
          }
        } else {
          const nearest = closestSnap(sheetHeight.get(), snapHeights)
          snapTo(nearest)
        }
      }
    },
    {
      from: () => [0, 0],
      filterTaps: true,
      rubberband: 0.15,
      axis: 'y',
      pointer: { touch: true },
    }
  )

  // Prevent body scroll when not at full
  useEffect(() => {
    if (snapIndex !== SNAP_FULL) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [snapIndex])

  const canScroll = snapIndex === SNAP_FULL

  // Reset scroll position when leaving FULL to prevent content appearing cut off
  useEffect(() => {
    if (!canScroll && contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [canScroll])

  return (
    <motion.div
      ref={sheetRef}
      {...bind()}
      style={{
        height: sheetHeight,
        touchAction: 'none',
        position: 'fixed',
        bottom: BOTTOM_MARGIN,
        left: SIDE_MARGIN,
        right: SIDE_MARGIN,
        zIndex: 30,
        borderRadius: 22,
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        boxShadow: '0 2px 28px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Drag handle */}
      <div className="flex items-center justify-center py-2.5 cursor-grab active:cursor-grabbing">
        <div
          className="rounded-full"
          style={{
            width: 36,
            height: 5,
            borderRadius: 2.5,
            background: 'rgba(0, 0, 0, 0.18)',
          }}
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
          height: 'calc(100% - 25px)',
        }}
        onTouchStart={(e) => {
          if (canScroll && contentRef.current && contentRef.current.scrollTop > 0) {
            e.stopPropagation()
          }
        }}
      >
        {children}
      </div>
    </motion.div>
  )
})

export default BottomSheet
