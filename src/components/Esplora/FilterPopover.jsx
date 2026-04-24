// FilterPopover desktop — overlay 420px sotto la pill Filtri (mockup v4 desktop).
// Stesse 5 sezioni + CTA del FilterSheet mobile, ma come popover con click-outside,
// animazione scale-y dall'alto, max-height 600.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MOMENT_KEYS, MOMENT_SLOTS } from '../../lib/hours'
import { useCategories } from '../../lib/hooks/useCategories'
import { countMatching } from '../../lib/hooks/useEsploraFilters'
import CategoryBubble from './CategoryBubble'
import { IconClose } from '../icons'

const DIETS = [
  { slug: 'vegan',        emoji: '🥦', label: 'Vegano' },
  { slug: 'vegetarian',   emoji: '🫑', label: 'Vegetariano' },
  { slug: 'healthy',      emoji: '🥗', label: 'Salutare' },
  { slug: 'gluten-free',  emoji: '🌾', label: 'Senza glutine' },
]
const PRICES = [
  { n: 1, label: '€' }, { n: 2, label: '€€' }, { n: 3, label: '€€€' }, { n: 4, label: '€€€€' },
]
const AREA_MIN = 0.2
const AREA_MAX = 10

export default function FilterPopover({
  open,
  onClose,
  filters,
  allRestaurants,
  userPosition,
  discountIds,
  focusSection = null,
  onApply,
  anchorStyle, // opzionale: { top, left, right } override del default top:140 left:24
}) {
  const { categories } = useCategories()
  const ref = useRef(null)

  const [draft, setDraft] = useState(() => cloneFilters(filters))
  useEffect(() => { if (open) setDraft(cloneFilters(filters)) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Auto-scroll alla sezione focus (Step 9 categorie shortcut)
  useEffect(() => {
    if (!open || !focusSection) return
    const t = setTimeout(() => {
      const el = document.querySelector('[data-esplora-popover-section="' + focusSection + '"]')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 220)
    return () => clearTimeout(t)
  }, [open, focusSection])

  const liveCount = useMemo(() => {
    if (!open) return 0
    return countMatching(allRestaurants, draft, userPosition, discountIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allRestaurants, draft, userPosition, discountIds])

  // Click outside / Escape → close
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.()
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const handleApply = () => {
    onApply?.({
      cat: draft.cat, price: draft.price, moment: draft.moment,
      diet: draft.diet, area: draft.area,
    })
    onClose?.()
  }
  const handleReset = () => {
    setDraft({ cat: [], price: [], moment: null, diet: [], disc: draft.disc, area: null, view: draft.view })
  }

  const defaultAnchor = { top: 140, left: 24 }
  const anchor = { ...defaultAnchor, ...(anchorStyle || {}) }

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'fixed',
          ...anchor,
          width: 420,
          maxHeight: 600,
          background: 'var(--color-white, #fff)',
          border: '1px solid var(--color-ink-05, rgba(34,24,28,0.05))',
          borderRadius: 28,
          boxShadow: '0 30px 70px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          zIndex: 1000,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexShrink: 0 }}>
          <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
            Filtri
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            style={{
              display: 'grid', placeItems: 'center',
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(34,24,28,0.05)', border: 'none',
              cursor: 'pointer', color: 'rgba(34,24,28,0.7)',
            }}
          >
            <IconClose size={13} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 12px', minHeight: 0 }}>
          <Section title="Categoria" sectionKey="categories">
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '14px 6px', marginTop: 6,
            }}>
              {categories.map((cat) => (
                <CategoryBubble
                  key={cat.name}
                  emoji={cat.emoji}
                  label={cat.name}
                  on={draft.cat.includes(cat.name)}
                  onClick={() => setDraft(d => toggleArr(d, 'cat', cat.name))}
                />
              ))}
            </div>
          </Section>

          <Section title="Fascia d'orario" sectionKey="moment">
            <PillRow>
              {MOMENT_KEYS.map(k => {
                const s = MOMENT_SLOTS[k]
                const on = draft.moment === k
                return (
                  <ChipPill key={k} on={on} onClick={() => setDraft(d => ({ ...d, moment: on ? null : k }))}>
                    <span>{s.emoji}</span>{s.label}
                  </ChipPill>
                )
              })}
            </PillRow>
          </Section>

          <Section title="Dieta e stile" sectionKey="diet">
            <PillRow>
              {DIETS.map(d => (
                <ChipPill key={d.slug} on={draft.diet.includes(d.slug)} onClick={() => setDraft(x => toggleArr(x, 'diet', d.slug))}>
                  <span>{d.emoji}</span>{d.label}
                </ChipPill>
              ))}
            </PillRow>
          </Section>

          <Section title="Fascia prezzo" sectionKey="price">
            <PillRow>
              {PRICES.map(p => (
                <ChipPill key={p.n} on={draft.price.includes(p.n)} onClick={() => setDraft(x => toggleArr(x, 'price', p.n))}>
                  {p.label}
                </ChipPill>
              ))}
            </PillRow>
          </Section>

          <Section title="Area di ricerca" sectionKey="area">
            <AreaSlider
              valueKm={draft.area ?? AREA_MAX + 1}
              onChange={(km) => setDraft(x => ({ ...x, area: km >= AREA_MAX + 0.001 ? null : km }))}
              disabled={!userPosition}
            />
            {!userPosition && (
              <p style={{ marginTop: 8, fontSize: 11.5, color: 'rgba(34,24,28,0.5)', fontWeight: 500 }}>
                Abilita la geolocalizzazione per usare il raggio.
              </p>
            )}
          </Section>
        </div>

        {/* CTA footer */}
        <div style={{
          padding: '10px 16px 14px',
          borderTop: '1px solid rgba(34,24,28,0.06)',
          display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={handleApply}
            style={{
              padding: '14px',
              background: 'var(--color-corallo, #E8453C)',
              color: '#fff', border: 'none', borderRadius: 999,
              fontSize: 14, fontWeight: 900, letterSpacing: '-0.01em',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(232,69,60,0.3)',
            }}
          >
            Mostra {liveCount} {liveCount === 1 ? 'locale' : 'locali'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: '11px',
              background: 'var(--color-white, #fff)',
              border: '1px solid rgba(34,24,28,0.12)',
              color: 'var(--color-ink, #22181C)',
              borderRadius: 999,
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Azzera filtri
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

function Section({ title, children, sectionKey }) {
  return (
    <section
      style={{ marginBottom: 18, scrollMarginTop: 12 }}
      data-esplora-popover-section={sectionKey || undefined}
    >
      <h4 style={{
        fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 14,
        letterSpacing: '-0.01em', color: 'var(--color-ink, #22181C)',
        marginBottom: 10,
      }}>{title}</h4>
      {children}
    </section>
  )
}

function PillRow({ children }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>
}

function ChipPill({ on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '9px 13px',
        background: on ? 'var(--color-corallo, #E8453C)' : 'var(--color-white, #fff)',
        color: on ? '#fff' : 'var(--color-ink, #22181C)',
        border: '1px solid ' + (on ? 'var(--color-corallo, #E8453C)' : 'rgba(34,24,28,0.12)'),
        borderRadius: 999,
        fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer',
        boxShadow: on ? '0 4px 10px rgba(232,69,60,0.3)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

function AreaSlider({ valueKm, onChange, disabled }) {
  const capped = Math.min(valueKm, AREA_MAX + 1)
  const percent = Math.min(100, Math.max(0, ((capped - AREA_MIN) / (AREA_MAX + 1 - AREA_MIN)) * 100))
  const label = capped > AREA_MAX ? 'Senza limite' : `${capped.toFixed(1).replace('.0', '')} km`
  return (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 12.5, marginBottom: 10 }}>
        <span style={{ color: 'rgba(34,24,28,0.7)', fontWeight: 600 }}>Dalla tua posizione</span>
        <span style={{
          marginLeft: 'auto', fontWeight: 800, fontSize: 12.5,
          padding: '4px 10px', background: '#fff',
          border: '1px solid rgba(34,24,28,0.12)', borderRadius: 999,
        }}>{label}</span>
      </div>
      <div style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 6, background: 'rgba(34,24,28,0.05)', borderRadius: 999 }} />
        <div style={{
          position: 'absolute', left: 0, width: `${percent}%`, height: 6,
          background: 'var(--color-ink, #22181C)', borderRadius: 999, transition: 'width 0.12s',
        }} />
        <input
          type="range"
          min={AREA_MIN} max={AREA_MAX + 1} step={0.1}
          value={capped}
          disabled={disabled}
          onChange={(e) => onChange?.(Number(e.target.value))}
          style={{ position: 'absolute', left: 0, right: 0, width: '100%', opacity: 0, cursor: disabled ? 'not-allowed' : 'grab', height: 24, margin: 0 }}
        />
        <div style={{
          position: 'absolute', left: `calc(${percent}% - 11px)`, top: '50%',
          transform: 'translateY(-50%)',
          width: 22, height: 22, borderRadius: '50%',
          background: '#fff', border: '3px solid var(--color-ink, #22181C)',
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}

function cloneFilters(f) {
  return {
    cat: [...(f.cat || [])],
    price: [...(f.price || [])],
    moment: f.moment || null,
    diet: [...(f.diet || [])],
    disc: !!f.disc,
    area: f.area ?? null,
    view: f.view || 'map',
  }
}

function toggleArr(draft, key, value) {
  const arr = draft[key] || []
  const has = arr.includes(value)
  return {
    ...draft,
    [key]: has ? arr.filter(x => x !== value) : [...arr, value],
  }
}
