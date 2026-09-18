import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { convertToWebP } from '../../lib/utils/imageUpload'
import { MEAL_SLOTS } from '../../lib/validity'

/**
 * I campi che rendono leggibili le regole di uno sconto, lato admin.
 *
 * Prima di questi, tutte le regole finivano nel campo libero «Condizioni»:
 * a catalogo ci sono righe come «Valido solo a cena dal Lunedì al Giovedì
 * escluso asporto», cioè tre informazioni diverse in una frase che lato
 * pubblico si legge in corpo 11 sotto a tutto il resto. Giorni e fasce hanno
 * già le loro colonne (`valid_days`, `valid_meal_slots`) — mancava solo il
 * modo di riempirle — e i prodotti hanno adesso la loro tabella.
 *
 * Tutto quello che c'è qui è facoltativo: uno sconto salvato senza toccare
 * nulla si comporta esattamente come prima.
 */

const STORAGE_BUCKET = 'photos'
const MAX_PRODUCTS = 8

const DAYS = [
  { dow: 1, label: 'Lun' },
  { dow: 2, label: 'Mar' },
  { dow: 3, label: 'Mer' },
  { dow: 4, label: 'Gio' },
  { dow: 5, label: 'Ven' },
  { dow: 6, label: 'Sab' },
  { dow: 7, label: 'Dom' },
]

const SLOTS = Object.keys(MEAL_SLOTS).map((id) => ({
  id,
  label: id.charAt(0).toUpperCase() + id.slice(1),
  hint: `${MEAL_SLOTS[id].from}–${MEAL_SLOTS[id].to}`,
}))

/* ============================================================================
   Quando vale — giorni e fasce
   ============================================================================ */

export function ValidityPicker({ days, slots, onChange }) {
  // Lista vuota = nessun limite = tutti i giorni. È la stessa convenzione che
  // legge `effectiveValidDays` lato pubblico: non serve salvare [1..7].
  const allDays = !days || days.length === 0 || days.length === 7

  const toggleDay = (dow) => {
    const current = allDays ? [1, 2, 3, 4, 5, 6, 7] : days
    const next = current.includes(dow) ? current.filter((d) => d !== dow) : [...current, dow].sort((a, b) => a - b)
    // Tolto l'ultimo giorno lo sconto non varrebbe mai: si torna a "tutti".
    onChange({ valid_days: next.length === 0 || next.length === 7 ? [] : next })
  }

  const toggleSlot = (id) => {
    const current = Array.isArray(slots) ? slots : []
    onChange({ valid_meal_slots: current.includes(id) ? current.filter((s) => s !== id) : [...current, id] })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={labelRow}>
          <span style={labelText}>Giorni validi</span>
          <button type="button" onClick={() => onChange({ valid_days: [] })} style={linkBtn}>
            {allDays ? 'Tutti i giorni' : 'Rimetti tutti'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {DAYS.map((d) => {
            const on = allDays || days.includes(d.dow)
            return (
              <button
                key={d.dow}
                type="button"
                onClick={() => toggleDay(d.dow)}
                aria-pressed={on}
                style={{
                  padding: '9px 0',
                  borderRadius: 9,
                  border: 0,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11.5,
                  fontWeight: 700,
                  background: on ? 'var(--gradient-sconto, linear-gradient(135deg,#A3E635,#4ADE80))' : '#F3EEE4',
                  color: on ? '#1A4731' : 'rgba(34,24,28,0.4)',
                }}
              >
                {d.label}
              </button>
            )
          })}
        </div>
        <p style={hintText}>
          {allDays ? 'Nessun limite: vale tutti i giorni.' : `Vale solo ${days.map((d) => DAYS[d - 1].label).join(', ')}.`}
        </p>
      </div>

      <div>
        <div style={labelRow}><span style={labelText}>Fasce orarie</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SLOTS.map((s) => {
            const on = Array.isArray(slots) && slots.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSlot(s.id)}
                aria-pressed={on}
                style={{
                  padding: '7px 12px',
                  borderRadius: 999,
                  border: on ? '1px solid #1A4731' : '1px solid #eee',
                  background: on ? '#EDFBE0' : '#fff',
                  color: on ? '#1A4731' : 'var(--color-ink)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  fontWeight: on ? 700 : 500,
                }}
              >
                {s.label} <span style={{ opacity: 0.55, fontWeight: 500 }}>{s.hint}</span>
              </button>
            )
          })}
        </div>
        <p style={hintText}>Nessuna selezione = valido a qualsiasi ora di apertura.</p>
      </div>
    </div>
  )
}

/* ============================================================================
   Su cosa vale — i prodotti
   ============================================================================ */

