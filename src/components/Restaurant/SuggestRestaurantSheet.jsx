import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

const ACCEPTED_PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX_PHOTO_BYTES = 8 * 1024 * 1024 // 8 MB
const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

function StepDots({ current, total = 3 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 18px', justifyContent: 'center' }}>
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <span
            key={idx}
            style={{
              width: active ? 22 : 8,
              height: 8,
              borderRadius: 999,
              background: done || active ? 'var(--color-corallo)' : 'var(--color-ink-15)',
              transition: 'width .2s, background .2s',
            }}
          />
        )
      })}
    </div>
  )
}

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
    if (!ACCEPTED_PHOTO_MIME.has(file.type)) {
      setError('Formato non supportato. Carica una foto JPG, PNG, WebP o HEIC.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('La foto è troppo grande. Massimo 8 MB.')
      e.target.value = ''
      return
    }
    setError('')
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      let photoUrl = null
      if (photo && !isAnon) {
        // Re-validate at submit time (defense-in-depth: handleFileChange may
        // have been bypassed by a malicious client). Derive extension from
        // MIME type, never from filename — prevents `.exe` renamed to `.jpg`.
        if (!ACCEPTED_PHOTO_MIME.has(photo.type) || photo.size > MAX_PHOTO_BYTES) {
          throw new Error('Foto non valida (tipo o dimensione)')
        }
        const ext = EXT_BY_MIME[photo.type] || 'jpg'
        const path = `suggestions/${userId}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('suggestions')
          .upload(path, photo, { contentType: photo.type, upsert: false })
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

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, touchAction: 'none' }}>
      <style>{`
        @media (min-width: 768px) {
          .v4-sheet-container {
            inset: 0 !important;
            display: grid !important;
            place-items: center !important;
            padding: 24px !important;
          }
          .v4-sheet {
            position: relative !important;
            bottom: auto !important;
            left: auto !important;
            right: auto !important;
            width: 100% !important;
            max-width: 520px !important;
            max-height: calc(100vh - 48px) !important;
            border-radius: 24px !important;
            box-shadow: 0 24px 60px rgba(34,24,28,.28) !important;
          }
          .v4-sheet-handle { display: none !important; }
        }
        .v4-input-wrap:focus-within {
          border-color: var(--color-ink-15) !important;
          background: #fff !important;
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(34,24,28,.45)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', touchAction: 'none' }}
      />

      <div className="v4-sheet-container" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <motion.div
          className="v4-sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'tween', duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'var(--color-page)',
            borderRadius: '28px 28px 0 0',
            maxHeight: 'calc(100% - 48px)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
            pointerEvents: 'auto',
            boxShadow: '0 -8px 24px rgba(34,24,28,.10)',
          }}
        >
          <div className="v4-sheet-handle" style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0', flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-ink-15)' }} />
          </div>

          <button
            onClick={onClose}
            aria-label="Chiudi"
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--color-ink-05)', border: 'none',
              cursor: 'pointer',
              display: 'grid', placeItems: 'center', zIndex: 2,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <div style={{ padding: '6px 22px 32px' }}>
            <StepDots current={success ? 4 : step} />

            {success ? (
              <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                  style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-green-a), var(--color-green-b))',
                    display: 'grid', placeItems: 'center',
                    margin: '4px auto 18px',
                    boxShadow: '0 8px 24px rgba(74,222,128,.30)',
                  }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </motion.div>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 26,
                  letterSpacing: '-0.025em', lineHeight: 1.1, color: 'var(--color-ink)',
                  marginBottom: 8,
                }}>
                  Grazie!
                </div>
                <p style={{
                  fontSize: 13.5, color: 'var(--color-ink-70)', lineHeight: 1.55,
                  margin: '0 auto 14px', maxWidth: 320,
                }}>
                  {(isAnon ? email.trim() : userEmail)
                    ? 'Ti ho mandato un riepilogo per email. Ci passo al più presto.'
                    : 'Bi valuterà il tuo consiglio e magari il prossimo posto in guida sarà il tuo!'}
                </p>
                <div style={{
                  fontFamily: 'var(--font-editorial, "Caveat", cursive)',
                  fontSize: 22, color: 'var(--color-corallo)',
                  marginBottom: 22,
                }}>
                  ti rispondo io ✦
                </div>
                <button
                  onClick={onClose}
                  style={{
                    width: '100%',
                    background: 'var(--color-ink)', color: '#fff',
                    border: 0, borderRadius: 999,
                    padding: 15, fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em',
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  Chiudi
                </button>
              </div>
            ) : step === 1 ? (
              <div>
                <Eyebrow>Step 1 di 3</Eyebrow>
                <Title>Consiglia un posto</Title>
                <Subtitle>Dimmi dove dovrebbe andare Bi.</Subtitle>

                <InputRow>
                  <SearchIcon />
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome del locale" style={fieldStyle} />
                </InputRow>

                <InputRow>
                  <PinIcon />
                  <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Dove si trova?" style={fieldStyle} />
                </InputRow>

                <Divider>oppure</Divider>

                <InputRow>
                  <LinkIcon />
                  <input value={mapsUrl} onChange={e => setMapsUrl(e.target.value)} placeholder="Link Google Maps" style={fieldStyle} />
                </InputRow>

                {isAnon && (
                  <InputRow style={{ marginTop: 14 }} highlight={email && !emailValid}>
                    <MailIcon />
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="La tua email (per risposta)" style={fieldStyle}
                      autoComplete="email"
                    />
                  </InputRow>
                )}

                <button
                  disabled={!nameValid}
                  onClick={() => setStep(2)}
                  style={{
                    width: '100%', marginTop: 22,
                    background: nameValid ? 'var(--color-corallo)' : 'var(--color-ink-15)',
                    color: '#fff',
                    borderRadius: 999, padding: 15, fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em',
                    border: 'none', cursor: nameValid ? 'pointer' : 'default',
                    fontFamily: 'var(--font-sans)',
                    boxShadow: nameValid ? '0 6px 14px rgba(232,69,60,.30)' : 'none',
                    transition: 'background .15s, box-shadow .15s',
                  }}
                >
                  Avanti →
                </button>
              </div>
            ) : step === 2 ? (
              <div>
                <Eyebrow>Step 2 di 3</Eyebrow>
                <Title>Cosa lo rende speciale?</Title>
                <Subtitle>Tagga ciò che ti ha colpito. Facoltativo.</Subtitle>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                  {TAGS.map(tag => {
                    const active = selectedTags.includes(tag.label)
                    return (
                      <button
                        key={tag.label}
                        onClick={() => toggleTag(tag.label)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 14px', borderRadius: 999,
                          background: active ? 'var(--color-corallo)' : '#fff',
                          color: active ? '#fff' : 'var(--color-ink)',
                          border: active ? '1px solid var(--color-corallo)' : '1px solid var(--color-ink-05)',
                          fontSize: 13, fontWeight: active ? 700 : 600,
                          letterSpacing: '-0.005em',
                          cursor: 'pointer', transition: 'all .15s',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{tag.emoji}</span> {tag.label}
                      </button>
                    )
                  })}
                </div>

                <Label>Una nota tua</Label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Cosa ordinare, quando andare, perché torneresti…"
                  style={{
                    width: '100%', minHeight: 92,
                    background: '#fff', border: '1px solid var(--color-ink-05)',
                    borderRadius: 14, padding: '12px 14px',
                    fontSize: 14, color: 'var(--color-ink)',
                    outline: 'none', resize: 'vertical',
                    fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
                    transition: 'border-color .15s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-ink-15)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-ink-05)' }}
                />

                <ButtonRow>
                  <GhostButton onClick={() => setStep(1)}>Indietro</GhostButton>
                  <PrimaryButton onClick={() => setStep(3)}>Avanti →</PrimaryButton>
                </ButtonRow>
              </div>
            ) : (
              <div>
                <Eyebrow>Step 3 di 3</Eyebrow>
                <Title>Una foto?</Title>
                <Subtitle>Facoltativo, ma aiuta a far venire fame.</Subtitle>

                {isAnon ? (
                  <div style={{
                    background: 'var(--color-ink-05)', borderRadius: 14,
                    padding: '14px 16px', marginBottom: 18, textAlign: 'center',
                  }}>
                    <p style={{ fontSize: 12.5, color: 'var(--color-ink-70)', margin: 0, lineHeight: 1.5 }}>
                      La foto è disponibile solo per gli utenti registrati.<br />
                      Il tuo consiglio resta comunque prezioso.
                    </p>
                  </div>
                ) : (
                  <>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    {photoPreview ? (
                      <div style={{ position: 'relative', marginBottom: 18 }}>
                        <img src={photoPreview} alt="" style={{
                          width: '100%', height: 180, objectFit: 'cover', borderRadius: 16,
                        }} />
                        <button onClick={() => { setPhoto(null); setPhotoPreview(null) }} style={{
                          position: 'absolute', top: 10, right: 10,
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'rgba(34,24,28,.7)', border: 'none', cursor: 'pointer',
                          display: 'grid', placeItems: 'center',
                          backdropFilter: 'blur(8px)',
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => fileRef.current?.click()} style={{
                        width: '100%', height: 152,
                        border: '2px dashed var(--color-ink-15)', borderRadius: 16,
                        background: '#fff', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                        marginBottom: 18,
                        fontFamily: 'var(--font-sans)',
                        transition: 'border-color .15s, background .15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-corallo)'; e.currentTarget.style.background = 'var(--color-corallo-wash)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-ink-15)'; e.currentTarget.style.background = '#fff' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-70)" strokeWidth="1.6" strokeLinecap="round">
                          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span style={{ fontSize: 13, color: 'var(--color-ink-70)', fontWeight: 600 }}>Tocca per aggiungere</span>
                      </button>
                    )}
                  </>
                )}

                {error && (
                  <p style={{
                    fontSize: 12.5, color: 'var(--color-corallo-ink)', fontWeight: 600,
                    textAlign: 'center', padding: '10px 14px',
                    background: 'var(--color-corallo-wash)',
                    border: '1px solid rgba(232,69,60,.18)',
                    borderRadius: 12, marginBottom: 12,
                  }}>{error}</p>
                )}

                <ButtonRow>
                  <GhostButton onClick={() => setStep(2)}>Indietro</GhostButton>
                  <PrimaryButton onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Invio…' : 'Invia a Bi →'}
                  </PrimaryButton>
                </ButtonRow>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>,
    document.body
  )
}

/* ─── UI helpers ─── */
const fieldStyle = {
  flex: 1, border: 'none', background: 'none', outline: 'none',
  fontSize: 14, color: 'var(--color-ink)',
  fontFamily: 'var(--font-sans)',
}

function InputRow({ children, style, highlight }) {
  return (
    <div className="v4-input-wrap" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--color-page)',
      border: `1px solid ${highlight ? 'var(--color-corallo)' : 'var(--color-ink-05)'}`,
      borderRadius: 14, padding: '13px 14px',
      marginBottom: 10,
      transition: 'border-color .15s, background .15s',
      ...style,
    }}>
      {children}
    </div>
  )
}

