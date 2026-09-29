import { toLocalInput, fromLocalInput, defaultPublishInput, formatPublishAt } from '../../lib/scheduledPublish'

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
  const muted = 'var(--color-ink-55, rgba(34,24,28,0.55))'
  const ink = 'var(--color-ink, #22181C)'
  const scheduled = !!form.schedule_on
  const whenLabel = formatPublishAt(fromLocalInput(form.publish_at))

  const choose = (on) =>
    onChange({
      schedule_on: on,
      publish_at: on && !form.publish_at ? defaultPublishInput() : form.publish_at,
    })

  const choice = (active) => ({
    flex: 1,
    minWidth: 0,
    padding: '10px 12px',
    borderRadius: 12,
    border: active ? `1.5px solid ${ink}` : '1px solid var(--color-line, #EAE3D7)',
    background: active ? ink : '#fff',
    color: active ? '#fff' : ink,
    fontSize: 13,
    fontWeight: 800,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    lineHeight: 1.25,
  })

  return (
    <section
      aria-label="Quando esce"
      style={{
        marginTop: compact ? 0 : 14,
        padding: compact ? 0 : '14px 16px',
        background: compact ? 'transparent' : 'var(--color-cream, #F5F0E4)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 720,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {!compact && (
        <div style={{ fontSize: 14, fontWeight: 900, color: ink, letterSpacing: '-0.01em' }}>
          ⏰ Quando esce?
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => choose(false)} aria-pressed={!scheduled} style={choice(!scheduled)}>
          <span>Subito</span>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75 }}>quando premi Pubblica</span>
        </button>
        <button type="button" onClick={() => choose(true)} aria-pressed={scheduled} style={choice(scheduled)}>
          <span>Programma l'uscita</span>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75 }}>scegli giorno e ora</span>
        </button>
      </div>

      {scheduled && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: ink }}>
          Esce il
          <input
            type="datetime-local"
            value={form.publish_at}
            min={toLocalInput(new Date().toISOString())}
            onChange={(e) => onChange({ publish_at: e.target.value })}
            style={{
              fontSize: 15,
              fontFamily: 'var(--font-sans)',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--color-line, #EAE3D7)',
              background: '#fff',
              color: ink,
              maxWidth: 280,
            }}
          />
        </label>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: ink, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={form.notify_on_publish !== false}
          onChange={(e) => onChange({ notify_on_publish: e.target.checked })}
          style={{ accentColor: 'var(--color-corallo, #E8453C)', width: 16, height: 16 }}
        />
        Manda l'email a tutti gli utenti quando esce
      </label>

      <p style={{ fontSize: 12, color: muted, margin: 0, lineHeight: 1.45 }}>
        {scheduled ? (
          <>
            Resta in bozza fino a <b style={{ color: ink }}>{whenLabel || '…'}</b>, poi va online da solo (entro 5
            minuti){form.notify_on_publish !== false ? ' e parte l\'email a tutti gli utenti' : ', senza email agli utenti'}
            {form.partner_email && form.verify_pin ? '; al locale arriva il suo PIN' : ''}. Premi{' '}
            <b style={{ color: ink }}>Programma</b> per confermare. Gli sconti programmati per lo stesso momento escono
            insieme a lui.
          </>
        ) : (
          <>
            Va online quando premi <b style={{ color: ink }}>Pubblica</b>
            {form.notify_on_publish !== false ? ', e in quel momento parte l\'email a tutti gli utenti' : ''}.
          </>
        )}
      </p>
    </section>
  )
}
