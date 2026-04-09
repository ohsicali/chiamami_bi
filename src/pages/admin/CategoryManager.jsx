import { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useCategories } from '../../lib/hooks/useCategories'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import AdminLayout from '../../components/Layout/AdminLayout'

/* ------------------------------------------------------------------ */
/*  Icons (inline SVG)                                                 */
/* ------------------------------------------------------------------ */
const ic = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

function PencilIcon() {
  return (
    <svg {...ic} width={15} height={15} viewBox="0 0 24 24">
      <path d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg {...ic} width={15} height={15} viewBox="0 0 24 24">
      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Color presets                                                      */
/* ------------------------------------------------------------------ */
const COLOR_PRESETS = [
  '#FF5757', '#EF4444', '#F59E0B', '#10B981', '#6366F1',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#3B82F6',
]

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function CategoryManager() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { categories, loading: catsLoading, addCategory, updateCategory, deleteCategory } = useCategories()
  const { allRestaurants: restaurants } = useRestaurants()

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', emoji: '', color: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', emoji: '', color: COLOR_PRESETS[0] })
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)

  // Count restaurants per category name
  const countMap = useMemo(() => {
    const m = {}
    ;(restaurants || []).forEach((r) => {
      ;(r.category || []).forEach((catName) => {
        m[catName] = (m[catName] || 0) + 1
      })
    })
    return m
  }, [restaurants])

  const startEdit = (cat) => {
    setEditingId(cat.id)
    setEditForm({ name: cat.name, emoji: cat.emoji, color: cat.color })
    setShowAdd(false)
  }

  const saveEdit = async () => {
    if (!editForm.name.trim() || saving) return
    setSaving(true)
    const { error } = await updateCategory(editingId, editForm)
    setSaving(false)
    if (!error) setEditingId(null)
  }

  const cancelEdit = () => setEditingId(null)

  const handleAdd = async () => {
    if (!addForm.name.trim() || saving) return
    setSaving(true)
    const { error } = await addCategory({ name: addForm.name, emoji: addForm.emoji || '🍴', color: addForm.color })
    setSaving(false)
    if (!error) {
      setAddForm({ name: '', emoji: '', color: COLOR_PRESETS[0] })
      setShowAdd(false)
    }
  }

  const handleDelete = async (id) => {
    setSaving(true)
    await deleteCategory(id)
    setSaving(false)
    setDeleteId(null)
  }

  if (authLoading || catsLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #E8453C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    border: '1px solid #eee',
    borderRadius: 8,
    background: '#fafafa',
    color: '#1a1a1f',
    outline: 'none',
    fontFamily: 'inherit',
  }

  return (
    <AdminLayout title="Categorie">
      {/* ─── HEADER ─── */}
      <div style={{ borderBottom: '1px solid #eee', background: '#fff' }} className="px-[18px] py-[16px] md:px-[28px] md:py-[20px]">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1f', margin: 0 }}>Categorie</h1>
            <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>{categories.length} categorie totali</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setEditingId(null) }}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: '#E8453C',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            + Aggiungi
          </button>
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="px-[18px] py-[16px] md:px-[28px] md:py-[24px]" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ─── ADD FORM ─── */}
        {showAdd && (
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1f', margin: '0 0 12px' }}>Nuova categoria</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 8 }}>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome categoria"
                  style={inputStyle}
                  autoFocus
                />
                <input
                  type="text"
                  value={addForm.emoji}
                  onChange={(e) => setAddForm((p) => ({ ...p, emoji: e.target.value }))}
                  placeholder="🍴"
                  style={{ ...inputStyle, textAlign: 'center' }}
                  maxLength={4}
                />
              </div>

              {/* Color picker */}
              <div>
                <p style={{ fontSize: 11, color: '#999', margin: '0 0 6px' }}>Colore</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAddForm((p) => ({ ...p, color: c }))}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: c,
                        border: addForm.color === c ? '2px solid #1a1a1f' : '2px solid transparent',
                        cursor: 'pointer',
                        padding: 0,
                        transform: addForm.color === c ? 'scale(1.15)' : 'none',
                        transition: 'transform 0.15s',
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={addForm.color}
                    onChange={(e) => setAddForm((p) => ({ ...p, color: e.target.value }))}
                    style={{ width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', border: 'none', padding: 0 }}
                    title="Colore personalizzato"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={() => setShowAdd(false)}
                  style={{ padding: '7px 14px', fontSize: 12, fontWeight: 500, background: 'transparent', border: '1px solid #eee', borderRadius: 8, color: '#666', cursor: 'pointer' }}
                >
                  Annulla
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!addForm.name.trim() || saving}
                  style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: '#E8453C', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: (!addForm.name.trim() || saving) ? 0.5 : 1 }}
                >
                  {saving ? '...' : 'Aggiungi'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── CATEGORY GRID ─── */}
        {categories.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '40px 20px', textAlign: 'center', color: '#999', fontSize: 13 }}>
            Nessuna categoria. Aggiungine una!
          </div>
        ) : (
          <div
            style={{ display: 'grid', gap: 10 }}
            className="grid-cols-1 md:!grid-cols-2 lg:!grid-cols-3"
          >
            {categories.map((cat) => {
              const isEditing = editingId === cat.id
              const count = countMap[cat.name] || 0

              if (isEditing) {
                return (
                  <div key={cat.id} style={{ background: '#fff', border: '1px solid #E8453C', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 8 }}>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          style={inputStyle}
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editForm.emoji}
                          onChange={(e) => setEditForm((p) => ({ ...p, emoji: e.target.value }))}
                          style={{ ...inputStyle, textAlign: 'center' }}
                          maxLength={4}
                        />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditForm((p) => ({ ...p, color: c }))}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: c,
                              border: editForm.color === c ? '2px solid #1a1a1f' : '2px solid transparent',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          />
                        ))}
                        <input
                          type="color"
                          value={editForm.color}
                          onChange={(e) => setEditForm((p) => ({ ...p, color: e.target.value }))}
                          style={{ width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', border: 'none', padding: 0 }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={cancelEdit}
                          style={{ padding: '6px 12px', fontSize: 11, fontWeight: 500, background: 'transparent', border: '1px solid #eee', borderRadius: 6, color: '#666', cursor: 'pointer' }}
                        >
                          Annulla
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
                        >
                          {saving ? '...' : 'Salva'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={cat.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #eee',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  {/* Emoji circle */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: `${cat.color}18`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {cat.emoji}
                  </div>

                  {/* Name + count */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                      {count} {count === 1 ? 'ristorante' : 'ristoranti'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => startEdit(cat)}
                      style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', color: '#999' }}
                      title="Modifica"
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#E8453C' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#999' }}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={() => setDeleteId(cat.id)}
                      style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', color: '#999' }}
                      title="Elimina"
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#999' }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── DELETE MODAL ─── */}
      {deleteId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            padding: 16,
          }}
          onClick={() => setDeleteId(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 360,
              width: '100%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1f', margin: '0 0 8px' }}>Elimina categoria</h3>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px', lineHeight: 1.5 }}>
              Sei sicuro di voler eliminare questa categoria? I ristoranti associati manterranno il riferimento attuale.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, background: 'transparent', border: '1px solid #eee', borderRadius: 8, color: '#666', cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={saving}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
              >
                {saving ? '...' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
