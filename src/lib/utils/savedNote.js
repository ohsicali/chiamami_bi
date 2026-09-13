/**
 * La nota personale su un locale salvato: limite e normalizzazione.
 *
 * Sta in un file suo perché il numero 600 deve essere lo stesso in tre posti
 * che non si parlano: il vincolo CHECK su `saved_restaurants` (in
 * supabase/saved-notes-2026-09-13.sql), il campo dove si scrive e la funzione
 * che salva. Se i tre si scollano, il sintomo non è un avviso: è un salvataggio
 * che fallisce in silenzio dopo che la persona ha finito di scrivere.
 */

export const NOTE_MAX = 600

/**
 * Toglie gli spazi ai bordi e taglia alla lunghezza consentita.
 * Restituisce sempre una stringa: il `null` per il database lo decide chi
 * scrive, perché "nota cancellata" e "nota vuota" sono la stessa cosa solo lì.
 */
export function normalizeNote(text) {
  return String(text ?? '').trim().slice(0, NOTE_MAX)
}

/** Il valore da mandare a Postgres: `null` quando non c'è più niente. */
export function noteForDb(text) {
  return normalizeNote(text) || null
}
