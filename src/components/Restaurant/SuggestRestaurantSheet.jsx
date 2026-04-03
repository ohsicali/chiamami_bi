import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useDrag } from '@use-gesture/react'
import { supabase } from '../../lib/supabase'

const TAGS = [
  { emoji: '🍝', label: 'Cibo pazzesco' },
  { emoji: '🍷', label: 'Vini top' },
  { emoji: '✨', label: 'Atmosfera' },
  { emoji: '💰', label: 'Prezzo giusto' },
  { emoji: '👨‍🍳', label: 'Servizio' },
  { emoji: '📸', label: 'Instagrammabile' },
]

function Stepper({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '4px 0 12px' }}>
      {[1, 2, 3].map((step, i) => {
        const done = step < current
        const active = step === current
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: done || active ? 'var(--color-accent)' : 'var(--color-bordo)',
              color: done || active ? '#fff' : 'var(--color-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>
              {done ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              ) : step}
            </div>
            {i < 2 && (
              <div style={{
                width: 40, height: 2,
                background: done ? 'var(--color-accent)' : 'var(--color-bordo)',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function SuggestRestaurantSheet({ userId, onClose }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [mapsUrl, setMapsUrl] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const scrollRef = useRef(null)
  const [dragY, setDragY] = useState(0)

  // Block body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Swipe down to close
  const bind = useDrag(({ movement: [, my], velocity: [, vy], direction: [, dy], cancel, last }) => {
    // Only allow downward drag when scroll is at top
    if (scrollRef.current && scrollRef.current.scrollTop > 0) {
      cancel()
      return
    }
    if (my < 0) { setDragY(0); return }
    setDragY(my)
    if (last) {
      if (my > 120 || (vy > 0.5 && dy > 0)) {
        onClose()
      } else {
        setDragY(0)
      }
    }
  }, { filterTaps: true, axis: 'y' })

  const toggleTag = (label) => {
    setSelectedTags(prev => prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label])
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      let photoUrl = null
      if (photo) {
        const ext = photo.name.split('.').pop()
        const path = `suggestions/${userId}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('suggestions').upload(path, photo)
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('suggestions').getPublicUrl(path)
          photoUrl = publicUrl
        }
      }

      const { error: insertErr } = await supabase.from('restaurant_suggestions').insert({
        user_id: userId,
        restaurant_name: name.trim(),
        address: address.trim() || null,
        google_maps_url: mapsUrl.trim() || null,
        tags: selectedTags,
        description: description.trim() || null,
        photo_url: photoUrl,
      })

      if (insertErr) throw insertErr
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Errore durante l\'invio')
    }
    setSubmitting(false)
  }

  const nameValid = name.trim().length >= 2

  const inputStyle = {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 12,
  }
  const fieldStyle = {
    flex: 1, border: 'none', background: 'none', outline: 'none',
    fontSize: 14, color: 'var(--color-primary)',
  }
  const btnSecondary = {
    flex: 1, background: '#fff', color: 'var(--color-primary)',
    borderRadius: 16, padding: 16, fontSize: 14, fontWeight: 600,
    border: '1px solid var(--color-bordo)', cursor: 'pointer',
  }
  const btnPrimary = {
    flex: 2, background: 'var(--color-accent)', color: '#fff',
    borderRadius: 16, padding: 16, fontSize: 14, fontWeight: 600,
    border: 'none', cursor: 'pointer',
  }

  // Which buttons to show in the sticky footer
  const renderFooter = () => {
    if (success) {
      return (
        <button onClick={onClose} style={{ ...btnSecondary, flex: 'none', width: '100%' }}>
          Chiudi
        </button>
      )
    }
    if (step === 1) {
      return (
        <button
          disabled={!nameValid}
          onClick={() => setStep(2)}
          style={{
            width: '100%', background: nameValid ? 'var(--color-accent)' : 'var(--color-bordo)',
            color: nameValid ? '#fff' : 'var(--color-secondary)',
            borderRadius: 16, padding: 16, fontSize: 14, fontWeight: 600,
            border: 'none', cursor: nameValid ? 'pointer' : 'default',
          }}
        >
          Avanti
        </button>
      )
    }
    if (step === 2) {
      return (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setStep(1)} style={btnSecondary}>Indietro</button>
          <button onClick={() => setStep(3)} style={btnPrimary}>Avanti</button>
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setStep(2)} style={btnSecondary}>Salta</button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ ...btnPrimary, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? 'Invio...' : 'Invia a Bi'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
      />

      {/* Sheet */}
      <motion.div
        {...bind()}
        initial={{ y: '100%' }}
        animate={{ y: dragY }}
        exit={{ y: '100%' }}
        transition={dragY > 0 ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#FAF7F2', borderRadius: '24px 24px 0 0',
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          touchAction: 'none',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-bordo)' }} />
        </div>

        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 16,
          width: 30, height: 30, borderRadius: '50%', background: '#fff',
          border: '1px solid var(--color-bordo)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          style={{
            flex: 1, overflowY: 'auto', padding: '0 22px',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
        >
          <Stepper current={success ? 4 : step} />

          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: 'var(--color-success)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div style={{ fontFamily: "'TAN Songbird', serif", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                Grazie!
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-secondary)', lineHeight: 1.5, margin: '0 auto 20px', maxWidth: 280 }}>
                Bi valuterà il tuo consiglio e magari il prossimo ristorante della guida sarà il tuo!
              </p>
            </div>
          ) : step === 1 ? (
            <div>
              <div style={{ fontFamily: "'TAN Songbird', serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                Consiglia un ristorante
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 20, marginTop: 0 }}>
                Dicci dove dovrebbe andare Bi!
              </p>

              <div style={inputStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome ristorante" style={fieldStyle} />
              </div>

              <div style={inputStyle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Dove si trova?" style={fieldStyle} />
              </div>

              <p style={{ fontSize: 11, color: 'var(--color-secondary)', textAlign: 'center', marginBottom: 16 }}>
                Oppure incolla il link di Google Maps
              </p>

              <div style={{ ...inputStyle, marginBottom: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
                <input value={mapsUrl} onChange={e => setMapsUrl(e.target.value)} placeholder="Link Google Maps" style={fieldStyle} />
              </div>
            </div>
          ) : step === 2 ? (
            <div>
              <div style={{ fontFamily: "'TAN Songbird', serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                Perché ti piace?
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 20, marginTop: 0 }}>
                Step 2 di 3
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {TAGS.map(tag => {
                  const active = selectedTags.includes(tag.label)
                  return (
                    <button
                      key={tag.label}
                      onClick={() => toggleTag(tag.label)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 20,
                        background: active ? 'var(--color-accent)' : '#fff',
                        color: active ? '#fff' : 'var(--color-primary)',
                        border: active ? 'none' : '1px solid var(--color-bordo)',
                        fontSize: 13, fontWeight: active ? 500 : 400,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {tag.emoji} {tag.label}
                    </button>
                  )
                })}
              </div>

              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Cosa ci consigli di ordinare, quando andare..."
                style={{
                  width: '100%', minHeight: 80, background: '#fff',
                  borderRadius: 14, padding: '14px 16px', border: 'none',
                  fontSize: 14, color: 'var(--color-primary)',
                  outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ) : (
            <div>
              <div style={{ fontFamily: "'TAN Songbird', serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                Una foto?
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 20, marginTop: 0 }}>
                Facoltativo
              </p>

              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              {photoPreview ? (
                <div style={{ position: 'relative', marginBottom: 20 }}>
                  <img src={photoPreview} alt="" style={{
                    width: '100%', height: 180, objectFit: 'cover', borderRadius: 16,
                  }} />
                  <button onClick={() => { setPhoto(null); setPhotoPreview(null) }} style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.5)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} style={{
                  width: '100%', height: 140,
                  border: '2px dashed var(--color-bordo)', borderRadius: 16,
                  background: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginBottom: 20,
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span style={{ fontSize: 13, color: 'var(--color-secondary)' }}>Tocca per aggiungere</span>
                </button>
              )}

              {error && (
                <p style={{ fontSize: 12, color: 'var(--color-accent)', marginBottom: 12, textAlign: 'center' }}>{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer with buttons — always visible */}
        <div style={{
          flexShrink: 0, padding: '16px 22px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
          background: '#FAF7F2',
          borderTop: '1px solid var(--color-bordo)',
        }}>
          {renderFooter()}
        </div>
      </motion.div>
    </div>
  )
}
