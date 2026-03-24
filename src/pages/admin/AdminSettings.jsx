import { useState, useCallback } from 'react'
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

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">Strumenti</h2>
        <div className="space-y-4 max-w-2xl">
          <ThumbnailTool />
        </div>
      </motion.div>
    </AdminLayout>
  )
}
