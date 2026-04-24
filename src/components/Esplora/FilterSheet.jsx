// FilterSheet mobile — modal 90% viewport (mockup v4 frame 3).
// 5 sezioni: Categoria (bubble grid) · Fascia orario · Dieta · Prezzo · Area.
// CTA sticky: "Mostra N locali" + "Azzera filtri".
// Tap ✕ / fuori → chiude senza applicare (draft buttato).

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useMotionValue, animate as motionAnimate } from 'framer-motion'
import { useDrag } from '@use-gesture/react'
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
  { n: 1, label: '€' },
  { n: 2, label: '€€' },
  { n: 3, label: '€€€' },
  { n: 4, label: '€€€€' },
]

const AREA_MIN = 0.2   // km
const AREA_MAX = 10    // km → oltre = senza limite (null)

export default function FilterSheet({
  open,
  onClose,
  filters,
  allRestaurants,
  userPosition,
  discountIds,
  focusSection = null, // 'categories' | 'moment' | 'price' | 'diet' | 'area'
  onApply,
}) {
  const { categories } = useCategories()

  // Draft state — ripartisce da `filters` a ogni apertura
  const [draft, setDraft] = useState(() => cloneFilters(filters))

  useEffect(() => {
    if (open) setDraft(cloneFilters(filters))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Live count
  const liveCount = useMemo(() => {
    if (!open) return 0
    return countMatching(allRestaurants, draft, userPosition, discountIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allRestaurants, draft, userPosition, discountIds])

  // Draggable handle (dismiss al drag-down forte)
  const y = useMotionValue(0)
  const handleBind = useDrag(({ movement: [, my], velocity: [, vy], active }) => {
    if (active) {
      y.set(Math.max(0, my))
    } else if (my > 140 || vy > 0.5) {
      onClose?.()
    } else {
      motionAnimate(y, 0, { type: 'spring', stiffness: 300, damping: 35 })
    }
  }, { axis: 'y', from: () => [0, 0], filterTaps: true, pointer: { touch: true } })

  if (!open) return null

  const handleApply = () => {
    onApply?.({
      cat: draft.cat,
      price: draft.price,
      moment: draft.moment,
      diet: draft.diet,
      area: draft.area,
    })
    onClose?.()
  }

  const handleReset = () => {
    setDraft({ cat: [], price: [], moment: null, diet: [], disc: draft.disc, area: null, view: draft.view })
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end',
        }}
      >
        <motion.div
          key="sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          style={{
            y,
            width: '100%', maxHeight: '92%',
            background: 'var(--color-page, #FAF7F2)',
            borderRadius: '24px 24px 0 0',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -20px 60px rgba(0,0,0,0.35)',
            willChange: 'transform',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div {...handleBind()} style={{ flex: '0 0 auto', padding: '10px 0 6px', display: 'flex', justifyContent: 'center', touchAction: 'none', cursor: 'grab' }}>
            <div style={{ width: 42, height: 4, borderRadius: 2, background: 'rgba(34,24,28,0.12)' }} />
          </div>

          {/* Header */}
          <div style={{ flex: '0 0 auto', padding: '4px 20px 14px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 26, letterSpacing: '-0.02em', color: 'var(--color-ink, #22181C)' }}>
              Filtri
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              style={{
                display: 'grid', placeItems: 'center',
                width: 30, height: 30, borderRadius: '50%',
                background: 'rgba(34,24,28,0.05)', border: 'none',
                cursor: 'pointer', color: 'rgba(34,24,28,0.7)',
              }}
            >
              <IconClose size={14} />
            </button>
          </div>

          {/* Body scrollable */}
          <div style={{
            flex: 1, overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '0 20px 160px',
          }}>
            {/* 1. Categoria */}
            <Section title="Categoria" autoFocus={focusSection === 'categories'}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '14px 6px',
                marginTop: 6,
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

            {/* 2. Fascia d'orario (single-select) */}
            <Section title="Fascia d'orario" autoFocus={focusSection === 'moment'}>
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

            {/* 3. Dieta e stile (multi-select) */}
            <Section title="Dieta e stile" autoFocus={focusSection === 'diet'}>
              <PillRow>
                {DIETS.map(d => (
                  <ChipPill
                    key={d.slug}
                    on={draft.diet.includes(d.slug)}
                    onClick={() => setDraft(x => toggleArr(x, 'diet', d.slug))}
                  >
                    <span>{d.emoji}</span>{d.label}
                  </ChipPill>
                ))}
              </PillRow>
            </Section>

            {/* 4. Fascia prezzo (multi-select) */}
            <Section title="Fascia prezzo" autoFocus={focusSection === 'price'}>
              <PillRow>
                {PRICES.map(p => (
                  <ChipPill
                    key={p.n}
                    on={draft.price.includes(p.n)}
                    onClick={() => setDraft(x => toggleArr(x, 'price', p.n))}
                  >
                    {p.label}
                  </ChipPill>
                ))}
              </PillRow>
            </Section>

            {/* 5. Area di ricerca */}
            <Section title="Area di ricerca" autoFocus={focusSection === 'area'}>
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

          {/* CTA sticky */}
          <div style={{
            position: 'absolute',
            left: 16, right: 16,
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <button
              type="button"
              onClick={handleApply}
              style={{
                padding: '16px',
                background: 'var(--color-corallo, #E8453C)',
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                fontSize: 14.5,
                fontWeight: 900,
                letterSpacing: '-0.01em',
                cursor: 'pointer',
                boxShadow: '0 12px 28px rgba(232,69,60,0.4)',
              }}
            >
              Mostra {liveCount} {liveCount === 1 ? 'locale' : 'locali'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: '14px',
                background: 'var(--color-white, #fff)',
                border: '1px solid rgba(34,24,28,0.12)',
                color: 'var(--color-ink, #22181C)',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Azzera filtri
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

function Section({ title, children, autoFocus }) {
  return (
    <section style={{ marginBottom: 22, scrollMarginTop: 20 }} data-auto-focus={autoFocus || undefined}>
      <h3 style={{
        fontFamily: 'var(--font-sans)',
        fontWeight: 900,
        fontSize: 15,
        letterSpacing: '-0.01em',
        color: 'var(--color-ink, #22181C)',
        marginBottom: 10,
      }}>
        {title}
      </h3>
      {children}
    </section>
  )
}

function PillRow({ children }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {children}
    </div>
  )
}

function ChipPill({ on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 14px',
        background: on ? 'var(--color-corallo, #E8453C)' : 'var(--color-white, #fff)',
        color: on ? '#fff' : 'var(--color-ink, #22181C)',
        border: '1px solid ' + (on ? 'var(--color-corallo, #E8453C)' : 'rgba(34,24,28,0.12)'),
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: on ? '0 4px 10px rgba(232,69,60,0.3)' : 'none',
        WebkitTapHighlightColor: 'transparent',
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
          marginLeft: 'auto', fontWeight: 800, fontSize: 13,
          padding: '4px 10px', background: '#fff',
          border: '1px solid rgba(34,24,28,0.12)', borderRadius: 999,
        }}>{label}</span>
      </div>
      <div style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 6, background: 'rgba(34,24,28,0.05)', borderRadius: 999 }} />
        <div style={{
          position: 'absolute', left: 0, width: `${percent}%`, height: 6,
          background: 'var(--color-ink, #22181C)', borderRadius: 999,
          transition: 'width 0.12s',
        }} />
        <input
          type="range"
          min={AREA_MIN} max={AREA_MAX + 1} step={0.1}
          value={capped}
          disabled={disabled}
          onChange={(e) => onChange?.(Number(e.target.value))}
          style={{
            position: 'absolute', left: 0, right: 0, width: '100%',
            opacity: 0, cursor: disabled ? 'not-allowed' : 'grab', height: 28,
            margin: 0,
          }}
        />
        <div style={{
          position: 'absolute', left: `calc(${percent}% - 12px)`, top: '50%',
          transform: 'translateY(-50%)',
          width: 24, height: 24, borderRadius: '50%',
          background: '#fff', border: '3px solid var(--color-ink, #22181C)',
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'rgba(34,24,28,0.4)', fontWeight: 700, marginTop: 6 }}>
        <span>200 m</span>
        <span>Senza limite</span>
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
