import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants, CUISINE_CATEGORIES, PRICE_LABELS } from '../../lib/hooks/useRestaurants'
import { useToast } from '../../components/UI/Toast'
import { LoadingSpinner } from '../../components/UI/LoadingSpinner'
import { geocodeAddress } from '../../lib/utils/geocoding'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

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
  rating: 0,
  our_review: '',
  our_tip: '',
  published: false,
  photos: [], // { url, caption, sort_order }
}

/* ------------------------------------------------------------------ */
/*  Interactive star selector                                          */
/* ------------------------------------------------------------------ */
function StarSelector({ value, onChange }) {
  const [hover, setHover] = useState(null)

  const handleClick = (starIndex, isHalf) => {
    const newVal = isHalf ? starIndex + 0.5 : starIndex + 1
    onChange(newVal === value ? 0 : newVal)
  }

  const display = hover !== null ? hover : value

  return (
    <div className="inline-flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = display >= i + 1
        const halfFilled = !filled && display >= i + 0.5
        return (
          <div key={i} className="relative cursor-pointer" style={{ width: 28, height: 28 }}>
            {/* Left half (half-star click) */}
            <div
              className="absolute inset-y-0 left-0 w-1/2 z-10"
              onMouseEnter={() => setHover(i + 0.5)}
              onMouseLeave={() => setHover(null)}
              onClick={() => handleClick(i, true)}
            />
            {/* Right half (full-star click) */}
            <div
              className="absolute inset-y-0 right-0 w-1/2 z-10"
              onMouseEnter={() => setHover(i + 1)}
              onMouseLeave={() => setHover(null)}
              onClick={() => handleClick(i, false)}
            />
            <svg width={28} height={28} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              {halfFilled && (
                <defs>
                  <linearGradient id={`starGrad-${i}`}>
                    <stop offset="50%" stopColor="#E85D3A" />
                    <stop offset="50%" stopColor="#E85D3A" stopOpacity="0.15" />
                  </linearGradient>
                </defs>
              )}
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
                fill={filled ? '#E85D3A' : halfFilled ? `url(#starGrad-${i})` : '#E85D3A'}
                opacity={filled ? 1 : halfFilled ? 1 : 0.15}
              />
            </svg>
          </div>
        )
      })}
      <span className="ml-2 text-sm font-medium text-secondary">{value > 0 ? value.toFixed(1) : '--'}</span>
    </div>
  )
}

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
/*  Category multi-select chips                                        */
/* ------------------------------------------------------------------ */
function CategoryChips({ selected, onChange }) {
  const toggle = (name) => {
    onChange(
      selected.includes(name)
        ? selected.filter((s) => s !== name)
        : [...selected, name]
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {CUISINE_CATEGORIES.map((cat) => {
        const active = selected.includes(cat.name)
        return (
          <motion.button
            key={cat.name}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => toggle(cat.name)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              active
                ? 'text-white shadow-sm'
                : 'border-gray-200 text-secondary hover:border-gray-300'
            }`}
            style={
              active
                ? { backgroundColor: cat.color, borderColor: cat.color }
                : {}
            }
          >
            <span>{cat.emoji}</span>
            {cat.name}
          </motion.button>
        )
      })}
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
/*  Photo management                                                   */
/* ------------------------------------------------------------------ */
function PhotoManager({ photos, onChange }) {
  const [newUrl, setNewUrl] = useState('')

  const addPhoto = () => {
    if (!newUrl.trim()) return
    onChange([
      ...photos,
      { url: newUrl.trim(), caption: '', sort_order: photos.length },
    ])
    setNewUrl('')
  }

  const removePhoto = (index) => {
    const updated = photos.filter((_, i) => i !== index)
      .map((p, i) => ({ ...p, sort_order: i }))
    onChange(updated)
  }

  const updateCaption = (index, caption) => {
    const updated = photos.map((p, i) => (i === index ? { ...p, caption } : p))
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
      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhoto())}
          placeholder="https://example.com/photo.jpg"
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-bg text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={addPhoto}
          className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium shrink-0 hover:bg-[#d14e2d] transition-colors"
        >
          Aggiungi
        </motion.button>
      </div>

      {/* Preview of URL being typed */}
      {newUrl.trim() && (
        <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50 p-2">
          <p className="text-xs text-secondary mb-1">Anteprima:</p>
          <img
            src={newUrl}
            alt="preview"
            className="w-full max-h-40 object-cover rounded-lg"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        </div>
      )}

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
              onError={(e) => { e.target.src = '' }}
            />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs text-secondary truncate">{photo.url}</p>
              <input
                type="text"
                value={photo.caption}
                onChange={(e) => updateCaption(i, e.target.value)}
                placeholder="Didascalia (opzionale)"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-primary placeholder:text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
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

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) navigate('/admin/login', { replace: true })
  }, [user, authLoading, navigate])

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
          rating: r.our_rating || 0,
          our_review: r.our_review || r.description || '',
          our_tip: r.our_tip || (Array.isArray(r.tips) ? r.tips.join('\n') : '') || '',
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
      our_rating: form.rating,
      our_review: form.our_review.trim(),
      our_tip: form.our_tip.trim(),
      is_published: form.published,
      photos: form.photos,
    }

    try {
      if (isSupabaseConfigured()) {
        if (isEditing) {
          const { error } = await supabase.from('restaurants').update(payload).eq('id', id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('restaurants').insert(payload)
          if (error) throw error
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

  if (!user) return null

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
    <div className="min-h-screen bg-bg overflow-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-30 glass border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-gray-100 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-primary">
              {isEditing ? 'Modifica Ristorante' : 'Nuovo Ristorante'}
            </h1>
          </div>
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
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-3xl mx-auto px-4 py-8"
      >
        <form onSubmit={handleSave} className="space-y-8">
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
            <Field label="Google Maps URL">
              <input
                type="url"
                value={form.google_maps_url}
                onChange={(e) => update('google_maps_url', e.target.value)}
                placeholder="https://maps.google.com/..."
                className={inputClass()}
              />
            </Field>
            <Field label="Sito web">
              <input
                type="url"
                value={form.website}
                onChange={(e) => update('website', e.target.value)}
                placeholder="https://..."
                className={inputClass()}
              />
            </Field>
          </Section>

          {/* --- Classification --- */}
          <Section title="Classificazione">
            <Field label="Categorie *" error={errors.categories}>
              <CategoryChips
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

            <Field label="Valutazione">
              <StarSelector
                value={form.rating}
                onChange={(v) => update('rating', v)}
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
            </Field>
            <Field label="Il nostro consiglio">
              <textarea
                value={form.our_tip}
                onChange={(e) => update('our_tip', e.target.value)}
                rows={3}
                placeholder="Consigli per chi visita il ristorante..."
                className={inputClass() + ' resize-y'}
              />
            </Field>
          </Section>

          {/* --- Photos --- */}
          <Section title="Foto">
            <PhotoManager
              photos={form.photos}
              onChange={(photos) => update('photos', photos)}
            />
          </Section>

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
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-accent text-white shadow-md hover:bg-[#d14e2d] transition-colors disabled:opacity-50"
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
  return `w-full px-4 py-2.5 rounded-xl border text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:ring-2 transition-all duration-200 ${
    hasError
      ? 'border-red-300 focus:ring-red-300/40 focus:border-red-400 bg-red-50/30'
      : 'border-gray-200 focus:ring-accent/30 focus:border-accent bg-bg'
  }`
}
