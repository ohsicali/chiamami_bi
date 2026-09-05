import { motion, useReducedMotion } from 'framer-motion'
import { useCallback } from 'react'
import { SPRING_SOFT, TR_MENU } from '../../lib/motion'

/**
 * SaveButton — il cuore "salva" su card e schede.
 *
 * Com'era: `whileHover={{ scale: 1.1 }}` (su touch un tap spara un falso
 * hover che resta appiccicato) e un rimbalzo costruito con tre animate()
 * concatenati in una promise — 0.7 → 1.2 → 1. Ogni tap ripartiva da capo
 * e i tap ravvicinati accodavano catene sovrapposte.
 *
 * Com'è ora: una sola molla. `whileTap` schiaccia il cuore, al rilascio
 * la molla lo riporta a 1 passandoci un filo sopra (bounce 0.2) — è quello
 * il "pop", ma essendo una transizione e non dei keyframe riparte dal
 * valore corrente se lo ripremi subito, invece di ricominciare da zero.
 * L'hover è passato al CSS, dietro a (hover: hover) and (pointer: fine).
 */
export default function SaveButton({
  saved = false,
  onClick,
  size = 'md',
  className = '',
}) {
  const reduce = useReducedMotion()

  const sizes = {
    xs: { button: 'w-6 h-6', icon: 14 },
    sm: { button: 'w-8 h-8', icon: 20 },
    md: { button: 'w-10 h-10', icon: 22 },
    lg: { button: 'w-12 h-12', icon: 26 },
  }

  const { button: btnSize, icon: iconSize } = sizes[size] || sizes.md

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation()
      e.preventDefault()
      onClick?.()
    },
    [onClick]
  )

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      className={`save-btn flex items-center justify-center rounded-full backdrop-blur-sm ${btnSize} ${className}`}
      style={{
        backgroundColor: saved
          ? 'rgba(232, 69, 60, 0.16)'
          : 'rgba(255, 255, 255, 0.92)',
        border: saved
          ? '1px solid rgba(232, 69, 60, 0.3)'
          : '1px solid rgba(34, 24, 28, 0.08)',
        boxShadow: '0 4px 14px rgba(34, 24, 28, 0.12)',
        transition: 'background-color var(--dur-menu) var(--ease-out), border-color var(--dur-menu) var(--ease-out)',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
      whileTap={reduce ? undefined : { scale: 0.85 }}
      transition={SPRING_SOFT}
      aria-pressed={saved}
      aria-label={saved ? 'Rimuovi dai salvati' : 'Salva ristorante'}
    >
      {/* Il cuore cresce di un soffio quando è salvato: conferma che il
          tap è passato anche quando il colore da solo non basta (foto
          chiare dietro alla card). */}
      <motion.svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={saved ? '#E8453C' : 'none'}
        stroke={saved ? '#E8453C' : '#22181C'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: `fill ${TR_MENU.duration}s, stroke ${TR_MENU.duration}s` }}
        animate={{ scale: saved && !reduce ? 1.08 : 1 }}
        transition={SPRING_SOFT}
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </motion.svg>
    </motion.button>
  )
}
