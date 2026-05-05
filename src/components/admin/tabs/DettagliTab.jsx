import { useState, useMemo, useRef, useEffect } from 'react'
import { useCategories, CATEGORY_GROUPS } from '../../../lib/hooks/useCategories'
import FGroup from './_FGroup'
import { FField, FInput, FTextarea, FRow } from './_Fields'
import { useAiCorrect, AiCorrectButton, AiSuggestionBox } from './_AiCorrect'
import GoogleMapsImportBlock from '../GoogleMapsImportBlock'
import GooglePlacesBlock from '../GooglePlacesBlock'
import { geocodeAddress } from '../../../lib/utils/geocoding'

const PRICE_LEVELS = [
  { value: 1, label: '€', desc: 'economico' },
  { value: 2, label: '€€', desc: 'medio' },
  { value: 3, label: '€€€', desc: '30–50€' },
  { value: 4, label: '€€€€', desc: 'alto' },
]

// Le 5 fasce canoniche; chiavi allineate a MOMENT_KEYS in src/lib/hours.js
// e al check constraint SQL su restaurants.moments.
const MOMENT_OPTIONS = [
  { key: 'colazione', emoji: '🥐', label: 'Colazione' },
  { key: 'pranzo',    emoji: '🍝', label: 'Pranzo' },
  { key: 'aperitivo', emoji: '🥂', label: 'Aperitivo' },
  { key: 'cena',      emoji: '🍷', label: 'Cena' },
  { key: 'dopocena',  emoji: '🍸', label: 'Dopo cena' },
]

const RECOMMENDED_FOR_OPTIONS = [
  'Cena romantica',
  'Famiglia',
  'Pranzo di lavoro',
  'Aperitivo',
  'Brunch',
  'Appuntamento',
  'Tradizione',
  'Esperienza unica',
  'Vegetariano',
  'Gruppo di amici',
  'Vista panoramica',
  'Prezzo accessibile',
]