function Divider({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 12px' }}>
      <span style={{ flex: 1, height: 1, background: 'var(--color-ink-05)' }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ink-55)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--color-ink-05)' }} />
    </div>
  )
}

function Eyebrow({ children }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em',
      textTransform: 'uppercase', color: 'var(--color-corallo-ink)',
      marginBottom: 8,
    }}>{children}</div>
  )
}
function Title({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--font-sans)', fontWeight: 900,
      fontSize: 24, letterSpacing: '-0.025em', lineHeight: 1.1,
      color: 'var(--color-ink)', marginBottom: 6,
    }}>{children}</div>
  )
}
function Subtitle({ children }) {
  return (
    <p style={{
      fontSize: 13, color: 'var(--color-ink-70)',
      margin: '0 0 18px', lineHeight: 1.45,
    }}>{children}</p>
  )
}
function Label({ children }) {
  return (
    <div style={{
      fontSize: 11.5, fontWeight: 700,
      color: 'var(--color-ink)', marginBottom: 6,
      letterSpacing: '-0.005em',
    }}>{children}</div>
  )
}
function ButtonRow({ children }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>{children}</div>
  )
}
function GhostButton({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, background: '#fff', color: 'var(--color-ink)',
      borderRadius: 999, padding: 14, fontSize: 13.5, fontWeight: 700,
      border: '1px solid var(--color-ink-05)', cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
    }}>{children}</button>
  )
}
function PrimaryButton({ onClick, children, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 2, background: disabled ? 'var(--color-ink-15)' : 'var(--color-corallo)',
      color: '#fff',
      borderRadius: 999, padding: 14, fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em',
      border: 'none', cursor: disabled ? 'default' : 'pointer',
      fontFamily: 'var(--font-sans)',
      boxShadow: disabled ? 'none' : '0 6px 14px rgba(232,69,60,.30)',
      transition: 'background .15s, box-shadow .15s',
    }}>{children}</button>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-70)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  )
}
function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-70)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}
function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-70)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  )
}
function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-70)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}
