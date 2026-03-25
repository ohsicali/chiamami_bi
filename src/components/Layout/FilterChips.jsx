import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { PRICE_LABELS } from '../../lib/hooks/useRestaurants'
import { useCategories } from '../../lib/hooks/useCategories'

// Pastel backgrounds for the first 6 visible categories in the scroll row
const PASTEL_BG = {
  Piemontese: '#FFF5F5',
  Italiana: '#FFF8EE',
  Giapponese: '#FFF0F0',
  Bar: '#F0F5FF',
  Pizzeria: '#FFFBEE',
  Tramezzini: '#F5FFF5',
}

function getPastelBg(catName, catColor) {
  return PASTEL_BG[catName] || catColor + '18'
}

const scrollStyle = {
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  WebkitOverflowScrolling: 'touch',
}

export default function FilterChips({ filters, onFilterChange, onNearbyClick, showDealsOnly, onToggleDeals, dealsCount = 0 }) {
  const { categories: CUISINE_CATEGORIES } = useCategories()
  const { t } = useTranslation()
  const [modalOpen, setModalOpen] = useState(false)

  // Multi-category support
  const selected = filters.category
    ? (Array.isArray(filters.category) ? filters.category : [filters.category])
    : []

  function isActive(name) {
    return selected.includes(name)
  }

  function handleCuisineClick(categoryName) {
    let next
    if (isActive(categoryName)) {
      next = selected.filter(s => s !== categoryName)
    } else {
      next = [...selected, categoryName]
    }
    onFilterChange?.({
      ...filters,
      category: next.length > 0 ? next : null,
    })
  }

  function handlePriceClick(priceLevel) {
    onFilterChange?.({
      ...filters,
      priceRange: filters.priceRange === priceLevel ? null : priceLevel,
    })
  }

  const hasActiveFilters = selected.length > 0 || filters.priceRange
  const filterCount = selected.length + (filters.priceRange ? 1 : 0)

  return (
    <div className="flex flex-col gap-2.5">
      {/* ROW 1: Category circles — 44px with pastel backgrounds */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4" style={scrollStyle}>
        <style>{`.filter-scroll::-webkit-scrollbar { display: none; }`}</style>
        {CUISINE_CATEGORIES.map((cat) => {
          const active = isActive(cat.name)
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => handleCuisineClick(cat.name)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
              style={{ width: 52 }}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all duration-200"
                style={{
                  backgroundColor: active ? cat.color + '30' : getPastelBg(cat.name, cat.color),
                  boxShadow: active ? `0 0 0 2px ${cat.color}` : 'none',
                }}
              >
                {cat.emoji}
              </div>
              <span
                className="text-[9px] font-medium text-center leading-tight line-clamp-1 transition-colors"
                style={{ color: active ? cat.color : '#888' }}
              >
                {cat.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* ROW 2: 3 chips only — Vicino a me, Scontati, Filtri */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4" style={scrollStyle}>
        {/* Vicino a me */}
        {onNearbyClick && (
          <ChipButton
            active={filters.sortBy === 'distance'}
            onClick={() => {
              if (filters.sortBy === 'distance') {
                onFilterChange?.({ ...filters, sortBy: null })
              } else {
                onNearbyClick()
              }
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
            {t('home.nearby')}
          </ChipButton>
        )}

        {/* Scontati — RED when active */}
        {onToggleDeals && (
          <button
            type="button"
            onClick={onToggleDeals}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium whitespace-nowrap select-none transition-all"
            style={{
              backgroundColor: showDealsOnly ? '#FF5757' : '#fff',
              color: showDealsOnly ? '#fff' : '#555',
              border: showDealsOnly ? '1px solid #FF5757' : '1px solid #e0ddd6',
            }}
          >
            🏷️ {t('home.discounted')}{dealsCount > 0 ? ` (${dealsCount})` : ''}
          </button>
        )}

        {/* Filtri — opens modal with prices + categories */}
        <ChipButton
          active={hasActiveFilters}
          onClick={() => setModalOpen(true)}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 12h12M3 20h6" />
          </svg>
          Filtri{filterCount > 0 ? ` (${filterCount})` : ''}
        </ChipButton>
      </div>

      {/* Filter modal — categories grid + price range */}
      {createPortal(
        <AnimatePresence>
          {modalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900">Filtri</h3>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {/* Price range */}
                  <p className="text-sm font-semibold text-gray-900 mb-3">Fascia di prezzo</p>
                  <div className="flex gap-2 mb-6">
                    {PRICE_LABELS.slice(1).map((label, idx) => {
                      const priceLevel = idx + 1
                      const active = filters.priceRange === priceLevel
                      return (
                        <button
                          key={priceLevel}
                          type="button"
                          onClick={() => handlePriceClick(priceLevel)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                          style={{
                            backgroundColor: active ? '#FF5757' : '#f8f6f1',
                            color: active ? '#fff' : '#555',
                            border: active ? '1px solid #FF5757' : '1px solid #eae7e0',
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Category grid */}
                  <p className="text-sm font-semibold text-gray-900 mb-3">Tipo di locale</p>
                  <div className="grid grid-cols-4 gap-3">
                    {/* "Tutti" option */}
                    <button
                      type="button"
                      onClick={() => {
                        onFilterChange?.({ ...filters, category: null })
                      }}
                      className="flex flex-col items-center gap-1.5 py-2"
                    >
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all"
                        style={{
                          backgroundColor: !selected.length ? '#FFF5F5' : '#f3f4f6',
                          boxShadow: !selected.length ? '0 0 0 2.5px #FF5757' : 'none',
                        }}
                      >
                        🍽️
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: !selected.length ? '#FF5757' : '#6B7280' }}>
                        {t('home.all')}
                      </span>
                    </button>

                    {CUISINE_CATEGORIES.map((cat) => {
                      const active = isActive(cat.name)
                      return (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => handleCuisineClick(cat.name)}
                          className="flex flex-col items-center gap-1.5 py-2"
                        >
                          <div
                            className="w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all"
                            style={{
                              backgroundColor: active ? cat.color + '25' : '#f3f4f6',
                              boxShadow: active ? `0 0 0 2.5px ${cat.color}` : 'none',
                            }}
                          >
                            {cat.emoji}
                          </div>
                          <span className="text-[10px] font-medium" style={{ color: active ? cat.color : '#6B7280' }}>
                            {cat.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-full py-3 rounded-xl bg-[#FF5757] text-white font-semibold text-sm shadow-md hover:bg-[#e64545] transition-colors"
                  >
                    {filterCount > 0 ? `Mostra risultati (${filterCount} filtri)` : 'Mostra tutti'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

function ChipButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium whitespace-nowrap select-none transition-all"
      style={{
        backgroundColor: active ? '#1a1a1a' : '#fff',
        color: active ? '#fff' : '#555',
        border: active ? '1px solid #1a1a1a' : '1px solid #e0ddd6',
      }}
    >
      {children}
    </button>
  )
}
