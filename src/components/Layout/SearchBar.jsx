import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const SearchIcon = ({ focused }) => (
  <motion.svg
    animate={{ rotate: focused ? -15 : 0 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="flex-shrink-0"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </motion.svg>
)

const ClearIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export default function SearchBar({ value, onChange, onFocus, onBlur }) {
  const { t } = useTranslation()
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)

  function handleFocus(e) {
    setFocused(true)
    onFocus?.(e)
  }

  function handleBlur(e) {
    setFocused(false)
    onBlur?.(e)
  }

  function handleClear() {
    onChange?.('')
    inputRef.current?.focus()
  }

  return (
    <div
      className="glass flex items-center gap-2.5 px-4 py-3 border-2 transition-all duration-200 ease-out"
      style={{
        borderRadius: 16,
        borderColor: focused ? '#FF5757' : 'rgba(209, 213, 219, 0.5)',
        transform: focused ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {/* Search icon */}
      <span className={`transition-colors duration-200 ${focused ? 'text-[#FF5757]' : 'text-gray-400'}`}>
        <SearchIcon focused={focused} />
      </span>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={t('home.search')}
        className="flex-1 bg-transparent text-[15px] text-primary placeholder:text-secondary outline-none"
        style={{ fontFamily: "var(--font-sans, 'Plus Jakarta Sans', sans-serif)" }}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {/* Clear button */}
      <AnimatePresence>
        {value && value.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
            onClick={handleClear}
            type="button"
            className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200/80 dark:bg-gray-700/80 text-gray-500 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-white transition-colors"
            aria-label="Cancella ricerca"
          >
            <ClearIcon />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
