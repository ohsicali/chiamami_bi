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
    sm: { button: 'w-8 h-8', icon: 20 },
    md: { button: 'w-10 h-10', icon: 22 },
    lg: { button: 'w-12 h-12', icon: 26 },
  }

  const { button: btnSize, icon: iconSize } = sizes[size] || sizes.md

  const handleClick = useCallback(
    async (e) => {
      e.stopPropagation()
      e.preventDefault()

      // Bounce animation
      await animate(scope.current, { scale: 0.7 }, { duration: 0.1 })
      await animate(
        scope.current,
        { scale: 1.25 },
        { type: 'spring', stiffness: 600, damping: 12 }
      )
      await animate(scope.current, { scale: 1 }, { duration: 0.15 })

      onClick?.()
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
        backgroundColor: saved ? 'rgba(255, 87, 87, 0.15)' : 'rgba(0, 0, 0, 0.25)',
      }}
      whileHover={{ scale: 1.1 }}
      aria-label={saved ? 'Rimuovi dai salvati' : 'Salva ristorante'}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={saved ? '#FF5757' : 'none'}
        stroke={saved ? '#FF5757' : '#fff'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    </motion.button>
  )
}
