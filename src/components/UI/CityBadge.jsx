// CityBadge — badge "📍 Città" sulle card dei locali fuori dalla città attiva
// (Blocco A4). I locali fuori Torino RESTANO in guida: il badge chiarisce solo
// dove si trova il locale, così non sembra un errore.

const norm = (s) => String(s || '').trim().toLowerCase()

export function CityBadge({ city, activeCity = 'Torino', style }) {
  if (!city || norm(city) === norm(activeCity)) return null
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        background: 'var(--color-ink, #22181c)', color: '#fff',
        fontSize: 10, fontWeight: 800, letterSpacing: '-0.01em',
        padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap',
        ...style,
      }}
    >
      📍 {city}
    </span>
  )
}

// Ordina i locali con la città attiva per prima, preservando l'ordine
// esistente (es. per distanza) all'interno di ciascun gruppo.
export function sortByActiveCity(list, activeCity = 'Torino') {
  if (!Array.isArray(list)) return list
  const a = norm(activeCity)
  return list
    .map((r, i) => [r, i])
    .sort((x, y) => {
      const xa = norm(x[0]?.city) === a ? 0 : 1
      const ya = norm(y[0]?.city) === a ? 0 : 1
      return xa !== ya ? xa - ya : x[1] - y[1]
    })
    .map((p) => p[0])
}

export default CityBadge
