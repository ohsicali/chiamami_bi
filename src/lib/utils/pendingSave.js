// Tiene da parte il locale che si stava salvando quando è comparsa la
// richiesta di registrarsi, e lo salva davvero al rientro.
//
// Senza, il giro finisce a metà: uno tocca il cuore, gli si chiede di
// registrarsi, si registra — e il locale che voleva salvare non è salvato.
// Il cuore andrebbe ritrovato e ritoccato, cioè rifare la cosa che aveva
// già fatto.
//
// `sessionStorage` e non `localStorage`: se la registrazione viene
// abbandonata, la richiesta muore con la scheda invece di risvegliarsi
// settimane dopo su un locale che nessuno ricorda di aver toccato.
const PENDING_KEY = 'chiamamibi_pending_save_id'

export function setPendingSaveId(id) {
  if (!id) return
  try { sessionStorage.setItem(PENDING_KEY, id) } catch { /* ignore */ }
}

export function readAndClearPendingSaveId() {
  try {
    const v = sessionStorage.getItem(PENDING_KEY)
    if (v) sessionStorage.removeItem(PENDING_KEY)
    return v || null
  } catch {
    return null
  }
}
