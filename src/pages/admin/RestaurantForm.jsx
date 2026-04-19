import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams, Link, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants, PRICE_LABELS } from '../../lib/hooks/useRestaurants'
import { useCategories } from '../../lib/hooks/useCategories'
import { useToast } from '../../components/UI/Toast'
import { LoadingSpinner } from '../../components/UI/LoadingSpinner'
import { geocodeAddress, reverseGeocode } from '../../lib/utils/geocoding'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'

/* ------------------------------------------------------------------ */
/*  Convert image file to WebP (smaller, faster loading)               */
/*  Returns { full, thumb } blobs                                      */
/* ------------------------------------------------------------------ */
function convertToWebP(file, maxWidth = 1200, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const objectUrl = img.src

      // Helper: resize to given width and return a WebP blob
      const resize = (targetWidth, q) =>
        new Promise((res, rej) => {
          const scale = Math.min(1, targetWidth / img.width)
          const w = Math.round(img.width * scale)
          const h = Math.round(img.height * scale)
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          canvas.toBlob(
            (blob) => (blob ? res(blob) : rej(new Error('WebP conversion failed'))),
            'image/webp',
            q
          )
        })

      Promise.all([
        resize(maxWidth, quality),      // full-size for carousel
        resize(400, 0.70),              // thumbnail for cards/lists
      ])
        .then(([full, thumb]) => {
          URL.revokeObjectURL(objectUrl)
          resolve({ full, thumb })
        })
        .catch((err) => {
          URL.revokeObjectURL(objectUrl)
          reject(err)
        })
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
  tagline: '',
  address: '',
  city: 'Torino',
  country: 'Italia',
  latitude: '',
  longitude: '',
  phone: '',
  google_maps_url: '',
  website: '',
  place_id: '',
  place_id_confidence: null,
  place_id_verified_at: null,
  categories: [],
  price_range: 0,
  our_review: '',
  our_tip: '',
  recommended_for: [],
  instagram_reel: '',
  tiktok_url: '',
  verify_pin: '',
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
const ADD_COLOR_PRESETS = [
  '#FF5757', '#EF4444', '#F59E0B', '#10B981', '#6366F1',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#3B82F6',
]

function CategorySelector({ selected, onChange }) {
  const { categories: CUISINE_CATEGORIES, addCategory } = useCategories()
  const [open, setOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', emoji: '', color: ADD_COLOR_PRESETS[0] })
  const [addSaving, setAddSaving] = useState(false)

  const toggle = (name) => {
    onChange(
      selected.includes(name)
        ? selected.filter((s) => s !== name)
        : [...selected, name]
    )
  }

  // Move a category to first position (changes map icon)
  const moveToFirst = (name) => {
    if (selected[0] === name) return
    onChange([name, ...selected.filter((s) => s !== name)])
  }

  // Add new category inline and auto-select it
  const handleAddInline = async () => {
    if (!addForm.name.trim() || addSaving) return
    setAddSaving(true)
    const { data, error } = await addCategory({ name: addForm.name, emoji: addForm.emoji || '🍴', color: addForm.color })
    setAddSaving(false)
    if (!error && data) {
      const newName = addForm.name.trim()
      if (!selected.includes(newName)) {
        onChange([...selected, newName])
      }
      setAddForm({ name: '', emoji: '', color: ADD_COLOR_PRESETS[0] })
      setShowAddForm(false)
    }
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

      {/* Selected chips preview — tap to move to first (= map icon) */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((name, i) => {
            const cat = CUISINE_CATEGORIES.find((c) => c.name === name)
            return (
              <motion.span
                key={name}
                layout
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white cursor-pointer ${
                  i === 0 ? 'ring-2 ring-offset-1 ring-accent' : ''
                }`}
                style={{ backgroundColor: cat?.color || '#6B7280' }}
                onClick={() => moveToFirst(name)}
                title={i === 0 ? 'Categoria principale (icona mappa)' : 'Tocca per impostare come principale'}
              >
                <span>{cat?.emoji}</span>
                {name}
                {i === 0 && (
                  <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(name) }}
                  className="ml-0.5 hover:opacity-70"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </motion.span>
            )
          })}
        </div>
      )}
      {selected.length > 1 && (
        <p className="text-[10px] text-secondary mt-1">Tocca una categoria per impostarla come principale (icona mappa)</p>
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
              onClick={() => { setOpen(false); setShowAddForm(false) }}
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
                  {showAddForm ? (
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-accent"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      Indietro
                    </button>
                  ) : (
                    <h3 className="text-lg font-semibold text-primary">Tipo di locale</h3>
                  )}
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setShowAddForm(false) }}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content area */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {showAddForm ? (
                    /* Add form — replaces grid so it's always visible above keyboard */
                    <div className="space-y-4">
                      <p className="text-lg font-semibold text-primary">Nuova categoria</p>
                      <div>
                        <label className="text-xs font-medium text-secondary mb-1.5 block">Nome</label>
                        <input
                          type="text"
                          value={addForm.name}
                          onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Es. Pizzeria"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-secondary mb-1.5 block">Emoji</label>
                        <input
                          type="text"
                          value={addForm.emoji}
                          onChange={(e) => setAddForm((p) => ({ ...p, emoji: e.target.value }))}
                          placeholder="🍴"
                          className="w-20 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent/30"
                          maxLength={4}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-secondary mb-1.5 block">Colore</label>
                        <div className="flex flex-wrap gap-2.5">
                          {ADD_COLOR_PRESETS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setAddForm((p) => ({ ...p, color: c }))}
                              className={`w-8 h-8 rounded-full border-2 transition-all ${
                                addForm.color === c ? 'border-primary scale-110 shadow-sm' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddInline}
                        disabled={!addForm.name.trim() || addSaving}
                        className="w-full py-3 rounded-xl text-sm font-medium bg-accent text-white hover:bg-[#e64545] transition-colors disabled:opacity-50 shadow-md mt-2"
                      >
                        {addSaving ? '...' : 'Aggiungi categoria'}
                      </button>
                    </div>
                  ) : (
                    /* Category grid */
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

                      {/* Add new category button */}
                      <button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        className="flex flex-col items-center gap-1.5 py-2"
                      >
                        <div className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-accent transition-colors">
                          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-secondary text-center leading-tight">Aggiungi</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer button */}
                <div className="px-5 py-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setShowAddForm(false) }}
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
              loading="lazy"
              decoding="async"
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
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { allRestaurants } = useRestaurants()
  const { addToast } = useToast()

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [googleFilling, setGoogleFilling] = useState(false)
  const [showNameSearch, setShowNameSearch] = useState(false)
  const [nameQuery, setNameQuery] = useState('')
  const [nameSearching, setNameSearching] = useState(false)
  const [aiCorrecting, setAiCorrecting] = useState(null) // 'our_review' | 'our_tip' | null
  const [aiSuggestion, setAiSuggestion] = useState(null) // { field, original, corrected }
  const [placeSearching, setPlaceSearching] = useState(false)
  const [placeCandidates, setPlaceCandidates] = useState(null) // array or null
  // Notify subscribers state
  const [notifying, setNotifying] = useState(false)
  const [notifyInfo, setNotifyInfo] = useState(null) // { sent_at, sent_count } if already sent
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

  // Autosave draft — survives tab close / connection loss / refresh.
  // Stored per-id (or 'new') in localStorage; cleared on successful save/delete.
  const draftKey = `restaurant-form-draft:${id || 'new'}`
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [savedDraftAt, setSavedDraftAt] = useState(null)
  const [pendingDraft, setPendingDraft] = useState(null) // { form, savedAt } if restore prompt needed


  // Load restaurant data when editing
  useEffect(() => {
    if (isEditing && allRestaurants.length > 0) {
      const r = allRestaurants.find((r) => r.id === id)
      if (r) {
        setForm({
          name: r.name || '',
          tagline: r.tagline || '',
          address: r.address || '',
          city: r.city || 'Torino',
          country: r.country || 'Italia',
          latitude: r.latitude != null ? String(r.latitude) : '',
          longitude: r.longitude != null ? String(r.longitude) : '',
          phone: r.phone || '',
          google_maps_url: r.google_maps_url || '',
          website: r.website || '',
          place_id: r.place_id || '',
          place_id_confidence: r.place_id_confidence ?? null,
          place_id_verified_at: r.place_id_verified_at || null,
          categories: r.cuisine_type ? [r.cuisine_type] : (r.categories || []),
          price_range: r.price_range || 0,
          our_review: r.our_review || r.description || '',
          our_tip: r.our_tip || (Array.isArray(r.tips) ? r.tips.join('\n') : '') || '',
          recommended_for: r.recommended_for || [],
          instagram_reel: r.instagram_reel || '',
          tiktok_url: r.tiktok_url || '',
          verify_pin: r.verify_pin || '',
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
  }, [isEditing, id, allRestaurants])

  // Check for an existing draft on mount (and after DB load for editing)
  useEffect(() => {
    // Wait for DB data to load when editing — otherwise we'd overwrite form
    // right after offering to restore
    if (isEditing && allRestaurants.length === 0) return
    if (draftLoaded) return
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.form && parsed.savedAt) {
          setPendingDraft(parsed)
        }
      }
    } catch {
      // corrupt draft — ignore
    }
    setDraftLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, allRestaurants.length, draftKey])

  // Debounced autosave — writes form to localStorage ~1s after last change.
  // Skips File objects in photos (not serializable); uploaded URLs are kept.
  useEffect(() => {
    if (!draftLoaded) return
    const handle = setTimeout(() => {
      try {
        // For "new" forms, only save once something is actually entered
        const hasContent =
          isEditing ||
          form.name?.trim() ||
          form.address?.trim() ||
          form.our_review?.trim() ||
          form.our_tip?.trim() ||
          (form.photos?.length > 0)
        if (!hasContent) return
        const serializable = {
          ...form,
          photos: (form.photos || [])
            .filter((p) => p.url && !p.url.startsWith('blob:'))
            .map((p) => ({ url: p.url, caption: p.caption || '', sort_order: p.sort_order })),
        }
        localStorage.setItem(draftKey, JSON.stringify({ form: serializable, savedAt: Date.now() }))
        setSavedDraftAt(Date.now())
      } catch {
        // quota exceeded or disabled — silent
      }
    }, 1000)
    return () => clearTimeout(handle)
  }, [form, draftKey, draftLoaded, isEditing])

  const restoreDraft = () => {
    if (!pendingDraft?.form) return
    setForm((prev) => ({ ...prev, ...pendingDraft.form }))
    setPendingDraft(null)
    addToast('Bozza ripristinata', 'success')
  }

  const discardDraft = () => {
    try { localStorage.removeItem(draftKey) } catch {}
    setPendingDraft(null)
    setSavedDraftAt(null)
  }

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }))
  }

  async function searchPlaceCandidates() {
    if (!form.name.trim()) {
      addToast('Inserisci prima il nome del locale', 'warning')
      return
    }
    setPlaceSearching(true)
    setPlaceCandidates(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessione scaduta')
      const res = await fetch('/api/admin-backfill-places?action=search-only', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: form.name, address: form.address }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Errore ricerca')
      setPlaceCandidates(json.candidates || [])
      if (!json.candidates?.length) addToast('Nessun candidato trovato', 'info')
    } catch (e) {
      addToast(`Errore: ${e.message}`, 'error')
    } finally {
      setPlaceSearching(false)
    }
  }

  function applyCandidate(c) {
    setForm(prev => ({
      ...prev,
      place_id: c.place_id,
      place_id_confidence: c.confidence,
      place_id_verified_at: null,
    }))
    setPlaceCandidates(null)
    addToast('Place ID impostato — verifica poi salva', 'success')
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

      // CID URLs (from Google Maps app) can't be resolved server-side (Google blocks with CAPTCHA)
      if (/[?&]cid=\d+/.test(mapsUrl)) {
        addToast('Questo tipo di link non è supportato. Dall\'app Google Maps, apri il locale → tocca "Condividi" (icona freccia) → "Copia link". Il link corretto inizia con maps.app.goo.gl', 'error')
        setGoogleFilling(false)
        return
      }

      const isShortUrl = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|share\.google)\//i.test(mapsUrl)
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

        if (data?._debug) console.log('Google Maps API debug:', JSON.stringify(data._debug, null, 2))

        if (data?.error) {
          if (data.captcha) {
            setShowNameSearch(true)
            addToast('Google ha bloccato il link. Cerca il ristorante per nome qui sotto.', 'error')
          } else {
            addToast(data.error, 'error')
          }
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

  // Name search fallback (when Google blocks URL resolution)
  const handleNameSearch = async () => {
    const q = nameQuery.trim()
    if (!q) return
    setNameSearching(true)
    try {
      const res = await fetch('/api/resolve-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      if (data?._debug) console.log('Name search debug:', JSON.stringify(data._debug, null, 2))
      if (data?.error) {
        addToast(data.error, 'error')
        setNameSearching(false)
        return
      }
      if (data.name) update('name', data.name)
      if (data.address) update('address', data.address)
      if (data.latitude) update('latitude', String(data.latitude))
      if (data.longitude) update('longitude', String(data.longitude))
      if (data.phone) update('phone', data.phone)
      if (data.website) update('website', data.website)
      if (data.resolved_url) update('google_maps_url', data.resolved_url)
      setShowNameSearch(false)
      setNameQuery('')
      addToast('Dati compilati da Google Places!', 'success')
    } catch (err) {
      addToast('Errore nella ricerca', 'error')
    }
    setNameSearching(false)
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

  // Load prior notify log for this restaurant (if any)
  useEffect(() => {
    if (!isEditing || !id || !isSupabaseConfigured()) return
    supabase
      .from('email_notifications_log')
      .select('sent_at, sent_count')
      .eq('type', 'restaurant')
      .eq('item_id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setNotifyInfo(data)
      })
  }, [isEditing, id])

  const handleNotifySubscribers = async ({ force = false } = {}) => {
    if (!id) return
    if (!form.published) {
      addToast('Pubblica il ristorante prima di notificare', 'error')
      return
    }
    setNotifying(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sessione scaduta')
      const res = await fetch('/api/notify-subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: 'restaurant', id, force }),
      })
      const json = await res.json()
      if (res.status === 409) {
        const sentWhen = new Date(json.sent_at).toLocaleString('it-IT')
        const again = window.confirm(`Già inviato il ${sentWhen} a ${json.sent_count} iscritti.\n\nVuoi inviare di nuovo?`)
        if (again) return handleNotifySubscribers({ force: true })
        return
      }
      if (!res.ok) throw new Error(json.error || 'Errore invio')
      if (json.errors) {
        alert(`Resend error details:\n\n${JSON.stringify(json.errorDetails, null, 2)}`)
      }
      addToast(`Notifica inviata a ${json.sent} iscritti${json.errors ? ` (${json.errors} errori)` : ''}`, 'success')
      setNotifyInfo({ sent_at: new Date().toISOString(), sent_count: json.sent })
    } catch (err) {
      addToast(`Errore notifica: ${err.message}`, 'error')
    } finally {
      setNotifying(false)
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
      tagline: form.tagline.trim() || null,
      address: form.address.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      phone: form.phone.trim(),
      google_maps_url: form.google_maps_url.trim(),
      website: form.website.trim(),
      place_id: form.place_id.trim() || null,
      place_id_confidence: form.place_id_confidence,
      place_id_verified_at: form.place_id_verified_at,
      cuisine_type: form.categories[0] || null,
      category: form.categories,
      price_range: form.price_range,
      our_review: form.our_review.trim(),
      our_tip: form.our_tip.trim(),
      recommended_for: form.recommended_for,
      instagram_reel: form.instagram_reel.trim() || null,
      tiktok_url: form.tiktok_url.trim() || null,
      verify_pin: form.verify_pin.trim() || null,
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

          const slugify = (str) => (str || '').trim().toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
          const nameSlug = slugify(form.name)
          const citySlug = slugify(form.city || form.address?.split(',').pop())

          const photoRows = []
          for (let idx = 0; idx < form.photos.length; idx++) {
            const photo = form.photos[idx]
            let photoUrl = photo.url
            // If it's a file upload, convert to WebP and upload full + thumbnail
            let thumbUrl = null
            if (photo.file) {
              try {
                const { full, thumb } = await convertToWebP(photo.file)
                // SEO-friendly naming: ristorante-nome-citta-1.webp
                const seoName = citySlug ? `${nameSlug}-${citySlug}` : nameSlug
                const fileName = `${seoName}-${idx + 1}.webp`
                const thumbName = `${seoName}-${idx + 1}-thumb.webp`
                const basePath = `restaurants/${citySlug || 'other'}/${nameSlug}`
                const uploadOpts = { contentType: 'image/webp', cacheControl: '31536000', upsert: true }

                // Upload full + thumb in parallel
                const [fullRes, thumbRes] = await Promise.all([
                  supabase.storage.from('photos').upload(`${basePath}/${fileName}`, full, uploadOpts),
                  supabase.storage.from('photos').upload(`${basePath}/${thumbName}`, thumb, uploadOpts),
                ])

                if (fullRes.error) {
                  console.error('Upload error:', fullRes.error)
                  addToast(`Errore upload foto: ${fullRes.error.message}`, 'error')
                  continue
                }

                const { data: urlData } = supabase.storage.from('photos').getPublicUrl(`${basePath}/${fileName}`)
                photoUrl = urlData.publicUrl

                if (!thumbRes.error) {
                  const { data: thumbData } = supabase.storage.from('photos').getPublicUrl(`${basePath}/${thumbName}`)
                  thumbUrl = thumbData.publicUrl
                }
              } catch (convErr) {
                console.error('Conversion error:', convErr)
                addToast(`Errore conversione foto ${idx + 1}`, 'error')
                continue
              }
            }
            photoRows.push({
              restaurant_id: restaurantId,
              photo_url: photoUrl,
              thumb_url: thumbUrl,
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

        try { localStorage.removeItem(draftKey) } catch {}
        addToast(isEditing ? 'Ristorante aggiornato!' : 'Ristorante creato!', 'success')
        navigate('/admin')
      } else {
        // Mock mode
        await new Promise((resolve) => setTimeout(resolve, 500))
        try { localStorage.removeItem(draftKey) } catch {}
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
      try { localStorage.removeItem(draftKey) } catch {}
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

  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  const FieldError = ({ field }) =>
    errors[field] ? (
      <motion.p
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          fontSize: 11,
          color: '#dc2626',
          marginTop: 6,
          fontWeight: 500,
        }}
      >
        {errors[field]}
      </motion.p>
    ) : null

  return (
    <AdminLayout title={isEditing ? 'Modifica Ristorante' : 'Nuovo Ristorante'}>
      {/* ── Sticky header ── */}
      {/* On mobile, AdminLayout shows a fixed 48px black ADMIN bar (z:20).
          So we sit this sticky header at top:48 on mobile (top:0 on desktop)
          with z-index higher than the admin bar. */}
      <style>{`
        .restaurant-form-sticky-header {
          position: sticky;
          top: 48px;
          z-index: 25;
        }
        @media (min-width: 768px) {
          .restaurant-form-sticky-header {
            top: 0;
          }
        }
      `}</style>
      <div
        className="restaurant-form-sticky-header px-3 md:px-6"
        style={{
          background: 'rgba(250,250,250,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #eee',
          paddingTop: 12,
          paddingBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <button
            type="button"
            onClick={() => navigate('/admin/restaurants')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: '#999',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
            aria-label="Torna ai ristoranti"
          >
            <ArrowLeftIcon className="w-[18px] h-[18px]" />
          </button>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              to="/admin/restaurants"
              className="hidden sm:inline"
              style={{
                fontSize: 12,
                color: '#999',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              Ristoranti
            </Link>
            <span className="hidden sm:inline" style={{ color: '#ccc', fontSize: 12, flexShrink: 0 }}>›</span>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#1a1a1f',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {isEditing ? (form.name || 'Modifica ristorante') : 'Nuovo ristorante'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isEditing && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="hidden md:inline-flex"
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid #eee',
                color: '#b91c1c',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Elimina
            </button>
          )}
          <button
            type="submit"
            form="restaurant-form"
            disabled={saving}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              background: '#E8453C',
              border: 'none',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              whiteSpace: 'nowrap',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>

      {/* ── Form body ── */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '22px 20px 48px' }}>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <form id="restaurant-form" onSubmit={handleSave} className="space-y-6">
          {/* Draft restore banner + autosave status */}
          {pendingDraft && (
            <div style={{
              background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10,
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#9A3412' }}>
                  Bozza non salvata trovata
                </div>
                <div style={{ fontSize: 12, color: '#9A3412', marginTop: 2 }}>
                  Salvata {new Date(pendingDraft.savedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                  {' '}— vuoi ripristinarla?
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={restoreDraft} style={{
                  background: '#22181C', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  Ripristina
                </button>
                <button type="button" onClick={discardDraft} style={{
                  background: '#fff', color: '#9A3412', border: '1px solid #FED7AA', borderRadius: 8,
                  padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  Scarta
                </button>
              </div>
            </div>
          )}
          {savedDraftAt && !pendingDraft && (
            <div style={{ fontSize: 11, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Bozza salvata alle {new Date(savedDraftAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

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
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleGoogleFill}
                disabled={googleFilling || !form.google_maps_url.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#1a1a1f] text-white hover:bg-[#2a2a2f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-start"
              >
                {googleFilling ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="45" className="opacity-40" />
                    </svg>
                    Ricerca in corso...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Compila automaticamente
                  </>
                )}
              </motion.button>
              <p style={{ fontSize: 11, color: '#999', lineHeight: 1.5 }}>
                Dall'app Google Maps tocca "Condividi" → "Copia link". Funzionano anche i link lunghi dal browser.
              </p>
            </div>

            {/* Name search fallback — shown when Google blocks URL resolution */}
            <AnimatePresence>
              {showNameSearch && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    style={{
                      marginTop: 12,
                      padding: 14,
                      borderRadius: 10,
                      background: '#fef3c7',
                      border: '1px solid #fde68a',
                    }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#b45309', marginBottom: 10 }}>
                      Google ha bloccato il link. Cerca il ristorante per nome:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nameQuery}
                        onChange={(e) => setNameQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNameSearch())}
                        placeholder="es. Ristorante Da Mario Torino"
                        className={inputClass()}
                      />
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={handleNameSearch}
                        disabled={nameSearching || !nameQuery.trim()}
                        style={{
                          flexShrink: 0,
                          padding: '8px 16px',
                          borderRadius: 8,
                          background: '#b45309',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          border: 'none',
                          cursor: nameSearching || !nameQuery.trim() ? 'not-allowed' : 'pointer',
                          opacity: nameSearching || !nameQuery.trim() ? 0.5 : 1,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {nameSearching ? 'Cerco...' : 'Cerca'}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Section>

          {/* --- Informazioni --- */}
          <CollapsibleSection title="Informazioni" subtitle="Nome, categorie, prezzo">
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

            <Field label="Breve descrizione">
              <input
                type="text"
                value={form.tagline}
                onChange={(e) => update('tagline', e.target.value)}
                placeholder="Es: Panini calabresi, Tapas e paella spagnola..."
                maxLength={60}
                className={inputClass()}
              />
              <span style={{ fontSize: 11, color: '#999', marginTop: 4, display: 'block' }}>
                {form.tagline.length}/60 — Apparirà sotto il nome nelle card
              </span>
            </Field>

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
          </CollapsibleSection>

          {/* --- Posizione --- */}
          <CollapsibleSection title="Posizione" subtitle="Indirizzo e coordinate sulla mappa">
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
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[#E8453C] text-[#E8453C] hover:bg-[#E8453C]/5 transition-colors disabled:opacity-50 self-start"
            >
              {geocoding ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="45" className="opacity-40" />
                  </svg>
                  Geocodifica in corso...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Trova coordinate da indirizzo
                </>
              )}
            </motion.button>
          </CollapsibleSection>

          {/* --- Contatti & Social --- */}
          <CollapsibleSection title="Contatti & Social" subtitle="Telefono, sito, Instagram, TikTok" defaultOpen={false}>
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
          </CollapsibleSection>

          {/* --- Area Ristoratori --- */}
          <CollapsibleSection
            title="Area Ristoratori"
            subtitle="PIN di accesso a /verify per il ristoratore"
            defaultOpen={false}
          >
            <Field label="PIN Verify (6 cifre)">
              <input
                type="text"
                inputMode="numeric"
                value={form.verify_pin}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
                  update('verify_pin', digits)
                }}
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="Es. 482103"
                className={inputClass()}
                style={{ letterSpacing: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              />
              <p className="mt-1.5 text-xs text-secondary">
                Il ristoratore usa questo PIN per accedere a <span className="font-semibold">/verify</span> e validare gli sconti dei clienti. Dev'essere <strong>univoco</strong> e di 6 cifre.
              </p>
            </Field>
          </CollapsibleSection>

          {/* --- Google Places (orari automatici) --- */}
          <CollapsibleSection title="Google Places" subtitle="Associa Place ID per orari automatici" defaultOpen={false}>
            <Field label="Place ID">
              <input
                type="text"
                value={form.place_id}
                onChange={(e) => update('place_id', e.target.value)}
                placeholder="Es. ChIJN1t_tDeuEmsRUsoyG83frY4"
                className={inputClass()}
                style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
              />
              <p className="mt-1.5 text-xs text-secondary">
                ID univoco del locale su Google Places. Usa il bottone qui sotto per cercare automaticamente, oppure incollalo manualmente dal{' '}
                <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" className="text-accent underline">
                  Places ID Finder
                </a>.
              </p>
            </Field>

            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={searchPlaceCandidates}
                disabled={placeSearching || !form.name.trim()}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1e40af] text-white hover:bg-[#1e3a8a] disabled:opacity-50 transition-colors"
              >
                {placeSearching ? 'Cerco...' : 'Cerca candidati Google'}
              </button>
            </div>

            {placeCandidates && placeCandidates.length > 0 && (
              <div style={{
                marginTop: 10, padding: 12, borderRadius: 10,
                background: 'rgba(30, 64, 175, 0.06)', border: '1px solid rgba(30, 64, 175, 0.2)',
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 10px' }}>
                  {placeCandidates.length} candidati trovati — clicca quello giusto:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {placeCandidates.map(c => (
                    <button
                      key={c.place_id}
                      type="button"
                      onClick={() => applyCandidate(c)}
                      style={{
                        textAlign: 'left', padding: 10, borderRadius: 8,
                        background: '#fff', border: '1px solid #ddd', cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                        <strong style={{ fontSize: 13 }}>{c.display_name}</strong>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: c.confidence >= 0.6 ? '#2e7d57' : c.confidence >= 0.35 ? '#b45309' : '#888',
                        }}>
                          {(c.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{c.address}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{
              display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12,
              padding: 12, borderRadius: 10, background: '#f9f7f2', border: '1px solid #eee',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Stato:</span>
                {!form.place_id.trim() ? (
                  <span style={{
                    padding: '3px 10px', borderRadius: 6, background: '#f3f3f3',
                    color: '#666', fontSize: 11, fontWeight: 600,
                  }}>Non associato</span>
                ) : form.place_id_verified_at ? (
                  <span style={{
                    padding: '3px 10px', borderRadius: 6, background: 'rgba(46, 125, 87, 0.12)',
                    color: '#2e7d57', fontSize: 11, fontWeight: 600,
                  }}>
                    Verificato il {new Date(form.place_id_verified_at).toLocaleDateString('it-IT')}
                  </span>
                ) : (
                  <span style={{
                    padding: '3px 10px', borderRadius: 6, background: 'rgba(180, 83, 9, 0.12)',
                    color: '#b45309', fontSize: 11, fontWeight: 600,
                  }}>Candidato non verificato</span>
                )}
                {form.place_id_confidence != null && (
                  <span style={{ fontSize: 11, color: '#888' }}>
                    · confidence {(form.place_id_confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {form.place_id.trim() && !form.place_id_verified_at && (
                  <button
                    type="button"
                    onClick={() => update('place_id_verified_at', new Date().toISOString())}
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1a1f] text-white hover:bg-[#2a2a2f] transition-colors"
                  >
                    Verifica come corretto
                  </button>
                )}
                {form.place_id_verified_at && (
                  <button
                    type="button"
                    onClick={() => update('place_id_verified_at', null)}
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#1a1a1f] border border-[#e5e5e5] hover:bg-[#f5f5f5] transition-colors"
                  >
                    Rimuovi verifica
                  </button>
                )}
              </div>

              <p style={{ fontSize: 11, color: '#888', lineHeight: 1.5, margin: 0 }}>
                Solo i locali verificati mostrano gli orari automatici sulla scheda pubblica.
                Senza verifica, il pubblico vede il bottone "Chiama" come fallback.
              </p>
            </div>
          </CollapsibleSection>

          {/* --- Recensione Bi --- */}
          <CollapsibleSection title="Recensione Bi" subtitle="La nostra opinione e i consigli del team" defaultOpen={false}>
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
                  {aiCorrecting === 'our_review' ? 'Correzione...' : 'Correggi con AI'}
                </motion.button>
              )}
              {aiSuggestion?.field === 'our_review' && (
                <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                  <p className="text-xs font-semibold text-purple-700 mb-2">Testo corretto:</p>
                  <p className="text-sm text-[#1a1a1f] whitespace-pre-wrap">{aiSuggestion.corrected}</p>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={handleAcceptAi} className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white">Accetta</button>
                    <button type="button" onClick={handleRejectAi} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-[#666]">Rifiuta</button>
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
                  {aiCorrecting === 'our_tip' ? 'Correzione...' : 'Correggi con AI'}
                </motion.button>
              )}
              {aiSuggestion?.field === 'our_tip' && (
                <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                  <p className="text-xs font-semibold text-purple-700 mb-2">Testo corretto:</p>
                  <p className="text-sm text-[#1a1a1f] whitespace-pre-wrap">{aiSuggestion.corrected}</p>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={handleAcceptAi} className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white">Accetta</button>
                    <button type="button" onClick={handleRejectAi} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-[#666]">Rifiuta</button>
                  </div>
                </div>
              )}
            </Field>
          </CollapsibleSection>

          {/* --- Photos --- */}
          <CollapsibleSection title="Foto" subtitle="Galleria del locale (WebP + thumbnail automatici)">
            <PhotoManager
              photos={form.photos}
              onChange={(photos) => update('photos', photos)}
            />
          </CollapsibleSection>

          {/* --- Discount (inline) --- */}
          {isEditing && (
            <CollapsibleSection title="Sconto attivo" subtitle="Gestisci lo sconto del locale" defaultOpen={false}>
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
            </CollapsibleSection>
          )}

          {/* --- Publishing (non-collapsible, always visible) --- */}
          <Section title="Pubblicazione">
            <Toggle
              checked={form.published}
              onChange={(v) => update('published', v)}
              label={form.published ? 'Pubblicato — visibile sulla mappa' : 'Bozza — non visibile'}
            />
          </Section>

          {/* --- Notify subscribers (only when editing an existing, published restaurant) --- */}
          {isEditing && (
            <Section title="Notifica iscritti newsletter">
              <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.5 }}>
                Invia una email a tutti gli iscritti alla newsletter per annunciare questo ristorante.
                {notifyInfo && (
                  <> <br/><strong>Ultima notifica</strong>: {new Date(notifyInfo.sent_at).toLocaleString('it-IT')} — {notifyInfo.sent_count} iscritti.</>
                )}
              </p>
              <button
                type="button"
                disabled={notifying || !form.published}
                onClick={() => handleNotifySubscribers({ force: false })}
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: form.published ? '#E8453C' : '#ddd',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: notifying || !form.published ? 'not-allowed' : 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  opacity: notifying ? 0.6 : 1,
                }}
              >
                {notifying ? 'Invio in corso…' : notifyInfo ? 'Invia di nuovo' : 'Invia notifica agli iscritti'}
              </button>
              {!form.published && (
                <p style={{ fontSize: 12, color: '#b91c1c', margin: 0 }}>
                  Pubblica il ristorante per abilitare l'invio.
                </p>
              )}
            </Section>
          )}

          {/* --- Mobile-only delete (sticky header hides it on small screens) --- */}
          {isEditing && (
            <div className="md:hidden" style={{ paddingTop: 8 }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: '#fff',
                  border: '1px solid #eee',
                  color: '#b91c1c',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: 'pointer',
                }}
              >
                Elimina ristorante
              </button>
            </div>
          )}
        </form>
      </motion.div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{
              background: 'rgba(26,26,31,0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                background: '#fff',
                borderRadius: 14,
                border: '1px solid #eee',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                padding: 24,
                maxWidth: 380,
                width: '100%',
                fontFamily: "'DM Sans', sans-serif",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1f', margin: 0, marginBottom: 8 }}>
                Conferma eliminazione
              </h3>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.5 }}>
                Sei sicuro di voler eliminare <strong style={{ color: '#1a1a1f' }}>{form.name}</strong>? Questa azione non può essere annullata.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: '1px solid #eee',
                    color: '#666',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Annulla
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    background: '#dc2626',
                    border: 'none',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
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
/*  Helpers — admin design                                             */
/* ------------------------------------------------------------------ */
function Section({ title, children }) {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #eee',
        padding: '20px 22px',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <h2
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#1a1a1f',
          margin: 0,
          marginBottom: 16,
          letterSpacing: '-0.1px',
        }}
      >
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </section>
  )
}

function CollapsibleSection({ title, subtitle, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #eee',
        overflow: 'hidden',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 22px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#1a1a1f',
              margin: 0,
              letterSpacing: '-0.1px',
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                fontSize: 11,
                color: '#999',
                margin: '2px 0 0',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#999"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '6px 22px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                borderTop: '1px solid #f3f3f3',
              }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function Field({ label, children, error }) {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 500,
          color: '#1a1a1f',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function inputClass(hasError) {
  return `w-full px-3.5 py-2.5 rounded-lg border text-sm text-[#1a1a1f] placeholder:text-[#aaa] focus:outline-none focus:ring-2 transition-all duration-150 ${
    hasError
      ? 'border-red-300 focus:ring-red-300/30 focus:border-red-400 bg-red-50/30'
      : 'border-[#eee] focus:ring-[#E8453C]/15 focus:border-[#E8453C]/50 bg-white'
  }`
}