export default function DettagliTab({ form, onChange, restaurantId, isNew }) {
  const { categories } = useCategories()
  const ai = useAiCorrect()
  const [geocoding, setGeocoding] = useState(false)
  const [customTag, setCustomTag] = useState('')
  const [catDropdownOpen, setCatDropdownOpen] = useState(false)
  const catDropdownRef = useRef(null)

  // Chiudi dropdown se si clicca fuori
  useEffect(() => {
    if (!catDropdownOpen) return
    const handleClickOutside = (e) => {
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target)) {
        setCatDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [catDropdownOpen])

  // Categorie raggruppate per group_key, ordinate per gruppo
  const categoriesByGroup = useMemo(() => {
    const grouped = {}
    CATEGORY_GROUPS.forEach((g) => {
      grouped[g.key] = []
    })
    categories.forEach((c) => {
      const key = c.group_key || 'cucina'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(c)
    })
    return grouped
  }, [categories])

  async function runGeocode() {
    if (!form.address?.trim()) return
    setGeocoding(true)
    const fullAddress = `${form.address}, ${form.city || 'Torino'}`
    const result = await geocodeAddress(fullAddress)
    if (result) onChange({ latitude: String(result.latitude), longitude: String(result.longitude) })
    setGeocoding(false)
  }

  function handleAddressBlur() {
    if (!form.latitude && !form.longitude) runGeocode()
  }

  function toggleMoment(key) {
    const current = Array.isArray(form.moments) ? form.moments : []
    onChange({
      moments: current.includes(key)
        ? current.filter((m) => m !== key)
        : [...current, key],
    })
  }

  function toggleRecommended(tag) {
    const current = Array.isArray(form.recommended_for) ? form.recommended_for : []
    onChange({
      recommended_for: current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag],
    })
  }

  function addCustomTag() {
    const tag = customTag.trim()
    if (!tag) return
    const current = Array.isArray(form.recommended_for) ? form.recommended_for : []
    if (!current.includes(tag)) onChange({ recommended_for: [...current, tag] })
    setCustomTag('')
  }

  // Categoria principale + categorie multiple
  const mainCategory = form.cuisine_type
  const allCategories = Array.isArray(form.category) ? form.category : []

  function setMainCategory(catName) {
    const current = Array.isArray(form.category) ? form.category : []
    // La principale è sempre la prima nel set
    const next = [catName, ...current.filter((c) => c !== catName)]
    onChange({ cuisine_type: catName, category: next })
  }

  function toggleSecondaryCategory(catName) {
    const current = Array.isArray(form.category) ? form.category : []
    if (current.includes(catName)) {
      // Rimuovi: se è la principale, scegli un'altra come principale
      const next = current.filter((c) => c !== catName)
      const newMain = catName === mainCategory ? next[0] || '' : mainCategory
      onChange({ category: next, cuisine_type: newMain })
    } else {
      // Aggiungi
      const next = [...current, catName]
      onChange({ category: next, cuisine_type: mainCategory || catName })
    }
  }

  const recommended = Array.isArray(form.recommended_for) ? form.recommended_for : []
  const customTags = recommended.filter((t) => !RECOMMENDED_FOR_OPTIONS.includes(t))

  return (
    <div>
      {/* Google Maps import */}
      <GoogleMapsImportBlock
        variant={isNew ? 'banner' : 'compact'}
        onApply={(patch) => onChange(patch)}
        onSlug={slugify}
        currentPlaceId={form.place_id}
      />

      {/* Google Places — orari automatici */}
      <GooglePlacesBlock form={form} onChange={onChange} restaurantId={restaurantId} />

      {/* ── 1. ANAGRAFICA — il minimo necessario ── */}
      <FGroup title="Anagrafica" count="il minimo necessario">
        <FRow>
          <FField label="Nome ristorante">
            <FInput value={form.name} onChange={(v) => onChange({ name: v })} placeholder="Es. Consorzio" />
          </FField>
          <FField label="Slug (URL)">
            <FInput value={form.slug} onChange={(v) => onChange({ slug: slugify(v) })} placeholder="consorzio" />
          </FField>
        </FRow>

        <FRow>
          <FField label="Zona · città">
            <FInput value={form.city} onChange={(v) => onChange({ city: v })} placeholder="San Salvario" />
          </FField>
          <FField label="Indirizzo">
            <FInput
              value={form.address}
              onChange={(v) => onChange({ address: v })}
              onBlur={handleAddressBlur}
              placeholder="Via Monte di Pietà 23, Torino"
            />
          </FField>
        </FRow>

        {/* Coordinate — collassabili in un dettaglio */}
        <details
          style={{
            border: '1px dashed var(--color-line, #EAE3D7)',
            borderRadius: 10,
            padding: '8px 12px',
            marginTop: 4,
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              userSelect: 'none',
            }}
          >
            📍 Coordinate (avanzate)
          </summary>
          <div style={{ marginTop: 10 }}>
            <FRow>
              <FField label="Latitudine" hint="Pin sulla mappa · auto-calcolata dall'indirizzo">
                <FInput value={String(form.latitude ?? '')} onChange={(v) => onChange({ latitude: v })} placeholder="45.0703" />
              </FField>
              <FField label="Longitudine">
                <FInput value={String(form.longitude ?? '')} onChange={(v) => onChange({ longitude: v })} placeholder="7.6869" />
              </FField>
            </FRow>
            <button
              type="button"
              onClick={runGeocode}
              disabled={geocoding || !form.address?.trim()}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-corallo, #E8453C)',
                color: 'var(--color-corallo, #E8453C)',
                padding: '7px 14px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.05em',
                cursor: geocoding ? 'wait' : 'pointer',
                fontFamily: 'var(--font-sans)',
                opacity: !form.address?.trim() || geocoding ? 0.5 : 1,
                marginTop: 4,
              }}
            >
              {geocoding ? '⏳ Cerco coordinate…' : '📍 Trova coordinate da indirizzo'}
            </button>
          </div>
        </details>

        {/* Fascia prezzo */}
        <FField label="Fascia prezzo">
          <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
            {PRICE_LEVELS.map(({ value, label, desc }) => {
              const active = (form.price_range ?? 2) === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange({ price_range: value })}
                  title={desc}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: `1.5px solid ${active ? 'var(--color-corallo, #E8453C)' : 'var(--color-line, #EAE3D7)'}`,
                    background: active ? 'var(--color-corallo, #E8453C)' : '#fff',
                    color: active ? '#fff' : 'var(--color-ink-55, rgba(34,24,28,0.55))',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    transition: 'all 0.12s',
                    minWidth: 52,
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </FField>
      </FGroup>

      {/* ── 2. CATEGORIE — dropdown raggruppata ── */}
      <FGroup
        title="Categorie e tag"
        count={
          allCategories.length
            ? `${allCategories.length} ${allCategories.length === 1 ? 'selezionata' : 'selezionate'}`
            : 'nessuna selezionata'
        }
      >
        <FField
          label="Categorie del ristorante"
          hint="Seleziona prima la cucina principale. Aggiungi anche atmosfera, occasione, servizi, dieta — più info dai, meglio è per il SEO."
        >
          <div ref={catDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setCatDropdownOpen((o) => !o)}
              style={{
                width: '100%',
                textAlign: 'left',
                border: '1px solid var(--color-line, #EAE3D7)',
                borderRadius: 10,
                padding: '10px 36px 10px 12px',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-ink, #22181C)',
                background: '#fff',
                cursor: 'pointer',
                position: 'relative',
                minHeight: 42,
              }}
            >
              {allCategories.length === 0 ? (
                <span style={{ color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontWeight: 500 }}>
                  Apri per selezionare le categorie…
                </span>
              ) : (
                <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
                  {allCategories.map((catName) => {
                    const c = categories.find((x) => x.name === catName)
                    const isMain = catName === mainCategory
                    return (
                      <span
                        key={catName}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 10px',
                          borderRadius: 999,
                          background: isMain ? (c?.color || '#E8453C') : '#fff',
                          color: isMain ? '#fff' : 'var(--color-ink, #22181C)',
                          border: isMain ? 'none' : `1.5px solid ${c?.color || '#ccc'}`,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {c?.emoji && <span>{c.emoji}</span>}
                        {catName}
                        {isMain && <span style={{ fontSize: 9, opacity: 0.85 }}>📍</span>}
                      </span>
                    )
                  })}
                </span>
              )}
              <span
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: `translateY(-50%) rotate(${catDropdownOpen ? 180 : 0}deg)`,
                  fontSize: 10,
                  color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                  transition: 'transform 0.15s',
                }}
              >
                ▼
              </span>
            </button>

            {catDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 6,
                  background: '#fff',
                  border: '1px solid var(--color-line, #EAE3D7)',
                  borderRadius: 14,
                  boxShadow: '0 10px 28px rgba(0,0,0,0.08)',
                  maxHeight: 460,
                  overflowY: 'auto',
                  zIndex: 30,
                  padding: '10px 0',
                }}
              >
                {CATEGORY_GROUPS.map((g) => {
                  const list = categoriesByGroup[g.key] || []
                  if (!list.length) return null
                  return (
                    <div key={g.key} style={{ padding: '6px 14px 14px' }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                          marginBottom: 8,
                          paddingBottom: 6,
                          borderBottom: '1px solid var(--color-line, #EAE3D7)',
                        }}
                      >
                        {g.emoji} {g.label}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {list.map((c) => {
                          const isSelected = allCategories.includes(c.name)
                          const isMain = c.name === mainCategory
                          return (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => {
                                if (g.key === 'cucina' && !isSelected) {
                                  // Cucina: selezionando la imposta come principale
                                  setMainCategory(c.name)
                                } else {
                                  toggleSecondaryCategory(c.name)
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 999,
                                border: isSelected
                                  ? `1.5px solid ${c.color || 'var(--color-corallo, #E8453C)'}`
                                  : '1.5px solid var(--color-line, #EAE3D7)',
                                background: isSelected ? (isMain ? c.color || '#E8453C' : `${c.color}18`) : '#fff',
                                color: isMain ? '#fff' : 'var(--color-ink, #22181C)',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-sans)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                              title={
                                g.key === 'cucina'
                                  ? isMain
                                    ? 'Cucina principale (mostrata sul pin)'
                                    : 'Imposta come cucina principale'
                                  : isSelected
                                    ? 'Rimuovi'
                                    : 'Aggiungi'
                              }
                            >
                              {c.emoji && <span>{c.emoji}</span>}
                              {c.name}
                              {isMain && <span style={{ fontSize: 10 }}>📍</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </FField>

        {mainCategory && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
              fontWeight: 600,
              marginTop: 4,
            }}
          >
            📍 <b style={{ color: 'var(--color-ink)' }}>{mainCategory}</b> è la categoria principale
            (verrà mostrata sul pin in mappa).
          </div>
        )}
      </FGroup>

      {/* ── 3. CONTATTI E LINK ── */}
      <FGroup title="Contatti e link" count="opzionali ma utili">
        <FRow>
          <FField label="Telefono">
            <FInput value={form.phone} onChange={(v) => onChange({ phone: v })} placeholder="+39 011 276 7661" />
          </FField>
          <FField label="Sito web">
            <FInput value={form.website} onChange={(v) => onChange({ website: v })} placeholder="consorzio-torino.it" />
          </FField>
        </FRow>
        <FRow>
          <FField label="Link al menu" hint="Pagina o PDF del menu">
            <FInput
              value={form.menu_url}
              onChange={(v) => onChange({ menu_url: v })}
              placeholder="https://consorzio-torino.it/menu"
            />
          </FField>
          <FField label="Link prenotazione" hint="TheFork, Plateform, modulo proprio…">
            <FInput
              value={form.reservation_url}
              onChange={(v) => onChange({ reservation_url: v })}
              placeholder="https://thefork.it/restaurant/…"
            />
          </FField>
        </FRow>
        <FRow>
          <FField label="Instagram">
            <FInput
              value={form.instagram_url}
              onChange={(v) => onChange({ instagram_url: v })}
              placeholder="https://instagram.com/consorzio"
            />
          </FField>
          <FField label="Link Google Maps (opzionale)">
            <FInput
              value={form.google_maps_url}
              onChange={(v) => onChange({ google_maps_url: v })}
              placeholder="https://maps.app.goo.gl/…"
            />
          </FField>
        </FRow>
      </FGroup>

      {/* ── 4. CONSIGLIATO PER ── */}
      <FGroup
        title="Quando andarci"
        count="fasce in cui questo locale ha senso — seleziona quelle giuste"
      >
        <div style={{ fontSize: 12, color: 'var(--color-ink-70, rgba(34,24,28,.7))', marginBottom: 10, lineHeight: 1.45 }}>
          Lascia vuoto per usare gli orari di Google come default. Selezionando una o più
          fasce sovrascrivi: il locale appare in quelle, anche se gli orari non
          combaciassero.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MOMENT_OPTIONS.map((m) => {
            const active = Array.isArray(form.moments) && form.moments.includes(m.key)
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleMoment(m.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: `1.5px solid ${active ? 'var(--color-corallo, #E8453C)' : 'var(--color-line, #EAE3D7)'}`,
                  background: active ? 'var(--color-corallo, #E8453C)' : '#fff',
                  color: active ? '#fff' : 'var(--color-ink, #22181C)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{m.emoji}</span>
                {m.label}
              </button>
            )
          })}
        </div>
      </FGroup>

      <FGroup title="Consigliato per" count="seleziona tutti quelli che si applicano">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {RECOMMENDED_FOR_OPTIONS.map((tag) => {
            const active = recommended.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleRecommended(tag)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: `1.5px solid ${active ? 'var(--color-corallo, #E8453C)' : 'var(--color-line, #EAE3D7)'}`,
                  background: active ? 'var(--color-corallo, #E8453C)' : '#fff',
                  color: active ? '#fff' : 'var(--color-ink, #22181C)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.12s',
                }}
              >
                {tag}
              </button>
            )
          })}
        </div>
        {/* Custom tag input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
            placeholder="Aggiungi tag personalizzato…"
            style={{
              flex: 1,
              border: '1px solid var(--color-line, #EAE3D7)',
              borderRadius: 10,
              padding: '9px 12px',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-ink, #22181C)',
              background: '#fff',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={addCustomTag}
            style={{
              background: 'var(--color-ink, #22181C)',
              color: '#fff',
              border: 0,
              padding: '9px 16px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              whiteSpace: 'nowrap',
            }}
          >
            Aggiungi
          </button>
        </div>
        {customTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {customTags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: 'rgba(232,69,60,0.1)',
                  color: 'var(--color-corallo, #E8453C)',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => toggleRecommended(tag)}
                  style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, color: 'inherit', lineHeight: 1, fontSize: 11 }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </FGroup>

      {/* ── 5. VOCE DI BI — il cuore della scheda ── */}
      <FGroup title="La voce di Bi" count="il cuore della scheda">
        <FRow one>
          <FField
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span>Occhiello (una riga)</span>
                <AiCorrectButton ai={ai} field="tagline" getText={() => form.tagline} context="restaurant tip" />
              </span>
            }
          >
            <FInput
              value={form.tagline}
              onChange={(v) => onChange({ tagline: v })}
              placeholder="La piola che prende tutto sul serio, tranne se stessa."
              maxLength={180}
            />
            <AiSuggestionBox ai={ai} field="tagline" onAccept={(t) => onChange({ tagline: t })} />
          </FField>
        </FRow>
        <FRow one>
          <FField
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span>Racconto completo</span>
                <AiCorrectButton ai={ai} field="our_review" getText={() => form.our_review} context="restaurant review" />
              </span>
            }
            hint="Almeno 80 caratteri per sbloccare la generazione SEO con AI."
          >
            <FTextarea
              value={form.our_review}
              onChange={(v) => onChange({ our_review: v })}
              placeholder="Cosa racconti a un amico che ti chiede perché ci deve andare?"
              rows={8}
            />
            <AiSuggestionBox ai={ai} field="our_review" onAccept={(t) => onChange({ our_review: t })} />
          </FField>
        </FRow>
      </FGroup>

      {/* ── 6. PUBBLICAZIONE ── */}
      <FGroup title="Pubblicazione">
        <FRow>
          <FField label="Status">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => onChange({ is_published: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              Scheda pubblica (visibile nella guida)
            </label>
          </FField>
          <FField label="Indicizzazione">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.noindex}
                onChange={(e) => onChange({ noindex: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              Escludi da Google (noindex)
            </label>
          </FField>
        </FRow>
      </FGroup>
    </div>
  )
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
