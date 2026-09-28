/**
 * Logica pura dietro `useAdminRedemptions`: come un evento realtime cambia
 * la mappa dei riscatti, e come da quella mappa escono i contatori per card,
 * il riepilogo di oggi e il feed. Sta fuori dall'hook (e senza import di
 * Supabase) perché `tests/redemptions-live.test.mjs` la possa provare.
 *
 * - "preso"      = una riga in `discount_redemptions` (QR/codice generato)
 * - "utilizzato" = la stessa riga passata a `status = 'redeemed'`
 */

export const FEED_SIZE = 40

const ts = (iso) => (iso ? new Date(iso).getTime() : 0)

function startOfDay(t) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Applica un payload `postgres_changes` alla mappa id → riga (la modifica
 * sul posto). Restituisce cosa è cambiato, o null se niente:
 *   { kind: 'taken' | 'used', id, discount_id } → da evidenziare
 *   { kind: 'delete' | 'status' }               → basta ricalcolare
 */
export function applyRedemptionChange(rows, payload) {
  if (payload.eventType === 'DELETE') {
    // Con REPLICA IDENTITY di default `old` porta solo la chiave primaria.
    const id = payload.old?.id
    if (id && rows.delete(id)) return { kind: 'delete' }
    return null
  }
  const row = payload.new
  if (!row?.id) return null
  const prev = rows.get(row.id)
  rows.set(row.id, { ...prev, ...row })
  if (!prev) {
    // Una riga nuova può essere già 'redeemed' se l'INSERT è andato perso
    // durante una riconnessione: conta come presa e utilizzata.
    return row.status === 'redeemed'
      ? { kind: 'used', id: row.id, discount_id: row.discount_id }
      : { kind: 'taken', id: row.id, discount_id: row.discount_id }
  }
  if (row.status === 'redeemed' && prev.status !== 'redeemed') {
    return { kind: 'used', id: row.id, discount_id: row.discount_id }
  }
  return prev.status !== row.status ? { kind: 'status' } : null
}

/**
 * Dalla mappa dei riscatti:
 *   byDiscount → { [discount_id]: { taken, used } }
 *   today      → { taken, used } dalla mezzanotte locale di `now`
 *   events     → feed, dal più recente, al massimo FEED_SIZE
 *   usedEvents → solo le convalide, dal più recente, al massimo FEED_SIZE
 *
 * Le convalide hanno una lista loro perché nel feed misto annegano: il
 * 28/09 si prendevano ~240 sconti al giorno e se ne usavano 6, e i quattro
 * QR scansionati da Shoro in serata erano già fuori dagli ultimi 40 eventi
 * mezz'ora dopo — per l'admin non esistevano.
 */
export function deriveRedemptionStats(rows, now) {
  const byDiscount = {}
  const today = { taken: 0, used: 0 }
  const events = []
  const usedEvents = []
  const dayStart = startOfDay(now)
  for (const r of rows.values()) {
    const c = byDiscount[r.discount_id] || (byDiscount[r.discount_id] = { taken: 0, used: 0 })
    c.taken += 1
    if (ts(r.generated_at) >= dayStart) today.taken += 1
    events.push({ key: `taken:${r.id}`, kind: 'taken', at: r.generated_at, row: r })
    if (r.status === 'redeemed') {
      c.used += 1
      if (ts(r.redeemed_at) >= dayStart) today.used += 1
      const ev = { key: `used:${r.id}`, kind: 'used', at: r.redeemed_at || r.generated_at, row: r }
      events.push(ev)
      usedEvents.push(ev)
    }
  }
  const newestFirst = (a, b) => ts(b.at) - ts(a.at)
  events.sort(newestFirst)
  usedEvents.sort(newestFirst)
  return {
    byDiscount,
    today,
    events: events.slice(0, FEED_SIZE),
    usedEvents: usedEvents.slice(0, FEED_SIZE),
  }
}
