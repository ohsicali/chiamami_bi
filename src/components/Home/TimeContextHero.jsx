import { useEffect, useState } from 'react'
import { getCurrentMoment, MOMENT_SLOTS, MOMENT_QUESTIONS } from '../../lib/hours'

/**
 * Il "momento" — il blocco che apre la home (Blocco 2).
 *
 * Sfondo scuro con un alone corallo, tag temporale, orologio, la domanda
 * contestuale e quanti locali sono aperti adesso.
 *
 * Perché apre lui e non il drop: chi apre l'app di sera cerca un posto, non
 * uno sconto. Il momento risponde alla domanda vera; il drop arriva subito
 * dopo, quando la persona è già dentro, e così guadagna impatto invece di
 * sembrare pubblicità in apertura.
 *
 * Sta scuro perché il ritmo della home è scuro → bianco → corallo (il drop)
 * → bianco: sono i due soli blocchi a colore pieno sopra la piega, e da soli
 * si prendono l'occhio senza bisogno di ingrandire nulla.
 *
 * Compatto per necessità, non per gusto: se questo blocco cresce, il drop
 * scende sotto la piega su uno schermo da 390px e non lo vede più nessuno.
 */
export default function TimeContextHero({ activeMomentKey, openCount, city = 'Torino' }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const { active, next } = getCurrentMoment(now)
  const momentKey = activeMomentKey || active || next
  const slot = MOMENT_SLOTS[momentKey]
  const question = active ? MOMENT_QUESTIONS[active] : MOMENT_QUESTIONS.none

  // Rende solo il contenuto: la card scura è il contenitore in HomeFeedV4,
  // perché deve contenere anche le chip (nel mockup stanno dentro `.moment`).
  return (
    <>
      {/* Ordine del mockup: tag, poi l'orologio SOTTO, poi la domanda.
          L'orologio non sta a destra del tag — è il numero grande che apre il
          blocco, e messo di fianco al tag perde quel ruolo. */}
      {slot && (
        <p className="hfv4-moment-tag">
          <i aria-hidden />
          {slot.label} · {city}
        </p>
      )}

      <time className="hfv4-moment-clock" dateTime={time}>{time}</time>

      <p className="hfv4-moment-q">{question}</p>

      {/* Il numero è vero: conta i locali che risultano aperti in questa
          fascia. Se è 0 non lo scriviamo — "0 locali aperti adesso" è una
          riga che allontana, non una che informa. */}
      {openCount > 0 && (
        <p className="hfv4-moment-sub">
          {openCount} {openCount === 1 ? 'locale aperto' : 'locali aperti'} adesso, {openCount === 1 ? 'scelto' : 'scelti'} da me
        </p>
      )}
    </>
  )
}
