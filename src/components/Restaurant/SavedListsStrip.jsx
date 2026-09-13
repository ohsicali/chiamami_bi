import { useState } from 'react'
import { proxyImg } from '../../lib/supabase'
import { LIST_EMOJI } from '../../lib/hooks/useSavedLists'

/* ============================================================================
   BLOCCO 6 — la striscia delle liste sopra i salvati.

   Sta qui e non dentro SavedPage perché la usano due pagine: il telefono e il
   desktop. Finché era una funzione privata di SavedPage, su desktop le liste
   semplicemente non esistevano — si creavano dal telefono e poi sparivano.

   La copertina è automatica: la foto del primo locale della lista. Nessuna
   scelta da fare — chiedere di scegliere una copertina è una decisione in più
   per salvare un ristorante.

   Le liste filtrano l'elenco sotto, non lo sostituiscono: ritoccando la lista
   attiva si torna a vedere tutto. Se non ci sono liste la striscia non
   compare affatto, invece di mostrare cartelle vuote.

   Rinomina e cancella compaiono SOLO quando una lista è selezionata, in una
   riga sotto la striscia. La ragione è banale ma decide il markup: una
   matitina nell'angolo di ogni riquadro sarebbe un bottone dentro un bottone,
   che è HTML non valido e su iOS fa partire il tocco sbagliato.
   ========================================================================= */

