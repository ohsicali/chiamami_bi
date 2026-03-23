import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useDrag } from '@use-gesture/react'

export const SNAP_PEEK = 0
export const SNAP_HALF = 1
export const SNAP_FULL = 2

const SIDE_MARGIN = 10 // px margin on left/right like Apple Maps

function getSnapPoints() {
  const h = typeof window !== 'undefined' ? window.innerHeight : 800
  return [
    h - 110,   // PEEK: floating search island (~110px visible)
    h * 0.45,  // HALF: ~55% visible
    h * 0.08,  // FULL: nearly full screen
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

const BottomSheet = forwardRef(function BottomSheet({ children, onSnapChange }, ref) {
  const [snapIndex, setSnapIndex] = useState(SNAP_PEEK)
  const [snapPoints, setSnapPoints] = useState(getSnapPoints)
  const y = useMotionValue(snapPoints[SNAP_PEEK])
  const contentRef = useRef(null)
  const sheetRef = useRef(null)
  const isDragging = useRef(false)
  const snapIndexRef = useRef(snapIndex)
  snapIndexRef.current = snapIndex

  // Animate border-radius: rounder when peeking (island), less round when expanded
  const borderRadius = useTransform(
    y,
    [snapPoints[SNAP_FULL], snapPoints[SNAP_HALF], snapPoints[SNAP_PEEK]],
    [20, 24, 28]
  )

  // Recalculate snap points on resize
  useEffect(() => {
    function handleResize() {
      const pts = getSnapPoints()
      setSnapPoints(pts)
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

  // Expose snapTo via ref — must be after snapTo is defined
  useImperativeHandle(ref, () => ({
    snapTo: (index) => snapTo(index),
    getSnapIndex: () => snapIndexRef.current,
  }), [snapTo])

  const bind = useDrag(
    ({ movement: [, my], velocity: [, vy], direction: [, dy], active, cancel }) => {
      if (active) {
        isDragging.current = true
        // If sheet is at FULL and content is scrolled, don't drag
        if (snapIndex === SNAP_FULL && contentRef.current) {
          const scrollTop = contentRef.current.scrollTop
          if (scrollTop > 0) {
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
        const VELOCITY_THRESHOLD = 0.5

        if (Math.abs(vy) > VELOCITY_THRESHOLD) {
          if (dy > 0) {
            snapTo(Math.max(SNAP_PEEK, snapIndex - 1))
          } else {
            snapTo(Math.min(SNAP_FULL, snapIndex + 1))
          }
        } else {
          const nearest = closestSnap(y.get(), snapPoints)
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
        borderRadius,
        touchAction: 'none',
        position: 'fixed',
        top: 0,
        left: SIDE_MARGIN,
        right: SIDE_MARGIN,
        height: '100dvh',
        zIndex: 30,
        background: 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 -2px 20px rgba(0, 0, 0, 0.1), 0 0 1px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Drag handle */}
      <div className="flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
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
          height: 'calc(100% - 40px)',
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
