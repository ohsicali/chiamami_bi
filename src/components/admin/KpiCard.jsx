/**
 * KpiCard — metric box with big value, delta arrow and inline sparkline.
 * Used on the admin Dashboard (PR15b) and in Analytics (PR15d).
 *
 * Props:
 *   label      → uppercase small label (es. "Ristoranti pubblicati")
 *   value      → main big number (number | string)
 *   delta      → small delta string (es. "+4 · 30gg")
 *   deltaDir   → "up" | "dn" | null  (color of the delta line)
 *   sparkline  → array of 6-10 numbers 0..100 (bar heights in %)
 *                last bar renders with corallo accent ("hot")
 */
export default function KpiCard({ label, value, delta, deltaDir, sparkline, loading = false }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--color-line, #EAE3D7)',
        borderRadius: 18,
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
        }}
      >
        {label}
      </div>
      {loading ? (
        // B-Admin: skeleton al posto del flash "0" finché la query non risponde.
        <div
          className="skeleton"
          aria-hidden="true"
          style={{ width: 72, height: 34, borderRadius: 8, marginTop: 8 }}
        />
      ) : (
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 34,
            letterSpacing: '-0.03em',
            marginTop: 8,
            lineHeight: 1,
            color: 'var(--color-ink, #22181C)',
          }}
        >
          {value}
        </div>
      )}
      {!loading && delta && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: deltaDir === 'dn' ? '#C0392B' : '#2C7A4A',
          }}
        >
          <span aria-hidden>{deltaDir === 'dn' ? '▼' : '▲'}</span>
          {delta}
        </div>
      )}
      {Array.isArray(sparkline) && sparkline.length > 0 && (
        <div
          style={{
            height: 34,
            marginTop: 10,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 3,
          }}
        >
          {sparkline.map((h, i) => {
            const isHot = i === sparkline.length - 1
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${Math.max(4, Math.min(100, h))}%`,
                  background: isHot ? 'var(--color-corallo, #E8453C)' : 'var(--color-cream-deep, #F1EBE0)',
                  borderRadius: 2,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
