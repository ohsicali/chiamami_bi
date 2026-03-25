import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { PRICE_LABELS } from '../../lib/hooks/useRestaurants'
import { useCategories } from '../../lib/hooks/useCategories'

export default function FilterChips({ filters, onFilterChange, onNearbyClick, showDealsOnly, onToggleDeals, dealsCount = 0 }) {
  const { categories: CUISINE_CATEGORIES } = useCategories()
  const { t } = useTranslation()
  const [modalOpen, setModalOpen] = useState(false)

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

  const hasActiveFilters = selected.length > 0 || filters.priceRange != null
  const filterCount = selected.length + (filters.priceRange != null ? 1 : 0)

  const scrollStyle = {
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    WebkitOverflowScrolling: 'touch',
  }

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
                  backgroundColor: active ? cat.color + '35' : cat.color + '20',
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

      {/* ROW 2: Chip buttons — [Vicino a me] [Scontati (N)] [Filtri] */}
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
              backgroundColor: showDealsOnly ? '#FF5757' : '#f8f6f1',
              color: showDealsOnly ? '#fff' : '#555',
              border: showDealsOnly ? 'none' : '0.5px solid #eae7e0',
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

      {/* Filter modal — categories + prices */}
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
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b" style={{ borderColor: '#eae7e0' }}>
                  <h3 className="text-lg font-semibold" style={{ fontWeight: 700 }}>Filtri</h3>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {/* Price range */}
                  <p className="text-sm font-semibold text-primary mb-3">Fascia di prezzo</p>
                  <div className="flex gap-2 mb-6">
                    {PRICE_LABELS.slice(1).map((label, idx) => {
                      const priceLevel = idx + 1
                      const active = filters.priceRange === priceLevel
                      return (
                        <button
                          key={priceLevel}
                          type="button"
                          onClick={() => handlePriceClick(priceLevel)}
                          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                          style={{
                            backgroundColor: active ? '#FF5757' : '#f8f6f1',
                            color: active ? '#fff' : '#555',
                            border: active ? 'none' : '0.5px solid #eae7e0',
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Category grid */}
                  <p className="text-sm font-semibold text-primary mb-3">{t('home.localeType')}</p>
                  <div className="grid grid-cols-4 gap-3">
                    {/* "Tutti" */}
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
                          backgroundColor: !selected.length ? '#FFF0F0' : '#f8f6f1',
                          boxShadow: !selected.length ? '0 0 0 2px #FF5757' : 'none',
                        }}
                      >
                        🍽️
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: !selected.length ? '#FF5757' : '#888' }}>
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
                              backgroundColor: active ? cat.color + '25' : '#f8f6f1',
                              boxShadow: active ? `0 0 0 2px ${cat.color}` : 'none',
                            }}
                          >
                            {cat.emoji}
                          </div>
                          <span className="text-[10px] font-medium" style={{ color: active ? cat.color : '#888' }}>
                            {cat.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t" style={{ borderColor: '#eae7e0' }}>
                  <div className="flex gap-3">
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          onFilterChange?.({ ...filters, category: null, priceRange: null })
                        }}
                        className="flex-1 py-3 rounded-xl text-sm font-medium transition-colors"
                        style={{ border: '0.5px solid #eae7e0', color: '#555' }}
                      >
                        Rimuovi filtri
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="flex-1 py-3 rounded-xl bg-[#FF5757] text-white font-medium text-sm shadow-md hover:bg-[#e64545] transition-colors"
                    >
                      {filterCount > 0 ? `Mostra risultati` : 'Chiudi'}
                    </button>
                  </div>
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
        backgroundColor: active ? '#1a1a1a' : '#f8f6f1',
        color: active ? '#fff' : '#555',
        border: active ? 'none' : '0.5px solid #eae7e0',
      }}
    >
      {children}
    </button>
  )
}
