import { motion, useAnimate } from 'framer-motion'
import { useCallback } from 'react'

export default function SaveButton({
  saved = false,
  onClick,
  size = 'md',
  className = '',
}) {
  const [scope, animate] = useAnimate()

  const sizes = {
    xs: { button: 'w-6 h-6', icon: 14 },
    sm: { button: 'w-8 h-8', icon: 20 },
    md: { button: 'w-10 h-10', icon: 22 },
    lg: { button: 'w-12 h-12', icon: 26 },
  }

  const { button: btnSize, icon: iconSize } = sizes[size] || sizes.md

  const handleClick = useCallback(
    async (e) => {
      e.stopPropagation()
      e.preventDefault()

      onClick?.()

      // Bounce animation (fire-and-forget, doesn't block save)
      animate(scope.current, { scale: 0.7 }, { duration: 0.08 })
        .then(() => animate(scope.current, { scale: 1.2 }, { type: 'spring', stiffness: 700, damping: 14 }))
        .then(() => animate(scope.current, { scale: 1 }, { duration: 0.1 }))
    },
    [onClick, animate, scope]
  )

  return (
    <motion.button
      ref={scope}
      type="button"
      onClick={handleClick}
      className={`flex items-center justify-center rounded-full backdrop-blur-sm transition-colors ${btnSize} ${className}`}
      style={{
        backgroundColor: saved
          ? 'rgba(238, 92, 85, 0.16)'
          : 'rgba(255, 255, 255, 0.92)',
        border: saved
          ? '1px solid rgba(238, 92, 85, 0.3)'
          : '1px solid rgba(34, 24, 28, 0.08)',
        boxShadow: '0 4px 14px rgba(34, 24, 28, 0.12)',
      }}
      whileHover={{ scale: 1.1 }}
      aria-label={saved ? 'Rimuovi dai salvati' : 'Salva ristorante'}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={saved ? '#EE5C55' : 'none'}
        stroke={saved ? '#EE5C55' : '#22181C'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    </motion.button>
  )
}
