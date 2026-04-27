import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { tokenizeQuery, matchesQuery, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { useCategories } from '../../lib/hooks/useCategories'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
import { proxyImg } from '../../lib/supabase'

const MAX_RESTAURANTS = 6
const MAX_CATEGORIES = 8
const MAX_ZONES = 4

const POPULAR_SUGGESTIONS = [
  'Giapponese',
  'Pizza',
  'Piemontese',
  'Aperitivo',
  'Fine Dining',
  'Vegano',
]

function isConversationalQuery(q) {
  // Heuristic: long-ish queries with question-y words probably belong to Bi.
  if (!q) return false
  const trimmed = q.trim()
  if (trimmed.length < 14) return false
  return /\b(dove|cosa|come|perch[eé]|consigli|porto|vado|posso|stasera|domani|romantico|economico|aperto|amici|ragazza|fidanzat)/i.test(trimmed)
}

function extractZones(restaurants) {
  // Crude zone extraction from address: take the first comma-separated segment
  // (typically the street). For Torino we don't have explicit zone data, so we
  // just expose street names as a "zona" filter target.
  const counts = new Map()
  for (const r of restaurants || []) {
    const addr = r.address || ''
    const street = addr.split(',')[0]?.trim()
    if (!street || street.length < 4) continue
    counts.set(street, (counts.get(street) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
}

export default function UnifiedSearch({ value, onChange, restaurants = [] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const { categories } = useCategories()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)
  const overlayRef = useRef(null)
  const wrapRef = useRef(null)
  const autoOpenedRef = useRef(false)

  const tokens = useMemo(() => tokenizeQuery(value || ''), [value])

  // Allow other parts of the app (Navbar magnifier icon) to deep-link into
  // the search via /<page>?search=open and have the overlay open + focused.
  useEffect(() => {
    if (autoOpenedRef.current) return
    if (searchParams.get('search') !== 'open') return
    autoOpenedRef.current = true
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
    const next = new URLSearchParams(searchParams)
    next.delete('search')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  function closeOverlay() {
    setOpen(false)
    setFocused(false)
    inputRef.current?.blur()
  }

  function handleInputFocus() {
    setFocused(true)
    setOpen(true)
  }

  function handleClear() {
    onChange?.('')
    inputRef.current?.focus()
  }

  function pickCategory(name) {
    onChange?.(name)
    closeOverlay()
  }

  function pickZone(name) {
    onChange?.(name)
    closeOverlay()
  }

  function pickRestaurant(slug) {
    if (!slug) return
    closeOverlay()
    navigate(`/restaurant/${slug}`)
  }

  function askBi() {
    const q = (value || '').trim()
    closeOverlay()
    if (q) {
      navigate(`/?ask=${encodeURIComponent(q)}`)
    } else {
      navigate('/?focus=bi')
    }
  }

  const matchedCategories = useMemo(() => {
    if (tokens.length === 0) {
      return categories.slice(0, MAX_CATEGORIES)
    }
    const list = categories.filter(c => {
      const name = (c.name || '').toLowerCase()
      return tokens.every(tok => name.includes(tok)) || tokens.some(tok => name.includes(tok))
    })
    return list.slice(0, MAX_CATEGORIES)
  }, [categories, tokens])

  const matchedRestaurants = useMemo(() => {
    if (tokens.length === 0) return []
    return (restaurants || [])
      .filter(r => r.is_published !== false)
      .filter(r => matchesQuery(r, tokens))
      .slice(0, MAX_RESTAURANTS)
  }, [restaurants, tokens])

  const matchedZones = useMemo(() => {
    if (tokens.length === 0) return []
    const all = extractZones(restaurants)
    return all
      .filter(z => {
        const norm = z.toLowerCase()
        return tokens.some(tok => norm.includes(tok))
      })
      .slice(0, MAX_ZONES)
  }, [restaurants, tokens])

  const hasResults = matchedCategories.length > 0 || matchedRestaurants.length > 0 || matchedZones.length > 0
  const showAskBiSuggestion = (value || '').trim().length > 0 && (isConversationalQuery(value) || !hasResults)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeOverlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Click-outside (desktop dropdown only — mobile sheet has explicit close)
  useEffect(() => {
    if (!open || !isDesktop) return
    function onClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        closeOverlay()
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open, isDesktop])

  // Lock body scroll while mobile sheet is open
  useEffect(() => {
    if (!open || isDesktop) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, isDesktop])

  // Focus input when sheet opens on mobile
  useEffect(() => {
    if (open && !isDesktop) {
      // Defer to next tick so the sheet is rendered before focusing
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [open, isDesktop])

  // ── Trigger: identical visual to old SearchBar ─────────────────────────
  const triggerInput = (
    <div
      className="flex items-center gap-3"
      style={{
        background: '#fff',
        border: `1.5px solid ${focused || open ? '#E8453C' : '#E8E5DE'}`,
        borderRadius: 16,
        padding: '13px 18px',
        boxShadow: focused || open ? '0 2px 20px rgba(232, 69, 60, 0.08)' : '0 2px 12px rgba(0,0,0,0.04)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        cursor: 'text',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={focused || open ? '#E8453C' : '#C0BBB3'}
        strokeWidth="2.2" strokeLinecap="round"
        style={{ flexShrink: 0, transition: 'stroke 0.2s' }}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        value={value ?? ''}
        onChange={(e) => { onChange?.(e.target.value); if (!open) setOpen(true) }}
        onFocus={handleInputFocus}
        onBlur={() => setFocused(false)}
        placeholder={t('home.search') || 'Ristorante, cucina, zona…'}
        style={{
          flex: 1, background: 'transparent',
          fontSize: 14, fontWeight: 500, color: '#22181C',
          outline: 'none', border: 'none',
          fontFamily: 'var(--font-sans)',
          minWidth: 0,
        }}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      <AnimatePresence>
        {value && value.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => { e.stopPropagation(); handleClear() }}
            type="button"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)', color: '#8A8680',
              border: 'none', cursor: 'pointer', flexShrink: 0,
            }}
            aria-label="Cancella ricerca"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )

  // ── Suggestion content (shared between desktop dropdown & mobile sheet) ─
  const suggestionContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '14px 4px' }}>
      {tokens.length === 0 && (
        <Section title="Prova a cercare">
          <ChipsRow>
            {POPULAR_SUGGESTIONS.map(s => {
              const info = getCategoryInfo(s)
              return (
                <Chip key={s} onClick={() => pickCategory(s)} emoji={info.emoji} label={s} color={info.color} />
              )
            })}
          </ChipsRow>
        </Section>
      )}

      {matchedCategories.length > 0 && (
        <Section title={tokens.length === 0 ? 'Tutte le cucine' : 'Cucine'}>
          <ChipsRow>
            {matchedCategories.map(c => (
              <Chip key={c.name} onClick={() => pickCategory(c.name)} emoji={c.emoji} label={c.name} color={c.color} />
            ))}
          </ChipsRow>
        </Section>
      )}

      {matchedRestaurants.length > 0 && (
        <Section title="Ristoranti">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {matchedRestaurants.map(r => (
              <RestaurantRow key={r.id} restaurant={r} onClick={() => pickRestaurant(r.slug)} />
            ))}
          </div>
        </Section>
      )}

      {matchedZones.length > 0 && (
        <Section title="Zone">
          <ChipsRow>
            {matchedZones.map(z => (
              <Chip key={z} onClick={() => pickZone(z)} emoji="📍" label={z} color="#22181C" />
            ))}
          </ChipsRow>
        </Section>
      )}

      {tokens.length > 0 && !hasResults && (
        <div style={{
          padding: '20px 16px', textAlign: 'center',
          color: '#8A8680', fontSize: 14, fontWeight: 500,
        }}>
          Nessun risultato per <strong style={{ color: '#22181C' }}>"{value}"</strong>.<br />
          Prova a chiedere a Bi qua sotto.
        </div>
      )}

      <AskBiCta query={value} highlighted={showAskBiSuggestion} onClick={askBi} />
    </div>
  )

  // ── Desktop dropdown ───────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div ref={wrapRef} style={{ position: 'relative' }}>
        {triggerInput}
        <AnimatePresence>
          {open && (
            <motion.div
              ref={overlayRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0, right: 0,
                zIndex: 60,
                background: '#fff',
                borderRadius: 18,
                border: '1px solid #E8E5DE',
                boxShadow: '0 8px 28px rgba(34,24,28,0.12), 0 2px 8px rgba(34,24,28,0.06)',
                padding: '8px 14px',
                maxHeight: 'min(70vh, 560px)',
                overflowY: 'auto',
              }}
            >
              {suggestionContent}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ── Mobile full-screen sheet ───────────────────────────────────────────
  return (
    <div ref={wrapRef}>
      {triggerInput}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'fixed', inset: 0,
              zIndex: 200,
              background: '#FAF7F2',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 16px',
              borderBottom: '1px solid #E8E5DE',
              background: '#fff',
            }}>
              <button
                type="button"
                onClick={closeOverlay}
                aria-label="Chiudi ricerca"
                style={{
                  width: 38, height: 38, borderRadius: 12,
                  border: 'none', background: 'transparent',
                  display: 'grid', placeItems: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22181C" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#F2EEE6', borderRadius: 14,
                  padding: '11px 14px',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8453C" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={value ?? ''}
                    onChange={(e) => onChange?.(e.target.value)}
                    placeholder={t('home.search') || 'Ristorante, cucina, zona…'}
                    style={{
                      flex: 1, background: 'transparent',
                      fontSize: 15, fontWeight: 500, color: '#22181C',
                      outline: 'none', border: 'none',
                      fontFamily: 'var(--font-sans)', minWidth: 0,
                    }}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  {value && value.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClear}
                      aria-label="Cancella ricerca"
                      style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.06)', color: '#8A8680',
                        border: 'none', display: 'grid', placeItems: 'center',
                        cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <motion.div
              initial={{ y: 12 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '4px 16px 80px',
              }}
            >
              {suggestionContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 800,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: '#8A8680',
        padding: '0 4px 8px',
      }}>{title}</div>
      {children}
    </div>
  )
}

function ChipsRow({ children }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 4px' }}>
      {children}
    </div>
  )
}

function Chip({ onClick, emoji, label, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '9px 13px',
        borderRadius: 999,
        background: '#fff',
        border: `1.5px solid ${color || '#E8E5DE'}30`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        fontSize: 13, fontWeight: 700,
        color: '#22181C',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
      <span>{label}</span>
    </button>
  )
}

function RestaurantRow({ restaurant, onClick }) {
  const firstPhoto = Array.isArray(restaurant.photos) && restaurant.photos.length > 0
    ? restaurant.photos[0] : null
  const photoUrl = firstPhoto
    ? proxyImg(typeof firstPhoto === 'string' ? firstPhoto : firstPhoto?.thumb_url || firstPhoto?.photo_url)
    : null
  const cats = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
  const meta = [cats[0], restaurant.price_range != null ? '€'.repeat(restaurant.price_range) : null]
    .filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 8px',
        background: 'transparent',
        border: 'none', borderRadius: 12,
        cursor: 'pointer', textAlign: 'left',
        width: '100%',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: photoUrl
          ? `url(${photoUrl}) center/cover`
          : 'linear-gradient(135deg,#C9A57B,#7D5230)',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: '#22181C',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontFamily: 'var(--font-sans)',
        }}>{restaurant.name}</div>
        {meta && (
          <div style={{ fontSize: 12, color: '#8A8680', marginTop: 2 }}>{meta}</div>
        )}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C0BBB3" strokeWidth="2.4" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}

function AskBiCta({ query, highlighted, onClick }) {
  const trimmed = (query || '').trim()
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        margin: '4px 0 0',
        padding: '14px 16px',
        background: highlighted ? 'linear-gradient(135deg, #FFEDE9 0%, #FFF6EB 100%)' : '#FAF7F2',
        border: `1.5px solid ${highlighted ? '#E8453C' : '#E8E5DE'}`,
        borderRadius: 16,
        cursor: 'pointer', textAlign: 'left',
        width: '100%',
        boxShadow: highlighted ? '0 2px 14px rgba(232,69,60,0.12)' : 'none',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: 'linear-gradient(135deg, #E8453C 0%, #C6372F 100%)',
        color: '#fff',
        display: 'grid', placeItems: 'center',
        fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
        fontSize: 17,
        flex: '0 0 38px',
        boxShadow: '0 4px 10px rgba(232,69,60,.3)',
      }}>B</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#22181C', fontFamily: 'var(--font-sans)' }}>
          {trimmed ? `Chiedi a Bi: "${trimmed.slice(0, 60)}${trimmed.length > 60 ? '…' : ''}"` : 'Chiedi a Bi'}
        </div>
        <div style={{ fontSize: 12, color: '#8A8680', marginTop: 2 }}>
          Suggerimenti smart per ogni voglia
        </div>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8453C" strokeWidth="2.4" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}