export function ProductsEditor({ products, onChange, folder }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const items = Array.isArray(products) ? products : []

  const patch = (next) => onChange(next.map((p, i) => ({ ...p, sort_order: i })))

  async function handleFiles(files) {
    const pool = Array.from(files || [])
    if (pool.length === 0) return
    const room = MAX_PRODUCTS - items.length
    if (pool.length > room) {
      setError(`Massimo ${MAX_PRODUCTS} prodotti — ne puoi aggiungere ancora ${room}.`)
      return
    }
    setError(null)
    setUploading(true)

    const added = []
    for (let i = 0; i < pool.length; i++) {
      try {
        const file = pool[i]
        const { full, thumb } = await convertToWebP(file, 1400)
        const ts = Date.now()
        const base = `discounts/${folder || 'senza-sconto'}`
        const fullPath = `${base}/${ts}-${i}.webp`
        const thumbPath = `${base}/${ts}-${i}-thumb.webp`

        const [fullRes, thumbRes] = await Promise.all([
          supabase.storage.from(STORAGE_BUCKET).upload(fullPath, full, { contentType: 'image/webp', upsert: false }),
          supabase.storage.from(STORAGE_BUCKET).upload(thumbPath, thumb, { contentType: 'image/webp', upsert: false }),
        ])
        if (fullRes.error) throw fullRes.error
        if (thumbRes.error) throw thumbRes.error

        const { data: fullPub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fullPath)
        const { data: thumbPub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(thumbPath)

        added.push({
          // Il nome parte dal file (IMG_4821 no, "matcha latte.jpg" sì) e
          // resta modificabile: è comunque più veloce che scriverlo da zero.
          name: nameFromFile(file.name),
          note: '',
          photo_url: fullPub.publicUrl,
          thumb_url: thumbPub.publicUrl,
        })
      } catch (err) {
        console.error('upload prodotto fallito:', err)
        setError(`Errore upload: ${err.message}`)
      }
    }

    if (added.length) patch([...items, ...added])
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const move = (idx, delta) => {
    const next = [...items]
    const target = idx + delta
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    patch(next)
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((p, i) => (
          <div
            key={p.id || p.photo_url || i}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              border: '1px solid #eee',
              borderRadius: 12,
              padding: 8,
              background: '#fff',
            }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 9, overflow: 'hidden', flex: 'none', background: '#F3EEE4', display: 'grid', placeItems: 'center' }}>
              {p.thumb_url || p.photo_url
                ? <img src={p.thumb_url || p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 20, opacity: 0.4 }}>🍽️</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <input
                type="text"
                value={p.name || ''}
                onChange={(e) => patch(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder="Nome del prodotto"
                style={{ ...productInput, fontWeight: 600 }}
              />
              <input
                type="text"
                value={p.note || ''}
                onChange={(e) => patch(items.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                placeholder="Nota breve (facoltativa)"
                style={productInput}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 'none' }}>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={miniBtn} title="Sposta su">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} style={miniBtn} title="Sposta giù">↓</button>
            </div>
            <button
              type="button"
              onClick={() => patch(items.filter((_, j) => j !== i))}
              style={{ ...miniBtn, color: '#E8453C' }}
              title="Rimuovi"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || items.length >= MAX_PRODUCTS}
        style={{
          width: '100%',
          marginTop: items.length ? 8 : 0,
          padding: 13,
          borderRadius: 12,
          border: '1.5px dashed #ddd',
          background: '#FCFAF6',
          cursor: uploading || items.length >= MAX_PRODUCTS ? 'default' : 'pointer',
          fontFamily: 'var(--font-sans)',
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--color-ink)',
          opacity: items.length >= MAX_PRODUCTS ? 0.5 : 1,
        }}
      >
        {uploading ? 'Carico…' : items.length >= MAX_PRODUCTS ? `Massimo ${MAX_PRODUCTS} prodotti` : '＋ Aggiungi foto prodotto'}
      </button>

      {error && <p style={{ ...hintText, color: '#E8453C' }}>{error}</p>}
      <p style={hintText}>
        Le foto di cosa lo sconto copre davvero. Compaiono nella scheda dello sconto e come
        anteprima nella lista del Bi Club. Niente prezzi: il risparmio lo dice già il valore dello sconto.
      </p>
    </div>
  )
}

/** «matcha latte.jpg» → «Matcha latte». Un IMG_4821 resta vuoto: meglio il
 *  campo vuoto che un nome finto da cancellare a mano. */
function nameFromFile(filename) {
  const base = String(filename || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim()
  if (!base || /^(img|dsc|photo|image|foto|screenshot)[\s0-9]*$/i.test(base)) return ''
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/* ---------------------------------------------------------------- stili --- */

const labelRow = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 6 }
const labelText = { fontSize: 11, fontWeight: 500, color: 'var(--color-ink)' }
const hintText = { margin: '6px 0 0', fontSize: 10.5, lineHeight: 1.5, color: '#999' }
const linkBtn = {
  background: 'none', border: 0, padding: 0, cursor: 'pointer',
  fontFamily: 'var(--font-sans)', fontSize: 10.5, fontWeight: 600, color: '#999',
}
const productInput = {
  width: '100%',
  padding: '6px 9px',
  borderRadius: 7,
  border: '1px solid #eee',
  background: '#FCFAF6',
  fontSize: 12,
  color: 'var(--color-ink)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
}
const miniBtn = {
  width: 26, height: 22,
  borderRadius: 6,
  border: '1px solid #eee',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 11,
  lineHeight: 1,
  color: '#999',
  fontFamily: 'var(--font-sans)',
}
