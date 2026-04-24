// FloatingToggle — pill ink floating usata in mappa/lista per switchare tra le due viste.
// In map → mostra "Lista" con IconList; in list → "Mappa" con IconMap.
// Posizionamento lo decide il chiamante (assoluto/fisso).

import { IconList, IconMap } from '../icons'

export default function FloatingToggle({ view, onClick, style, className }) {
  const isMap = view === 'map'
  const label = isMap ? 'Lista' : 'Mappa'
  const Icon = isMap ? IconList : IconMap

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-label={isMap ? 'Passa alla lista' : 'Passa alla mappa'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        padding: '13px 22px',
        background: 'var(--color-ink, #22181C)',
        color: '#fff',
        borderRadius: 999,
        border: 'none',
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: '-0.01em',
        boxShadow: '0 14px 30px rgba(34,24,28,.45), inset 0 1px 0 rgba(255,255,255,.18)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >
      <Icon size={17} />
      {label}
    </button>
  )
}
