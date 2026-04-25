import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCategories } from '../../lib/hooks/useCategories'
import { PRICE_LABELS } from '../../lib/hooks/useRestaurants'
import { MOMENT_KEYS, MOMENT_SLOTS } from '../../lib/hours'

const DIETARY_OPTIONS = [
  { key: 'vegano',         label: 'Vegano',        emoji: '🥦' },
  { key: 'vegetariano',   label: 'Vegetariano',   emoji: '🫑' },
  { key: 'salutare',      label: 'Salutare',       emoji: '🥗' },
  { key: 'senza_glutine', label: 'Senza glutine', emoji: '🌽' },
]

// null = senza limite
const RADIUS_STEPS = [0.2, 0.5, 1, 1.5, 2, 3, 5, 10, null]

function formatRadius(val) {
  if (val === null) return 'Senza limite'
  if (val < 1) return `${Math.round(val * 1000)} m`
  return `${val} km`
}

const PREVIEW_CAT_COUNT = 8

const CORALLO = '#E8453C'
const INK = '#22181C'
const CREAM = '#FAF7F2'
const BORDER = '#E8E5DE'
const MUTED = '#8A8680'

/* ── Shared sub-components ─────────────────────────────────────────────── */

function SheetModal({ open, onClose, title, children, footer }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              maxHeight: '90vh',
              background: CREAM,
              borderRadius: '24px 24px 0 0',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.16)' }} />
            </div>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 20px 16px', flexShrink: 0,
            }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: INK, margin: 0, letterSpacing: '-0.025em' }}>
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.06)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', WebkitOverflowScrolling: 'touch' }}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div style={{
                padding: '14px 20px 28px', flexShrink: 0,
                borderTop: `1px solid ${BORDER}`, background: CREAM,
              }}>
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 style={{
      fontSize: 18, fontWeight: 800, color: INK,
      marginBottom: 14, marginTop: 0, letterSpacing: '-0.015em',
    }}>
      {children}
    </h3>
  )
}

function CatCircle({ cat, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '0 0 4px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
      }}
    >
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
        background: active ? `${CORALLO}18` : '#fff',
        border: `2.5px solid ${active ? CORALLO : BORDER}`,
        boxShadow: active ? `0 0 0 1.5px ${CORALLO}40` : '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'all 0.18s',
      }}>
        {cat.emoji}
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: active ? CORALLO : INK,
        textAlign: 'center', lineHeight: 1.25,
        maxWidth: 72, wordBreak: 'break-word',
      }}>
        {cat.name}
      </span>
    </button>
  )
}

