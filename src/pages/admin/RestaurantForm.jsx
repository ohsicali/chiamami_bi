import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams, Link, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants, CUISINE_CATEGORIES, PRICE_LABELS } from '../../lib/hooks/useRestaurants'
import { useToast } from '../../components/UI/Toast'
import { LoadingSpinner } from '../../components/UI/LoadingSpinner'
import { geocodeAddress, reverseGeocode } from '../../lib/utils/geocoding'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'

/* ------------------------------------------------------------------ */
/*  Convert image file to WebP (smaller, faster loading)               */
/* ------------------------------------------------------------------ */
function convertToWebP(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('WebP conversion failed'))),
        'image/webp',
        quality
      )
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const EMPTY_FORM = {
  name: '',
  address: '',
  city: 'Torino',
  country: 'Italia',
  latitude: '',
  longitude: '',
  phone: '',
  google_maps_url: '',
  website: '',
  categories: [],
  price_range: 0,
  our_review: '',
  our_tip: '',
  recommended_for: [],
  instagram_reel: '',
  tiktok_url: '',
  published: false,
  photos: [], // { url, caption, sort_order, file? }
}

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

/* ------------------------------------------------------------------ */
/*  Price range selector                                               */
/* ------------------------------------------------------------------ */
function PriceSelector({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4].map((level) => (
        <motion.button
          key={level}
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(value === level ? 0 : level)}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
            value === level
              ? 'bg-accent text-white border-accent shadow-sm'
              : 'border-gray-200 text-secondary hover:border-accent/40 hover:text-accent'
          }`}
        >
          {PRICE_LABELS[level]}
        </motion.button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Recommended-for multi-select chips                                 */
/* ------------------------------------------------------------------ */
function RecommendedForSelector({ selected, onChange }) {
  const [custom, setCustom] = useState('')

  const toggle = (tag) => {
    onChange(
      selected.includes(tag)
        ? selected.filter((s) => s !== tag)
        : [...selected, tag]
    )
  }

  const addCustom = () => {
    const tag = custom.trim()
    if (tag && !selected.includes(tag)) {
      onChange([...selected, tag])
    }
    setCustom('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {RECOMMENDED_FOR_OPTIONS.map((tag) => {
          const active = selected.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'bg-accent text-white border-accent'
                  : 'border-gray-200 text-secondary hover:border-accent/40 hover:text-accent'
              }`}
            >
              {tag}
            </button>
          )
        })}
      </div>
      {/* Custom tag input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder="Aggiungi tag personalizzato..."
          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-bg text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="button"
          onClick={addCustom}
          className="px-3 py-2 rounded-xl bg-gray-100 text-xs font-medium text-secondary hover:bg-gray-200 transition-colors"
        >
          Aggiungi
        </button>
      </div>
      {/* Show custom tags (not in predefined list) */}
      {selected.filter((t) => !RECOMMENDED_FOR_OPTIONS.includes(t)).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected
            .filter((t) => !RECOMMENDED_FOR_OPTIONS.includes(t))
            .map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent"
              >
                {tag}
                <button type="button" onClick={() => toggle(tag)} className="hover:opacity-70">✕</button>
              </span>
            ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Category multi-select — Glovo-style dropdown modal                 */
/* ------------------------------------------------------------------ */
function CategorySelector({ selected, onChange }) {
  const [open, setOpen] = useState(false)

  const toggle = (name) => {
    onChange(
      selected.includes(name)
        ? selected.filter((s) => s !== name)
        : [...selected, name]
    )
  }

  return (
    <div>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-bg text-sm font-medium text-primary hover:border-accent/40 transition-colors"
      >
        <span>Tipo di locale</span>
        <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Selected chips preview */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((name) => {
            const cat = CUISINE_CATEGORIES.find((c) => c.name === name)
            return (
              <span
                key={name}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: cat?.color || '#6B7280' }}
              >
                <span>{cat?.emoji}</span>
                {name}
                <button
                  type="button"
                  onClick={() => toggle(name)}
                  className="ml-0.5 hover:opacity-70"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Full-screen modal — rendered via portal to avoid scroll/clipping issues */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-primary">Tipo di locale</h3>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Grid — min-h-0 prevents flex child from overflowing */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="grid grid-cols-4 gap-3">
                    {CUISINE_CATEGORIES.map((cat) => {
                      const active = selected.includes(cat.name)
                      return (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => toggle(cat.name)}
                          className="flex flex-col items-center gap-1.5 py-2"
                        >
                          <div
                            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all ${
                              active
                                ? 'ring-3 ring-accent shadow-md'
                                : 'bg-gray-100'
                            }`}
                            style={active ? { backgroundColor: cat.color + '20', ringColor: cat.color } : {}}
                          >
                            {cat.emoji}
                          </div>
                          <span className={`text-xs font-medium text-center leading-tight ${
                            active ? 'text-accent' : 'text-primary'
                          }`}>
                            {cat.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Footer button */}
                <div className="px-5 py-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="w-full py-3 rounded-xl bg-accent text-white font-medium text-sm shadow-md hover:bg-[#e64545] transition-colors"
                  >
                    {selected.length > 0
                      ? `Fatto (${selected.length} selezionat${selected.length === 1 ? 'o' : 'i'})`
                      : 'Chiudi'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Toggle switch                                                      */
/* ------------------------------------------------------------------ */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
    >
      <div
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
          checked ? 'bg-accent' : 'bg-gray-200'
        }`}
      >
        <motion.div
          className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </div>
      <span className="text-sm font-medium text-primary">{label}</span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Photo management — file upload from device + URL                   */
/* ------------------------------------------------------------------ */
function PhotoManager({ photos, onChange }) {
  const [newUrl, setNewUrl] = useState('')

  const addFromFiles = (e) => {
    try {
      const files = Array.from(e.target.files || [])
      if (!files.length) return
      const newPhotos = files.map((file, idx) => ({
        url: URL.createObjectURL(file),
        file,
        caption: '',
        sort_order: photos.length + idx,
      }))
      onChange([...photos, ...newPhotos])
    } catch (err) {
      console.error('Errore caricamento foto:', err)
    } finally {
      e.target.value = ''
    }
  }

  const addFromUrl = () => {
    if (!newUrl.trim()) return
    onChange([
      ...photos,
      { url: newUrl.trim(), caption: '', sort_order: photos.length },
    ])
    setNewUrl('')
  }

  const removePhoto = (index) => {
    const removed = photos[index]
    if (removed.url?.startsWith('blob:')) URL.revokeObjectURL(removed.url)
    const updated = photos.filter((_, i) => i !== index)
      .map((p, i) => ({ ...p, sort_order: i }))
    onChange(updated)
  }

  const movePhoto = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= photos.length) return
    const updated = [...photos]
    const tmp = updated[index]
    updated[index] = updated[target]
    updated[target] = tmp
    onChange(updated.map((p, i) => ({ ...p, sort_order: i })))
  }

  return (
    <div className="space-y-4">
      {/* Upload from device — label+input is more reliable on iOS Safari */}
      <label
        htmlFor="photo-upload-input"
        className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-secondary hover:border-accent hover:text-accent active:scale-[0.97] transition-all bg-gray-50/50 cursor-pointer"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Carica foto dalla libreria
        <input
          id="photo-upload-input"
          type="file"
          accept="image/*"
          multiple
          onChange={addFromFiles}
          className="sr-only"
        />
      </label>

      {/* Or add by URL */}
      <div className="flex gap-2">
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFromUrl())}
          placeholder="Oppure incolla un URL immagine..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-bg text-base text-primary placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={addFromUrl}
          className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium shrink-0 hover:bg-[#e64545] transition-colors"
        >
          Aggiungi
        </motion.button>
      </div>

      {/* Photo list */}
      <AnimatePresence>
        {photos.map((photo, i) => (
          <motion.div
            key={`${photo.url}-${i}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100"
          >
            <img
              src={photo.url}
              alt=""
              className="w-16 h-16 rounded-lg object-cover shrink-0"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-secondary truncate">
                Foto {i + 1}
              </p>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                type="button"
                onClick={() => movePhoto(i, -1)}
                disabled={i === 0}
                className="p-1 rounded text-secondary hover:text-primary disabled:opacity-30 transition-colors"
                title="Sposta su"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => movePhoto(i, 1)}
                disabled={i === photos.length - 1}
                className="p-1 rounded text-secondary hover:text-primary disabled:opacity-30 transition-colors"
                title="Sposta giu"
              >
                <svg className="w-3.5 h-3.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="p-1 rounded text-secondary hover:text-red-500 transition-colors"
                title="Rimuovi"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
function ArrowLeftIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Main form page                                                     */
/* ------------------------------------------------------------------ */
export default function RestaurantForm() {
  const { id } = useParams()
  const isEditing = !!id
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { restaurants } = useRestaurants()
  const { addToast } = useToast()

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [googleFilling, setGoogleFilling] = useState(false)
  const [aiCorrecting, setAiCorrecting] = useState(null) // 'our_review' | 'our_tip' | null
  const [aiSuggestion, setAiSuggestion] = useState(null) // { field, original, corrected }
  // Inline discount state
  const [discount, setDiscount] = useState(null)
  const [discountLoading, setDiscountLoading] = useState(false)
  const [discountForm, setDiscountForm] = useState({
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    conditions: '',
    valid_until: '',
    max_redemptions: '',
  })


  // Load restaurant data when editing
  useEffect(() => {
    if (isEditing && restaurants.length > 0) {
      const r = restaurants.find((r) => r.id === id)
      if (r) {
        setForm({
          name: r.name || '',
          address: r.address || '',
          city: r.city || 'Torino',
          country: r.country || 'Italia',
          latitude: r.latitude != null ? String(r.latitude) : '',
          longitude: r.longitude != null ? String(r.longitude) : '',
          phone: r.phone || '',
          google_maps_url: r.google_maps_url || '',
          website: r.website || '',
          categories: r.cuisine_type ? [r.cuisine_type] : (r.categories || []),
          price_range: r.price_range || 0,
          our_review: r.our_review || r.description || '',
          our_tip: r.our_tip || (Array.isArray(r.tips) ? r.tips.join('\n') : '') || '',
          recommended_for: r.recommended_for || [],
          instagram_reel: r.instagram_reel || '',
          tiktok_url: r.tiktok_url || '',
          published: r.is_published !== false,
          photos: Array.isArray(r.photos)
            ? r.photos.map((p, i) =>
                typeof p === 'string'
                  ? { url: p, caption: '', sort_order: i }
                  : { url: p.photo_url || p.url || '', caption: p.caption || '', sort_order: p.sort_order ?? i }
              )
            : [],
        })
      }
    }
  }, [isEditing, id, restaurants])

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Nome obbligatorio'
    if (!form.address.trim()) e.address = 'Indirizzo obbligatorio'
    if (!form.city.trim()) e.city = 'Citta obbligatoria'
    if (form.categories.length === 0) e.categories = 'Seleziona almeno una categoria'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleGeocode = async () => {
    if (!form.address.trim()) {
      addToast('Inserisci un indirizzo prima', 'error')
      return
    }
    setGeocoding(true)
    const fullAddress = `${form.address}, ${form.city}, ${form.country}`
    const result = await geocodeAddress(fullAddress)
    if (result) {
      update('latitude', String(result.latitude))
      update('longitude', String(result.longitude))
      addToast('Coordinate trovate!', 'success')
    } else {
      addToast('Geocodifica non disponibile (token Mapbox mancante o indirizzo non trovato)', 'error')
    }
    setGeocoding(false)
  }

  // Google Maps autofill — resolve URL via Edge Function + Mapbox reverse geocode
  const handleGoogleFill = async () => {
    const mapsUrl = form.google_maps_url.trim()

    if (!mapsUrl) {
      addToast('Incolla un link Google Maps', 'error')
      return
    }

    setGoogleFilling(true)
    try {
      // Step 1: Try to parse the URL directly (full URLs like google.com/maps/place/...)
      let name = ''
      let lat = null
      let lng = null
      let phone = ''
      let resolvedUrl = mapsUrl

      const isCidUrl = /[?&]cid=\d+/.test(mapsUrl)
      const isShortUrl = isCidUrl || /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|share\.google)\//i.test(mapsUrl)
      const placeMatch = mapsUrl.match(/\/place\/([^/@]+)/)
      const coordMatch = mapsUrl.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/)

      if (!isShortUrl && placeMatch) {
        // Full URL — parse directly
        name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
        if (coordMatch) {
          lat = parseFloat(coordMatch[1])
          lng = parseFloat(coordMatch[2])
        }
      } else {
        // Short URL — resolve via Vercel serverless function
        const res = await fetch('/api/resolve-maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: mapsUrl }),
        })
        const data = await res.json()

        if (data?.error) {
          addToast(data.error, 'error')
          setGoogleFilling(false)
          return
        }

        name = data.name || ''
        lat = data.latitude
        lng = data.longitude
        phone = data.phone || ''
        resolvedUrl = data.resolved_url || mapsUrl

        if (data.address) update('address', data.address)
        if (data.website) update('website', data.website)
        if (data.warning) addToast(data.warning, 'error')
        if (data._debug) console.log('Google Maps API debug:', JSON.stringify(data._debug, null, 2))
      }

      // Reject names that are just numbers (postal codes) or common city names
      const invalidNames = ['torino', 'milano', 'roma', 'napoli', 'firenze', 'bologna', 'genova', 'palermo']
      if (/^\d+$/.test(name) || invalidNames.includes(name.toLowerCase())) {
        name = ''
      }

      if (!name && !lat) {
        addToast('Impossibile estrarre dati dal link. Prova con un link completo di Google Maps.', 'error')
        setGoogleFilling(false)
        return
      }

      if (name) update('name', name)
      if (resolvedUrl !== mapsUrl) update('google_maps_url', resolvedUrl)

      if (lat && lng) {
        update('latitude', String(lat))
        update('longitude', String(lng))
        // Fallback to Mapbox reverse geocode if Google didn't return an address
        if (!form.address) {
          const address = await reverseGeocode(lat, lng)
          if (address) update('address', address)
        }
      }

      if (phone) update('phone', phone)

      addToast('Dati compilati da Google Maps!', 'success')
    } catch (err) {
      addToast('Errore nella compilazione automatica', 'error')
    }
    setGoogleFilling(false)
  }

  // AI text correction — shows suggestion for accept/reject
  const handleAiCorrect = async (field) => {
    const text = form[field]?.trim()
    if (!text) {
      addToast('Scrivi prima il testo da correggere', 'error')
      return
    }
    setAiCorrecting(field)
    setAiSuggestion(null)
    try {
      const resp = await fetch('/api/correct-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context: field === 'our_review' ? 'restaurant review' : 'restaurant tip' }),
      })
      const data = await resp.json()
      if (data?.error) {
        addToast(data.error, 'error')
      } else if (data?.corrected && data.changed) {
        setAiSuggestion({ field, original: text, corrected: data.corrected })
      } else {
        addToast('Il testo sembra già corretto', 'success')
      }
    } catch (err) {
      addToast('Errore nella correzione del testo.', 'error')
    }
    setAiCorrecting(null)
  }

  const handleAcceptAi = () => {
    if (aiSuggestion) {
      update(aiSuggestion.field, aiSuggestion.corrected)
      addToast('Correzione applicata!', 'success')
    }
    setAiSuggestion(null)
  }

  const handleRejectAi = () => {
    setAiSuggestion(null)
  }

  // Load existing discount when editing
  useEffect(() => {
    if (!isEditing || !id || !isSupabaseConfigured()) return
    setDiscountLoading(true)
    supabase
      .from('discounts')
      .select('*')
      .eq('restaurant_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setDiscount(data)
          setDiscountForm({
            title: data.title || '',
            description: data.description || '',
            discount_type: data.discount_type || 'percentage',
            discount_value: data.discount_value || '',
            conditions: data.conditions || '',
            valid_until: data.valid_until ? data.valid_until.slice(0, 10) : '',
            max_redemptions: data.max_redemptions ? String(data.max_redemptions) : '',
          })
        }
        setDiscountLoading(false)
      })
  }, [isEditing, id])

  const handleSaveDiscount = async () => {
    if (!discountForm.title.trim() || !discountForm.discount_value.trim()) {
      addToast('Titolo e valore sconto sono obbligatori', 'error')
      return
    }
    if (!isSupabaseConfigured()) return

    const restaurantId = id
    if (!restaurantId) {
      addToast('Salva prima il ristorante, poi aggiungi lo sconto', 'error')
      return
    }

    const payload = {
      restaurant_id: restaurantId,
      title: discountForm.title.trim(),
      description: discountForm.description.trim(),
      discount_type: discountForm.discount_type,
      discount_value: discountForm.discount_value.trim(),
      conditions: discountForm.conditions.trim(),
      valid_until: discountForm.valid_until ? new Date(discountForm.valid_until).toISOString() : null,
      max_redemptions: discountForm.max_redemptions ? parseInt(discountForm.max_redemptions) : null,
      is_active: true,
    }

    try {
      if (discount) {
        const { error } = await supabase.from('discounts').update(payload).eq('id', discount.id)
        if (error) throw error
        addToast('Sconto aggiornato!', 'success')
      } else {
        const { data, error } = await supabase.from('discounts').insert(payload).select().single()
        if (error) throw error
        setDiscount(data)
        addToast('Sconto creato!', 'success')
      }
    } catch (err) {
      addToast(`Errore sconto: ${err.message}`, 'error')
    }
  }

  const handleDeleteDiscount = async () => {
    if (!discount) return
    try {
      const { error } = await supabase.from('discounts').delete().eq('id', discount.id)
      if (error) throw error
      setDiscount(null)
      setDiscountForm({ title: '', description: '', discount_type: 'percentage', discount_value: '', conditions: '', valid_until: '', max_redemptions: '' })
      addToast('Sconto eliminato', 'success')
    } catch (err) {
      addToast(`Errore: ${err.message}`, 'error')
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!validate()) {
      addToast('Correggi gli errori nel form', 'error')
      return
    }
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      phone: form.phone.trim(),
      google_maps_url: form.google_maps_url.trim(),
      website: form.website.trim(),
      cuisine_type: form.categories[0] || null,
      category: form.categories,
      price_range: form.price_range,
      our_review: form.our_review.trim(),
      our_tip: form.our_tip.trim(),
      recommended_for: form.recommended_for,
      instagram_reel: form.instagram_reel.trim() || null,
      tiktok_url: form.tiktok_url.trim() || null,
      is_published: form.published,
    }

    try {
      if (isSupabaseConfigured()) {
        let restaurantId = id

        if (isEditing) {
          const { error } = await supabase.from('restaurants').update(payload).eq('id', id)
          if (error) throw error
        } else {
          // Generate slug from name
          payload.slug = form.name.trim().toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            + '-' + Date.now().toString(36)
          const { data, error } = await supabase.from('restaurants').insert(payload).select('id').single()
          if (error) throw error
          restaurantId = data.id
        }

        // Handle photos — convert to WebP, upload to storage, save to restaurant_photos
        if (form.photos.length > 0) {
          // Delete old photos if editing
          if (isEditing) {
            await supabase.from('restaurant_photos').delete().eq('restaurant_id', restaurantId)
          }

          const slug = form.name.trim().toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')

          const photoRows = []
          for (let idx = 0; idx < form.photos.length; idx++) {
            const photo = form.photos[idx]
            let photoUrl = photo.url
            // If it's a file upload, convert to WebP and upload to Supabase Storage
            if (photo.file) {
              try {
                const webpBlob = await convertToWebP(photo.file)
                const fileName = `${slug}-${idx + 1}.webp`
                const path = `restaurants/${restaurantId}/${fileName}`
                const { error: uploadError } = await supabase.storage
                  .from('photos')
                  .upload(path, webpBlob, { contentType: 'image/webp', cacheControl: '3600', upsert: true })
                if (uploadError) {
                  console.error('Upload error:', uploadError)
                  addToast(`Errore upload foto: ${uploadError.message}`, 'error')
                  continue
                }
                const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
                photoUrl = urlData.publicUrl
              } catch (convErr) {
                console.error('Conversion error:', convErr)
                addToast(`Errore conversione foto ${idx + 1}`, 'error')
                continue
              }
            }
            photoRows.push({
              restaurant_id: restaurantId,
              photo_url: photoUrl,
              caption: '',
              sort_order: idx,
            })
          }

          if (photoRows.length > 0) {
            const { error: photoError } = await supabase.from('restaurant_photos').insert(photoRows)
            if (photoError) {
              console.error('Photo insert error:', photoError)
              addToast(`Ristorante salvato ma errore foto: ${photoError.message}`, 'error')
            }
          }
        } else if (isEditing) {
          // If no photos, clear existing
          await supabase.from('restaurant_photos').delete().eq('restaurant_id', restaurantId)
        }

        addToast(isEditing ? 'Ristorante aggiornato!' : 'Ristorante creato!', 'success')
        navigate('/admin')
      } else {
        // Mock mode
        await new Promise((resolve) => setTimeout(resolve, 500))
        addToast(
          isEditing ? 'Ristorante aggiornato (mock)!' : 'Ristorante creato (mock)!',
          'success'
        )
        navigate('/admin')
      }
    } catch (err) {
      addToast(`Errore: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('restaurants').delete().eq('id', id)
        if (error) throw error
      } else {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
      addToast('Ristorante eliminato', 'success')
      navigate('/admin')
    } catch (err) {
      addToast(`Errore: ${err.message}`, 'error')
    } finally {
      setSaving(false)
      setShowDeleteModal(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user) return <Navigate to="/admin/login" replace />

  const FieldError = ({ field }) =>
    errors[field] ? (
      <motion.p
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xs text-red-500 mt-1"
      >
        {errors[field]}
      </motion.p>
    ) : null

  return (
    <AdminLayout title={isEditing ? 'Modifica Ristorante' : 'Nuovo Ristorante'}>
      <div className="max-w-3xl mx-auto">
        {/* Action bar */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-primary">
            {isEditing ? 'Modifica Ristorante' : 'Nuovo Ristorante'}
          </h1>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                Elimina
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="px-4 py-2 rounded-xl text-sm font-medium text-secondary hover:bg-gray-100 transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <form onSubmit={handleSave} className="space-y-8">
          {/* --- Google Maps autofill --- */}
          <Section title="Compilazione rapida">
            <Field label="Link Google Maps">
              <input
                type="url"
                value={form.google_maps_url}
                onChange={(e) => update('google_maps_url', e.target.value)}
                placeholder="Incolla link Google Maps (es. https://maps.google.com/...)"
                className={inputClass()}
              />
            </Field>
            <div className="flex flex-col sm:flex-row gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleGoogleFill}
                disabled={googleFilling || !form.google_maps_url.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                {googleFilling ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="45" className="opacity-40" />
                    </svg>
                    Ricerca in corso...
                  </>
                ) : (
                  'Compila automaticamente'
                )}
              </motion.button>
              <p className="text-xs text-secondary self-center">
                Dall'app Google Maps tocca "Condividi" → "Copia link". Funzionano anche i link lunghi dal browser.
              </p>
            </div>
          </Section>

          {/* --- Basic info --- */}
          <Section title="Informazioni base">
            <Field label="Nome *" error={errors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Nome del ristorante"
                className={inputClass(errors.name)}
              />
              <FieldError field="name" />
            </Field>

            <Field label="Indirizzo *" error={errors.address}>
              <input
                type="text"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="Via Roma, 1, 10121 Torino TO"
                className={inputClass(errors.address)}
              />
              <FieldError field="address" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Citta *" error={errors.city}>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  className={inputClass(errors.city)}
                />
                <FieldError field="city" />
              </Field>
              <Field label="Paese">
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => update('country', e.target.value)}
                  className={inputClass()}
                />
              </Field>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Latitudine">
                <input
                  type="text"
                  value={form.latitude}
                  onChange={(e) => update('latitude', e.target.value)}
                  placeholder="45.0703"
                  className={inputClass()}
                />
              </Field>
              <Field label="Longitudine">
                <input
                  type="text"
                  value={form.longitude}
                  onChange={(e) => update('longitude', e.target.value)}
                  placeholder="7.6869"
                  className={inputClass()}
                />
              </Field>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={handleGeocode}
              disabled={geocoding}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 border-accent text-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
            >
              {geocoding ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="45" className="opacity-40" />
                  </svg>
                  Geocodifica in corso...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Geocodifica Indirizzo
                </>
              )}
            </motion.button>
          </Section>

          {/* --- Contact --- */}
          <Section title="Contatti">
            <Field label="Telefono">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="+39 011 123 4567"
                className={inputClass()}
              />
            </Field>
            <Field label="Sito web">
              <input
                type="text"
                value={form.website}
                onChange={(e) => update('website', e.target.value)}
                onBlur={(e) => {
                  let val = e.target.value.trim()
                  if (val && !/^https?:\/\//i.test(val)) {
                    val = 'https://' + val
                  }
                  update('website', val)
                }}
                placeholder="www.ristorante.it"
                className={inputClass()}
              />
            </Field>
          </Section>

          {/* --- Classification --- */}
          <Section title="Classificazione">
            <Field label="Categorie *" error={errors.categories}>
              <CategorySelector
                selected={form.categories}
                onChange={(v) => update('categories', v)}
              />
              <FieldError field="categories" />
            </Field>

            <Field label="Fascia di prezzo">
              <PriceSelector
                value={form.price_range}
                onChange={(v) => update('price_range', v)}
              />
            </Field>

            <Field label="Consigliato per...">
              <RecommendedForSelector
                selected={form.recommended_for}
                onChange={(v) => update('recommended_for', v)}
              />
            </Field>

          </Section>

          {/* --- Review & Tip --- */}
          <Section title="Recensione e consigli">
            <Field label="La nostra recensione">
              <textarea
                value={form.our_review}
                onChange={(e) => update('our_review', e.target.value)}
                rows={4}
                placeholder="Scrivi la tua recensione del ristorante..."
                className={inputClass() + ' resize-y'}
              />
              {form.our_review.trim() && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleAiCorrect('our_review')}
                  disabled={!!aiCorrecting}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 border border-purple-200 text-purple-600 hover:bg-purple-100 transition-colors disabled:opacity-50"
                >
                  {aiCorrecting === 'our_review' ? 'Correzione...' : 'Correggi'}
                </motion.button>
              )}
              {aiSuggestion?.field === 'our_review' && (
                <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                  <p className="text-xs font-semibold text-purple-700 mb-2">Testo corretto:</p>
                  <p className="text-sm text-primary whitespace-pre-wrap">{aiSuggestion.corrected}</p>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={handleAcceptAi} className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white">Accetta</button>
                    <button type="button" onClick={handleRejectAi} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-secondary">Rifiuta</button>
                  </div>
                </div>
              )}
            </Field>
            <Field label="I suggerimenti di Bi">
              <textarea
                value={form.our_tip}
                onChange={(e) => update('our_tip', e.target.value)}
                rows={3}
                placeholder="I suggerimenti di Bi per chi visita il locale..."
                className={inputClass() + ' resize-y'}
              />
              {form.our_tip.trim() && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleAiCorrect('our_tip')}
                  disabled={!!aiCorrecting}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 border border-purple-200 text-purple-600 hover:bg-purple-100 transition-colors disabled:opacity-50"
                >
                  {aiCorrecting === 'our_tip' ? 'Correzione...' : 'Correggi'}
                </motion.button>
              )}
              {aiSuggestion?.field === 'our_tip' && (
                <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                  <p className="text-xs font-semibold text-purple-700 mb-2">Testo corretto:</p>
                  <p className="text-sm text-primary whitespace-pre-wrap">{aiSuggestion.corrected}</p>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={handleAcceptAi} className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white">Accetta</button>
                    <button type="button" onClick={handleRejectAi} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-secondary">Rifiuta</button>
                  </div>
                </div>
              )}
            </Field>
          </Section>

          {/* --- Social / Video --- */}
          <Section title="Social e Video">
            <Field label="Link Reel Instagram (opzionale)">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-pink-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
                <input
                  type="url"
                  value={form.instagram_reel}
                  onChange={(e) => update('instagram_reel', e.target.value)}
                  placeholder="https://www.instagram.com/reel/..."
                  className={inputClass()}
                />
              </div>
            </Field>
            <Field label="Link TikTok (opzionale)">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.87a8.28 8.28 0 004.76 1.5v-3.4a4.85 4.85 0 01-1-.28z"/>
                </svg>
                <input
                  type="url"
                  value={form.tiktok_url}
                  onChange={(e) => update('tiktok_url', e.target.value)}
                  placeholder="https://www.tiktok.com/@..."
                  className={inputClass()}
                />
              </div>
            </Field>
          </Section>

          {/* --- Photos --- */}
          <Section title="Foto">
            <PhotoManager
              photos={form.photos}
              onChange={(photos) => update('photos', photos)}
            />
          </Section>

          {/* --- Discount (inline) --- */}
          {isEditing && (
            <Section title="Sconto attivo">
              {discountLoading ? (
                <p className="text-sm text-secondary">Caricamento sconto...</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Titolo sconto *">
                      <input
                        type="text"
                        value={discountForm.title}
                        onChange={(e) => setDiscountForm(p => ({ ...p, title: e.target.value }))}
                        placeholder="Es. -10% sul conto"
                        className={inputClass()}
                      />
                    </Field>
                    <Field label="Valore *">
                      <input
                        type="text"
                        value={discountForm.discount_value}
                        onChange={(e) => setDiscountForm(p => ({ ...p, discount_value: e.target.value }))}
                        placeholder="Es. 10%, 5€, Dolce gratis"
                        className={inputClass()}
                      />
                    </Field>
                  </div>

                  <Field label="Tipo di sconto">
                    <div className="flex gap-2">
                      {[
                        { value: 'percentage', label: 'Percentuale' },
                        { value: 'fixed', label: 'Importo fisso' },
                        { value: 'freebie', label: 'Omaggio' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDiscountForm(p => ({ ...p, discount_type: opt.value }))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                            discountForm.discount_type === opt.value
                              ? 'bg-accent text-white border-accent'
                              : 'border-gray-200 text-secondary hover:border-accent/40'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Descrizione">
                    <input
                      type="text"
                      value={discountForm.description}
                      onChange={(e) => setDiscountForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Descrizione dello sconto..."
                      className={inputClass()}
                    />
                  </Field>

                  <Field label="Condizioni">
                    <input
                      type="text"
                      value={discountForm.conditions}
                      onChange={(e) => setDiscountForm(p => ({ ...p, conditions: e.target.value }))}
                      placeholder="Es. Minimo 2 persone, solo cena"
                      className={inputClass()}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Valido fino al">
                      <input
                        type="date"
                        value={discountForm.valid_until}
                        onChange={(e) => setDiscountForm(p => ({ ...p, valid_until: e.target.value }))}
                        className={inputClass()}
                      />
                    </Field>
                    <Field label="Max utilizzi">
                      <input
                        type="number"
                        value={discountForm.max_redemptions}
                        onChange={(e) => setDiscountForm(p => ({ ...p, max_redemptions: e.target.value }))}
                        placeholder="Illimitati"
                        className={inputClass()}
                      />
                    </Field>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSaveDiscount}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-[#e64545] transition-colors"
                    >
                      {discount ? 'Aggiorna Sconto' : 'Crea Sconto'}
                    </motion.button>
                    {discount && (
                      <button
                        type="button"
                        onClick={handleDeleteDiscount}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Elimina Sconto
                      </button>
                    )}
                    {discount && (
                      <span className="text-xs text-green-600 font-medium">
                        Sconto attivo ({discount.total_redeemed || 0} utilizzi)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* --- Publishing --- */}
          <Section title="Pubblicazione">
            <Toggle
              checked={form.published}
              onChange={(v) => update('published', v)}
              label={form.published ? 'Pubblicato' : 'Bozza'}
            />
          </Section>

          {/* --- Submit --- */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-secondary hover:bg-gray-100 transition-colors"
            >
              Annulla
            </button>
            <motion.button
              type="submit"
              disabled={saving}
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-accent text-white shadow-md hover:bg-[#e64545] transition-colors disabled:opacity-50"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="45" className="opacity-40" />
                  </svg>
                  Salvataggio...
                </span>
              ) : (
                isEditing ? 'Salva Modifiche' : 'Crea Ristorante'
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-primary mb-2">Conferma eliminazione</h3>
              <p className="text-sm text-secondary mb-6">
                Sei sicuro di voler eliminare <strong>{form.name}</strong>? Questa azione non puo essere annullata.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-secondary hover:bg-gray-100 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Eliminazione...' : 'Elimina'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </AdminLayout>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function Section({ title, children }) {
  return (
    <section className="bg-card rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-base font-semibold text-primary mb-5">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, children, error }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function inputClass(hasError) {
  return `w-full px-4 py-2.5 rounded-xl border text-base text-primary placeholder:text-secondary/50 focus:outline-none focus:ring-2 transition-all duration-200 ${
    hasError
      ? 'border-red-300 focus:ring-red-300/40 focus:border-red-400 bg-red-50/30'
      : 'border-gray-200 focus:ring-accent/30 focus:border-accent bg-bg'
  }`
}
