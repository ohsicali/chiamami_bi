import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '4px 0 24px' }}>
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

// userId is optional: when null the form shows an email field so anonymous
// users can submit without registering. Photo upload requires a userId.
// userEmail / userName: passed from parent for authenticated users so the
// confirmation email can be sent without exposing auth state inside this sheet.
export default function SuggestRestaurantSheet({ userId = null, userEmail = null, userName = null, onClose }) {
  const isAnon = !userId
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [mapsUrl, setMapsUrl] = useState('')
  const [email, setEmail] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  // Block ALL background scroll
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

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
      // Photo upload only for authenticated users (storage policies require userId in path)
      if (photo && !isAnon) {
        const ext = photo.name.split('.').pop()
        const path = `suggestions/${userId}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('suggestions').upload(path, photo)
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('suggestions').getPublicUrl(path)
          photoUrl = publicUrl
        }
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('restaurant_suggestions')
        .insert({
          user_id: isAnon ? null : userId,
          email: isAnon ? email.trim() : null,
          restaurant_name: name.trim(),
          address: address.trim() || null,
          google_maps_url: mapsUrl.trim() || null,
          tags: selectedTags,
          description: description.trim() || null,
          photo_url: photoUrl,
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr
      setSuccess(true)

      // Fire confirmation + internal-notify emails in parallel (non-blocking)
      const recipientEmail = isAnon ? email.trim() : userEmail
      const senderName = isAnon ? '' : (userName || '')
      if (recipientEmail) {
        Promise.allSettled([
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'confirmation',
              to: recipientEmail,
              nome_utente: senderName,
              nome_locale: name.trim(),
            }),
          }),
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'internal-notify',
              nome_locale: name.trim(),
              address: address.trim() || undefined,
              tags: selectedTags.length ? selectedTags.join(', ') : undefined,
              description: description.trim() || undefined,
              nome_utente: senderName,
              email_utente: recipientEmail,
              id: inserted?.id,
            }),
          }),
        ]).catch(() => {})
      }
    } catch (err) {
      setError(err.message || 'Errore durante l\'invio')
    }
    setSubmitting(false)
  }

  const emailValid = !isAnon || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const nameValid = (name.trim().length >= 2 || mapsUrl.trim().length >= 5) && emailValid

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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, touchAction: 'none' }}>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', touchAction: 'none' }}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: '#FAF7F2', borderRadius: '24px 24px 0 0',
          maxHeight: 'calc(100% - 60px)',
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain', touchAction: 'pan-y',
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

        <div style={{ padding: '0 22px 80px' }}>
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
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>
                Grazie!
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-secondary)', lineHeight: 1.5, margin: '0 auto 20px', maxWidth: 280 }}>
                {(isAnon ? email.trim() : userEmail)
                  ? 'Ti ho mandato un riepilogo per email. Ci passo al più presto.'
                  : 'Bi valuterà il tuo consiglio e magari il prossimo ristorante della guida sarà il tuo!'}
              </p>
              <button onClick={onClose} style={{ ...btnSecondary, flex: 'none', width: '100%' }}>Chiudi</button>
            </div>
          ) : step === 1 ? (
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>
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

              <div style={{ ...inputStyle, marginBottom: isAnon ? 12 : 24 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
                <input value={mapsUrl} onChange={e => setMapsUrl(e.target.value)} placeholder="Link Google Maps" style={fieldStyle} />
              </div>

              {/* Email field for anonymous users */}
              {isAnon && (
                <div style={{ ...inputStyle, marginBottom: 24, borderColor: email && !emailValid ? 'var(--color-accent)' : undefined }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="La tua email (per seguire il consiglio)"
                    style={fieldStyle}
                    autoComplete="email"
                  />
                </div>
              )}

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
            </div>
          ) : step === 2 ? (
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>
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

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setStep(1)} style={btnSecondary}>Indietro</button>
                <button onClick={() => setStep(3)} style={btnPrimary}>Avanti</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>
                Una foto?
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 20, marginTop: 0 }}>
                Facoltativo
              </p>

              {isAnon ? (
                <div style={{
                  background: 'var(--color-bordo)', borderRadius: 14,
                  padding: '14px 16px', marginBottom: 20, textAlign: 'center',
                }}>
                  <p style={{ fontSize: 12, color: 'var(--color-secondary)', margin: 0 }}>
                    La foto è disponibile solo per gli utenti registrati.<br />
                    Il tuo consiglio sarà comunque prezioso!
                  </p>
                </div>
              ) : (
                <>
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
                </>
              )}

              {error && (
                <p style={{ fontSize: 12, color: 'var(--color-accent)', marginBottom: 12, textAlign: 'center' }}>{error}</p>
              )}

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
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
