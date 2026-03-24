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
/*  Account: Change email                                              */
/* ------------------------------------------------------------------ */
function ChangeEmail({ currentEmail }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null) // { type: 'success'|'error', msg }
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || email === currentEmail) return
    setSaving(true)
    setStatus(null)
    const { error } = await supabase.auth.updateUser({ email })
    setSaving(false)
    if (error) {
      setStatus({ type: 'error', msg: error.message })
    } else {
      setStatus({ type: 'success', msg: 'Email di conferma inviata al nuovo indirizzo. Controlla la casella.' })
      setEmail('')
    }
  }

  return (
    <div className="p-5 bg-card rounded-2xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-semibold text-primary mb-1">Cambia email</h3>
      <p className="text-xs text-secondary mb-3">
        Email attuale: <span className="font-medium text-primary">{currentEmail}</span>
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Nuova email"
          required
          className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
        />
        <button
          type="submit"
          disabled={saving || !email.trim()}
          className="px-4 py-2 rounded-xl text-xs font-medium bg-accent text-white hover:bg-[#e64545] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {saving ? 'Invio...' : 'Aggiorna email'}
        </button>
      </form>
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
/*  Admin list                                                         */
/* ------------------------------------------------------------------ */
function AdminList() {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured()) { setLoading(false); return }
    supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, is_admin')
      .eq('is_admin', true)
      .order('full_name')
      .then(({ data }) => {
        setAdmins(data || [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="p-5 bg-card rounded-2xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-semibold text-primary mb-3">Amministratori</h3>
      {loading ? (
        <div className="animate-pulse h-10 bg-gray-100 rounded-xl" />
      ) : admins.length === 0 ? (
        <p className="text-xs text-secondary">Nessun admin trovato</p>
      ) : (
        <div className="space-y-2">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
              {admin.avatar_url ? (
                <img src={admin.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
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
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                Admin
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function AdminSettings() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }
  if (!user) return <Navigate to="/admin/login" replace />

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
          <ChangeEmail currentEmail={user.email} />
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
          <AdminList />
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
