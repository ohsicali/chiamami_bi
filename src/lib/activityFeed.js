/**
 * Cronologia a pagine fatta di più tabelle (dashboard admin).
 *
 * Le attività stanno in tabelle diverse (riscatti, iscrizioni, candidature,
 * locali, sconti…) e ognuna ha la sua colonna di data. Per mostrarle tutte in
 * una lista sola, dalla più recente, e caricarle un pezzo alla volta mentre si
 * scende, si fa un merge a k vie: ogni fonte si scarica a blocchi già ordinati
 * dal più recente, e a ogni passo esce l'elemento più nuovo fra le teste dei
 * blocchi. Una fonte si riscarica solo quando il suo blocco si svuota, quindi
 * l'ordine resta giusto anche fra una pagina e l'altra.
 *
 * Sta fuori dall'hook e senza Supabase perché `tests/activity-feed.test.mjs`
 * la possa provare con fonti finte.
 *
 * Una fonte è { fetch(offset, limit) → Promise<righe>, toItem(riga) → item }
 * e un item è { key, type, at, text, … }. Le righe arrivano con offset
 * (`range()`): se nel frattempo ne entra una nuova in cima, la pagina dopo
 * ripete l'ultima vista — `key` serve a scartare il doppione.
 */

const ts = (iso) => (iso ? new Date(iso).getTime() : 0)

export function createActivityFeed(sources, { batch = 25, onError } = {}) {
  const state = sources.map((src) => ({ src, buf: [], offset: 0, done: false }))
  const seen = new Set()
  let pending = null

  async function fill(st) {
    if (st.buf.length || st.done) return
    try {
      const rows = (await st.src.fetch(st.offset, batch)) || []
      st.offset += rows.length
      if (rows.length < batch) st.done = true
      for (const row of rows) {
        const item = st.src.toItem(row)
        if (item) st.buf.push(item)
      }
    } catch (err) {
      // Una tabella che non risponde non deve fermare le altre: la si chiude
      // e la cronologia continua senza.
      st.done = true
      onError?.(err, st.src)
    }
  }

  async function take(n) {
    const out = []
    while (out.length < n) {
      await Promise.all(state.map(fill))
      let best = null
      for (const st of state) {
        if (!st.buf.length) continue
        if (!best || ts(st.buf[0].at) > ts(best.buf[0].at)) best = st
      }
      if (!best) break
      const item = best.buf.shift()
      if (seen.has(item.key)) continue
      seen.add(item.key)
      out.push(item)
    }
    return { items: out, done: isDone() }
  }

  function isDone() {
    return state.every((st) => st.done && !st.buf.length)
  }

  return {
    /** Le prossime `n` attività, dalla più recente. Chiamate in fila, mai sovrapposte. */
    next(n) {
      const run = (pending || Promise.resolve()).then(() => take(n))
      pending = run.catch(() => {})
      return run
    },
    isDone,
  }
}

/**
 * "Oggi", "Ieri", "lunedì 22 settembre" (con l'anno se non è quello di `now`).
 * Serve alle intestazioni di giorno delle cronologie lunghe, dove "3g fa"
 * ripetuto trenta volte non dice più niente.
 */
export function dayLabel(iso, now = Date.now()) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const diff = Math.round((today - day) / 86400000)
  if (diff === 0) return 'Oggi'
  if (diff === 1) return 'Ieri'
  const opts = { weekday: 'long', day: 'numeric', month: 'long' }
  if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric'
  const label = d.toLocaleDateString('it-IT', opts)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Chiave del giorno locale, per capire dove cambia l'intestazione. */
export function dayKey(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** "21:04" */
export function timeLabel(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}
