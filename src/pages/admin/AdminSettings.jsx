import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */
const cardStyle = {
  background: '#fff',
  border: '1px solid #eee',
  borderRadius: 12,
  padding: 18,
}

const inputStyle = {
  flex: '1 1 200px',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #e5e5e5',
  background: '#fff',
  fontSize: 13,
  fontFamily: 'inherit',
  color: '#1a1a1f',
  outline: 'none',
}

const btnPrimary = {
  padding: '10px 18px',
  borderRadius: 10,
  border: 'none',
  background: '#E8453C',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const btnDark = {
  ...btnPrimary,
  background: '#1a1a1f',
}

const sectionLabel = {
  fontSize: 10,
  color: '#999',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 1.2,
  marginBottom: 12,
}

/* ------------------------------------------------------------------ */
/*  Tool: Regenerate thumbnails for existing photos                    */
/* ------------------------------------------------------------------ */
function ThumbnailTool() {
  const [progress, setProgress] = useState(null)

  const run = useCallback(async () => {
    if (!isSupabaseConfigured()) return

    const { data: photos, error } = await supabase
      .from('restaurant_photos')
      .select('id, photo_url, restaurant_id')
      .is('thumb_url', null)
      .not('photo_url', 'is', null)

    if (error || !photos?.length) {
      setProgress({ done: 0, total: 0, current: 'Nessuna foto da convertire' })
      setTimeout(() => setProgress(null), 3000)
      return
    }

    setProgress({ done: 0, total: photos.length, current: 'Avvio...' })

    const createThumb = (url) =>
      new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const scale = Math.min(1, 400 / img.width)
          const w = Math.round(img.width * scale)
          const h = Math.round(img.height * scale)
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('blob failed'))),
            'image/webp',
            0.70
          )
        }
        img.onerror = () => reject(new Error('load failed'))
        img.src = url
      })

    let done = 0
    for (const photo of photos) {
      try {
        setProgress({ done, total: photos.length, current: `Foto ${done + 1}/${photos.length}` })

        const thumbBlob = await createThumb(photo.photo_url)
        const thumbPath = `restaurants/${photo.restaurant_id}/${photo.id}-thumb.webp`
        const { error: upErr } = await supabase.storage
          .from('photos')
          .upload(thumbPath, thumbBlob, { contentType: 'image/webp', cacheControl: '31536000', upsert: true })

        if (!upErr) {
          const { data: urlData } = supabase.storage.from('photos').getPublicUrl(thumbPath)
          await supabase
            .from('restaurant_photos')
            .update({ thumb_url: urlData.publicUrl })
            .eq('id', photo.id)
        }
      } catch (err) {
        console.warn('Thumb generation failed for', photo.id, err)
      }
      done++
    }

    setProgress({ done, total: photos.length, current: `Completato! ${done} foto convertite` })
    setTimeout(() => setProgress(null), 5000)
  }, [])

  const running = progress !== null && progress.total > 0 && progress.done < progress.total

  return (
    <div style={{ ...cardStyle, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: '#eef2ff', color: '#4338ca',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1f' }}>Rigenera thumbnail</div>
        <p style={{ fontSize: 12, color: '#666', margin: '4px 0 12px', lineHeight: 1.5 }}>
          Genera thumbnail (400px WebP) per tutte le foto che non ne hanno ancora una.
          Utile dopo il primo setup o se cambi le impostazioni di compressione.
        </p>

        {progress && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666', marginBottom: 4 }}>
              <span>{progress.current}</span>
              {progress.total > 0 && <span>{progress.done}/{progress.total}</span>}
            </div>
            {progress.total > 0 && (
              <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round((progress.done / progress.total) * 100)}%`,
                  background: '#4338ca',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </div>
            )}
          </div>
        )}

        <button
          onClick={run}
          disabled={running}
          style={{
            ...btnDark,
            background: '#4338ca',
            opacity: running ? 0.5 : 1,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? 'In corso...' : 'Avvia'}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Account: Change email                                              */
/* ------------------------------------------------------------------ */
function ChangeEmail({ currentEmail, user }) {
  const isGoogleUser = user?.app_metadata?.provider === 'google' || user?.app_metadata?.providers?.includes('google')
  const [step, setStep] = useState('form')
  const [newEmail, setNewEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleGoogleEmailChange = async (e) => {
    e.preventDefault()
    if (!newEmail.trim()) return
    setLoading(true)
    setStatus(null)
    const { error } = await supabase.from('profiles').update({ email: newEmail.trim() }).eq('id', user.id)
    setLoading(false)
    if (error) {
      setStatus({ type: 'error', msg: error.message })
    } else {
      setStep('done')
      setStatus({ type: 'success', msg: 'Email di contatto aggiornata!' })
    }
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!newEmail.trim() || newEmail === currentEmail) return
    setLoading(true)
    setStatus(null)
    const { error } = await supabase.auth.signInWithOtp({ email: currentEmail })
    setLoading(false)
    if (error) {
      setStatus({ type: 'error', msg: error.message })
    } else {
      setStep('otp')
      setStatus({ type: 'success', msg: `Codice di verifica inviato a ${currentEmail}` })
    }
  }

  const handleVerifyAndUpdate = async (e) => {
    e.preventDefault()
    if (!otpCode.trim()) return
    setLoading(true)
    setStatus(null)
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email: currentEmail,
      token: otpCode.trim(),
      type: 'email',
    })
    if (verifyErr) {
      setLoading(false)
      setStatus({ type: 'error', msg: 'Codice non valido o scaduto' })
      return
    }
    const { error: updateErr } = await supabase.auth.updateUser({ email: newEmail })
    setLoading(false)
    if (updateErr) {
      setStatus({ type: 'error', msg: updateErr.message })
    } else {
      setStep('done')
      setStatus({ type: 'success', msg: 'Email aggiornata con successo!' })
    }
  }

  const handleReset = () => {
    setStep('form')
    setNewEmail('')
    setOtpCode('')
    setStatus(null)
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1f', marginBottom: 4 }}>
        {isGoogleUser ? 'Email di contatto' : 'Cambia email'}
      </div>
      {isGoogleUser ? (
        <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px' }}>
          Accesso con Google ({currentEmail}). Puoi impostare un'email di contatto diversa.
        </p>
      ) : (
        <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px' }}>
          Email attuale: <span style={{ fontWeight: 600, color: '#1a1a1f' }}>{currentEmail}</span>
        </p>
      )}

      {step === 'form' && isGoogleUser && (
        <form onSubmit={handleGoogleEmailChange} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email di contatto"
            required
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading || !newEmail.trim()}
            style={{ ...btnPrimary, opacity: loading || !newEmail.trim() ? 0.5 : 1, cursor: loading || !newEmail.trim() ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Salvataggio...' : 'Salva'}
          </button>
        </form>
      )}

      {step === 'form' && !isGoogleUser && (
        <form onSubmit={handleSendOtp} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Nuova email"
            required
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading || !newEmail.trim() || newEmail === currentEmail}
            style={{ ...btnPrimary, opacity: loading || !newEmail.trim() || newEmail === currentEmail ? 0.5 : 1, cursor: loading || !newEmail.trim() || newEmail === currentEmail ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Invio...' : 'Cambia email'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <div>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
            Inserisci il codice ricevuto su <strong>{currentEmail}</strong>
          </p>
          <form onSubmit={handleVerifyAndUpdate} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Codice di verifica"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              style={{ ...inputStyle, textAlign: 'center', letterSpacing: 4, fontFamily: 'monospace' }}
            />
            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              style={{ ...btnPrimary, opacity: loading || otpCode.length < 6 ? 0.5 : 1, cursor: loading || otpCode.length < 6 ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Verifica...' : 'Conferma'}
            </button>
          </form>
          <button
            type="button"
            onClick={handleReset}
            style={{ background: 'none', border: 'none', fontSize: 12, color: '#999', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Annulla
          </button>
        </div>
      )}

      {step === 'done' && (
        <button
          onClick={handleReset}
          style={{ background: 'none', border: 'none', fontSize: 12, color: '#E8453C', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
        >
          Cambia di nuovo
        </button>
      )}

      {status && (
        <p style={{ fontSize: 12, color: status.type === 'error' ? '#dc2626' : '#059669', marginTop: 10 }}>
          {status.msg}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Account: Change password                                           */
/* ------------------------------------------------------------------ */
function ChangePassword({ userEmail }) {
  const [currentPwd, setCurrentPwd] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!currentPwd) return
    setVerifying(true)
    setStatus(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPwd,
    })
    setVerifying(false)
    if (error) {
      setStatus({ type: 'error', msg: 'Password attuale non corretta' })
    } else {
      setUnlocked(true)
      setStatus(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      setStatus({ type: 'error', msg: 'La password deve avere almeno 6 caratteri' })
      return
    }
    if (password !== confirm) {
      setStatus({ type: 'error', msg: 'Le password non corrispondono' })
      return
    }
    setSaving(true)
    setStatus(null)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      setStatus({ type: 'error', msg: error.message })
    } else {
      setStatus({ type: 'success', msg: 'Password aggiornata!' })
      setPassword('')
      setConfirm('')
      setCurrentPwd('')
      setUnlocked(false)
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1f', marginBottom: 12 }}>Cambia password</div>

      {!unlocked ? (
        <div>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
            Inserisci la password attuale per procedere
          </p>
          <form onSubmit={handleVerify} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              placeholder="Password attuale"
              required
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={verifying || !currentPwd}
              style={{ ...btnDark, opacity: verifying || !currentPwd ? 0.5 : 1, cursor: verifying || !currentPwd ? 'not-allowed' : 'pointer' }}
            >
              {verifying ? 'Verifica...' : 'Verifica'}
            </button>
          </form>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nuova password (min. 6 caratteri)"
            required
            minLength={6}
            style={{ ...inputStyle, flex: 'none', width: '100%' }}
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Conferma nuova password"
            required
            style={{ ...inputStyle, flex: 'none', width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              disabled={saving || !password || !confirm}
              style={{ ...btnPrimary, opacity: saving || !password || !confirm ? 0.5 : 1, cursor: saving || !password || !confirm ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Salvataggio...' : 'Aggiorna password'}
            </button>
            <button
              type="button"
              onClick={() => { setUnlocked(false); setPassword(''); setConfirm(''); setCurrentPwd(''); setStatus(null) }}
              style={{
                padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e5e5',
                background: '#fff', color: '#666', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {status && (
        <p style={{ fontSize: 12, color: status.type === 'error' ? '#dc2626' : '#059669', marginTop: 10 }}>
          {status.msg}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Admin list — view, add, remove admins                              */
/* ------------------------------------------------------------------ */
function AdminList({ currentUserId }) {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [removeId, setRemoveId] = useState(null)

  const fetchAdmins = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return }
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, is_admin')
      .eq('is_admin', true)
      .order('full_name')
    setAdmins(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAdmins() }, [fetchAdmins])

  const handleAdd = async (e) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    setActionLoading(true)
    setStatus(null)

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', trimmed)
      .limit(1)

    if (error || !profiles?.length) {
      setActionLoading(false)
      setStatus({ type: 'error', msg: 'Nessun utente trovato con questa email. L\'utente deve prima registrarsi.' })
      return
    }

    const profile = profiles[0]
    if (admins.some(a => a.id === profile.id)) {
      setActionLoading(false)
      setStatus({ type: 'error', msg: 'Questo utente è già admin.' })
      return
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', profile.id)

    setActionLoading(false)
    if (updateErr) {
      setStatus({ type: 'error', msg: updateErr.message })
    } else {
      setEmail('')
      setStatus({ type: 'success', msg: `${profile.full_name || profile.email} è ora admin!` })
      fetchAdmins()
    }
  }

  const handleRemove = async (id) => {
    if (id === currentUserId) {
      setStatus({ type: 'error', msg: 'Non puoi rimuovere te stesso come admin.' })
      setRemoveId(null)
      return
    }
    setActionLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: false })
      .eq('id', id)
    setActionLoading(false)
    setRemoveId(null)
    if (!error) fetchAdmins()
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1f', marginBottom: 14 }}>Amministratori</div>

      {loading ? (
        <div style={{ height: 40, background: '#f3f3f3', borderRadius: 10 }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {admins.map((admin) => (
            <div key={admin.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 10, background: '#fafafa',
            }}>
              {admin.avatar_url ? (
                <img
                  src={admin.avatar_url} alt="" loading="lazy" decoding="async"
                  style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(232,69,60,0.1)', color: '#E8453C',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {(admin.full_name || admin.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {admin.full_name || 'Admin'}
                </div>
                {admin.email && (
                  <div style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                    {admin.email}
                  </div>
                )}
              </div>

              {admin.id === currentUserId ? (
                <span style={{
                  padding: '3px 9px', borderRadius: 10,
                  background: '#ecfdf5', color: '#059669',
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  Tu
                </span>
              ) : removeId === admin.id ? (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleRemove(admin.id)}
                    disabled={actionLoading}
                    style={{
                      padding: '5px 10px', borderRadius: 8, border: 'none',
                      background: '#dc2626', color: '#fff',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      opacity: actionLoading ? 0.5 : 1,
                    }}
                  >
                    Conferma
                  </button>
                  <button
                    onClick={() => setRemoveId(null)}
                    style={{
                      padding: '5px 10px', borderRadius: 8, border: '1px solid #e5e5e5',
                      background: '#fff', color: '#666',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setRemoveId(admin.id)}
                  title="Rimuovi admin"
                  style={{
                    padding: 6, borderRadius: 8, border: 'none',
                    background: 'transparent', color: '#999', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                  }}
                >
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {admins.length === 0 && (
            <p style={{ fontSize: 12, color: '#999' }}>Nessun admin trovato</p>
          )}
        </div>
      )}

      {/* Add admin form */}
      <div style={{ borderTop: '1px solid #f3f3f3', paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>Aggiungi amministratore</div>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email dell'utente"
            required
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={actionLoading || !email.trim()}
            style={{ ...btnPrimary, opacity: actionLoading || !email.trim() ? 0.5 : 1, cursor: actionLoading || !email.trim() ? 'not-allowed' : 'pointer' }}
          >
            {actionLoading ? '...' : 'Aggiungi'}
          </button>
        </form>
        {status && (
          <p style={{ fontSize: 12, color: status.type === 'error' ? '#dc2626' : '#059669', marginTop: 10 }}>
            {status.msg}
          </p>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function AdminSettings() {
  const { user, isAdmin, loading } = useAuth()

  if (loading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Impostazioni">
      <div style={{ padding: '20px 28px', fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1f', margin: 0 }}>Impostazioni</h1>
          <p style={{ fontSize: 13, color: '#999', margin: '4px 0 0' }}>
            Strumenti di manutenzione e configurazione
          </p>
        </div>

        {/* Account section — 2 cols on desktop */}
        <div style={{ marginBottom: 28 }}>
          <div style={sectionLabel}>ACCOUNT</div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}
            className="md:!grid-cols-2"
          >
            <ChangeEmail currentEmail={user.email} user={user} />
            <ChangePassword userEmail={user.email} />
          </div>
        </div>

        {/* Team + Tools — 2 cols on desktop */}
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 28 }}
          className="md:!grid-cols-2 md:!gap-x-16"
        >
          {/* Team section */}
          <div>
            <div style={sectionLabel}>TEAM</div>
            <AdminList currentUserId={user.id} />
          </div>

          {/* Tools section */}
          <div>
            <div style={sectionLabel}>STRUMENTI</div>
            <ThumbnailTool />
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
