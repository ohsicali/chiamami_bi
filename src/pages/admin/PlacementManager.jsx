import { useState, useEffect, useMemo, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'
import { AdPreview } from '../../components/Ads/AdBanner'
import { AD_SLOT_LIST, AD_FORMATS, AD_SLOTS, MAX_ADS_PER_PAGE } from '../../lib/adSlots'
import { formatDiscountValue } from '../../lib/utils/discountFormat'

/**
 * Pubblicità · gestione campagne per posizione.
 *
 * La pagina è organizzata come si ragiona quando si vende: prima la posizione
 * ("quanto spazio ho libero in home?"), poi i clienti che se la dividono e con
 * che percentuale di rotazione.
 */

const VARIANTS = [
  { key: 'restaurant_discount', label: 'Ristorante + sconto', hint: 'Richiede ristorante e sconto attivo' },
  { key: 'restaurant_plain',    label: 'Ristorante',          hint: 'Solo ristorante, senza sconto collegato' },
  { key: 'brand',               label: 'Brand',               hint: 'Cantine, gastronomie, aziende non-food' },
]

const EMPTY_FORM = {
  id: null,
  slot: 'home_hero',
  variant: 'restaurant_plain',
  client_name: '',
  restaurant_id: '',
  brand_name: '',
  brand_subtitle: '',
  discount_id: '',
  headline: '',
  subtitle: '',
  cta_label: '',
  link_type: 'internal',
  cta_url: '',
  cover_image_url: '',
  logo_image_url: '',
  weight: 5,
  priority: 0,
  start_at: '',
  end_at: '',
  notes: '',
  active: true,
}

const RESTAURANT_FIELDS = 'id, name, slug, cuisine_type, category, address, price_range, tagline'

/* ============================================
   Date e stato
   ============================================ */

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

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 3600_000)
}

function campaignState(p, now = Date.now()) {
  const start = new Date(p.start_at).getTime()
  const end = new Date(p.end_at).getTime()
  if (!p.active) return 'off'
  if (start > now) return 'upcoming'
  if (end <= now) return 'expired'
  return 'live'
}

const STATE_META = {
  live:     { label: 'Attiva ora',   bg: 'var(--color-ok-bg, #E7F2EA)',   fg: 'var(--color-ok, #2C7A4A)' },
  upcoming: { label: 'In programma', bg: 'var(--color-warn-bg, #FBF0DC)', fg: 'var(--color-warn, #8A5A12)' },
  expired:  { label: 'Scaduta',      bg: 'var(--color-ink-05)',           fg: 'var(--color-ink-70)' },
  off:      { label: 'Spenta',       bg: 'var(--color-ink-05)',           fg: 'var(--color-ink-70)' },
}

function remainingLabel(p) {
  const now = Date.now()
  const state = campaignState(p, now)
  if (state === 'live') {
    const days = Math.ceil((new Date(p.end_at).getTime() - now) / (24 * 3600_000))
    return days <= 1 ? 'finisce oggi' : `ancora ${days} giorni`
  }
  if (state === 'upcoming') {
    const days = Math.ceil((new Date(p.start_at).getTime() - now) / (24 * 3600_000))
    return days <= 1 ? 'parte domani' : `parte tra ${days} giorni`
  }
  return null
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/* ============================================
   Rotazione
   ============================================ */

function clampWeight(w) {
  const n = Number(w)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(10, Math.round(n))
}

/** Percentuale di uscita di ogni campagna viva dentro uno slot. */
function rotationShares(livePlacements) {
  const total = livePlacements.reduce((s, p) => s + clampWeight(p.weight), 0)
  if (total === 0) return {}
  return Object.fromEntries(
    livePlacements.map((p) => [p.id, Math.round((clampWeight(p.weight) / total) * 100)])
  )
}

/* ============================================
   Upload immagini
   ============================================ */

/** Ridimensiona e converte in WebP prima di caricare: le creatività arrivano
 *  spesso come JPG da 5 MB e finirebbero tali e quali sulla home. */
function compressImage(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('conversione fallita'))),
        'image/webp',
        0.82
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('immagine non leggibile')) }
    img.src = url
  })
}

