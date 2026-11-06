/**
 * Sito in manutenzione (06/11).
 *
 * Con `true` chi apre chiamamibi.com vede solo l'avviso "stiamo risolvendo
 * dei problemi tecnici": niente home, mappa, Bi Club, /verify, niente popup.
 * Restano aperte le pagine del pannello (/admin, /admin/login) e il ritorno
 * dal login (/auth/callback), così l'admin entra e — una volta riconosciuto
 * come admin — vede e prova tutto il sito come sempre.
 *
 * Per riaprire il sito a tutti basta rimetterlo a `false` e fare il deploy:
 * il resto del codice non va toccato.
 */
export const SITE_MAINTENANCE = true

// Pagine che restano raggiungibili da tutti anche in manutenzione: servono
// all'admin per entrare (il pannello controlla da sé chi è admin).
export function isMaintenanceExempt(pathname = '') {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/auth/callback'
}

/**
 * Il sito va coperto dall'avviso? Finché il profilo non è arrivato `isAdmin`
 * è false: l'admin vede l'avviso per un attimo, mai il contrario (un utente
 * qualunque che intravede il sito mentre il login si carica).
 */
export function isSiteLocked({ pathname, isAdmin, enabled = SITE_MAINTENANCE }) {
  if (!enabled) return false
  if (isAdmin) return false
  return !isMaintenanceExempt(pathname)
}