export default function SavedListsStrip({
  lists,
  suggestions = [],
  restaurants,
  activeListId,
  onSelect,
  onRename,
  onDelete,
  tileWidth = 116,
}) {
  const [editing, setEditing] = useState(null)   // la lista in modifica
  const [confirming, setConfirming] = useState(null)
  const [hint, setHint] = useState(null)         // il suggerimento toccato

  const real = lists || []
  if (real.length === 0 && suggestions.length === 0) return null
  const byId = new Map((restaurants || []).map((r) => [r.id, r]))
  const active = lists.find((l) => l.id === activeListId) || null
  const canEdit = typeof onRename === 'function' && typeof onDelete === 'function'

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          paddingBottom: 14,
          scrollbarWidth: 'none',
        }}
      >
        {real.map((l) => {
          const first = (l.restaurantIds || []).map((id) => byId.get(id)).find(Boolean)
          const photoRaw = first?.photos?.[0]?.thumb_url || first?.photos?.[0]?.photo_url
          const cover = proxyImg(photoRaw, { w: 300 })
          const isActive = activeListId === l.id
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                onSelect(isActive ? null : l.id)
                setEditing(null)
                setConfirming(null)
              }}
              style={{
                flex: '0 0 auto',
                width: tileWidth,
                border: `2px solid ${isActive ? 'var(--color-corallo)' : 'transparent'}`,
                borderRadius: 16,
                padding: 0,
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              aria-pressed={isActive}
            >
              <div
                style={{
                  width: '100%',
                  height: 78,
                  borderRadius: 14,
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #E8CFA8 0%, rgba(34,24,28,.18) 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 26,
                }}
              >
                {cover
                  ? <img src={cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span aria-hidden="true">{l.emoji || '📁'}</span>}
              </div>
              <div style={{ padding: '6px 4px 0' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {/* L'emoji nel nome solo quando la copertina è una foto: se
                      la lista è ancora vuota l'emoji è già grande lì sopra, e
                      ripeterla due volte in tre centimetri sembra un errore. */}
                  {cover && l.emoji ? `${l.emoji} ` : ''}{l.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-ink-55)', fontWeight: 600 }}>
                  {/* Un numero nudo non dice di cosa: "0" da solo si legge
                      come un errore, "vuota" come uno stato. */}
                  {countLabel((l.restaurantIds || []).length)}
                </div>
              </div>
            </button>
          )
        })}

        {/* Le tre liste pronte, finché nessuno le usa. Non sono cartelle
            vuote da riordinare: sono l'unico posto in cui si scopre che le
            liste esistono. Prima comparivano solo dentro il foglio che si
            apre al primo salvataggio, che si chiude con un tocco fuori e non
            torna mai più — chi lo saltava non aveva alcun modo di sapere
            di averlo saltato. */}
        {suggestions.map((sug) => {
          const on = hint === sug.name
          return (
            <button
              key={`sug-${sug.name}`}
              type="button"
              onClick={() => setHint(on ? null : sug.name)}
              aria-expanded={on}
              style={{
                flex: '0 0 auto',
                width: tileWidth,
                border: '2px solid transparent',
                borderRadius: 16,
                padding: 0,
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: 78,
                  borderRadius: 14,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 26,
                  // Tratteggiata e senza sfondo: si legge come "qui ci può
                  // andare qualcosa" invece che come una lista che hai già.
                  border: `1.5px dashed ${on ? 'var(--color-corallo)' : 'var(--color-ink-15, rgba(34,24,28,.15))'}`,
                  opacity: on ? 1 : .75,
                }}
              >
                <span aria-hidden="true">{sug.emoji}</span>
              </div>
              <div style={{ padding: '6px 4px 0' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--color-ink-70)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sug.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-ink-55)', fontWeight: 600 }}>
                  da usare
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {hint && (
        <p style={{ ...boxStyle, fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-ink-70)', margin: '0 0 14px' }}>
          &ldquo;{hint}&rdquo; nasce quando ci metti dentro il primo locale.
          Qui sotto, su un locale salvato, tocca <strong>Metti in una lista</strong>.
        </p>
      )}

      {canEdit && active && !editing && !confirming && (
        <div style={{ display: 'flex', gap: 16, paddingBottom: 12 }}>
          <MiniAction onClick={() => setEditing(active)}>Rinomina</MiniAction>
          <MiniAction onClick={() => setConfirming(active)} tone="danger">Elimina lista</MiniAction>
        </div>
      )}

      {canEdit && confirming && (
        <div style={boxStyle}>
          <strong style={{ display: 'block', fontSize: 14.5, marginBottom: 4 }}>
            Elimino “{confirming.name}”?
          </strong>
          {/* Detto esplicitamente perché è la paura che blocca il dito: la
              lista è un'etichetta, non una cartella, e toglierla non toglie
              niente da "tutti i salvati". */}
          <span style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-ink-70)' }}>
            I locali restano salvati: sparisce solo l&rsquo;etichetta.
          </span>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              type="button"
              style={{ ...pillStyle, background: 'var(--color-corallo)', color: '#fff' }}
              onClick={async () => {
                const id = confirming.id
                setConfirming(null)
                if (activeListId === id) onSelect(null)
                await onDelete(id)
              }}
            >Elimina</button>
            <button
              type="button"
              style={{ ...pillStyle, background: 'transparent', color: 'var(--color-ink-70)' }}
              onClick={() => setConfirming(null)}
            >Lascia stare</button>
          </div>
        </div>
      )}

      {canEdit && editing && (
        <ListEditor
          list={editing}
          onCancel={() => setEditing(null)}
          onSave={onRename}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * La riga in fondo alla card di un locale salvato: le liste in cui sta, e il
 * modo per cambiarle.
 *
 * Senza di lei le liste erano un vicolo cieco. Si sceglievano una volta sola,
 * nel foglio facoltativo che compare subito dopo il primo salvataggio; quel
 * foglio si chiude toccando fuori e non torna più, e da lì in avanti non
 * esisteva un punto in tutto il sito da cui rimettere mano alle liste di un
 * locale già salvato. Qui il punto c'è, ed è dove uno guarda i suoi
 * salvati.
 */
export function SavedListsFooter({ lists, restaurantId, restaurantName, onOpen }) {
  const dentro = (lists || []).filter((l) => (l.restaurantIds || []).includes(restaurantId))
  const vuoto = dentro.length === 0
  // Due etichette e poi un numero: le card stanno in griglia e prendono
  // l'altezza della più alta, quindi un locale in cinque liste alzerebbe
  // tutta la riga per far posto a nomi che nessuno sta leggendo.
  const mostrate = dentro.slice(0, 2)
  const altre = dentro.length - mostrate.length
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={vuoto ? `Metti ${restaurantName} in una lista` : `Cambia le liste di ${restaurantName}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
        width: '100%', marginTop: 8, paddingTop: 8, border: 'none',
        borderTop: '1px solid var(--color-ink-05)',
        background: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 11.5, fontWeight: 700, textAlign: 'left',
        color: vuoto ? 'var(--color-ink-55)' : 'var(--color-ink-70)',
      }}
    >
      {vuoto ? (
        <><span aria-hidden="true" style={{ fontSize: 13 }}>+</span> Metti in una lista</>
      ) : (
        mostrate.map((l) => (
          <span
            key={l.id}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: 'var(--color-ink-05)', borderRadius: 999, padding: '2px 7px',
              maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            <span aria-hidden="true">{l.emoji || '📁'}</span>{l.name}
          </span>
        ))
      )}
      {altre > 0 && <span>+{altre}</span>}
    </button>
  )
}

/* -------------------------------------------------------------------------- */

function countLabel(n) {
  if (n === 0) return 'vuota'
  return n === 1 ? '1 locale' : `${n} locali`
}

function ListEditor({ list, onCancel, onSave }) {
  const [name, setName] = useState(list.name)
  const [emoji, setEmoji] = useState(list.emoji || '📁')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await onSave(list.id, { name, emoji })
    setBusy(false)
    if (res?.ok) onCancel()
    else setError(res?.error || 'Non sono riuscito a salvare.')
  }

  return (
    <form onSubmit={submit} style={boxStyle}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--color-ink-70)', marginBottom: 6 }}>
        Nome della lista
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        style={{
          width: '100%', padding: '11px 13px', borderRadius: 12,
          border: '1px solid var(--color-ink-15, rgba(34,24,28,.15))',
          fontFamily: 'inherit', fontSize: 15, background: '#fff', color: 'var(--color-ink)',
        }}
      />
      <EmojiPicker value={emoji} onChange={setEmoji} />
      {error && (
        <p role="alert" style={{ fontSize: 13, color: 'var(--color-corallo)', margin: '10px 0 0' }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          style={{ ...pillStyle, background: 'var(--color-ink)', color: '#fff', opacity: busy || !name.trim() ? .5 : 1 }}
        >{busy ? 'Salvo…' : 'Salva'}</button>
        <button
          type="button"
          onClick={onCancel}
          style={{ ...pillStyle, background: 'transparent', color: 'var(--color-ink-70)' }}
        >Annulla</button>
      </div>
    </form>
  )
}

/** Il selettore di emoji, condiviso fra "rinomina" e "nuova lista". */
export function EmojiPicker({ value, onChange }) {
  return (
    <>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--color-ink-70)', margin: '12px 0 6px' }}>
        Scegli un&rsquo;icona
      </span>
      <div role="radiogroup" aria-label="Icona della lista" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {LIST_EMOJI.map((e) => {
          const on = value === e
          return (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Icona ${e}`}
              onClick={() => onChange(e)}
              style={{
                width: 38, height: 38, borderRadius: 11, fontSize: 19, lineHeight: 1,
                cursor: 'pointer',
                background: on ? 'var(--color-corallo-wash, #FDEDEB)' : '#fff',
                border: `1.5px solid ${on ? 'var(--color-corallo)' : 'var(--color-ink-10, rgba(34,24,28,.10))'}`,
              }}
            >{e}</button>
          )
        })}
      </div>
    </>
  )
}

function MiniAction({ children, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
        color: tone === 'danger' ? 'var(--color-corallo)' : 'var(--color-ink-70)',
        textDecoration: 'underline',
      }}
    >{children}</button>
  )
}

const boxStyle = {
  background: 'var(--color-cream, #F5F0E4)',
  borderRadius: 16,
  padding: '14px 16px',
  marginBottom: 14,
  maxWidth: 420,
}

const pillStyle = {
  padding: '10px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
}
