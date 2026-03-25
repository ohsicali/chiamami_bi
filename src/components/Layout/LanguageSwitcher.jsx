import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const current = LANGUAGES.find(l => l.code === i18n.language?.slice(0, 2)) || LANGUAGES[0]

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  const handleSelect = (e, code) => {
    e.stopPropagation()
    e.preventDefault()
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <motion.button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        className="flex items-center justify-center w-9 h-9 rounded-xl shadow-sm text-base"
        style={{
          backgroundColor: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        aria-label="Cambia lingua"
      >
        {current.flag}
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed rounded-xl bg-white shadow-lg border border-gray-100 overflow-hidden min-w-[140px]"
              style={{
                zIndex: 9999,
                top: ref.current ? ref.current.getBoundingClientRect().bottom + 8 : 60,
                right: ref.current ? window.innerWidth - ref.current.getBoundingClientRect().right : 16,
              }}
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={(e) => handleSelect(e, lang.code)}
                  className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left transition-colors ${
                    lang.code === current.code
                      ? 'bg-accent/10 text-accent font-semibold'
                      : 'text-primary hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
