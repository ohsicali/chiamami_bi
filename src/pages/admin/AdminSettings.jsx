import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

/* ------------------------------------------------------------------ */
/*  Tool: Regenerate thumbnails for existing photos                    */
/* ------------------------------------------------------------------ */
function ThumbnailTool() {
  const [progress, setProgress] = useState(null) // { done, total, current } | null

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
    <div className="flex items-start gap-4 p-5 bg-card rounded-2xl border border-gray-100 shadow-sm">
      <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-primary">Rigenera thumbnail</h3>
        <p className="text-xs text-secondary mt-0.5 mb-3">
          Genera thumbnail (400px WebP) per tutte le foto che non ne hanno ancora una.
          Utile dopo il primo setup o se cambi le impostazioni di compressione.
        </p>
        {progress && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-secondary mb-1">
              <span>{progress.current}</span>
              {progress.total > 0 && <span>{progress.done}/{progress.total}</span>}
            </div>
            {progress.total > 0 && (
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
        <button
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? 'In corso...' : 'Avvia'}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Account: Change email (OTP on current email, then immediate change) */
/* ------------------------------------------------------------------ */
function ChangeEmail({ currentEmail, user }) {
  const isGoogleUser = user?.app_metadata?.provider === 'google' || user?.app_metadata?.providers?.includes('google')
  const [step, setStep] = useState('form') // 'form' | 'otp' | 'done'
  const [newEmail, setNewEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  // Google users: update only profile email (contact email)
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
    <div className="p-5 bg-card rounded-2xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-semibold text-primary mb-1">
        {isGoogleUser ? 'Email di contatto' : 'Cambia email'}
      </h3>
      {isGoogleUser ? (
        <p className="text-xs text-secondary mb-3">
          Accesso con Google ({currentEmail}). Puoi impostare un'email di contatto diversa.
        </p>
      ) : (
        <p className="text-xs text-secondary mb-3">
          Email attuale: <span className="font-medium text-primary">{currentEmail}</span>
        </p>
      )}

      {step === 'form' && isGoogleUser && (
        <form onSubmit={handleGoogleEmailChange} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email di contatto"
            required
            className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading || !newEmail.trim()}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-accent text-white hover:bg-[#e64545] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? 'Salvataggio...' : 'Salva'}
          </button>
        </form>
      )}

      {step === 'form' && !isGoogleUser && (
        <form onSubmit={handleSendOtp} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Nuova email"
            required
            className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading || !newEmail.trim() || newEmail === currentEmail}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-accent text-white hover:bg-[#e64545] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? 'Invio...' : 'Cambia email'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyAndUpdate} className="space-y-2">
          <p className="text-xs text-secondary">
            Inserisci il codice ricevuto su <strong>{currentEmail}</strong>
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Codice di verifica"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-accent text-white hover:bg-[#e64545] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? 'Verifica...' : 'Conferma'}
            </button>
          </div>
          <button type="button" onClick={handleReset} className="text-xs text-secondary hover:text-primary transition-colors">
            Annulla
          </button>
        </form>
      )}

      {step === 'done' && (
        <button onClick={handleReset} className="text-xs text-accent hover:underline">
          Cambia di nuovo
        </button>
      )}

      {status && (
        <p className={`text-xs mt-2 ${status.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
          {status.msg}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Account: Change password (requires current password to unlock)     */
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
    // Verify current password by re-authenticating
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
    <div className="p-5 bg-card rounded-2xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-semibold text-primary mb-3">Cambia password</h3>
      {!unlocked ? (
        <form onSubmit={handleVerify} className="space-y-2">
          <p className="text-xs text-secondary mb-1">Inserisci la password attuale per procedere</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              placeholder="Password attuale"
              required
              className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            <button
              type="submit"
              disabled={verifying || !currentPwd}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-gray-800 text-white hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {verifying ? 'Verifica...' : 'Verifica'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nuova password (min. 6 caratteri)"
            required
            minLength={6}
            className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Conferma nuova password"
            required
            className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !password || !confirm}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-accent text-white hover:bg-[#e64545] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvataggio...' : 'Aggiorna password'}
            </button>
            <button
              type="button"
              onClick={() => { setUnlocked(false); setPassword(''); setConfirm(''); setCurrentPwd(''); setStatus(null) }}
              className="px-4 py-2 rounded-xl text-xs font-medium text-secondary hover:bg-gray-100 transition-colors"
            >
              Annulla
            </button>
          </div>
        </form>
      )}
      {status && (
        <p className={`text-xs mt-2 ${status.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
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

    // Find profile by email
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
    <div className="p-5 bg-card rounded-2xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-semibold text-primary mb-3">Amministratori</h3>

      {loading ? (
        <div className="animate-pulse h-10 bg-gray-100 rounded-xl" />
      ) : (
        <div className="space-y-2 mb-4">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
              {admin.avatar_url ? (
                <img src={admin.avatar_url} alt="" loading="lazy" decoding="async" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">
                  {(admin.full_name || admin.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary truncate">
                  {admin.full_name || 'Admin'}
                </p>
                {admin.email && (
                  <p className="text-xs text-secondary truncate">{admin.email}</p>
                )}
              </div>
              {admin.id === currentUserId ? (
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                  Tu
                </span>
              ) : removeId === admin.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleRemove(admin.id)}
                    disabled={actionLoading}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    Conferma
                  </button>
                  <button
                    onClick={() => setRemoveId(null)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium text-secondary hover:bg-gray-200 transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setRemoveId(admin.id)}
                  className="p-1.5 rounded-lg text-secondary hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Rimuovi admin"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {admins.length === 0 && (
            <p className="text-xs text-secondary">Nessun admin trovato</p>
          )}
        </div>
      )}

      {/* Add admin form */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-medium text-secondary mb-2">Aggiungi amministratore</p>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email dell'utente"
            required
            className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
          <button
            type="submit"
            disabled={actionLoading || !email.trim()}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-accent text-white hover:bg-[#e64545] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {actionLoading ? '...' : 'Aggiungi'}
          </button>
        </form>
        {status && (
          <p className={`text-xs mt-2 ${status.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Impostazioni">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-primary">Impostazioni</h1>
        <p className="text-sm text-secondary mt-0.5">Strumenti di manutenzione e configurazione</p>
      </motion.div>

      {/* Account section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="mb-8"
      >
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">Account</h2>
        <div className="space-y-4 max-w-2xl">
          <ChangeEmail currentEmail={user.email} user={user} />
          <ChangePassword userEmail={user.email} />
        </div>
      </motion.div>

      {/* Admin list */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="mb-8"
      >
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">Team</h2>
        <div className="max-w-2xl">
          <AdminList currentUserId={user.id} />
        </div>
      </motion.div>

      {/* Tools section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">Strumenti</h2>
        <div className="space-y-4 max-w-2xl">
          <ThumbnailTool />
        </div>
      </motion.div>
    </AdminLayout>
  )
}
