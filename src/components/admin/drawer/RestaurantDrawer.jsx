import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { supabase, isSupabaseConfigured } from '../../../lib/supabase'
import TabsShell from './TabsShell'
import DettagliTab from '../tabs/DettagliTab'
import FotoGalleriaTab from '../tabs/FotoGalleriaTab'
import CosaTiConsiglioTab from '../tabs/CosaTiConsiglioTab'
import ScontoTab from '../tabs/ScontoTab'
import CredenzialiTab from '../tabs/CredenzialiTab'
import SeoTab from '../tabs/SeoTab'

const TABS = [
  { key: 'dettagli', label: 'Dettagli' },
  { key: 'foto', label: 'Foto & galleria' },
  { key: 'consiglio', label: 'Cosa ti consiglio' },
  { key: 'sconto', label: 'Sconto' },
  { key: 'credenziali', label: 'Credenziali' },
  { key: 'seo', label: 'SEO' },
]

/**
 * RestaurantDrawer — slide-in side drawer (720px desktop, full-width mobile)
 * for editing an existing restaurant. Six shared tab components inside
 * a <TabsShell>.
 *
 * Usage:
 *   <RestaurantDrawer restaurantId={id} onClose={() => ...} onSaved={() => ...} />
 *
 * Accessibility:
 *   - ESC closes (with dirty check)
 *   - Click overlay closes (with dirty check)
 *   - Focus locks to first close button on open, restores on close
 *   - Body scroll locked while open
 */
