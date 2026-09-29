/**
 * Uscita programmata di locali e sconti — il lato del pannello admin.
 *
 * Una riga con `publish_at` pieno è "programmata": resta nascosta
 * (`is_published` / `is_active` a false) e il giro ogni 5 minuti la mette
 * online all'ora scelta, mandando le email (api/_scheduled-publish.js,
 * SQL supabase/scheduled-publish-2026-09-29.sql). Qui solo quello che serve
 * al form: leggere e scrivere la data, controllarla, dirla in italiano.
 *
 * Sotto test in tests/scheduled-publish.test.mjs.
 */

const pad = (n) => String(n).padStart(2, '0')

/** ISO → valore per `<input type="datetime-local">`, nell'ora del browser. */
export function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Valore di `datetime-local` → ISO (o null se vuoto o non valido). */
export function fromLocalInput(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Il valore di default quando si accende "Programma": domani alle 18. */
export function defaultPublishInput(now = new Date()) {
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  d.setHours(18, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

/** Cosa non va nella data scelta, o null se va bene. */
export function publishAtError(value, now = new Date()) {
  const iso = fromLocalInput(value)
  if (!iso) return 'Scegli giorno e ora dell\'uscita.'
  if (new Date(iso).getTime() <= now.getTime()) return 'L\'uscita programmata deve essere nel futuro.'
  return null
}

/** "lun 5 ott, 18:00" — sempre all'ora di Roma, da qualunque browser. */
export function formatPublishAt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Rome' })
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
  return `${day}, ${time}`
}

/** La riga è programmata (e non ancora uscita)? */
export function isScheduled(row) {
  return !!row?.publish_at
}
