import { useState, useEffect } from 'react'
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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase, isSupabaseConfigured } from '../../../lib/supabase'
import FGroup from './_FGroup'
import { FField, FInput, FTextarea } from './_Fields'

/**
 * CosaTiConsiglioTab — consiglio di Bi in 2 formati:
 *   1. Nota generale (our_tip, sempre disponibile) — quando Augusto non
 *      ricorda il nome dei piatti ma sa cosa consigliare "a grandi linee".
 *   2. Piatti specifici (0-N righe in restaurant_dishes) — con titolo,
 *      descrizione, foto opzionale, drag&drop reorder.
 *
 * Persistenza piatti: auto-save on blur di ogni field + DnD reorder
 * immediato. Create/Delete tramite bottoni "+ Aggiungi" e "✕".
 */
export default function CosaTiConsiglioTab({ form, onChange, restaurantId }) {
  const [dishes, setDishes] = useState([])
  const [loadingDishes, setLoadingDishes] = useState(true)
  const [savingId, setSavingId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Load dishes on mount / restaurant change
  useEffect(() => {
    if (!restaurantId || !isSupabaseConfigured()) return
    let cancelled = false
    ;(async () => {
      setLoadingDishes(true)
      const { data } = await supabase
        .from('restaurant_dishes')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true })
      if (cancelled) return
      setDishes(data || [])
      setLoadingDishes(false)
    })()
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  async function handleAdd() {
    const nextOrder = dishes.length
    const { data, error } = await supabase
      .from('restaurant_dishes')
      .insert({
        restaurant_id: restaurantId,
        sort_order: nextOrder,
        title: 'Nuovo piatto',
        description: '',
      })
      .select()
      .single()
    if (error) {
      alert('Errore: ' + error.message)
      return
    }
    setDishes((prev) => [...prev, data])
  }

  async function handleUpdate(id, patch) {
    setSavingId(id)
    try {
      const { error } = await supabase
        .from('restaurant_dishes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      setDishes((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
    } catch (err) {
      alert('Errore: ' + err.message)
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Elimina questo piatto?')) return
    const { error } = await supabase.from('restaurant_dishes').delete().eq('id', id)
    if (error) {
      alert('Errore: ' + error.message)
      return
    }
    setDishes((prev) => prev.filter((d) => d.id !== id))
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = dishes.findIndex((d) => d.id === active.id)
    const newIdx = dishes.findIndex((d) => d.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(dishes, oldIdx, newIdx).map((d, i) => ({ ...d, sort_order: i }))
    setDishes(reordered)

    // Persist sort_order batch
    try {
      await Promise.all(
        reordered.map((d) =>
          supabase.from('restaurant_dishes').update({ sort_order: d.sort_order }).eq('id', d.id)
        )
      )
    } catch (err) {
      console.error('reorder persist failed:', err)
    }
  }

  return (
    <div>
      {/* Note generale (our_tip) */}
      <FGroup title="Nota generale" count="quello che diresti a un amico">
        <FField
          label="Cosa consigli a grandi linee"
          hint="Usalo quando non ricordi i piatti specifici ma sai cosa è buono qui."
        >
          <FTextarea
            value={form.our_tip}
            onChange={(v) => onChange({ our_tip: v })}
            rows={3}
            placeholder="Es. «Tutto ciò che cuociono in forno. Se hanno la pasta del giorno, prendi quella.»"
          />
        </FField>
      </FGroup>

      {/* Piatti specifici */}
      <FGroup
        title="Piatti specifici · opzionale"
        count={
          loadingDishes
            ? 'carico…'
            : `${dishes.length} piat${dishes.length === 1 ? 'to' : 'ti'} · trascina per riordinare`
        }
      >
        {dishes.length === 0 && !loadingDishes && (
          <div
            style={{
              textAlign: 'center',
              padding: '16px 12px',
              color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            Nessun piatto specifico. Aggiungi solo se ne ricordi uno che vale davvero.
          </div>
        )}

        {dishes.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={dishes.map((d) => d.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {dishes.map((d, i) => (
                  <DishRow
                    key={d.id}
                    dish={d}
                    index={i}
                    saving={savingId === d.id}
                    onUpdate={(patch) => handleUpdate(d.id, patch)}
                    onDelete={() => handleDelete(d.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <button
          type="button"
          onClick={handleAdd}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: '2px dashed var(--color-line, #EAE3D7)',
            borderRadius: 12,
            background: 'transparent',
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + Aggiungi piatto
        </button>
      </FGroup>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  DishRow — sortable + inline editable                               */
/* ------------------------------------------------------------------ */
function DishRow({ dish, index, saving, onUpdate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dish.id })
  const [title, setTitle] = useState(dish.title || '')
  const [description, setDescription] = useState(dish.description || '')

  // Sync local state when parent updates dish (e.g. after reorder)
  useEffect(() => {
    setTitle(dish.title || '')
    setDescription(dish.description || '')
  }, [dish.id, dish.title, dish.description])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: 'var(--color-cream, #F5F0E4)',
    borderRadius: 12,
    padding: 12,
    display: 'grid',
    gridTemplateColumns: '24px 70px 1fr auto',
    gap: 10,
    alignItems: 'center',
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? '0 10px 30px rgba(0,0,0,0.15)' : 'none',
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab',
          color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
          fontSize: 16,
          display: 'grid',
          placeItems: 'center',
          touchAction: 'none',
        }}
        aria-label="Trascina per riordinare"
      >
        ⋮⋮
      </div>
      <div
        style={{
          width: 70,
          height: 70,
          borderRadius: 10,
          background: dish.photo_url
            ? `url(${dish.photo_url}) center/cover no-repeat`
            : 'linear-gradient(135deg, #d8cfc1, #9a8671)',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: -6,
            left: -6,
            width: 22,
            height: 22,
            background: 'var(--color-oro, #B08954)',
            color: '#fff',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-wordmark, "Alfa Slab One")',
            fontSize: 11,
          }}
        >
          {index + 1}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <FInput
          value={title}
          onChange={setTitle}
          onBlur={() => title !== dish.title && onUpdate({ title })}
          placeholder="Nome piatto"
          style={{ fontWeight: 800, fontSize: 13 }}
        />
        <FTextarea
          value={description}
          onChange={setDescription}
          onBlur={() => description !== dish.description && onUpdate({ description })}
          rows={2}
          placeholder="Breve descrizione (una riga, tono Bi)"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        {saving && (
          <span style={{ fontSize: 10, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontWeight: 700 }}>
            salvo…
          </span>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Elimina piatto"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: 0,
            background: '#fff',
            color: 'var(--color-danger, #C0392B)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
