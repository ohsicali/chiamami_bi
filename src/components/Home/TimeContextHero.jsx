import { useEffect, useState } from 'react'
import { getCurrentMoment, MOMENT_SLOTS, MOMENT_QUESTIONS } from '../../lib/hours'

/**
 * TimeContextHero · orologio grande + tag momento + domanda contestuale.
 * Aggiorna ogni 60s per riflettere l'ora corrente.
 */
export default function TimeContextHero({ activeMomentKey }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const { active, next } = getCurrentMoment(now)
  const momentKey = activeMomentKey || active || next
  const slot = MOMENT_SLOTS[momentKey]
  const question = active ? MOMENT_QUESTIONS[active] : MOMENT_QUESTIONS.none

  return (
    <div className="hfv4-timehero" style={{ padding: '22px 20px 14px', textAlign: 'left' }}>
      {slot && (
        <div
          className="hfv4-timehero-tag"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: 'var(--color-corallo-wash, #FDF2F0)',
            color: 'var(--color-corallo-ink, #C6372F)',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-corallo)',
              animation: 'hero-pulse 1.6s infinite',
            }}
          />
          {slot.label}
        </div>
      )}

      <div
        className="hfv4-timehero-clock"
        style={{
          fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
          fontSize: 96,
          lineHeight: 0.92,
          letterSpacing: '-0.02em',
          color: 'var(--color-ink)',
          marginBottom: 12,
          fontWeight: 400,
        }}
      >
        {time}
      </div>

      <div
        className="hfv4-timehero-q"
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 900,
          fontSize: 26,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          color: 'var(--color-ink)',
          maxWidth: 320,
        }}
      >
        {question}
      </div>

      <div
        className="hfv4-timehero-sub"
        style={{
          marginTop: 8,
          fontSize: 14,
          color: 'var(--color-ink-70)',
          lineHeight: 1.4,
          maxWidth: 300,
        }}
      >
        Ti mostro dove andare ora, a Torino.
      </div>
    </div>
  )
}