async function uploadCreative(file, maxWidth) {
  const blob = await compressImage(file, maxWidth)
  const safe = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40)
  const path = `ads/${Date.now()}-${safe || 'creativita'}.webp`
  const { error } = await supabase.storage
    .from('photos')
    .upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}

/* ============================================
   Pagina
   ============================================ */

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
        .select(`*, restaurant:restaurants(${RESTAURANT_FIELDS}), discount:discounts(id, title, description, discount_value, discount_type)`)
        .order('active', { ascending: false })
        .order('start_at', { ascending: false }),
      supabase.from('restaurants').select(RESTAURANT_FIELDS).eq('is_published', true).order('name'),
      supabase.from('discounts').select('id, title, description, restaurant_id, discount_type, discount_value').eq('is_active', true).order('created_at', { ascending: false }),
    ]).then(([p, r, d]) => {
      if (p.error) setError(p.error.message)
      setPlacements(p.data || [])
      setRestaurants(r.data || [])
      setDiscounts(d.data || [])
      setLoading(false)
    })
  }, [authLoading, isAdmin])

  // Riferimento temporale unico per tutta la pagina: gli stati mostrati
  // ("attiva ora", "in programma") restano coerenti tra loro.
  const [now] = useState(() => Date.now())

  const bySlot = useMemo(() => {
    const map = {}
    for (const slot of AD_SLOT_LIST) map[slot.key] = { all: [], live: [] }
    for (const p of placements) {
      const key = map[p.slot] ? p.slot : '__orphan'
      if (!map[key]) map[key] = { all: [], live: [] }
      map[key].all.push(p)
      if (campaignState(p, now) === 'live') map[key].live.push(p)
    }
    return map
  }, [placements, now])

  if (authLoading) return null
  if (!isAdmin) return <Navigate to="/" replace />

  const startCreate = (slotKey = 'home_hero') => {
    const now = new Date()
    setForm({
      ...EMPTY_FORM,
      slot: slotKey,
      start_at: toLocalInput(now),
      end_at: toLocalInput(addDays(now, 30)),
    })
    setEditing(true)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startEdit = (p) => {
    setForm({
      id: p.id,
      slot: p.slot || 'home_hero',
      variant: p.variant,
      client_name: p.client_name || '',
      restaurant_id: p.restaurant_id || '',
      brand_name: p.brand_name || '',
      brand_subtitle: p.brand_subtitle || '',
      discount_id: p.discount_id || '',
      headline: p.headline || '',
      subtitle: p.subtitle || '',
      cta_label: p.cta_label || '',
      link_type: p.link_type || 'internal',
      cta_url: p.cta_url || '',
      cover_image_url: p.cover_image_url || '',
      logo_image_url: p.logo_image_url || '',
      weight: clampWeight(p.weight),
      priority: p.priority || 0,
      start_at: toLocalInput(p.start_at),
      end_at: toLocalInput(p.end_at),
      notes: p.notes || '',
      active: !!p.active,
    })
    setEditing(true)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Rinnovo di un cliente: stessi contenuti, nuovo periodo, da salvare. */
  const duplicate = (p) => {
    const now = new Date()
    startEdit(p)
    setForm((f) => ({
      ...f,
      id: null,
      start_at: toLocalInput(now),
      end_at: toLocalInput(addDays(now, 30)),
      active: true,
    }))
  }

  const cancelEdit = () => {
    setForm(EMPTY_FORM)
    setEditing(false)
    setError(null)
  }

  const validate = () => {
    if (form.variant === 'restaurant_discount' && (!form.restaurant_id || !form.discount_id))
      return 'Una campagna “Ristorante + sconto” richiede sia il ristorante che lo sconto.'
    if (form.variant === 'restaurant_plain' && !form.restaurant_id)
      return 'Scegli il ristorante.'
    if (form.variant === 'brand' && !form.brand_name.trim())
      return 'Il nome del brand è obbligatorio.'
    if (form.variant === 'brand' && !form.cta_url.trim())
      return 'Un brand ha bisogno del link esterno a cui portare.'
    if (form.link_type === 'external' && !form.cta_url.trim())
      return 'Hai scelto “link esterno”: inserisci l’indirizzo.'
    if (form.cta_url.trim() && !/^https?:\/\//i.test(form.cta_url.trim()))
      return 'Il link esterno deve iniziare con http:// o https://'
    if (!form.start_at || !form.end_at)
      return 'Inizio e fine della campagna sono obbligatori.'
    if (new Date(form.end_at) <= new Date(form.start_at))
      return 'La fine deve venire dopo l’inizio.'
    return null
  }

  const save = async () => {
    const problem = validate()
    if (problem) { setError(problem); return }

    setSaving(true)
    setError(null)

    const isBrand = form.variant === 'brand'
    const payload = {
      slot: form.slot,
      variant: form.variant,
      client_name: form.client_name.trim() || null,
      restaurant_id: isBrand ? null : (form.restaurant_id || null),
      brand_name: isBrand ? form.brand_name.trim() : null,
      brand_subtitle: isBrand ? (form.brand_subtitle.trim() || null) : null,
      discount_id: form.variant === 'restaurant_discount' ? form.discount_id : null,
      headline: form.headline.trim() || null,
      subtitle: form.subtitle.trim() || null,
      cta_label: form.cta_label.trim() || null,
      // Un brand porta sempre fuori dal sito: non ha una scheda dove atterrare.
      link_type: isBrand ? 'external' : form.link_type,
      cta_url: form.cta_url.trim() || null,
      cover_image_url: form.cover_image_url.trim() || null,
      logo_image_url: form.logo_image_url.trim() || null,
      weight: clampWeight(form.weight),
      priority: Number(form.priority) || 0,
      start_at: fromLocalInput(form.start_at),
      end_at: fromLocalInput(form.end_at),
      notes: form.notes.trim() || null,
      active: !!form.active,
    }

    const select = `*, restaurant:restaurants(${RESTAURANT_FIELDS}), discount:discounts(id, title, description, discount_value, discount_type)`
    const op = form.id
      ? supabase.from('sponsored_placements').update(payload).eq('id', form.id).select(select).single()
      : supabase.from('sponsored_placements').insert(payload).select(select).single()

    const { data, error: saveErr } = await op
    if (saveErr) {
      setError(saveErr.message)
      setSaving(false)
      return
    }
    setPlacements((prev) => [data, ...prev.filter((p) => p.id !== data.id)])
    cancelEdit()
    setSaving(false)
  }

  const remove = async (p) => {
    const who = p.client_name || p.brand_name || p.restaurant?.name || 'questa campagna'
    if (!confirm(`Eliminare la campagna di ${who}? L'operazione non è reversibile.`)) return
    const { error: delErr } = await supabase.from('sponsored_placements').delete().eq('id', p.id)
    if (delErr) { setError(delErr.message); return }
    setPlacements((prev) => prev.filter((x) => x.id !== p.id))
  }

  const toggleActive = async (p) => {
    const select = `*, restaurant:restaurants(${RESTAURANT_FIELDS}), discount:discounts(id, title, description, discount_value, discount_type)`
    const { data, error: updErr } = await supabase
      .from('sponsored_placements')
      .update({ active: !p.active })
      .eq('id', p.id)
      .select(select)
      .single()
    if (updErr) { setError(updErr.message); return }
    setPlacements((prev) => prev.map((x) => (x.id === p.id ? data : x)))
  }

  const orphans = bySlot.__orphan?.all || []

  return (
    <AdminLayout>
      <div style={{ padding: '20px 24px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 24, margin: 0 }}>
              Pubblicità
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-ink-70)', margin: '5px 0 0', maxWidth: 620, lineHeight: 1.5 }}>
              Ogni posizione ospita più clienti: a ogni caricamento pagina ne esce uno solo, estratto a sorte in base al peso.
              Un visitatore vede al massimo {MAX_ADS_PER_PAGE} annunci per pagina, e la label “Annuncio” è sempre visibile.
            </p>
          </div>
          {!editing && (
            <button type="button" onClick={() => startCreate()} style={primaryBtnStyle}>
              + Nuova campagna
            </button>
          )}
        </div>

        {error && (
          <div style={{ background: 'var(--color-danger-bg, #FBEAE8)', color: 'var(--color-danger, #B3261E)', padding: '11px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        {editing && (
          <Editor
            form={form}
            setForm={setForm}
            restaurants={restaurants}
            discounts={discounts}
            placements={placements}
            save={save}
            cancel={cancelEdit}
            saving={saving}
            setError={setError}
          />
        )}

        {loading ? (
          <div style={{ color: 'var(--color-ink-70)' }}>Caricamento…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {AD_SLOT_LIST.map((slot) => (
              <SlotSection
                key={slot.key}
                slot={slot}
                data={bySlot[slot.key] || { all: [], live: [] }}
                onCreate={() => startCreate(slot.key)}
                onEdit={startEdit}
                onDuplicate={duplicate}
                onRemove={remove}
                onToggle={toggleActive}
              />
            ))}

            {orphans.length > 0 && (
              <div style={{ background: 'var(--color-warn-bg, #FBF0DC)', border: '1px solid rgba(176,137,84,.3)', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                  {orphans.length} campagne in posizioni non più esistenti
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--color-ink-70)', marginBottom: 12 }}>
                  Non vengono mostrate da nessuna parte. Riassegnale a una posizione valida o eliminale.
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {orphans.map((p) => (
                    <Row key={p.id} p={p} share={null} onEdit={startEdit} onDuplicate={duplicate} onRemove={remove} onToggle={toggleActive} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

/* ============================================
   Sezione posizione
   ============================================ */

function SlotSection({ slot, data, onCreate, onEdit, onDuplicate, onRemove, onToggle }) {
  const format = AD_FORMATS[slot.format]
  const shares = rotationShares(data.live)
  const sorted = [...data.all].sort((a, b) => {
    const order = { live: 0, upcoming: 1, off: 2, expired: 3 }
    return order[campaignState(a)] - order[campaignState(b)]
  })

  return (
    <section style={{ background: '#fff', border: '1px solid var(--color-ink-05)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', borderBottom: sorted.length ? '1px solid var(--color-ink-05)' : 0, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>{slot.label}</h2>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-oro-deep, #8E6B3E)', background: 'rgba(176,137,84,.12)', padding: '3px 8px', borderRadius: 999 }}>
              {format?.label}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-ink-70)', marginTop: 4 }}>
            {slot.where} · {format?.sizeHint}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--color-ink-70)', fontWeight: 600 }}>
            {data.live.length === 0 ? 'nessuna campagna attiva' : `${data.live.length} in rotazione`}
          </span>
          <button type="button" onClick={onCreate} style={secondaryBtnStyle}>+ Aggiungi</button>
        </div>
      </div>

      {data.live.length > 1 && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-ink-05)', background: 'var(--color-cream, #F5F0E4)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-ink-70)', marginBottom: 10 }}>
            Come si divide la rotazione
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {data.live.map((p) => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 160px) 1fr 42px', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaignTitle(p)}</span>
                <span style={{ height: 8, borderRadius: 999, background: 'var(--color-ink-05)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${shares[p.id] || 0}%`, background: 'var(--color-corallo)', borderRadius: 999 }} />
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: 'var(--color-ink-70)' }}>{shares[p.id] || 0}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div style={{ padding: '18px', fontSize: 13, color: 'var(--color-ink-70)' }}>
          Posizione libera — non viene mostrato nessuno spazio vuoto sul sito.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 1, background: 'var(--color-ink-05)' }}>
          {sorted.map((p) => (
            <Row key={p.id} p={p} share={shares[p.id]} onEdit={onEdit} onDuplicate={onDuplicate} onRemove={onRemove} onToggle={onToggle} />
          ))}
        </div>
      )}
    </section>
  )
}

function campaignTitle(p) {
  return p.client_name || p.headline || p.brand_name || p.restaurant?.name || '—'
}

function Row({ p, share, onEdit, onDuplicate, onRemove, onToggle }) {
  const state = campaignState(p)
  const meta = STATE_META[state]
  const variantLabel = VARIANTS.find((v) => v.key === p.variant)?.label || p.variant
  const remaining = remainingLabel(p)

  return (
    <div style={{ background: '#fff', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{campaignTitle(p)}</span>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, background: meta.bg, color: meta.fg }}>
            {meta.label}
          </span>
          {typeof share === 'number' && state === 'live' && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ink-70)' }}>{share}% delle uscite</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--color-ink-70)', marginTop: 3 }}>
          {variantLabel}
          {' · '}
          {p.link_type === 'external' ? 'link esterno' : 'scheda sul sito'}
          {' · '}
          {fmtDate(p.start_at)} → {fmtDate(p.end_at)}
          {remaining && <span style={{ color: 'var(--color-oro-deep, #8E6B3E)', fontWeight: 700 }}>{' · '}{remaining}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => onToggle(p)} style={toggleBtnStyle(p.active)}>{p.active ? 'Accesa' : 'Spenta'}</button>
        <button type="button" onClick={() => onEdit(p)} style={secondaryBtnStyle}>Modifica</button>
        <button type="button" onClick={() => onDuplicate(p)} style={secondaryBtnStyle} title="Rinnova con le stesse impostazioni">Rinnova</button>
        <button type="button" onClick={() => onRemove(p)} style={dangerBtnStyle} aria-label="Elimina">✕</button>
      </div>
    </div>
  )
}

/* ============================================
   Editor
   ============================================ */

function Editor({ form, setForm, restaurants, discounts, placements, save, cancel, saving, setError }) {
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const slot = AD_SLOTS[form.slot]
  const format = slot ? AD_FORMATS[slot.format] : null
  const isBrand = form.variant === 'brand'

  const filteredDiscounts = useMemo(() => {
    if (!form.restaurant_id) return discounts
    return discounts.filter((d) => d.restaurant_id === form.restaurant_id)
  }, [discounts, form.restaurant_id])

  // Percentuale che avrà questa campagna una volta salvata, calcolata contro
  // le altre campagne vive nello stesso slot.
  const projectedShare = useMemo(() => {
    const now = Date.now()
    const others = placements.filter(
      (p) => p.slot === form.slot && p.id !== form.id && campaignState(p, now) === 'live'
    )
    const mine = clampWeight(form.weight)
    const total = others.reduce((s, p) => s + clampWeight(p.weight), 0) + mine
    return Math.round((mine / total) * 100)
  }, [placements, form.slot, form.id, form.weight])

  // Il brand non ha una scheda sul sito: la destinazione è per forza esterna.
  useEffect(() => {
    if (isBrand && form.link_type !== 'external') update('link_type', 'external')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBrand])

  const previewAd = useMemo(() => {
    const restaurant = restaurants.find((r) => r.id === form.restaurant_id) || null
    const discount = discounts.find((d) => d.id === form.discount_id) || null
    return {
      id: form.id || 'preview',
      variant: form.variant,
      link_type: isBrand ? 'external' : form.link_type,
      restaurant,
      discount,
      brand_name: form.brand_name,
      brand_subtitle: form.brand_subtitle,
      headline: form.headline,
      subtitle: form.subtitle,
      cta_label: form.cta_label,
      cta_url: form.cta_url || 'https://example.com',
      cover_image_url: form.cover_image_url,
      logo_image_url: form.logo_image_url,
    }
  }, [form, restaurants, discounts, isBrand])

  const setPeriod = (days) => {
    const now = new Date()
    setForm((f) => ({ ...f, start_at: toLocalInput(now), end_at: toLocalInput(addDays(now, days)) }))
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-ink-05)', borderRadius: 16, padding: 20, marginBottom: 26 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>
        {form.id ? 'Modifica campagna' : 'Nuova campagna'}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: 26, alignItems: 'start' }} className="ad-editor-grid">
        {/* ---- colonna form ---- */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          <Field label="Posizione" hint={format ? `${format.label} · ${format.sizeHint}` : undefined}>
            <select value={form.slot} onChange={(e) => update('slot', e.target.value)} style={inputStyle}>
              {AD_SLOT_LIST.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
            </select>
          </Field>

          <Field label="Tipo campagna" hint={VARIANTS.find((v) => v.key === form.variant)?.hint}>
            <select value={form.variant} onChange={(e) => update('variant', e.target.value)} style={inputStyle}>
              {VARIANTS.map((v) => (<option key={v.key} value={v.key}>{v.label}</option>))}
            </select>
          </Field>

          <Field label="Cliente" hint="Come ritrovi la campagna in questa pagina">
            <input type="text" value={form.client_name} onChange={(e) => update('client_name', e.target.value)} style={inputStyle} placeholder="Smashers · contratto marzo" />
          </Field>

          {!isBrand && (
            <Field label="Ristorante">
              <select value={form.restaurant_id} onChange={(e) => update('restaurant_id', e.target.value)} style={inputStyle}>
                <option value="">—</option>
                {restaurants.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
              </select>
            </Field>
          )}

          {form.variant === 'restaurant_discount' && (
            <Field label="Sconto collegato" hint={form.restaurant_id ? 'Solo gli sconti di questo ristorante' : 'Scegli prima il ristorante'}>
              <select value={form.discount_id} onChange={(e) => update('discount_id', e.target.value)} style={inputStyle}>
                <option value="">—</option>
                {filteredDiscounts.map((d) => (<option key={d.id} value={d.id}>{d.title} ({formatDiscountValue(d)})</option>))}
              </select>
            </Field>
          )}

          {isBrand && (
            <>
              <Field label="Nome del brand">
                <input type="text" value={form.brand_name} onChange={(e) => update('brand_name', e.target.value)} style={inputStyle} placeholder="Cascina Torricelli" />
              </Field>
              <Field label="Sottotitolo brand">
                <input type="text" value={form.brand_subtitle} onChange={(e) => update('brand_subtitle', e.target.value)} style={inputStyle} placeholder="Bianchi del Monferrato · produttore" />
              </Field>
            </>
          )}

          <Field label="Dove porta il click" hint={isBrand ? 'Un brand porta sempre fuori dal sito' : undefined} full>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <RadioPill
                checked={form.link_type === 'internal'}
                disabled={isBrand}
                onChange={() => update('link_type', 'internal')}
                label="Scheda sul sito"
              />
              <RadioPill
                checked={form.link_type === 'external'}
                onChange={() => update('link_type', 'external')}
                label="Link esterno"
              />
            </div>
          </Field>

          {form.link_type === 'external' && (
            <Field label="Indirizzo esterno" hint="Si apre in una nuova scheda, marcato come link a pagamento" full>
              <input type="url" value={form.cta_url} onChange={(e) => update('cta_url', e.target.value)} style={inputStyle} placeholder="https://…" />
            </Field>
          )}

          <Field label="Titolo" hint={counterHint(form.headline, format?.limits.headline)} full>
            <input type="text" value={form.headline} onChange={(e) => update('headline', e.target.value)} style={inputStyle} placeholder={isBrand ? 'Cascina Torricelli' : 'Lascia vuoto per usare il nome del ristorante'} />
          </Field>

          <Field label="Sottotitolo" hint={counterHint(form.subtitle, format?.limits.subtitle)} full>
            <input type="text" value={form.subtitle} onChange={(e) => update('subtitle', e.target.value)} style={inputStyle} placeholder="Smash burger senza compromessi" />
          </Field>

          <Field label="Testo del bottone">
            <input type="text" value={form.cta_label} onChange={(e) => update('cta_label', e.target.value)} style={inputStyle} placeholder={form.variant === 'restaurant_discount' ? 'Attiva sconto' : 'Scopri di più'} />
          </Field>

          <ImageField
            label={format?.image === 'logo' ? 'Logo (quadrato)' : 'Foto orizzontale'}
            hint={format?.sizeHint}
            value={format?.image === 'logo' ? form.logo_image_url : form.cover_image_url}
            onChange={(url) => update(format?.image === 'logo' ? 'logo_image_url' : 'cover_image_url', url)}
            maxWidth={format?.image === 'logo' ? 512 : 1600}
            onError={setError}
          />

          <Field label="Periodo" full>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                <label style={subLabelStyle}>
                  Inizio
                  <input type="datetime-local" value={form.start_at} onChange={(e) => update('start_at', e.target.value)} style={inputStyle} />
                </label>
                <label style={subLabelStyle}>
                  Fine
                  <input type="datetime-local" value={form.end_at} onChange={(e) => update('end_at', e.target.value)} style={inputStyle} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--color-ink-70)', alignSelf: 'center' }}>Da adesso per:</span>
                {[7, 14, 30, 90].map((d) => (
                  <button key={d} type="button" onClick={() => setPeriod(d)} style={ghostBtnStyle}>
                    {d} giorni
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <Field
            label="Quanto spesso esce"
            hint={`Con i pesi attuali questa campagna prende circa il ${projectedShare}% delle uscite in questa posizione`}
            full
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="range"
                min="1"
                max="10"
                value={form.weight}
                onChange={(e) => update('weight', Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--color-corallo)' }}
              />
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: 15, minWidth: 46, textAlign: 'right' }}>
                {projectedShare}%
              </span>
            </div>
          </Field>

          <Field label="Note interne" hint="Non compaiono sul sito" full>
            <input type="text" value={form.notes} onChange={(e) => update('notes', e.target.value)} style={inputStyle} placeholder="Referente, importo, scadenza fattura…" />
          </Field>

          <Field label="Stato" full>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
              Accesa (compare quando siamo dentro il periodo)
            </label>
          </Field>
        </div>

        {/* ---- colonna anteprima ---- */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-ink-70)', marginBottom: 10 }}>
            Anteprima · {format?.label}
          </div>
          <div style={{ background: 'var(--color-page, #FAF7F2)', border: '1px solid var(--color-ink-05)', borderRadius: 20, padding: 10 }}>
            <AdPreview ad={previewAd} format={slot?.format} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--color-ink-70)', marginTop: 8, lineHeight: 1.45 }}>
            Su desktop il formato hero si allarga affiancando foto e testo; gli altri due mantengono queste proporzioni.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button type="button" onClick={save} disabled={saving} style={primaryBtnStyle}>
          {saving ? 'Salvataggio…' : (form.id ? 'Salva modifiche' : 'Crea campagna')}
        </button>
        <button type="button" onClick={cancel} style={secondaryBtnStyle}>Annulla</button>
      </div>
    </div>
  )
}

function counterHint(value, limit) {
  if (!limit) return undefined
  const len = (value || '').length
  return len > limit ? `${len}/${limit} caratteri — oltre il limite si tronca` : `${len}/${limit} caratteri`
}

function ImageField({ label, hint, value, onChange, maxWidth, onError }) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadCreative(file, maxWidth)
      onChange(url)
    } catch (err) {
      onError?.(`Caricamento non riuscito: ${err.message}`)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Field label={label} hint={hint} full>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: 10, flexShrink: 0,
            border: '1px solid var(--color-ink-05)',
            background: value ? `url(${value}) center/cover` : 'var(--color-ink-05)',
            display: 'grid', placeItems: 'center', fontSize: 20, color: 'var(--color-ink-70)',
          }}
        >
          {!value && '🖼'}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => inputRef.current?.click()} style={secondaryBtnStyle} disabled={busy}>
            {busy ? 'Carico…' : value ? 'Sostituisci' : 'Carica immagine'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange('')} style={ghostBtnStyle}>Rimuovi</button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, marginTop: 8, fontSize: 12 }}
        placeholder="…oppure incolla un indirizzo https://"
      />
    </Field>
  )
}

function RadioPill({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      style={{
        padding: '9px 14px',
        borderRadius: 999,
        border: `1px solid ${checked ? 'var(--color-ink)' : 'var(--color-ink-05)'}`,
        background: checked ? 'var(--color-ink)' : '#fff',
        color: checked ? '#fff' : 'var(--color-ink)',
        fontSize: 12.5,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  )
}

function Field({ label, hint, children, full }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ink-70)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
        {label}
      </div>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: 'var(--color-ink-55, rgba(34,24,28,.55))', marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  )
}

/* ============================================
   Stili
   ============================================ */

const inputStyle = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--color-ink-05)',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  background: '#fff',
  outline: 'none',
}
const subLabelStyle = {
  display: 'grid',
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-ink-70)',
}
const primaryBtnStyle = {
  padding: '10px 18px',
  background: 'var(--color-corallo)',
  color: '#fff',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 800,
  border: 0,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
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
  whiteSpace: 'nowrap',
}
const ghostBtnStyle = {
  padding: '7px 12px',
  background: 'transparent',
  color: 'var(--color-ink-70)',
  border: '1px solid var(--color-ink-05)',
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
const dangerBtnStyle = {
  padding: '8px 12px',
  background: 'var(--color-danger-bg, #FBEAE8)',
  color: 'var(--color-danger, #B3261E)',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  border: 0,
  cursor: 'pointer',
}
function toggleBtnStyle(active) {
  return {
    padding: '8px 13px',
    background: active ? 'var(--color-ok-bg, #E7F2EA)' : 'var(--color-ink-05)',
    color: active ? 'var(--color-ok, #2C7A4A)' : 'var(--color-ink-70)',
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 800,
    border: 0,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}
