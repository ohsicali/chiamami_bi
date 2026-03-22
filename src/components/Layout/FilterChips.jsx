import { useRef } from 'react'
import { motion } from 'framer-motion'
import { CUISINE_CATEGORIES, PRICE_LABELS } from '../../lib/hooks/useRestaurants'

function Chip({ label, emoji, active, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      animate={{
        backgroundColor: active ? '#E85D3A' : 'rgba(255, 255, 255, 0.85)',
        color: active ? '#FFFFFF' : '#4B5563',
      }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border whitespace-nowrap select-none"
      style={{
        borderColor: active ? '#E85D3A' : 'rgba(209, 213, 219, 0.6)',
        backdropFilter: active ? 'none' : 'blur(8px)',
        WebkitBackdropFilter: active ? 'none' : 'blur(8px)',
      }}
      type="button"
    >
      {emoji && <span className="text-base leading-none">{emoji}</span>}
      <span>{label}</span>
    </motion.button>
  )
}

export default function FilterChips({ filters, onFilterChange }) {
  const cuisineScrollRef = useRef(null)
  const priceScrollRef = useRef(null)

  function handleCuisineClick(categoryName) {
    onFilterChange?.({
      ...filters,
      category: filters.category === categoryName ? null : categoryName,
    })
  }

  function handlePriceClick(priceLevel) {
    onFilterChange?.({
      ...filters,
      priceRange: filters.priceRange === priceLevel ? null : priceLevel,
    })
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Cuisine categories row */}
      <div
        ref={cuisineScrollRef}
        className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4"
        style={{
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <style>{`
          .filter-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        {CUISINE_CATEGORIES.map((cat) => (
          <div key={cat.name} style={{ scrollSnapAlign: 'start' }}>
            <Chip
              label={cat.name}
              emoji={cat.emoji}
              active={filters.category === cat.name}
              onClick={() => handleCuisineClick(cat.name)}
            />
          </div>
        ))}
      </div>

      {/* Price range row */}
      <div
        ref={priceScrollRef}
        className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4"
        style={{
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {PRICE_LABELS.slice(1).map((label, idx) => {
          const priceLevel = idx + 1
          return (
            <div key={priceLevel} style={{ scrollSnapAlign: 'start' }}>
              <Chip
                label={label}
                active={filters.priceRange === priceLevel}
                onClick={() => handlePriceClick(priceLevel)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
