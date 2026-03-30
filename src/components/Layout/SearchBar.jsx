import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'

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
      className="flex items-center gap-3"
      style={{
        background: '#fff',
        border: `1.5px solid ${focused ? '#E8453C' : '#E8E5DE'}`,
        borderRadius: 16,
        padding: '13px 18px',
        boxShadow: focused ? '0 2px 20px rgba(232,69,60,0.08)' : '0 2px 12px rgba(0,0,0,0.04)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={focused ? '#E8453C' : '#C0BBB3'}
        strokeWidth="2.2" strokeLinecap="round"
        style={{ flexShrink: 0, transition: 'stroke 0.2s' }}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={t('home.search') || 'Ristorante, cucina, zona...'}
        style={{
          flex: 1, background: 'transparent',
          fontSize: 14, fontWeight: 500, color: '#22181C',
          outline: 'none', border: 'none',
          fontFamily: "'DM Sans', sans-serif",
        }}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      <AnimatePresence>
        {value && value.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
            onClick={handleClear}
            type="button"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)', color: '#8A8680',
              border: 'none', cursor: 'pointer',
            }}
            aria-label="Cancella ricerca"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
