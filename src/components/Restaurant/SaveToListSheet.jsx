import { useState } from 'react'
import { useSavedLists } from '../../lib/hooks/useSavedLists'
import './SaveToListSheet.css'

/**
 * BLOCCO 6 — il foglio che compare dopo aver salvato.
 *
 * È FACOLTATIVO e si può ignorare: il salvataggio è già avvenuto col tocco
 * sul cuore, questo serve solo a chi vuole anche mettere il locale in una
 * lista. Per questo si chiude toccando fuori e non ha un "Annulla" che
 * suggerisca di aver lasciato qualcosa a metà.
 *
 * Le tre liste pronte ci sono fin dal primo salvataggio, ma esistono in
 * database solo quando qualcuno ne tocca una.
 */
export default function SaveToListSheet({ userId, restaurant, onClose }) {
  const { lists, suggestions, toggleInList, createList } = useSavedLists(userId)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(null)

  if (!restaurant) return null
  const all = [...lists, ...suggestions]

  const handleToggle = async (list) => {
    setBusy(list.id || list.name)
    await toggleInList(list, restaurant.id)
    setBusy(null)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy('new')
    const id = await createList(name)
    if (id) await toggleInList({ id, name }, restaurant.id)
    setNewName('')
    setCreating(false)
    setBusy(null)
  }

  return (
    <div
      className="stl-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Metti in una lista"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="stl-sheet">
        <div className="stl-grab" aria-hidden="true" />
        <p className="stl-saved">🤍 Salvato — {restaurant.name}</p>
        <h3 className="stl-title">Vuoi metterlo in una lista?</h3>

        <div className="stl-lists">
          {all.map((l) => {
            const inList = l.restaurantIds?.includes(restaurant.id)
            const key = l.id || l.name
            return (
              <button
                key={key}
                type="button"
                className={`stl-item${inList ? ' is-in' : ''}`}
                onClick={() => handleToggle(l)}
                disabled={busy === key}
              >
                <span className="stl-emoji" aria-hidden="true">{l.emoji || '📁'}</span>
                <span className="stl-name">{l.name}</span>
                <span className="stl-check" aria-hidden="true">{inList ? '✓' : '+'}</span>
              </button>
            )
          })}

          {creating ? (
            <form className="stl-new" onSubmit={handleCreate}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome della lista"
                maxLength={40}
                aria-label="Nome della nuova lista"
              />
              <button type="submit" disabled={!newName.trim() || busy === 'new'}>Crea</button>
            </form>
          ) : (
            <button type="button" className="stl-item stl-add" onClick={() => setCreating(true)}>
              <span className="stl-emoji" aria-hidden="true">＋</span>
              <span className="stl-name">Nuova lista</span>
            </button>
          )}
        </div>

        {/* "Fatto", non "Annulla": non c'è niente da annullare, il locale è
            già salvato. */}
        <button type="button" className="stl-done" onClick={onClose}>Fatto</button>
      </div>
    </div>
  )
}