function SelectPill({ label, emoji, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '10px 18px',
        borderRadius: 999,
        border: `1.5px solid ${active ? CORALLO : BORDER}`,
        background: active ? CORALLO : '#fff',
        color: active ? '#fff' : INK,
        fontSize: 13, fontWeight: 600,
        cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
    >
      {emoji && <span style={{ fontSize: 16 }}>{emoji}</span>}
      {label}
    </button>
  )
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function MobileFilterBar({
  filters,
  onFilterChange,
  showDealsOnly = false,
  onToggleDeals,
  restaurantCount = 0,
  extraFilters = { dietary: [], radiusKm: null },
  onExtraFilterChange,
}) {
  const { categories } = useCategories()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [catsExpanded, setCatsExpanded] = useState(false)

  const selectedCats = Array.isArray(filters.category)
    ? filters.category
    : filters.category ? [filters.category] : []

  const selectedDietary = extraFilters.dietary || []

  const activeCount =
    (selectedCats.length > 0 ? 1 : 0) +
    (filters.priceRange ? 1 : 0) +
    (filters.moment ? 1 : 0) +
    selectedDietary.length +
    (extraFilters.radiusKm !== null ? 1 : 0)

  const catLabel = selectedCats.length === 1
    ? selectedCats[0]
    : selectedCats.length > 1
      ? `Categorie (${selectedCats.length})`
      : 'Categorie'
  const catActive = selectedCats.length > 0

  const radiusIdx = extraFilters.radiusKm === null
    ? RADIUS_STEPS.length - 1
    : Math.max(0, RADIUS_STEPS.findIndex(v => v === extraFilters.radiusKm))

  /* ── Handlers ─── */

  function handleCatToggle(name) {
    const next = selectedCats.includes(name)
      ? selectedCats.filter(s => s !== name)
      : [...selectedCats, name]
    onFilterChange?.({ ...filters, category: next.length > 0 ? next : null })
  }

  function handleMomentToggle(key) {
    onFilterChange?.({ ...filters, moment: filters.moment === key ? null : key })
  }

  function handlePriceToggle(level) {
    onFilterChange?.({ ...filters, priceRange: filters.priceRange === level ? null : level })
  }

  function handleDietaryToggle(key) {
    const next = selectedDietary.includes(key)
      ? selectedDietary.filter(k => k !== key)
      : [...selectedDietary, key]
    onExtraFilterChange?.({ ...extraFilters, dietary: next })
  }

  function handleRadiusChange(idxStr) {
    const val = RADIUS_STEPS[Number(idxStr)]
    onExtraFilterChange?.({ ...extraFilters, radiusKm: val })
  }

  function handleReset() {
    onFilterChange?.({ ...filters, category: null, priceRange: null, moment: null })
    onExtraFilterChange?.({ dietary: [], radiusKm: null })
    setCatsExpanded(false)
  }

  /* ── Sub-lists ─── */

  const previewCats = categories.slice(0, PREVIEW_CAT_COUNT)
  const remainingCats = categories.slice(PREVIEW_CAT_COUNT)

  /* ── Footer content ─── */

  const filtersFooter = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button
        type="button"
        onClick={() => setFiltersOpen(false)}
        style={{
          width: '100%', padding: '15px', borderRadius: 16, border: 'none',
          background: CORALLO, color: '#fff', fontSize: 15, fontWeight: 800,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(232,69,60,0.3)',
        }}
      >
        Mostra {restaurantCount} local{restaurantCount === 1 ? 'e' : 'i'}
      </button>
      <button
        type="button"
        onClick={handleReset}
        style={{
          width: '100%', padding: '13px', borderRadius: 16,
          border: `1.5px solid ${BORDER}`, background: '#fff',
          color: MUTED, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Azzera filtri
      </button>
    </div>
  )

  const categoriesFooter = (
    <button
      type="button"
      onClick={() => setCategoriesOpen(false)}
      style={{
        width: '100%', padding: '15px', borderRadius: 16, border: 'none',
        background: CORALLO, color: '#fff', fontSize: 15, fontWeight: 800,
        cursor: 'pointer', boxShadow: '0 4px 16px rgba(232,69,60,0.3)',
      }}
    >
      Mostra {restaurantCount} local{restaurantCount === 1 ? 'e' : 'i'}
    </button>
  )

  /* ── Render ─── */

  return (
    <>
      {/* ─ 3-pill bar ─ */}
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

          {/* Filtri */}
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 999, cursor: 'pointer',
              border: `1.5px solid ${activeCount > 0 ? INK : BORDER}`,
              background: activeCount > 0 ? INK : '#fff',
              color: activeCount > 0 ? '#FAF7F2' : INK,
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M4 6h16M6 12h12M8 18h8" />
            </svg>
            Filtri
            {activeCount > 0 && (
              <span style={{
                background: CORALLO, color: '#fff',
                fontSize: 10, fontWeight: 800,
                padding: '1px 6px', borderRadius: 999, lineHeight: 1.4,
              }}>
                {activeCount}
              </span>
            )}
          </button>

          {/* Categorie */}
          <button
            type="button"
            onClick={() => setCategoriesOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '9px 14px', borderRadius: 999, cursor: 'pointer',
              border: `1.5px solid ${catActive ? INK : BORDER}`,
              background: catActive ? INK : '#fff',
              color: catActive ? '#FAF7F2' : INK,
              fontSize: 13, fontWeight: 700, flexShrink: 0,
              maxWidth: 160, overflow: 'hidden',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {catLabel}
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Sconti */}
          <button
            type="button"
            onClick={onToggleDeals}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '9px 14px', borderRadius: 999, cursor: 'pointer',
              border: `1.5px solid ${showDealsOnly ? CORALLO : BORDER}`,
              background: '#fff',
              color: showDealsOnly ? CORALLO : INK,
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            Sconti
          </button>
        </div>

        {/* Counter row — shown only when filters or deals are active */}
        {(activeCount > 0 || showDealsOnly) && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>
              {restaurantCount} local{restaurantCount === 1 ? 'e' : 'i'}
              {activeCount > 0 && (
                <span style={{ fontWeight: 500, color: MUTED }}>
                  {' '}· {activeCount} filtr{activeCount === 1 ? 'o' : 'i'} attiv{activeCount === 1 ? 'o' : 'i'}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: 13, fontWeight: 700, color: CORALLO, cursor: 'pointer',
              }}
            >
              Azzera
            </button>
          </div>
        )}
      </div>

      {/* ─ Modals (portaled to body) ─ */}
      {createPortal(
        <>
          {/* FILTERS MODAL */}
          <SheetModal
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            title="Filtri"
            footer={filtersFooter}
          >
            {/* Categoria */}
            <section style={{ marginBottom: 28 }}>
              <SectionTitle>Categoria</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 8px', marginBottom: 12 }}>
                {previewCats.map(cat => (
                  <CatCircle
                    key={cat.name}
                    cat={cat}
                    active={selectedCats.includes(cat.name)}
                    onClick={() => handleCatToggle(cat.name)}
                  />
                ))}
                {catsExpanded && remainingCats.map(cat => (
                  <CatCircle
                    key={cat.name}
                    cat={cat}
                    active={selectedCats.includes(cat.name)}
                    onClick={() => handleCatToggle(cat.name)}
                  />
                ))}
              </div>
              {remainingCats.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCatsExpanded(v => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', padding: 0,
                    fontSize: 13, fontWeight: 600, color: MUTED, cursor: 'pointer',
                  }}
                >
                  {catsExpanded
                    ? 'Meno categorie ▴'
                    : `Altro (${remainingCats.length}) ▾`}
                </button>
              )}
            </section>

            {/* Fascia d'orario */}
            <section style={{ marginBottom: 28 }}>
              <SectionTitle>Fascia d'orario</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {MOMENT_KEYS.map(key => {
                  const slot = MOMENT_SLOTS[key]
                  return (
                    <SelectPill
                      key={key}
                      label={slot.label}
                      emoji={slot.emoji}
                      active={filters.moment === key}
                      onClick={() => handleMomentToggle(key)}
                    />
                  )
                })}
              </div>
            </section>

            {/* Dieta e stile */}
            <section style={{ marginBottom: 28 }}>
              <SectionTitle>Dieta e stile</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DIETARY_OPTIONS.map(opt => (
                  <SelectPill
                    key={opt.key}
                    label={opt.label}
                    emoji={opt.emoji}
                    active={selectedDietary.includes(opt.key)}
                    onClick={() => handleDietaryToggle(opt.key)}
                  />
                ))}
              </div>
            </section>

            {/* Fascia prezzo */}
            <section style={{ marginBottom: 28 }}>
              <SectionTitle>Fascia prezzo</SectionTitle>
              <div style={{ display: 'flex', gap: 8 }}>
                {PRICE_LABELS.slice(1).map((label, idx) => {
                  const level = idx + 1
                  return (
                    <SelectPill
                      key={level}
                      label={label}
                      active={filters.priceRange === level}
                      onClick={() => handlePriceToggle(level)}
                    />
                  )
                })}
              </div>
            </section>

            {/* Area di ricerca */}
            <section style={{ marginBottom: 36 }}>
              <SectionTitle>Area di ricerca</SectionTitle>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>Dalla tua posizione</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: INK,
                  padding: '4px 12px', borderRadius: 999,
                  background: '#fff', border: `1.5px solid ${BORDER}`,
                }}>
                  {formatRadius(RADIUS_STEPS[radiusIdx])}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={RADIUS_STEPS.length - 1}
                value={radiusIdx}
                onChange={e => handleRadiusChange(e.target.value)}
                style={{ width: '100%', accentColor: INK, height: 4 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: MUTED }}>200 m</span>
                <span style={{ fontSize: 11, color: MUTED }}>Senza limite</span>
              </div>
            </section>
          </SheetModal>

          {/* CATEGORIES MODAL */}
          <SheetModal
            open={categoriesOpen}
            onClose={() => setCategoriesOpen(false)}
            title="Categorie"
            footer={categoriesFooter}
          >
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '14px 8px', paddingBottom: 8,
            }}>
              {categories.map(cat => (
                <CatCircle
                  key={cat.name}
                  cat={cat}
                  active={selectedCats.includes(cat.name)}
                  onClick={() => handleCatToggle(cat.name)}
                />
              ))}
            </div>
          </SheetModal>
        </>,
        document.body
      )}
    </>
  )
}
