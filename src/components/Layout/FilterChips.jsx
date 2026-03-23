import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CUISINE_CATEGORIES, PRICE_LABELS } from '../../lib/hooks/useRestaurants'

export default function FilterChips({ filters, onFilterChange, onNearbyClick }) {
  const [modalOpen, setModalOpen] = useState(false)

  // Support multi-category as array
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

  return (
    <div className="flex flex-col gap-3">
      {/* Scrollable category circles — Glovo style */}
      <div
        className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <style>{`.filter-scroll::-webkit-scrollbar { display: none; }`}</style>
        {CUISINE_CATEGORIES.map((cat) => {
          const active = isActive(cat.name)
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => handleCuisineClick(cat.name)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
              style={{ width: 64 }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all duration-200"
                style={{
                  backgroundColor: active ? cat.color + '25' : '#f3f4f6',
                  boxShadow: active ? `0 0 0 2.5px ${cat.color}` : 'none',
                }}
              >
                {cat.emoji}
              </div>
              <span
                className="text-[10px] font-medium text-center leading-tight line-clamp-1 transition-colors"
                style={{ color: active ? cat.color : '#6B7280' }}
              >
                {cat.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filter buttons row */}
      <div
        className="flex gap-2 overflow-x-auto -mx-4 px-4"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* "Nelle vicinanze" button */}
        {onNearbyClick && (
          <button
            type="button"
            onClick={onNearbyClick}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border whitespace-nowrap select-none transition-colors"
            style={{
              backgroundColor: filters.sortBy === 'distance' ? '#3B82F6' : 'rgba(255,255,255,0.85)',
              color: filters.sortBy === 'distance' ? '#fff' : '#4B5563',
              borderColor: filters.sortBy === 'distance' ? '#3B82F6' : 'rgba(209,213,219,0.6)',
              backdropFilter: filters.sortBy === 'distance' ? 'none' : 'blur(8px)',
              WebkitBackdropFilter: filters.sortBy === 'distance' ? 'none' : 'blur(8px)',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
            <span>Nelle vicinanze</span>
          </button>
        )}

        {/* "Tipo di locale" button — opens full modal */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border whitespace-nowrap select-none transition-colors"
          style={{
            backgroundColor: selected.length ? '#FF5757' : 'rgba(255,255,255,0.85)',
            color: selected.length ? '#fff' : '#4B5563',
            borderColor: selected.length ? '#FF5757' : 'rgba(209,213,219,0.6)',
            backdropFilter: selected.length ? 'none' : 'blur(8px)',
            WebkitBackdropFilter: selected.length ? 'none' : 'blur(8px)',
          }}
        >
          <span>{selected.length ? `Tipo di locale (${selected.length})` : 'Tipo di locale'}</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Price range chips */}
        {PRICE_LABELS.slice(1).map((label, idx) => {
          const priceLevel = idx + 1
          const active = filters.priceRange === priceLevel
          return (
            <button
              key={priceLevel}
              type="button"
              onClick={() => handlePriceClick(priceLevel)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border whitespace-nowrap select-none transition-colors"
              style={{
                backgroundColor: active ? '#FF5757' : 'rgba(255,255,255,0.85)',
                color: active ? '#fff' : '#4B5563',
                borderColor: active ? '#FF5757' : 'rgba(209,213,219,0.6)',
                backdropFilter: active ? 'none' : 'blur(8px)',
                WebkitBackdropFilter: active ? 'none' : 'blur(8px)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Full-screen category modal — rendered via portal to avoid clipping by BottomSheet's backdrop-filter */}
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
                  <h3 className="text-lg font-semibold text-gray-900">Tipo di locale</h3>
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

                {/* Grid */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="grid grid-cols-4 gap-3">
                    {/* "Tutti" option to clear filter */}
                    <button
                      type="button"
                      onClick={() => {
                        onFilterChange?.({ ...filters, category: null })
                        setModalOpen(false)
                      }}
                      className="flex flex-col items-center gap-1.5 py-2"
                    >
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all ${
                          !selected.length ? 'ring-3 ring-[#FF5757] shadow-md bg-orange-50' : 'bg-gray-100'
                        }`}
                      >
                        🍽️
                      </div>
                      <span className={`text-xs font-medium text-center leading-tight ${
                        !selected.length ? 'text-[#FF5757]' : 'text-gray-900'
                      }`}>
                        Tutti
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
                            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all ${
                              active ? 'ring-3 shadow-md' : 'bg-gray-100'
                            }`}
                            style={active ? { backgroundColor: cat.color + '20', ringColor: cat.color } : {}}
                          >
                            {cat.emoji}
                          </div>
                          <span className={`text-xs font-medium text-center leading-tight ${
                            active ? 'text-[#FF5757]' : 'text-gray-900'
                          }`}>
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
                    className="w-full py-3 rounded-xl bg-[#FF5757] text-white font-medium text-sm shadow-md hover:bg-[#e64545] transition-colors"
                  >
                    {selected.length > 0 ? `Fatto (${selected.length} selezionat${selected.length === 1 ? 'o' : 'i'})` : 'Mostra tutti'}
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
