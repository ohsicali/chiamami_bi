import { useCategories } from '../../../lib/hooks/useCategories'
import FGroup from './_FGroup'
import { FField, FInput, FTextarea, FSelect, FRow } from './_Fields'

/**
 * DettagliTab — scope ridotto alla parte testuale (no cover-grid).
 * Contains: Anagrafica + Voce di Bi. Foto e piatti vivono negli altri tab.
 * Credenziali PIN: info box che rimanda al tab "Credenziali" (evita duplicazione).
 */
export default function DettagliTab({ form, onChange }) {
  const { categories } = useCategories()

  return (
    <div>
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
            <FInput value={form.address} onChange={(v) => onChange({ address: v })} placeholder="Via Monte di Pietà 23, Torino" />
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
          <FField label="Occhiello (una riga)">
            <FInput
              value={form.tagline}
              onChange={(v) => onChange({ tagline: v })}
              placeholder="La piola che prende tutto sul serio, tranne se stessa."
              maxLength={180}
            />
          </FField>
        </FRow>
        <FRow one>
          <FField label="Racconto completo">
            <FTextarea
              value={form.our_review}
              onChange={(v) => onChange({ our_review: v })}
              placeholder="Cosa racconti a un amico che ti chiede perché ci deve andare?"
              rows={8}
            />
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
