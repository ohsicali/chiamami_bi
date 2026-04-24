import { useState } from 'react'
import { useCategories } from '../../../lib/hooks/useCategories'
import FGroup from './_FGroup'
import { FField, FInput, FTextarea, FSelect, FRow } from './_Fields'
import { useAiCorrect, AiCorrectButton, AiSuggestionBox } from './_AiCorrect'
import GoogleMapsImportBlock from '../GoogleMapsImportBlock'
import GooglePlacesBlock from '../GooglePlacesBlock'
import { geocodeAddress } from '../../../lib/utils/geocoding'

/**
 * DettagliTab — scope ridotto alla parte testuale (no cover-grid).
 * Contains: Anagrafica + Voce di Bi. Foto e piatti vivono negli altri tab.
 * Credenziali PIN: info box che rimanda al tab "Credenziali" (evita duplicazione).
 */
export default function DettagliTab({ form, onChange, restaurantId, isNew }) {
  const { categories } = useCategories()
  const ai = useAiCorrect()
  const [geocoding, setGeocoding] = useState(false)

  async function runGeocode() {
    if (!form.address?.trim()) return
    setGeocoding(true)
    const fullAddress = `${form.address}, ${form.city || 'Torino'}`
    const result = await geocodeAddress(fullAddress)
    if (result) onChange({ latitude: String(result.latitude), longitude: String(result.longitude) })
    setGeocoding(false)
  }

  function handleAddressBlur() {
    const hasCoords = form.latitude && form.longitude
    if (!hasCoords) runGeocode()
  }

  return (
    <div>
      {/* Google Maps import — banner (espanso) su nuovo ristorante, compact su edit */}
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
        <FRow>
          <FField label="Categoria principale">
            <FSelect value={form.cuisine_type} onChange={(v) => onChange({ cuisine_type: v, category: v ? [v] : [] })}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </FSelect>
          </FField>
          <FField label="Zona · città">
            <FInput value={form.city} onChange={(v) => onChange({ city: v })} placeholder="San Salvario" />
          </FField>
        </FRow>
        <FRow>
          <FField label="Indirizzo">
            <FInput value={form.address} onChange={(v) => onChange({ address: v })} onBlur={handleAddressBlur} placeholder="Via Monte di Pietà 23, Torino" />
          </FField>
          <FField label="Fascia prezzo">
            <FSelect value={String(form.price_range ?? 2)} onChange={(v) => onChange({ price_range: parseInt(v, 10) || 2 })}>
              <option value="1">€ · economico</option>
              <option value="2">€€ · medio</option>
              <option value="3">€€€ · 30–50€</option>
              <option value="4">€€€€ · alto</option>
            </FSelect>
          </FField>
        </FRow>
        <FRow>
          <FField label="Latitudine" hint="Pin sulla mappa">
            <FInput value={String(form.latitude ?? '')} onChange={(v) => onChange({ latitude: v })} placeholder="45.0703" />
          </FField>
          <FField label="Longitudine">
            <FInput value={String(form.longitude ?? '')} onChange={(v) => onChange({ longitude: v })} placeholder="7.6869" />
          </FField>
        </FRow>
        <div style={{ marginBottom: 10 }}>
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

      {/* Voce di Bi */}
      <FGroup title="La voce di Bi" count="il cuore della scheda">
        <FRow one>
          <FField
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span>Occhiello (una riga)</span>
                <AiCorrectButton
                  ai={ai}
                  field="tagline"
                  getText={() => form.tagline}
                  context="restaurant tip"
                />
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
                <AiCorrectButton
                  ai={ai}
                  field="our_review"
                  getText={() => form.our_review}
                  context="restaurant review"
                />
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
