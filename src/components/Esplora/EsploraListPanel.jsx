// Pannello lista mobile · full-screen sotto Navbar, sopra TabBar.
// Usato quando URL param `?view=list` sulla rotta /esplora.
//
// Struttura (mockup v4 mobile frame 2):
//   [Navbar globale — montata altrove]
//   Search bar sticky
//   FilterPillsRow sticky
//   Lista scroll verticale (MiniCard full-width) · opz. group headers per distanza (Step 11)
//   FloatingToggle "Mappa" fixed bottom
//
// Prop-driven · non gestisce state (lo fa HomePage con useEsploraFilters).

import { TAB_BAR_HEIGHT } from '../Layout/MobileTabBar'
import SearchBar from '../Layout/SearchBar'
import MiniCard from '../Restaurant/MiniCard'
import FilterPillsRow from './FilterPillsRow'
import FloatingToggle from './FloatingToggle'

const NAVBAR_OFFSET = 'calc(env(safe-area-inset-top, 0px) + 56px)'

export default function EsploraListPanel({
  restaurants,
  userPosition,
  loading,
  searchQuery,
  onSearchChange,
  esplora,
  discountIds,
  discountLabels,
  isSaved,
  onToggleSave,
  onCardClick,
  onToggleView,
  onOpenFilters,
  onOpenCategories,
  groups, // optional: Array<{ label, items }> — usato da Step 11
}) {
  const activeFiltersTotal =
    esplora.activeCount
    + (esplora.filters.cat.length > 0 ? 1 : 0)
    + (esplora.filters.disc ? 1 : 0)

  const hasGroups = Array.isArray(groups) && groups.length > 0

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'var(--color-page, #FAF7F2)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
      }}
    >
      {/* Spacer per Navbar (già montata a livello HomePage) */}
      <div style={{ flex: '0 0 auto', height: NAVBAR_OFFSET }} />

      {/* Search bar sotto header */}
      <div style={{ padding: '4px 16px 10px', flex: '0 0 auto' }}>
        <SearchBar value={searchQuery} onChange={onSearchChange} />
      </div>

      {/* Filter pills + count bar */}
      <div style={{ flex: '0 0 auto' }}>
        <FilterPillsRow
          activeCount={esplora.activeCount}
          activeFiltersTotal={activeFiltersTotal}
          discActive={esplora.filters.disc}
          catActive={esplora.filters.cat.length > 0}
          count={restaurants.length}
          onOpenFilters={onOpenFilters}
          onOpenCategories={onOpenCategories}
          onToggleDisc={esplora.toggleDisc}
          onReset={esplora.reset}
        />
      </div>

      {/* Lista scrollable */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: `8px 16px ${TAB_BAR_HEIGHT + 96}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#8A8680', fontSize: 13 }}>
            Caricamento…
          </div>
        ) : restaurants.length === 0 ? (
          <EmptyInline onReset={esplora.reset} hasFilters={activeFiltersTotal > 0} />
        ) : hasGroups ? (
          groups.map(g => (
            <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={groupHeaderStyle}>{g.label}</div>
              {g.items.map(r => (
                <MiniCard
                  key={r.id}
                  restaurant={r}
                  userPosition={userPosition}
                  discountTitle={discountLabels?.[r.id]}
                  saved={isSaved(r.id)}
                  onSave={() => onToggleSave(r.id)}
                  onClick={onCardClick}
                  width="100%"
                />
              ))}
            </div>
          ))
        ) : (
          restaurants.map(r => (
            <MiniCard
              key={r.id}
              restaurant={r}
              userPosition={userPosition}
              discountTitle={discountLabels?.[r.id]}
              saved={isSaved(r.id)}
              onSave={() => onToggleSave(r.id)}
              onClick={onCardClick}
              width="100%"
            />
          ))
        )}
      </div>

      {/* Floating toggle "Mappa" */}
      <div
        style={{
          position: 'absolute',
          left: 0, right: 0,
          bottom: TAB_BAR_HEIGHT + 16,
          display: 'flex', justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 30,
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <FloatingToggle view="list" onClick={onToggleView} />
        </div>
      </div>
    </div>
  )
}

const groupHeaderStyle = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(34,24,28,0.4)',
  padding: '8px 2px 4px',
}

function EmptyInline({ onReset, hasFilters }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', textAlign: 'center',
      padding: '48px 20px', gap: 10,
    }}>
      <div style={{ fontSize: 40 }}>🔍</div>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#22181C', margin: 0 }}>
        {hasFilters ? 'Nessun posto con questi filtri' : 'Nessun ristorante trovato'}
      </p>
      <p style={{ fontSize: 13, color: '#8A8680', margin: 0, maxWidth: 300, lineHeight: 1.5 }}>
        Prova a togliere una categoria o ad allargare la fascia prezzo.
      </p>
      {hasFilters && (
        <button
          onClick={onReset}
          style={{
            marginTop: 6,
            padding: '11px 22px',
            background: 'var(--color-corallo, #E8453C)',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            fontSize: 13.5,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(232,69,60,0.28)',
          }}
        >
          Azzera filtri
        </button>
      )}
    </div>
  )
}
