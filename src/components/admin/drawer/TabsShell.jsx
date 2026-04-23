/**
 * TabsShell — horizontal pill-tab navigation + content panel.
 *
 * Used inside EditRestaurant (PR15g.2) and NewRestaurant (PR15c-2), so
 * the 6 tabs look identical in both contexts.
 *
 * Props:
 *   tabs       → array of { key, label, hide?, locked?, lockedReason? }
 *                - hide=true skips a tab (e.g. "Credenziali" in create mode)
 *                - locked=true greys out the tab + shows 🔒 + tooltip.
 *                  Click is still allowed; parent renders a placeholder.
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
            const locked = t.locked === true
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onChange(t.key)}
                title={locked ? t.lockedReason || 'Questa tab è bloccata.' : undefined}
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  color: active ? '#fff' : locked ? 'var(--color-ink-55, rgba(34,24,28,0.45))' : 'var(--color-ink-55, rgba(34,24,28,0.55))',
                  background: active ? 'var(--color-ink, #22181C)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s, color 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {locked && <span aria-hidden style={{ fontSize: 10, opacity: active ? 1 : 0.65 }}>🔒</span>}
                <span style={{ opacity: locked && !active ? 0.7 : 1 }}>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}