export default function RestaurantDrawer({ restaurantId, onClose, onSaved }) {
  const open = Boolean(restaurantId)
  const [loading, setLoading] = useState(false)
  const [restaurant, setRestaurant] = useState(null)
  const [form, setForm] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('dettagli')
  const [toast, setToast] = useState(null)
  const firstFocusRef = useRef(null)
  const previouslyFocusedRef = useRef(null)

  // ── Fetch restaurant on open ──
  useEffect(() => {
    if (!open || !isSupabaseConfigured()) return
    let cancelled = false
    setLoading(true)
    setActiveTab('dettagli')
    ;(async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*, restaurant_photos(photo_url, thumb_url, caption, sort_order)')
        .eq('id', restaurantId)
        .single()
      if (cancelled) return
      if (error) {
        console.error('drawer load error:', error)
        setRestaurant(null)
        setForm(null)
      } else {
        setRestaurant(data)
        setForm(toFormState(data))
        setDirty(false)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [restaurantId, open])

  // ── Body scroll lock + ESC + focus ──
  useEffect(() => {
    if (!open) return
    previouslyFocusedRef.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const timeout = setTimeout(() => {
      firstFocusRef.current?.focus()
    }, 50)

    const handleKey = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKey)

    return () => {
      clearTimeout(timeout)
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKey)
      if (previouslyFocusedRef.current?.focus) {
        previouslyFocusedRef.current.focus()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const updateField = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }, [])

  const handleClose = useCallback(() => {
    if (dirty && !confirm('Ci sono modifiche non salvate. Chiudi comunque?')) return
    onClose?.()
  }, [dirty, onClose])

  const handleSave = useCallback(
    async (alsoPublish) => {
      if (!form) return
      setSaving(true)
      try {
        const payload = toDbPayload(form, alsoPublish)
        const { error } = await supabase.from('restaurants').update(payload).eq('id', restaurantId)
        if (error) throw error

        // Save photos to restaurant_photos (delete + re-insert)
        await supabase.from('restaurant_photos').delete().eq('restaurant_id', restaurantId)
        if (form.photos?.length > 0) {
          const photoRows = form.photos
            .map((p, i) => ({
              restaurant_id: restaurantId,
              photo_url: p.url || p.photo_url || '',
              thumb_url: p.thumb_url || null,
              caption: p.caption || '',
              sort_order: i,
            }))
            .filter((p) => p.photo_url)
          if (photoRows.length > 0) {
            await supabase.from('restaurant_photos').insert(photoRows)
          }
        }

        setDirty(false)
        setToast({ kind: 'ok', text: alsoPublish === true ? 'Salvato e pubblicato' : 'Salvato' })
        // refresh local state so subsequent edits start from persisted values
        setRestaurant((prev) => ({ ...prev, ...payload }))
        onSaved?.()
        setTimeout(() => setToast(null), 2400)
      } catch (err) {
        setToast({ kind: 'err', text: `Errore: ${err.message || 'save failed'}` })
        setTimeout(() => setToast(null), 3200)
      } finally {
        setSaving(false)
      }
    },
    [form, restaurantId, onSaved]
  )

  if (!open) return null

  const drawer = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={handleClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(34,24,28,0.45)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 200,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={form?.name ? `Modifica ${form.name}` : 'Modifica ristorante'}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(720px, 100vw)',
              height: '100%',
              background: 'var(--color-page, #FAF7F2)',
              overflowY: 'auto',
              boxShadow: '-20px 0 60px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '18px 24px',
                borderBottom: '1px solid var(--color-line, #EAE3D7)',
                background: '#fff',
                position: 'sticky',
                top: 0,
                zIndex: 3,
              }}
            >
              <button
                ref={firstFocusRef}
                type="button"
                onClick={handleClose}
                aria-label="Chiudi"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--color-cream, #F5F0E4)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 16,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--color-ink)',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: 2,
                  }}
                >
                  Edita ristorante
                </div>
                <h2
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 900,
                    fontSize: 22,
                    letterSpacing: '-0.02em',
                    margin: 0,
                    color: 'var(--color-ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {loading ? '…' : form?.name || 'Ristorante'}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <a
                  href={form?.slug ? `/r/${form.slug}` : '#'}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--color-line, #EAE3D7)',
                    color: 'var(--color-ink)',
                    padding: '9px 16px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'none',
                    fontFamily: 'var(--font-sans)',
                    pointerEvents: form?.slug ? 'auto' : 'none',
                    opacity: form?.slug ? 1 : 0.5,
                  }}
                >
                  Anteprima
                </a>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave(true)}
                  style={{
                    background: 'var(--color-corallo, #E8453C)',
                    color: '#fff',
                    border: 0,
                    padding: '10px 18px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: saving ? 'wait' : 'pointer',
                    boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
                    fontFamily: 'var(--font-sans)',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Salvo…' : 'Salva · pubblica'}
                </button>
              </div>
            </div>

            {/* Body */}
            <div
              style={{
                padding: '22px 24px 40px',
                flex: 1,
                minHeight: 0,
              }}
            >
              {loading || !form ? (
                <LoadingDrawerBody />
              ) : (
                <TabsShell tabs={TABS} activeKey={activeTab} onChange={setActiveTab}>
                  {activeTab === 'dettagli' && (
                    <DettagliTab form={form} onChange={updateField} restaurantId={restaurantId} />
                  )}
                  {activeTab === 'foto' && (
                    <FotoGalleriaTab form={form} onChange={updateField} restaurantId={restaurantId} />
                  )}
                  {activeTab === 'consiglio' && (
                    <CosaTiConsiglioTab form={form} onChange={updateField} restaurantId={restaurantId} />
                  )}
                  {activeTab === 'sconto' && (
                    <ScontoTab form={form} onChange={updateField} restaurantId={restaurantId} />
                  )}
                  {activeTab === 'credenziali' && (
                    <CredenzialiTab
                      form={form}
                      onChange={updateField}
                      restaurantId={restaurantId}
                      onPinRotated={(pin, at) => {
                        setForm((prev) => ({ ...prev, verify_pin: pin, last_pin_rotation_at: at }))
                        setRestaurant((prev) => ({ ...prev, verify_pin: pin, last_pin_rotation_at: at }))
                      }}
                      onDisableToggled={(flag) => {
                        setForm((prev) => ({ ...prev, is_disabled: flag }))
                        setRestaurant((prev) => ({ ...prev, is_disabled: flag }))
                      }}
                    />
                  )}
                  {activeTab === 'seo' && (
                    <SeoTab form={form} onChange={updateField} restaurantId={restaurantId} />
                  )}
                </TabsShell>
              )}
            </div>

            {/* Toast */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  style={{
                    position: 'sticky',
                    bottom: 16,
                    alignSelf: 'center',
                    background: toast.kind === 'err' ? 'var(--color-danger, #C0392B)' : 'var(--color-ink, #22181C)',
                    color: '#fff',
                    padding: '10px 16px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 700,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                    fontFamily: 'var(--font-sans)',
                    zIndex: 4,
                  }}
                >
                  {toast.text}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(drawer, document.body)
}

function LoadingDrawerBody() {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 13 }}>
      <div
        style={{
          width: 28,
          height: 28,
          border: '3px solid var(--color-corallo, #E8453C)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'drawer-spin 0.8s linear infinite',
          margin: '0 auto 12px',
        }}
      />
      Carico i dati…
      <style>{`@keyframes drawer-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Form-state ↔ DB mapping                                            */
/* ------------------------------------------------------------------ */

function toFormState(r) {
  return {
    id: r.id,
    name: r.name || '',
    slug: r.slug || '',
    tagline: r.tagline || '',
    our_review: r.our_review || '',
    our_tip: r.our_tip || '',
    address: r.address || '',
    city: r.city || 'Torino',
    neighborhood: r.neighborhood || '',
    phone: r.phone || '',
    website: r.website || '',
    google_maps_url: r.google_maps_url || '',
    category: Array.isArray(r.category) ? r.category : [],
    cuisine_type: r.cuisine_type || '',
    price_range: r.price_range ?? 2,
    recommended_for: Array.isArray(r.recommended_for) ? r.recommended_for : [],
    latitude: r.latitude != null ? String(r.latitude) : '',
    longitude: r.longitude != null ? String(r.longitude) : '',
    photos: Array.isArray(r.restaurant_photos)
      ? r.restaurant_photos
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((p) => ({
            url: p.photo_url || '',
            photo_url: p.photo_url || '',
            thumb_url: p.thumb_url || null,
            caption: p.caption || '',
            sort_order: p.sort_order ?? 0,
          }))
      : [],
    is_published: r.is_published !== false,
    is_disabled: r.is_disabled === true,
    verify_pin: r.verify_pin || '',
    partner_email: r.partner_email || '',
    last_pin_rotation_at: r.last_pin_rotation_at || null,
    // Google Places (orari automatici)
    place_id: r.place_id || '',
    place_id_confidence: r.place_id_confidence ?? null,
    place_id_verified_at: r.place_id_verified_at || null,
    hours_cache_updated_at: r.hours_cache_updated_at || null,
    // SEO
    seo_title: r.seo_title || '',
    seo_description: r.seo_description || '',
    og_title: r.og_title || '',
    og_description: r.og_description || '',
    og_image: r.og_image || '',
    noindex: r.noindex === true,
  }
}

function toDbPayload(form, alsoPublish) {
  const payload = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    tagline: form.tagline || null,
    our_review: form.our_review || null,
    our_tip: form.our_tip || null,
    address: form.address || null,
    city: form.city || 'Torino',
    neighborhood: form.neighborhood || null,
    phone: form.phone || null,
    website: form.website || null,
    google_maps_url: form.google_maps_url || null,
    category: form.category,
    cuisine_type: form.cuisine_type || (form.category?.[0] ?? null),
    price_range: form.price_range ?? 2,
    recommended_for: form.recommended_for,
    latitude: form.latitude !== '' && form.latitude != null ? parseFloat(form.latitude) || null : null,
    longitude: form.longitude !== '' && form.longitude != null ? parseFloat(form.longitude) || null : null,
    partner_email: form.partner_email || null,
    place_id: form.place_id || null,
    place_id_confidence: form.place_id_confidence,
    place_id_verified_at: form.place_id_verified_at,
    seo_title: form.seo_title || null,
    seo_description: form.seo_description || null,
    og_title: form.og_title || null,
    og_description: form.og_description || null,
    og_image: form.og_image || null,
    noindex: form.noindex === true,
    updated_at: new Date().toISOString(),
  }
  if (alsoPublish === true) payload.is_published = true
  else payload.is_published = form.is_published
  return payload
}
