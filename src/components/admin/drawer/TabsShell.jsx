/**
 * TabsShell — horizontal pill-tab navigation + content panel.
 *
 * Used inside RestaurantDrawer (PR15c) and on the Nuovo ristorante page
 * (PR15c-2), so the 6 tabs look identical in both contexts.
 *
 * Props:
 *   tabs       → array of { key, label, hide? } — hide=true skips a tab
 *                (e.g. "Credenziali" in create mode)
 *   activeKey  → current tab key
 *   onChange   → (key) => void
 *   children   → tab content (single React node, parent switches)
 *   sticky     → keep tab bar sticky at top of scroll area (default true)
 */
export default function TabsShell({ tabs, activeKey, onChange, children, sticky = true }) {
  const visible = tabs.filter((t) => !t.hide)
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          position: sticky ? 'sticky' : 'static',
          top: 0,
          background: 'var(--color-page, #FAF7F2)',
          paddingTop: 4,
          paddingBottom: 16,
          zIndex: 2,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: '#fff',
            border: '1px solid var(--color-line, #EAE3D7)',
            borderRadius: 999,
            padding: 4,
            width: 'fit-content',
            maxWidth: '100%',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {visible.map((t) => {
            const active = t.key === activeKey
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onChange(t.key)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  color: active ? '#fff' : 'var(--color-ink-55, rgba(34,24,28,0.55))',
                  background: active ? 'var(--color-ink, #22181C)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}
