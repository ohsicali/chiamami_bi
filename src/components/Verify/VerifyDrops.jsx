import { dropPeopleNotes, dropPeopleSummary } from '../../lib/dropStats'
import './VerifyDrops.css'

/**
 * I numeri di un drop nella card corallo di /verify (12/10): posti presi con
 * la barra, poi usati / da usare / in lista / persi, e due righe su come
 * funziona. I dati arrivano da `useVerifyDrops` (lib/hooks/useVerifyDrops.js);
 * le parole sono le stesse dell'admin (src/lib/dropStats.js).
 */
export function DropPeople({ item }) {
  const s = dropPeopleSummary(item)
  if (!s) return null
  const notes = dropPeopleNotes(s)
  const tiles = [
    { k: 'used', n: s.used, label: s.used === 1 ? 'usato alla cassa' : 'usati alla cassa' },
    { k: 'touse', n: s.toUse, label: 'da usare' },
    ...(s.windowed ? [{ k: 'wait', n: s.waiting, label: 'in lista d’attesa', hot: s.waiting > 0 }] : []),
    ...(s.windowed ? [{ k: 'lost', n: s.lost, label: s.lost === 1 ? 'perso (tempo scaduto)' : 'persi (tempo scaduto)' }] : []),
  ]
  return (
    <div className="vdrop">
      <div className="vdrop-head">
        <span>Persone che l’hanno preso</span>
        <span>
          <b>{s.taken}</b>
          {s.total ? <> / {s.total}</> : null}
        </span>
      </div>
      {s.total && (
        <div className="vdrop-track" role="progressbar" aria-valuenow={s.taken} aria-valuemin={0} aria-valuemax={s.total}>
          <i style={{ width: `${s.pct}%` }} />
        </div>
      )}
      <div className="vdrop-foot">
        {s.soldOut
          ? <span className="vdrop-sold">Sold out · tutti i posti sono presi</span>
          : s.total
            ? <span>{s.free === 1 ? '1 posto ancora libero' : `${s.free} posti ancora liberi`}</span>
            : <span>Senza limite di posti</span>}
      </div>

      <div className={`vdrop-tiles vdrop-tiles--${tiles.length}`}>
        {tiles.map((t) => (
          <div key={t.k} className={`vdrop-tile ${t.hot ? 'is-hot' : ''}`}>
            <b>{t.n}</b>
            <span>{t.label}</span>
          </div>
        ))}
      </div>

      {notes.length > 0 && (
        <ul className="vdrop-notes">
          {notes.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
    </div>
  )
}
