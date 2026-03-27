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
    onFilterChange?.({ ...filters, category: next.length > 0 ? next : null })
  }

  function handlePriceClick(priceLevel) {
    onFilterChange?.({ ...filters, priceRange: filters.priceRange === priceLevel ? null : priceLevel })
  }

  // Show first 6 categories as capsule pills
  const visibleCats = CUISINE_CATEGORIES.slice(0, 6)

  return (
    <div className="flex flex-col gap-3">
      {/* Category capsules — editorial pill style */}
      <div
        className="flex gap-2 overflow-x-auto -mx-1 px-1"
        style={{
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          maskImage: 'linear-gradient(90deg, #000 85%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, #000 85%, transparent)',
        }}
      >
        {/* "Tutti" pill */}
        <button
          type="button"
          onClick={() => onFilterChange?.({ ...filters, category: null })}
          className="flex items-center gap-2 flex-shrink-0"
          style={{
            padding: '8px 16px 8px 10px',
            borderRadius: 40,
            background: selected.length === 0 ? '#111' : '#fff',
            border: `1.5px solid ${selected.length === 0 ? '#111' : '#E8E5DE'}`,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <span style={{
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
            background: selected.length === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)',
          }}>
            🍽
          </span>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: selected.length === 0 ? '#FAF7F2' : '#111',
            whiteSpace: 'nowrap',
          }}>
            Tutti
          </span>
        </button>

        {visibleCats.map((cat) => {
          const active = isActive(cat.name)
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => handleCuisineClick(cat.name)}
              className="flex items-center gap-2 flex-shrink-0"
              style={{
                padding: '8px 16px 8px 10px',
                borderRadius: 40,
                background: active ? '#111' : '#fff',
                border: `1.5px solid ${active ? '#111' : '#E8E5DE'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <span style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15,
                background: active ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)',
              }}>
                {cat.emoji}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: active ? '#FAF7F2' : '#111',
                whiteSpace: 'nowrap',
              }}>
                {cat.name}
              </span>
            </button>
          )
        })}

        {/* "Altro +" to open modal */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 flex-shrink-0"
          style={{
            padding: '8px 16px 8px 10px',
            borderRadius: 40,
            background: selected.length > 0 ? '#111' : '#fff',
            border: `1.5px solid ${selected.length > 0 ? '#111' : '#E8E5DE'}`,
          }}
        >
          <span style={{
            width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
            background: selected.length > 0 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)',
          }}>
            ＋
          </span>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: selected.length > 0 ? '#FAF7F2' : '#111',
            whiteSpace: 'nowrap',
          }}>
            Altro
          </span>
        </button>
      </div>

      {/* Filter chips row */}
      <div className="flex gap-2">
        {/* Vicino a me */}
        {onNearbyClick && (
          <button
            type="button"
            onClick={() => {
              if (filters.sortBy === 'distance') {
                onFilterChange?.({ ...filters, sortBy: null })
              } else {
                onNearbyClick()
              }
            }}
            style={{
              padding: '9px 16px',
              borderRadius: 24,
              fontSize: 12, fontWeight: 600, letterSpacing: 0.2,
              whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 6,
              border: `1.5px solid ${filters.sortBy === 'distance' ? '#111' : '#E8E5DE'}`,
              background: filters.sortBy === 'distance' ? '#111' : '#fff',
              color: filters.sortBy === 'distance' ? '#FAF7F2' : '#5A564F',
              cursor: 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
            Vicino a me
          </button>
        )}

        {/* Scontati */}
        {onToggleDeals && (
          <button
            type="button"
            onClick={onToggleDeals}
            style={{
              padding: '9px 16px',
              borderRadius: 24,
              fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 6,
              border: `1.5px solid ${showDealsOnly ? '#E8453C' : '#E8E5DE'}`,
              background: showDealsOnly ? '#E8453C' : '#fff',
              color: showDealsOnly ? '#fff' : '#5A564F',
              boxShadow: showDealsOnly ? '0 2px 12px rgba(232,69,60,0.3)' : 'none',
              cursor: 'pointer',
            }}
          >
            🏷 Scontati
            {dealsCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: showDealsOnly ? 'rgba(255,255,255,0.25)' : 'rgba(232,69,60,0.1)',
                color: showDealsOnly ? '#fff' : '#E8453C',
                padding: '1px 6px', borderRadius: 8,
              }}>
                {dealsCount}
              </span>
            )}
          </button>
        )}

        {/* Filtri — opens full modal with categories + price */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            padding: '9px 16px',
            borderRadius: 24,
            fontSize: 12, fontWeight: 600,
            whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6,
            border: `1.5px solid ${(selected.length || filters.priceRange) ? '#111' : '#E8E5DE'}`,
            background: (selected.length || filters.priceRange) ? '#111' : '#fff',
            color: (selected.length || filters.priceRange) ? '#FAF7F2' : '#5A564F',
            cursor: 'pointer',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 6h16M4 12h10M4 18h4"/></svg>
          Filtri
          {(selected.length > 0 || filters.priceRange) && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: 'rgba(255,255,255,0.2)',
              padding: '1px 6px', borderRadius: 8,
            }}>
              {(selected.length || 0) + (filters.priceRange ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Full filter modal */}
      {createPortal(
        <AnimatePresence>
          {modalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
              onClick={() => setModalOpen(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                className="absolute bottom-0 left-0 right-0 max-h-[85vh] flex flex-col"
                style={{ background: '#FAF7F2', borderRadius: '28px 28px 0 0' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ borderBottom: '1px solid #E8E5DE' }}>
                  <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 20, fontWeight: 600, color: '#111' }}>
                    Filtri
                  </h3>
                  <button type="button" onClick={() => setModalOpen(false)} className="p-2 rounded-full" style={{ background: 'rgba(0,0,0,0.04)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A8680" strokeWidth="2"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto p-5" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {/* Categories grid */}
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680', marginBottom: 12 }}>Tipo di cucina</p>
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {/* All option */}
                    <button type="button" onClick={() => { onFilterChange?.({ ...filters, category: null }) }} className="flex flex-col items-center gap-1.5 py-2">
                      <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22,
                        background: !selected.length ? 'rgba(232,69,60,0.1)' : 'rgba(0,0,0,0.04)',
                        boxShadow: !selected.length ? '0 0 0 2.5px #E8453C' : 'none',
                      }}>🍽️</div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: !selected.length ? '#E8453C' : '#111' }}>Tutti</span>
                    </button>

                    {CUISINE_CATEGORIES.map((cat) => {
                      const active = isActive(cat.name)
                      return (
                        <button key={cat.name} type="button" onClick={() => handleCuisineClick(cat.name)} className="flex flex-col items-center gap-1.5 py-2">
                          <div style={{
                            width: 56, height: 56, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 22,
                            background: active ? `${cat.color}20` : 'rgba(0,0,0,0.04)',
                            boxShadow: active ? `0 0 0 2.5px ${cat.color}` : 'none',
                            transition: 'all 0.2s',
                          }}>{cat.emoji}</div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: active ? cat.color : '#111', textAlign: 'center', lineHeight: 1.2 }}>{cat.name}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Price range */}
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#8A8680', marginBottom: 12 }}>Fascia di prezzo</p>
                  <div className="flex gap-2 mb-4">
                    {PRICE_LABELS.slice(1).map((label, idx) => {
                      const priceLevel = idx + 1
                      const active = filters.priceRange === priceLevel
                      return (
                        <button
                          key={priceLevel}
                          type="button"
                          onClick={() => handlePriceClick(priceLevel)}
                          style={{
                            flex: 1, padding: '12px 8px', borderRadius: 14,
                            fontSize: 13, fontWeight: 600,
                            background: active ? '#111' : '#fff',
                            color: active ? '#FAF7F2' : '#5A564F',
                            border: `1.5px solid ${active ? '#111' : '#E8E5DE'}`,
                            cursor: 'pointer', transition: 'all 0.2s',
                            textAlign: 'center',
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4" style={{ borderTop: '1px solid #E8E5DE' }}>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    style={{
                      width: '100%', padding: '14px', borderRadius: 14,
                      background: '#E8453C', color: '#fff',
                      fontSize: 14, fontWeight: 700,
                      border: 'none', cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(232,69,60,0.3)',
                    }}
                  >
                    {selected.length > 0 || filters.priceRange
                      ? `Mostra risultati`
                      : 'Tutti i ristoranti'
                    }
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
