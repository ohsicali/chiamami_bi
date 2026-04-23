import { useState, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase, proxyImg } from '../../../lib/supabase'
import FGroup from './_FGroup'

const MAX_PHOTOS = 12
const STORAGE_BUCKET = 'photos'

/**
 * FotoGalleriaTab — multi-photo upload + drag-reorder + delete + set-cover.
 *
 * Storage layout: photos/{slug}/{timestamp}-{index}.webp
 * Each photo in DB is { url, thumb_url, caption, sort_order }.
 * The first one (sort_order=0) is automatically the cover.
 *
 * WebP conversion happens client-side before upload (full + thumb variants).
 */
export default function FotoGalleriaTab({ form, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const photos = normalizePhotos(form.photos)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = photos.findIndex((p) => p.url === active.id)
    const newIdx = photos.findIndex((p) => p.url === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(photos, oldIdx, newIdx).map((p, i) => ({ ...p, sort_order: i }))
    onChange({ photos: reordered })
  }

  async function handleUpload(files) {
    if (!files || files.length === 0) return
    const pool = Array.from(files)
    const roomLeft = Math.max(0, MAX_PHOTOS - photos.length)
    if (pool.length > roomLeft) {
      setError(`Max ${MAX_PHOTOS} foto — ne puoi aggiungere ancora ${roomLeft}.`)
      return
    }
    setError(null)
    setUploading(true)
    setProgress({ done: 0, total: pool.length })

    const slug = form.slug || 'tmp-' + Date.now()
    const newPhotos = [...photos]

    for (let i = 0; i < pool.length; i++) {
      try {
        const file = pool[i]
        const { full, thumb } = await convertToWebP(file)
        const ts = Date.now()
        const fullName = `${ts}-${i}.webp`
        const thumbName = `${ts}-${i}-thumb.webp`
        const basePath = `${slug}`

        const [fullRes, thumbRes] = await Promise.all([
          supabase.storage.from(STORAGE_BUCKET).upload(`${basePath}/${fullName}`, full, { contentType: 'image/webp', upsert: false }),
          supabase.storage.from(STORAGE_BUCKET).upload(`${basePath}/${thumbName}`, thumb, { contentType: 'image/webp', upsert: false }),
        ])
        if (fullRes.error) throw fullRes.error
        if (thumbRes.error) throw thumbRes.error

        const { data: fullPub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(`${basePath}/${fullName}`)
        const { data: thumbPub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(`${basePath}/${thumbName}`)

        newPhotos.push({
          url: fullPub.publicUrl,
          photo_url: fullPub.publicUrl,
          thumb_url: thumbPub.publicUrl,
          caption: '',
          sort_order: newPhotos.length,
        })
      } catch (err) {
        console.error('upload failed:', err)
        setError(`Errore upload: ${err.message}`)
      }
      setProgress({ done: i + 1, total: pool.length })
    }

    onChange({ photos: newPhotos.map((p, i) => ({ ...p, sort_order: i })) })
    setUploading(false)
    setTimeout(() => setProgress({ done: 0, total: 0 }), 600)
  }

  function handleDelete(url) {
    if (!confirm('Eliminare questa foto?')) return
    const next = photos.filter((p) => p.url !== url).map((p, i) => ({ ...p, sort_order: i }))
    onChange({ photos: next })
  }

  function handleSetCover(url) {
    const photo = photos.find((p) => p.url === url)
    if (!photo) return
    const others = photos.filter((p) => p.url !== url)
    const next = [photo, ...others].map((p, i) => ({ ...p, sort_order: i }))
    onChange({ photos: next })
  }

  return (
    <div>
      <FGroup
        title="Foto & galleria"
        count={`${photos.length} / ${MAX_PHOTOS} foto · trascina per riordinare`}
      >
        {photos.length === 0 && <EmptyPhotoState onBrowse={() => fileInputRef.current?.click()} />}

        {photos.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={photos.map((p) => p.url)} strategy={rectSortingStrategy}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {photos.map((photo, i) => (
                  <PhotoTile
                    key={photo.url}
                    photo={photo}
                    isCover={i === 0}
                    onDelete={() => handleDelete(photo.url)}
                    onSetCover={() => handleSetCover(photo.url)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Upload area */}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              width: '100%',
              padding: 24,
              border: '2px dashed var(--color-line, #EAE3D7)',
              borderRadius: 12,
              background: 'var(--color-cream, #F5F0E4)',
              color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: 13,
              cursor: uploading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {uploading
              ? `Carico ${progress.done}/${progress.total}…`
              : `+ Aggiungi foto (max ${MAX_PHOTOS - photos.length} restanti)`}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          style={{ display: 'none' }}
        />

        {error && (
          <div
            style={{
              marginTop: 10,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'var(--color-danger-wash, #FCE8E4)',
              color: 'var(--color-danger, #C0392B)',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}
      </FGroup>

      <FGroup title="Nota">
        <div style={{ fontSize: 12, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', lineHeight: 1.6 }}>
          La prima foto (marcata <b>Cover</b>) viene usata come immagine principale sulla scheda
          pubblica, nelle liste e come fallback OG image per condivisione social.
          Le foto vengono convertite in <b>WebP</b> (full + thumb) al momento dell'upload per
          ottimizzare il caricamento.
        </div>
      </FGroup>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  PhotoTile (sortable)                                               */
/* ------------------------------------------------------------------ */
function PhotoTile({ photo, isCover, onDelete, onSetCover }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.url })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    aspectRatio: '4 / 3',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#eee',
    cursor: 'grab',
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? '0 10px 30px rgba(0,0,0,0.25)' : 'none',
    touchAction: 'none',
  }
  const src = proxyImg(photo.thumb_url || photo.url || photo.photo_url)
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {src ? (
        <img
          src={src}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #d8cfc1, #ad9b80)',
          }}
        />
      )}
      {isCover && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            background: 'rgba(0,0,0,0.65)',
            color: '#fff',
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 800,
            borderRadius: 999,
            letterSpacing: '0.04em',
          }}
        >
          Cover
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          right: 6,
          display: 'flex',
          gap: 4,
        }}
      >
        {!isCover && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onSetCover()
            }}
            aria-label="Imposta come cover"
            title="Imposta come cover"
            style={photoAction}
          >
            ★
          </button>
        )}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label="Elimina"
          title="Elimina"
          style={{ ...photoAction, color: 'var(--color-danger, #C0392B)' }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function EmptyPhotoState({ onBrowse }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 13 }}>
      <div style={{ fontSize: 36, marginBottom: 6 }} aria-hidden>📸</div>
      <div>Nessuna foto ancora.</div>
      <button
        type="button"
        onClick={onBrowse}
        style={{
          marginTop: 10,
          background: 'var(--color-corallo, #E8453C)',
          color: '#fff',
          border: 0,
          padding: '10px 18px',
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
        }}
      >
        + Carica le prime foto
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function normalizePhotos(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((p, i) => {
      if (typeof p === 'string') return { url: p, photo_url: p, thumb_url: null, caption: '', sort_order: i }
      return {
        url: p.url || p.photo_url || '',
        photo_url: p.photo_url || p.url || '',
        thumb_url: p.thumb_url || null,
        caption: p.caption || '',
        sort_order: p.sort_order ?? i,
      }
    })
    .filter((p) => p.url)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

function convertToWebP(file, maxWidth = 1200, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const resize = (targetWidth, q) =>
        new Promise((res, rej) => {
          const scale = Math.min(1, targetWidth / img.width)
          const w = Math.round(img.width * scale)
          const h = Math.round(img.height * scale)
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          canvas.toBlob((blob) => (blob ? res(blob) : rej(new Error('WebP conversion failed'))), 'image/webp', q)
        })
      Promise.all([resize(maxWidth, quality), resize(400, 0.7)])
        .then(([full, thumb]) => {
          URL.revokeObjectURL(img.src)
          resolve({ full, thumb })
        })
        .catch(reject)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

const photoAction = {
  width: 26,
  height: 26,
  borderRadius: 999,
  border: 0,
  background: 'rgba(255,255,255,0.95)',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 900,
  color: 'var(--color-ink, #22181C)',
  boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
}
