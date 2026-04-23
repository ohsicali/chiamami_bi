import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'
import SponsorBanner from '../../components/Home/SponsorBanner'

const VARIANTS = [
  { key: 'restaurant_discount', label: 'Ristorante + sconto', hint: 'Richiede ristorante + sconto attivo associato' },
  { key: 'restaurant_plain',    label: 'Ristorante senza sconto', hint: 'Solo ristorante, CTA Scopri di più' },
  { key: 'brand',               label: 'Brand non-food',          hint: 'Logo + nome + CTA esterno (cantine, gastronomie…)' },
]

const EMPTY_FORM = {
  id: null,
  variant: 'restaurant_plain',
  restaurant_id: '',
  brand_name: '',
  brand_subtitle: '',
  discount_id: '',
  headline: '',
  subtitle: '',
  cta_label: '',
  cta_url: '',
  cover_image_url: '',
  logo_image_url: '',
  priority: 0,
  start_at: '',
  end_at: '',
  active: true,
}

function toLocalInput(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(str) {
  if (!str) return null
  return new Date(str).toISOString()
}

export default function PlacementManager() {
  const { isAdmin, loading: authLoading } = useAuth()
  const [placements, setPlacements] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [discounts, setDiscounts] = useState([])
  const [loading, setLoading] = useState(() => !!isSupabaseConfigured())
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading || !isAdmin || !isSupabaseConfigured()) return
    Promise.all([
      supabase
        .from('sponsored_placements')
        .select('*, restaurant:restaurants(id, name, slug), discount:discounts(id, title, discount_value, discount_type)')
        .order('active', { ascending: false })
        .order('priority', { ascending: false })
        .order('start_at', { ascending: false }),
      supabase.from('restaurants').select('id, name').eq('is_published', true).order('name'),
      supabase.from('discounts').select('id, title, restaurant_id, discount_type, discount_value').eq('is_active', true).order('created_at', { ascending: false }),
    ]).then(([p, r, d]) => {
      setPlacements(p.data || [])
      setRestaurants(r.data || [])
      setDiscounts(d.data || [])
      setLoading(false)
    })
  }, [authLoading, isAdmin])

  const filteredDiscounts = useMemo(() => {
    if (!form.restaurant_id) return discounts
    return discounts.filter((d) => d.restaurant_id === form.restaurant_id)
  }, [discounts, form.restaurant_id])

  // `nowKey` cambia ogni ~minuto per tenere i bucket freschi senza fare re-render inutili
  const [nowKey] = useState(() => Date.now())
  const categorized = useMemo(() => {
    const now = nowKey
    const active = []
    const upcoming = []
    const expired = []
    for (const p of placements) {
      const start = new Date(p.start_at).getTime()
      const end = new Date(p.end_at).getTime()
      if (p.active && start <= now && end > now) active.push(p)
      else if (p.active && start > now) upcoming.push(p)
      else expired.push(p)
    }
    return { active, upcoming, expired }
  }, [placements, nowKey])

  if (authLoading) return null
  if (!isAdmin) return <Navigate to="/" replace />

  const startCreate = () => {
    const now = new Date()
    const endDefault = new Date(now.getTime() + 14 * 24 * 3600_000)
    setForm({
      ...EMPTY_FORM,
      start_at: toLocalInput(now),
      end_at: toLocalInput(endDefault),
    })
    setEditing(true)
    setError(null)
  }

  const startEdit = (p) => {
    setForm({
      id: p.id,
      variant: p.variant,
      restaurant_id: p.restaurant_id || '',
      brand_name: p.brand_name || '',
      brand_subtitle: p.brand_subtitle || '',
      discount_id: p.discount_id || '',
      headline: p.headline || '',
      subtitle: p.subtitle || '',
      cta_label: p.cta_label || '',
      cta_url: p.cta_url || '',
      cover_image_url: p.cover_image_url || '',
      logo_image_url: p.logo_image_url || '',
      priority: p.priority || 0,
      start_at: toLocalInput(p.start_at),
      end_at: toLocalInput(p.end_at),
      active: !!p.active,
    })
    setEditing(true)
    setError(null)
  }

  const cancelEdit = () => {
    setForm(EMPTY_FORM)
    setEditing(false)
    setError(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)

    // Validate required fields per variant
    if (form.variant === 'restaurant_discount' && (!form.restaurant_id || !form.discount_id)) {
      setSaving(false)
      setError('Variant "Ristorante + sconto" richiede restaurant_id E discount_id.')
      return
    }
    if (form.variant === 'restaurant_plain' && !form.restaurant_id) {
      setSaving(false)
      setError('Variant "Ristorante senza sconto" richiede restaurant_id.')
      return
    }
    if (form.variant === 'brand' && !form.brand_name) {
      setSaving(false)
      setError('Variant "Brand" richiede brand_name.')
      return
    }
    if (!form.start_at || !form.end_at) {
      setSaving(false)
      setError('Start e End sono obbligatori.')
      return
    }
    if (new Date(form.end_at) <= new Date(form.start_at)) {
      setSaving(false)
      setError('End deve essere successivo a Start.')
      return
    }

    const payload = {
      variant: form.variant,
      restaurant_id: form.variant === 'brand' ? null : (form.restaurant_id || null),
      brand_name: form.variant === 'brand' ? form.brand_name.trim() : null,
      brand_subtitle: form.variant === 'brand' ? (form.brand_subtitle.trim() || null) : null,
      discount_id: form.variant === 'restaurant_discount' ? form.discount_id : null,
      headline: form.headline.trim() || null,
      subtitle: form.subtitle.trim() || null,
      cta_label: form.cta_label.trim() || null,
      cta_url: form.cta_url.trim() || null,
      cover_image_url: form.cover_image_url.trim() || null,
      logo_image_url: form.logo_image_url.trim() || null,
      priority: Number(form.priority) || 0,
      start_at: fromLocalInput(form.start_at),
      end_at: fromLocalInput(form.end_at),
      active: !!form.active,
    }

    const op = form.id
      ? supabase.from('sponsored_placements').update(payload).eq('id', form.id).select('*, restaurant:restaurants(id, name, slug), discount:discounts(id, title, discount_value, discount_type)').single()
      : supabase.from('sponsored_placements').insert(payload).select('*, restaurant:restaurants(id, name, slug), discount:discounts(id, title, discount_value, discount_type)').single()

    const { data, error: saveErr } = await op
    if (saveErr) {
      setError(saveErr.message)
      setSaving(false)
      return
    }
    setPlacements((prev) => {
      const without = prev.filter((p) => p.id !== data.id)
      return [data, ...without]
    })
    cancelEdit()
    setSaving(false)
  }

  const remove = async (id) => {
    if (!confirm('Eliminare questo placement?')) return
    const { error: delErr } = await supabase.from('sponsored_placements').delete().eq('id', id)
    if (delErr) { setError(delErr.message); return }
    setPlacements((prev) => prev.filter((p) => p.id !== id))
  }

  const toggleActive = async (p) => {
    const { data, error: updErr } = await supabase
      .from('sponsored_placements')
      .update({ active: !p.active })
      .eq('id', p.id)
      .select('*, restaurant:restaurants(id, name, slug), discount:discounts(id, title, discount_value, discount_type)')
      .single()
    if (updErr) { setError(updErr.message); return }
    setPlacements((prev) => prev.map((x) => (x.id === p.id ? data : x)))
  }

  return (
    <AdminLayout>
      <div style={{ padding: '20px 24px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 24, margin: 0 }}>
              Placements sponsor
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-ink-70)', margin: '4px 0 0' }}>
              Banner home · 3 variant · label "Annuncio" sempre visibile.
            </p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={startCreate}
              style={{
                padding: '10px 18px',
                background: 'var(--color-corallo)',
                color: '#fff',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 800,
                border: 0,
                cursor: 'pointer',
              }}
            >
              + Nuovo placement
            </button>
          )}
        </div>

        {error && (
          <div style={{ background: '#FDEBEA', color: '#C6372F', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        {editing && (
          <Editor
            form={form}
            setForm={setForm}
            restaurants={restaurants}
            discounts={filteredDiscounts}
            save={save}
            cancel={cancelEdit}
            saving={saving}
          />
        )}

        {loading ? (
          <div style={{ color: 'var(--color-ink-70)' }}>Caricamento…</div>
        ) : (
          <>
            <Bucket title={`Attivi ora (${categorized.active.length})`} placements={categorized.active} onEdit={startEdit} onRemove={remove} onToggle={toggleActive} />
            <Bucket title={`In programma (${categorized.upcoming.length})`} placements={categorized.upcoming} onEdit={startEdit} onRemove={remove} onToggle={toggleActive} />
            <Bucket title={`Scaduti / disattivi (${categorized.expired.length})`} placements={categorized.expired} onEdit={startEdit} onRemove={remove} onToggle={toggleActive} dim />
          </>
        )}

        {/* Anteprima live (usa stesso componente home) */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--color-ink-05)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink-70)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
            Anteprima live in home
          </h2>
          <div style={{ maxWidth: 420, background: 'var(--color-page, #FAF7F2)', padding: 8, borderRadius: 20, border: '1px solid var(--color-ink-05)' }}>
            <SponsorBanner />
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

function Bucket({ title, placements, onEdit, onRemove, onToggle, dim }) {
  if (placements.length === 0) return null
  return (
    <div style={{ marginBottom: 28, opacity: dim ? 0.6 : 1 }}>
      <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-ink-70)', marginBottom: 10 }}>
        {title}
      </h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {placements.map((p) => (
          <Row key={p.id} p={p} onEdit={onEdit} onRemove={onRemove} onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}

function Row({ p, onEdit, onRemove, onToggle }) {
  const variantLabel = VARIANTS.find((v) => v.key === p.variant)?.label || p.variant
  const title = p.variant === 'brand'
    ? (p.headline || p.brand_name)
    : (p.headline || p.restaurant?.name || '—')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: '#fff', border: '1px solid var(--color-ink-05)', borderRadius: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-corallo)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {variantLabel} · priority {p.priority}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, margin: '3px 0' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--color-ink-70)' }}>
          {new Date(p.start_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {' → '}
          {new Date(p.end_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <button type="button" onClick={() => onToggle(p)} style={toggleBtnStyle(p.active)}>{p.active ? 'Attivo' : 'Off'}</button>
      <button type="button" onClick={() => onEdit(p)} style={secondaryBtnStyle}>Edit</button>
      <button type="button" onClick={() => onRemove(p.id)} style={dangerBtnStyle}>✕</button>
    </div>
  )
}

function Editor({ form, setForm, restaurants, discounts, save, cancel, saving }) {
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-ink-05)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>
        {form.id ? 'Modifica placement' : 'Nuovo placement'}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        <Field label="Variant">
          <select value={form.variant} onChange={(e) => update('variant', e.target.value)} style={inputStyle}>
            {VARIANTS.map((v) => (<option key={v.key} value={v.key}>{v.label}</option>))}
          </select>
        </Field>

        <Field label="Priority" hint="più alto = mostrato prima">
          <input type="number" value={form.priority} onChange={(e) => update('priority', e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Start (inizio visibilità)">
          <input type="datetime-local" value={form.start_at} onChange={(e) => update('start_at', e.target.value)} style={inputStyle} />
        </Field>

        <Field label="End (fine visibilità)">
          <input type="datetime-local" value={form.end_at} onChange={(e) => update('end_at', e.target.value)} style={inputStyle} />
        </Field>

        {form.variant !== 'brand' && (
          <Field label="Ristorante">
            <select value={form.restaurant_id} onChange={(e) => update('restaurant_id', e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {restaurants.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
            </select>
          </Field>
        )}

        {form.variant === 'restaurant_discount' && (
          <Field label="Sconto collegato">
            <select value={form.discount_id} onChange={(e) => update('discount_id', e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {discounts.map((d) => (<option key={d.id} value={d.id}>{d.title} ({d.discount_value}{d.discount_type === 'percentage' ? '%' : '€'})</option>))}
            </select>
          </Field>
        )}

        {form.variant === 'brand' && (
          <>
            <Field label="Brand · nome">
              <input type="text" value={form.brand_name} onChange={(e) => update('brand_name', e.target.value)} style={inputStyle} placeholder="Cascina Torricelli" />
            </Field>
            <Field label="Brand · sottotitolo">
              <input type="text" value={form.brand_subtitle} onChange={(e) => update('brand_subtitle', e.target.value)} style={inputStyle} placeholder="Bianchi del Monferrato · produttore" />
            </Field>
            <Field label="Logo URL (72×72)">
              <input type="text" value={form.logo_image_url} onChange={(e) => update('logo_image_url', e.target.value)} style={inputStyle} placeholder="https://…" />
            </Field>
            <Field label="CTA · URL esterno">
              <input type="text" value={form.cta_url} onChange={(e) => update('cta_url', e.target.value)} style={inputStyle} placeholder="https://…" />
            </Field>
          </>
        )}

        <Field label="Headline (opzionale)">
          <input type="text" value={form.headline} onChange={(e) => update('headline', e.target.value)} style={inputStyle} placeholder={form.variant === 'brand' ? 'Cascina Torricelli' : 'Override del nome ristorante'} />
        </Field>

        <Field label="Sottotitolo (opzionale)">
          <input type="text" value={form.subtitle} onChange={(e) => update('subtitle', e.target.value)} style={inputStyle} placeholder="Smash burger senza compromessi" />
        </Field>

        <Field label="CTA label (opzionale)">
          <input type="text" value={form.cta_label} onChange={(e) => update('cta_label', e.target.value)} style={inputStyle} placeholder={form.variant === 'restaurant_discount' ? 'Attiva sconto' : 'Scopri di più'} />
        </Field>

        {form.variant !== 'brand' && (
          <Field label="Cover image URL (hero)">
            <input type="text" value={form.cover_image_url} onChange={(e) => update('cover_image_url', e.target.value)} style={inputStyle} placeholder="https://…" />
          </Field>
        )}

        <Field label="Stato">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
            Attivo (visibile se nella finestra start/end)
          </label>
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button type="button" onClick={save} disabled={saving} style={primaryBtnStyle}>
          {saving ? 'Salvataggio…' : (form.id ? 'Salva modifiche' : 'Crea placement')}
        </button>
        <button type="button" onClick={cancel} style={secondaryBtnStyle}>Annulla</button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ink-70)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
        {label}
      </div>
      {children}
      {hint && <div style={{ fontSize: 10, color: 'var(--color-ink-40, rgba(34,24,28,.4))', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--color-ink-05)',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  background: '#fff',
  outline: 'none',
}
const primaryBtnStyle = {
  padding: '10px 18px',
  background: 'var(--color-ink)',
  color: '#fff',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 800,
  border: 0,
  cursor: 'pointer',
}
const secondaryBtnStyle = {
  padding: '8px 14px',
  background: 'var(--color-ink-05)',
  color: 'var(--color-ink)',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  border: 0,
  cursor: 'pointer',
}
const dangerBtnStyle = {
  padding: '8px 12px',
  background: '#FDEBEA',
  color: '#C6372F',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  border: 0,
  cursor: 'pointer',
}
function toggleBtnStyle(active) {
  return {
    padding: '6px 12px',
    background: active ? '#DCFCE7' : 'var(--color-ink-05)',
    color: active ? '#137C3E' : 'var(--color-ink-70)',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    border: 0,
    cursor: 'pointer',
  }
}
