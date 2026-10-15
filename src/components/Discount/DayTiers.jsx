import { useEffect, useState } from 'react'
import { weekRuns, romeWeekday, todayTier, tierDeal } from '../../lib/dayTiers'
import { tierChips, formatDiscountBadge } from '../../lib/utils/discountFormat'
import './DayTiers.css'

/**
 * Lo sconto a fasce disegnato (15/10, regole in src/lib/dayTiers.js).
 *
 * La regola che tiene insieme tutte le forme: le cifre si dicono SEMPRE
 * tutte, quella di oggi accesa. Chi lunedì ha visto −30% e sabato trova
 * −15% deve averle lette tutte e due fin dall'inizio, se no pensa a un
 * trucco. Stessa grammatica delle regole dello sconto: il verde è ciò che
 * vale adesso, la crema è "non è il suo turno".
 *
 *   variant="week"   la settimana in fila, la cifra sopra ai suoi giorni:
 *                    dentro "Quando" (DiscountRules) e nell'anteprima del
 *                    pannello. È la risposta completa.
 *   variant="chips"  due pillole "−30% lun–gio" "−15% ven–dom · oggi": dove
 *                    c'è una riga sola (card del Bi Club, QR, barra della
 *                    scheda, /verify).
 *
 * `tone`: "light" su bianco/crema, "green" sopra il verde degli sconti
 * (barra della scheda del locale), "dark" sulla card scura della home.
 * Senza fasce non disegna niente: chi la monta non deve controllare prima.
 * `children` (solo "week") va fra la frase di oggi e la regola d'uso.
 */
export default function DayTiers({ deal, variant = 'chips', tone = 'light', className = '', style, now: nowProp, children = null }) {
  const now = useToday(nowProp)
  const chips = tierChips(deal, now)
  if (!chips.length) return null
  if (variant === 'week') return <TierWeek deal={deal} chips={chips} now={now} className={className}>{children}</TierWeek>

  const label = chips.map((c) => `${c.badge} ${c.daysLong}${c.today ? ', oggi' : ''}`).join('; ')
  return (
    <span className={`dtier-chips dtier--${tone} ${className}`.trim()} style={style} role="img" aria-label={`Sconto a fasce: ${label}`}>
      {chips.map((c) => (
        <span key={c.key} className={`dtier-chip ${c.today ? 'is-today' : ''}`} aria-hidden="true">
          <b>{c.badge}</b>
          <span>{c.daysShort}</span>
          {c.today && <i>oggi</i>}
        </span>
      ))}
    </span>
  )
}

const LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const DAY_FULL = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']

/**
 * La settimana in fila: un riquadro per ogni gruppo di giorni con la stessa
 * cifra, la cifra sopra e i giorni sotto. Il riquadro di oggi è verde, gli
 * altri crema; un giorno senza fascia (locale chiuso) resta vuoto a
 * tratteggio. Oggi ha il contorno, come la fila dei giorni di DiscountRules.
 */
function TierWeek({ deal, chips, now, className, children }) {
  const today = romeWeekday(now)
  const runs = weekRuns(deal)
  const current = todayTier(deal, now)
  const label = chips.map((c) => `${c.badge} ${c.daysLong}`).join(', ')

  return (
    <div className={`dtier-week-wrap ${className}`.trim()}>
      <div className="dtier-week" role="img" aria-label={`Quanto vale: ${label}. Oggi è ${DAY_FULL[(today || 1) - 1]}.`}>
        {runs.map((run) => {
          const isToday = !!run.tier && run.days.includes(today)
          const badge = run.tier ? formatDiscountBadge(tierDeal(deal, run.tier), now) : ''
          return (
            <div
              key={run.start}
              className={`dtier-run ${run.tier ? '' : 'is-off'} ${isToday ? 'is-today' : ''} ${run.days.length === 1 ? 'is-single' : ''}`}
              style={{ gridColumn: `${run.start} / ${run.end + 1}`, '--dtier-n': run.days.length }}
              aria-hidden="true"
            >
              <span className="dtier-run-val">{badge || '—'}</span>
              <span className="dtier-run-days">
                {run.days.map((d) => (
                  <span key={d} className={`dtier-run-day ${d === today ? 'is-now' : ''}`}>{LETTERS[d - 1]}</span>
                ))}
              </span>
            </div>
          )
        })}
      </div>
      <p className="dtier-line">
        {current ? (
          <><strong>Oggi {formatDiscountBadge(tierDeal(deal, current), now)}</strong>{chips.filter((c) => !c.today).map((c) => ` · ${c.badge} ${c.daysLong}`).join('')}</>
        ) : (
          <><strong>Oggi non vale</strong>{chips.map((c) => ` · ${c.badge} ${c.daysLong}`).join('')}</>
        )}
      </p>
      {/* Chi la monta può aggiungere una riga (l'orario, in DiscountRules)
          fra la frase di oggi e la regola d'uso. */}
      {children}
      <p className="dtier-note">Si usa una volta: alla cassa vale la cifra del giorno in cui lo usi.</p>
    </div>
  )
}

/**
 * "Oggi" cambia a mezzanotte (di Roma): chi tiene aperta la pagina da
 * giovedì sera a venerdì mattina deve vedere passare la fascia. Un controllo
 * al minuto basta, e ridisegna solo se il giorno è cambiato.
 */
function useToday(nowProp) {
  const [now, setNow] = useState(() => nowProp || new Date())
  useEffect(() => {
    if (nowProp) return undefined
    const id = setInterval(() => {
      setNow((prev) => {
        const next = new Date()
        return romeWeekday(next) === romeWeekday(prev) ? prev : next
      })
    }, 60_000)
    return () => clearInterval(id)
  }, [nowProp])
  return nowProp || now
}
