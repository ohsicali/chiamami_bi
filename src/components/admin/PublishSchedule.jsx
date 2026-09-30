import { toLocalInput, fromLocalInput, defaultPublishInput, formatPublishAt } from '../../lib/scheduledPublish'
import { ToggleRow } from './ui'

/**
 * "Quando esce?" — l'uscita di un locale ancora in bozza: subito (al tocco
 * su Pubblica) o a un giorno e un'ora precisi, e se in quel momento parte
 * l'email a tutti gli utenti.
 *
 * Sta in due posti della pagina Modifica ristorante, perché la prima
 * versione (due caselline grigie sotto l'intestazione) non la trovava
 * nessuno: in cima alla pagina, e nella sezione "Pubblicazione" dei
 * Dettagli, dov'è la spunta "Scheda pubblica". Stesso stato (`form`) in
 * tutti e due, quindi restano allineati.
 *
 * Campi del form: `schedule_on`, `publish_at` (valore datetime-local),
 * `notify_on_publish`, più `partner_email` e `verify_pin` per dire se al
 * locale arriva il PIN. La logica dell'uscita: src/lib/scheduledPublish.js
 * e api/_scheduled-publish.js.
 */
export default function PublishSchedule({ form, onChange, compact = false }) {
  const scheduled = !!form.schedule_on
  const whenLabel = formatPublishAt(fromLocalInput(form.publish_at))
  const emailOn = form.notify_on_publish !== false

  const choose = (on) =>
    onChange({
      schedule_on: on,
      publish_at: on && !form.publish_at ? defaultPublishInput() : form.publish_at,
    })

  return (
    <section
      aria-label="Quando esce"
      className={compact ? 'adm' : 'adm adm-card adm-card--cream'}
      style={{ marginTop: compact ? 0 : 14, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {!compact && (
        <div className="adm-card__head" style={{ marginBottom: 0 }}>
          <span className="adm-card__icon" style={{ background: '#fff' }} aria-hidden>⏰</span>
          <div>
            <h3 className="adm-card__title">Quando esce?</h3>
            <p className="adm-card__hint">Finché è in bozza non lo vede nessuno.</p>
          </div>
        </div>
      )}

      <div className="adm-choices" role="radiogroup" aria-label="Quando esce" style={{ '--cols': 2, '--cols-sm': 2 }}>
        <button type="button" role="radio" aria-checked={!scheduled} className="adm-choice" onClick={() => choose(false)}>
          <span className="adm-choice__check" aria-hidden>✓</span>
          <span className="adm-choice__emoji" aria-hidden>⚡</span>
          <span className="adm-choice__title">Subito</span>
          <span className="adm-choice__hint">quando premi Pubblica</span>
        </button>
        <button type="button" role="radio" aria-checked={scheduled} className="adm-choice" onClick={() => choose(true)}>
          <span className="adm-choice__check" aria-hidden>✓</span>
          <span className="adm-choice__emoji" aria-hidden>📅</span>
          <span className="adm-choice__title">Programma l'uscita</span>
          <span className="adm-choice__hint">scegli giorno e ora</span>
        </button>
      </div>

      {scheduled && (
        <div className="adm-field">
          <label className="adm-label" htmlFor="ps-when">Esce il</label>
          <input
            id="ps-when"
            className="adm-input"
            type="datetime-local"
            value={form.publish_at}
            min={toLocalInput(new Date().toISOString())}
            onChange={(e) => onChange({ publish_at: e.target.value })}
            style={{ maxWidth: 300 }}
          />
        </div>
      )}

      <ToggleRow
        icon="✉️"
        title="Email a tutti gli utenti quando esce"
        text={emailOn ? 'Parte una volta sola, all\'uscita' : 'Esce in silenzio, senza email'}
        checked={emailOn}
        onChange={(v) => onChange({ notify_on_publish: v })}
      />

      <p className="adm-help">
        {scheduled ? (
          <>
            Resta in bozza fino a <b style={{ color: 'var(--adm-ink)' }}>{whenLabel || '…'}</b>, poi va online da solo (entro 5
            minuti){emailOn ? ' e parte l\'email a tutti gli utenti' : ', senza email agli utenti'}
            {form.partner_email && form.verify_pin ? '; al locale arriva il suo PIN' : ''}. Premi{' '}
            <b style={{ color: 'var(--adm-ink)' }}>Programma</b> per confermare. Gli sconti programmati per lo stesso momento escono
            insieme a lui.
          </>
        ) : (
          <>
            Va online quando premi <b style={{ color: 'var(--adm-ink)' }}>Pubblica</b>
            {emailOn ? ', e in quel momento parte l\'email a tutti gli utenti' : ''}.
          </>
        )}
      </p>
    </section>
  )
}
