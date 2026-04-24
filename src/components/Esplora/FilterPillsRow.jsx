// FilterPillsRow — riga scrollabile dei 3 pill filtro + count bar (mockup v4).
//
//   [ ⚙ Filtri N ] [ ▦ Categorie ▾ ] [ 🏷 Sconti ]
//   17 locali · N filtri attivi            Azzera
//
// Stesso pattern mobile (mappa/lista) e desktop.

import FilterPill from './FilterPill'
import { IconSliders, IconGrid, IconTag } from '../icons'

export default function FilterPillsRow({
  activeCount = 0,
  discActive = false,
  catActive = false,
  onOpenFilters,
  onOpenCategories,
  onToggleDisc,
  count,
  showCountBar = true,
  activeFiltersTotal = 0,
  onReset,
  style,
}) {
  return (
    <div style={style}>
      <div
        className="esplora-fpills"
        style={{
          display: 'flex',
          gap: 8,
          padding: '0 16px 10px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        <style>{`.esplora-fpills::-webkit-scrollbar{display:none}`}</style>
        <FilterPill
          icon={<IconSliders />}
          badge={activeCount}
          variant={activeCount > 0 ? 'on' : 'default'}
          onClick={onOpenFilters}
          aria-label="Apri filtri"
        >
          Filtri
        </FilterPill>
        <FilterPill
          icon={<IconGrid />}
          chevron
          variant={catActive ? 'on' : 'default'}
          onClick={onOpenCategories}
          aria-label="Apri categorie"
        >
          Categorie
        </FilterPill>
        <FilterPill
          icon={<IconTag />}
          variant={discActive ? 'active-highlight' : 'default'}
          onClick={onToggleDisc}
          aria-pressed={discActive}
        >
          Sconti
        </FilterPill>
      </div>

      {showCountBar && (
        <div
          style={{
            padding: '4px 20px 10px',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '-0.01em',
              color: 'var(--color-ink, #22181C)',
            }}
          >
            {count != null ? `${count} ${count === 1 ? 'locale' : 'locali'}` : '—'}
            {activeFiltersTotal > 0 && (
              <>
                {' · '}
                {activeFiltersTotal} {activeFiltersTotal === 1 ? 'filtro attivo' : 'filtri attivi'}
              </>
            )}
          </span>
          {activeFiltersTotal > 0 && onReset && (
            <button
              type="button"
              onClick={onReset}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 4px',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-corallo, #E8453C)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Azzera
            </button>
          )}
        </div>
      )}
    </div>
  )
}
