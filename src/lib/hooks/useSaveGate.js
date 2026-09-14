import { useState, useEffect, useCallback } from 'react'
import { setPendingSaveId, readAndClearPendingSaveId } from '../utils/pendingSave'

/**
 * Il cuore "salva" per chi non ha ancora un account.
 *
 * Senza questo, `toggleSave` esce subito quando manca l'utente: si tocca il
 * cuore e non succede niente — né il locale viene salvato, né si capisce che
 * serviva registrarsi. Il tocco sembra non essere nemmeno arrivato.
 *
 * Qui il tocco apre la porta a vetri (`<SaveAuthGate>`) e mette da parte il
 * locale; al rientro da registrazione o accesso viene salvato da solo, senza
 * dover ritrovare la card e ritoccare il cuore — una cosa che la persona
 * aveva già fatto.
 *
 * Sta in un hook e non copiato pagina per pagina perché le pagine che
 * mostrano un cuore sono sette, e finora ognuna faceva una cosa diversa:
 * chi apriva il gate, chi buttava su /login, chi non faceva niente.
 *
 * Uso:
 *   const { isSaved, toggleSave, addSave } = useSavedRestaurants(user?.id)
 *   const { saveGateFor, openSaveGate, closeSaveGate } = useSaveGate({ user, addSave })
 *   const handleSave = (id) => { if (!user) return openSaveGate(id); toggleSave(id) }
 *   ...
 *   {saveGateFor && <SaveAuthGate onClose={closeSaveGate} />}
 */
export function useSaveGate({ user, addSave }) {
  const [saveGateFor, setSaveGateFor] = useState(null)

  const openSaveGate = useCallback((restaurantId) => {
    // `|| true` così il gate si apre anche se chi chiama non ha un id sotto
    // mano: la registrazione va chiesta comunque, salterà solo il salvataggio
    // automatico al rientro.
    setPendingSaveId(restaurantId)
    setSaveGateFor(restaurantId || true)
  }, [])

  const closeSaveGate = useCallback(() => setSaveGateFor(null), [])

  // `addSave` e non `toggleSave`: chi ha toccato il cuore da sloggato ha
  // chiesto di salvare. Se nel frattempo il locale risultasse già salvato,
  // un toggle glielo toglierebbe — l'esatto contrario.
  useEffect(() => {
    if (!user?.id) return
    const id = readAndClearPendingSaveId()
    if (id) void addSave(id)
  }, [user?.id, addSave])

  return { saveGateFor, openSaveGate, closeSaveGate }
}
