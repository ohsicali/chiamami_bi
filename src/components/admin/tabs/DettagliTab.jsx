import { useState } from 'react'
import { useCategories } from '../../../lib/hooks/useCategories'
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

      {/* Anagrafica */}
      <FGroup title="Anagrafica" count="il minimo necessario">
        <FRow>
          <FField label="Nome ristorante">
            <FInput value={form.name} onChange={(v) => onChange({ name: v })} placeholder="Es. Consorzio" />
          </FField>
          <FField label="Slug (URL)">
            <FInput value={form.slug} onChange={(v) => onChange({ slug: slugify(v) })} placeholder="consorzio" />
          </FField>
        </FRow>

        {/* Categoria — visual chips */}
        <FField label="Categoria principale">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
            {categories.map((c) => {
              const active = form.cuisine_type === c.name
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => onChange({ cuisine_type: c.name, category: [c.name] })}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: `1.5px solid ${active ? c.color || 'var(--color-corallo, #E8453C)' : 'var(--color-line, #EAE3D7)'}`,
                    background: active ? (c.color || 'var(--color-corallo, #E8453C)') : '#fff',
                    color: active ? '#fff' : 'var(--color-ink, #22181C)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.12s',
                  }}
                >
                  {c.emoji && <span>{c.emoji}</span>}
                  {c.name}
                </button>
              )
            })}
          </div>
        </FField>

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

        {/* Coordinate */}
        <FRow>
          <FField label="Latitudine" hint="Pin sulla mappa · auto-calcolata dall'indirizzo">
            <FInput value={String(form.latitude ?? '')} onChange={(v) => onChange({ latitude: v })} placeholder="45.0703" />
          </FField>
          <FField label="Longitudine">
            <FInput value={String(form.longitude ?? '')} onChange={(v) => onChange({ longitude: v })} placeholder="7.6869" />
          </FField>
        </FRow>
        <div style={{ marginBottom: 14 }}>
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
              opacity: (!form.address?.trim() || geocoding) ? 0.5 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {geocoding ? '⏳ Cerco coordinate…' : '📍 Trova coordinate da indirizzo'}
          </button>
        </div>

        {/* Fascia prezzo — bottoni */}
        <FField label="Fascia prezzo">
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
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

        <FRow>
          <FField label="Telefono">
            <FInput value={form.phone} onChange={(v) => onChange({ phone: v })} placeholder="+39 011 276 7661" />
          </FField>
          <FField label="Website">
            <FInput value={form.website} onChange={(v) => onChange({ website: v })} placeholder="consorzio-torino.it" />
          </FField>
        </FRow>
        <FRow>
          <FField label="Link Google Maps (opzionale)">
            <FInput value={form.google_maps_url} onChange={(v) => onChange({ google_maps_url: v })} placeholder="https://maps.app.goo.gl/…" />
          </FField>
        </FRow>
      </FGroup>

      {/* Consigliato per */}
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

      {/* Voce di Bi */}
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

      {/* Pubblicazione */}
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
          <FField label="Nasconde la scheda dai motori di ricerca">
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
