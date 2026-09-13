import { useState } from 'react'
import { useSavedLists } from '../../lib/hooks/useSavedLists'
import { EmojiPicker } from './SavedListsStrip'
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
  // Le liste pronte hanno un'emoji vera e quelle create finivano tutte con la
  // cartellina: nella striscia si distinguevano solo leggendo il nome.
  const [newEmoji, setNewEmoji] = useState('📁')
  const [busy, setBusy] = useState(null)

  if (!restaurant) return null
  const all = [...lists, ...suggestions]
  // Il foglio si apre in due momenti diversi: subito dopo il primo
  // salvataggio, e più tardi dai Salvati per cambiare idea. "Vuoi metterlo
  // in una lista?" è la domanda giusta solo la prima volta — la seconda il
  // locale in una lista ci sta già, e chiederlo suona come se non lo
  // sapessimo.
  const giaDentro = all.some((l) => l.restaurantIds?.includes(restaurant.id))

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
    const id = await createList(name, newEmoji)
    if (id) await toggleInList({ id, name, emoji: newEmoji }, restaurant.id)
    setNewName('')
    setNewEmoji('📁')
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
        <h3 className="stl-title">{giaDentro ? 'Le liste di questo locale' : 'Vuoi metterlo in una lista?'}</h3>

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
            <form className="stl-new-form" onSubmit={handleCreate}>
              <div className="stl-new">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome della lista"
                  maxLength={40}
                  aria-label="Nome della nuova lista"
                />
                <button type="submit" disabled={!newName.trim() || busy === 'new'}>Crea</button>
              </div>
              <EmojiPicker value={newEmoji} onChange={setNewEmoji} />
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
