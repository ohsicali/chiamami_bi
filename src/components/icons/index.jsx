// Lucide-style SVG icon set — uniforme su tutta la pagina Esplora (filter pills,
// floating toggle map/list, search, geo).
//
// Regole:
//   - stroke 2, viewBox 24×24, currentColor
//   - default 15×15; override con `size` prop o className
//   - tracciato ispirato ai mockup v4-mobile/desktop-esplora-redesign.html

function Svg({ size = 15, className, children, ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

// Filtri — 3 righe con nodi (sliders)
export function IconSliders(props) {
  return (
    <Svg {...props}>
      <line x1="4" y1="6" x2="10" y2="6" />
      <line x1="14" y1="6" x2="20" y2="6" />
      <circle cx="12" cy="6" r="2" />
      <line x1="4" y1="12" x2="7" y2="12" />
      <line x1="11" y1="12" x2="20" y2="12" />
      <circle cx="9" cy="12" r="2" />
      <line x1="4" y1="18" x2="14" y2="18" />
      <line x1="18" y1="18" x2="20" y2="18" />
      <circle cx="16" cy="18" r="2" />
    </Svg>
  )
}

// Categorie — 4 quadrati
export function IconGrid(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  )
}

// Sconti — etichetta (tag)
export function IconTag(props) {
  return (
    <Svg {...props}>
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
    </Svg>
  )
}

// Toggle lista — 3 righe orizzontali
export function IconList(props) {
  return (
    <Svg {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </Svg>
  )
}

// Toggle mappa — mappa piegata a 3 sezioni (stile Neotaste)
export function IconMap(props) {
  return (
    <Svg {...props}>
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </Svg>
  )
}

// Search — lente
export function IconSearch(props) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </Svg>
  )
}

// User location — crosshair
export function IconGeo(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Svg>
  )
}

// Close / chiudi — usato nel filter sheet
export function IconClose(props) {
  return (
    <Svg {...props}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </Svg>
  )
}
