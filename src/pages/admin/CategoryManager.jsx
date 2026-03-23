import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { CUISINE_CATEGORIES } from '../../lib/hooks/useRestaurants'
import { LoadingSpinner } from '../../components/UI/LoadingSpinner'
import AdminLayout from '../../components/Layout/AdminLayout'

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
function ArrowLeftIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}
function PencilIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}
function TrashIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}
function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
function XIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function PlusIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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
  const { user, loading: authLoading } = useAuth()

  // Local state mirroring the hardcoded categories
  const [categories, setCategories] = useState(
    CUISINE_CATEGORIES.map((c, i) => ({ ...c, id: i }))
  )
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', emoji: '', color: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', emoji: '', color: COLOR_PRESETS[0] })
  const [deleteId, setDeleteId] = useState(null)

  const startEdit = (cat) => {
    setEditingId(cat.id)
    setEditForm({ name: cat.name, emoji: cat.emoji, color: cat.color })
    setShowAdd(false)
  }

  const saveEdit = () => {
    if (!editForm.name.trim()) return
    setCategories((prev) =>
      prev.map((c) =>
        c.id === editingId
          ? { ...c, name: editForm.name.trim(), emoji: editForm.emoji, color: editForm.color }
          : c
      )
    )
    setEditingId(null)
  }

  const cancelEdit = () => setEditingId(null)

  const addCategory = () => {
    if (!addForm.name.trim()) return
    const newId = Math.max(0, ...categories.map((c) => c.id)) + 1
    setCategories((prev) => [
      ...prev,
      { id: newId, name: addForm.name.trim(), emoji: addForm.emoji || '🍴', color: addForm.color },
    ])
    setAddForm({ name: '', emoji: '', color: COLOR_PRESETS[0] })
    setShowAdd(false)
  }

  const deleteCategory = (id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setDeleteId(null)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user) return null

  return (
    <AdminLayout title="Categorie">
      <div className="max-w-2xl mx-auto">
        {/* Header with Add button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-primary">Categorie</h1>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { setShowAdd(true); setEditingId(null) }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium shadow-sm hover:bg-[#e64545] transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Aggiungi
          </motion.button>
        </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Info note */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6">
          <p className="text-sm text-blue-700">
            <strong>Nota:</strong> Le categorie sono attualmente gestite nel codice sorgente (
            <code className="bg-blue-100 px-1 rounded text-xs">CUISINE_CATEGORIES</code> in{' '}
            <code className="bg-blue-100 px-1 rounded text-xs">useRestaurants.js</code>). Le modifiche
            qui sono solo locali a questa sessione. Per renderle permanenti, aggiorna il file sorgente.
          </p>
        </div>

        {/* Add form (inline) */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-primary mb-4">Nuova categoria</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-[1fr_80px] gap-3">
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Nome categoria"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-bg text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={addForm.emoji}
                      onChange={(e) => setAddForm((p) => ({ ...p, emoji: e.target.value }))}
                      placeholder="🍴"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-bg text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent/30"
                      maxLength={4}
                    />
                  </div>

                  {/* Color picker */}
                  <div>
                    <p className="text-xs text-secondary mb-2">Colore</p>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAddForm((p) => ({ ...p, color: c }))}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${
                            addForm.color === c ? 'border-primary scale-110 shadow-sm' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <input
                        type="color"
                        value={addForm.color}
                        onChange={(e) => setAddForm((p) => ({ ...p, color: e.target.value }))}
                        className="w-7 h-7 rounded-full cursor-pointer border-0 p-0"
                        title="Colore personalizzato"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={() => setShowAdd(false)}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-secondary hover:bg-gray-100 transition-colors"
                    >
                      Annulla
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={addCategory}
                      disabled={!addForm.name.trim()}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-[#e64545] transition-colors disabled:opacity-50"
                    >
                      Aggiungi
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category list */}
        <div className="bg-card rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {categories.map((cat, i) => {
              const isEditing = editingId === cat.id
              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="px-5 py-4"
                >
                  {isEditing ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <div className="grid grid-cols-[1fr_80px] gap-3">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-bg text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editForm.emoji}
                          onChange={(e) => setEditForm((p) => ({ ...p, emoji: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-bg text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent/30"
                          maxLength={4}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditForm((p) => ({ ...p, color: c }))}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${
                              editForm.color === c ? 'border-primary scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <input
                          type="color"
                          value={editForm.color}
                          onChange={(e) => setEditForm((p) => ({ ...p, color: e.target.value }))}
                          className="w-6 h-6 rounded-full cursor-pointer border-0 p-0"
                        />
                      </div>
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={cancelEdit}
                          className="p-2 rounded-lg text-secondary hover:bg-gray-100 transition-colors"
                          title="Annulla"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={saveEdit}
                          className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                          title="Salva"
                        >
                          <CheckIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                          style={{ backgroundColor: `${cat.color}15` }}
                        >
                          {cat.emoji}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-primary">{cat.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="inline-block w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-xs text-secondary">{cat.color}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(cat)}
                          className="p-2 rounded-lg text-secondary hover:text-accent hover:bg-accent/5 transition-colors"
                          title="Modifica"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(cat.id)}
                          className="p-2 rounded-lg text-secondary hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Elimina"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}

            {categories.length === 0 && (
              <div className="px-5 py-12 text-center text-secondary text-sm">
                Nessuna categoria. Aggiungine una!
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
            onClick={() => setDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-primary mb-2">Elimina categoria</h3>
              <p className="text-sm text-secondary mb-6">
                Sei sicuro di voler eliminare questa categoria? I ristoranti associati manterranno il riferimento attuale.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-secondary hover:bg-gray-100 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={() => deleteCategory(deleteId)}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm"
                >
                  Elimina
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </AdminLayout>
  )
}
