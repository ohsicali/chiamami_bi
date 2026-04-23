/**
 * SEO lock logic — shared between EditRestaurant and NewRestaurant.
 *
 * The SEO tab stays locked until the admin has filled the minimum data
 * the AI needs to write meaningful metadata:
 *   - name       (identity)
 *   - city       (localization hook)
 *   - our_review (the editorial voice — at least 80 chars to be useful)
 *
 * Until those are ready, the tab shows a checklist instead of the form,
 * so the admin clearly sees what's missing.
 */

export const SEO_MIN_REVIEW_CHARS = 80

export function checkSeoReady(form) {
  const missing = []
  if (!form.name?.trim()) missing.push({ key: 'name', label: 'Nome ristorante' })
  if (!form.city?.trim()) missing.push({ key: 'city', label: 'Zona · città' })
  const reviewLen = (form.our_review || '').trim().length
  if (reviewLen < SEO_MIN_REVIEW_CHARS) {
    missing.push({
      key: 'our_review',
      label: `Racconto completo (${reviewLen}/${SEO_MIN_REVIEW_CHARS} caratteri minimi)`,
    })
  }
  return { ready: missing.length === 0, missing }
}

export function SeoLockedPlaceholder({ missing, onGoToDettagli }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--color-line, #EAE3D7)',
        borderRadius: 18,
        padding: '40px 28px',
        textAlign: 'center',
        maxWidth: 560,
        margin: '20px auto',
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 10 }} aria-hidden>
        🔒
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 900,
          fontSize: 20,
          letterSpacing: '-0.015em',
          color: 'var(--color-ink, #22181C)',
          margin: 0,
        }}
      >
        SEO bloccato
      </h3>
      <p
        style={{
          fontSize: 13,
          color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
          lineHeight: 1.6,
          margin: '8px 0 20px',
        }}
      >
        Completa prima i campi minimi nella tab <b style={{ color: 'var(--color-ink)' }}>Dettagli</b> —
        servono all'AI per scrivere metadati utili. Poi la tab SEO si sblocca e un click ti
        genera automaticamente title, meta description e preview social.
      </p>

      <div
        style={{
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          margin: '0 auto 24px',
          maxWidth: 360,
        }}
      >
        {missing.map((m) => (
          <div
            key={m.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: 'var(--color-cream, #F5F0E4)',
              borderRadius: 12,
              fontSize: 13,
              color: 'var(--color-ink, #22181C)',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: '2px solid var(--color-ink-55, rgba(34,24,28,0.35))',
                flexShrink: 0,
              }}
              aria-hidden
            />
            {m.label}
          </div>
        ))}
      </div>

      {onGoToDettagli && (
        <button
          type="button"
          onClick={onGoToDettagli}
          style={{
            background: 'var(--color-corallo, #E8453C)',
            color: '#fff',
            border: 0,
            padding: '10px 20px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
          }}
        >
          → Vai a Dettagli
        </button>
      )}
    </div>
  )
}
