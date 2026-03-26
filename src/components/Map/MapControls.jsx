import { motion } from 'framer-motion'
import { TAB_BAR_HEIGHT } from '../Layout/MobileTabBar'

function getButtonStyle() {
  return {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#374151',
    fontSize: 20,
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  }
}

function LocateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

const buttonVariants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  tap: { scale: 0.92 },
  hover: { scale: 1.05 },
}

export default function MapControls({
  onLocateMe,
  isLocating,
  onZoomIn,
  onZoomOut,
}) {
  const BUTTON_STYLE = getButtonStyle()

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      style={{
        position: 'absolute',
        right: 16,
        bottom: TAB_BAR_HEIGHT + 180,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 10,
      }}
    >
      {/* Locate me button */}
      <motion.button
        variants={buttonVariants}
        initial="initial"
        animate="animate"
        whileTap="tap"
        whileHover="hover"
        transition={{ duration: 0.2 }}
        onClick={onLocateMe}
        aria-label="Vicino a me"
        title="Vicino a me"
        style={{
          ...BUTTON_STYLE,
          color: isLocating ? '#3B82F6' : '#374151',
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {isLocating && (
          <motion.div
            animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'rgba(59,130,246,0.2)',
            }}
          />
        )}
        <LocateIcon />
      </motion.button>

      {/* Zoom in */}
      <motion.button
        variants={buttonVariants}
        initial="initial"
        animate="animate"
        whileTap="tap"
        whileHover="hover"
        transition={{ duration: 0.2, delay: 0.05 }}
        onClick={onZoomIn}
        aria-label="Zoom avanti"
        title="Zoom avanti"
        style={BUTTON_STYLE}
      >
        <PlusIcon />
      </motion.button>

      {/* Zoom out */}
      <motion.button
        variants={buttonVariants}
        initial="initial"
        animate="animate"
        whileTap="tap"
        whileHover="hover"
        transition={{ duration: 0.2, delay: 0.1 }}
        onClick={onZoomOut}
        aria-label="Zoom indietro"
        title="Zoom indietro"
        style={BUTTON_STYLE}
      >
        <MinusIcon />
      </motion.button>
    </motion.div>
  )
}
