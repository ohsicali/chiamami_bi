import { useMemo } from 'react'
import { proxyImg } from '../../lib/supabase'
import {
  formatSlots,
  effectiveValidDays,
  todayDayOfWeek,
  DAY_SHORT_LABELS,
  MEAL_SLOTS,
} from '../../lib/validity'
import { normalizeProducts } from '../../lib/utils/discountProducts'
import './DiscountRules.css'

/**
 * DiscountRules — la scheda che risponde alle tre domande dello sconto:
 * su COSA vale, QUANDO vale, e cos'altro c'è da sapere.
 *
 * Nasce da com'erano messe le cose prima: il vantaggio era una riga di testo
 * sopra la foto del bancone, e tutte le regole finivano schiacciate in una
 * riga «Da sapere» in corpo 11 — «Valido solo a cena dal Lunedì al Giovedì
 * escluso asporto». Tre informazioni diverse (quando, quali giorni, quale
 * eccezione) in una frase sola che nessuno legge fino in fondo.
 *
 * Qui diventano tre blocchi con tre forme diverse:
 *   - VALE SU   → le foto dei prodotti coperti (`discount_products`)
 *   - QUANDO    → i sette giorni come pastiglie, quelli buoni accesi
 *   - DA SAPERE → le condizioni, una per riga
 *
 * Ogni blocco compare solo se ha qualcosa da dire. Uno sconto senza prodotti,
 * senza giorni e senza condizioni non mostra la scheda affatto: resta come
 * era prima, che è il caso della maggior parte degli sconti già a catalogo.
 *
 * Il verde è riservato a ciò che è valido — è lo stesso `--gradient-sconto`
 * delle pillole percentuale, non un secondo verde.
 */
export default function DiscountRules({ deal, products, className = '' }) {
  const items = useMemo(() => normalizeProducts(products ?? deal?.products), [products, deal])

  const days = effectiveValidDays(deal)
  const hasDayLimit = days.length > 0 && days.length < 7
  const slots = Array.isArray(deal?.valid_meal_slots) ? deal.valid_meal_slots : []
  const hasWindow = !!(deal?.valid_time_from && deal?.valid_time_to) || slots.length > 0
  const showWhen = hasDayLimit || hasWindow

  const conditionLines = splitConditions(deal?.conditions)
  const showConditions = conditionLines.length > 0

  if (items.length === 0 && !showWhen && !showConditions) return null

  return (
    <section className={`dr ${className}`.trim()} aria-label="Regole dello sconto">
      {items.length > 0 && (
        <div className="dr-block">
          <h3 className="dr-eyebrow">Lo sconto vale su</h3>
          <ProductShowcase items={items} />
        </div>
      )}

      {showWhen && (
        <div className="dr-block">
          <h3 className="dr-eyebrow">Quando</h3>
          {/* La fila dei sette giorni esce solo se qualche giorno è escluso.
              Senza limiti sarebbero sette pastiglie verdi tutte uguali: un
              disegno che sembra una regola ma non ne dice nessuna, e in più
              riempie di verde un blocco che parla d'altro. "Tutti i giorni"
              scritto in due parole è più corto e più chiaro. */}
          {hasDayLimit && <DayStrip days={days} />}
          <WindowLine deal={deal} slots={slots} allDays={!hasDayLimit} />
        </div>
      )}

      {showConditions && (
        <div className="dr-block">
          <h3 className="dr-eyebrow">Da sapere</h3>
          <ul className="dr-conds">
            {conditionLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/* ============================================================================
   VALE SU — le foto dei prodotti
   ============================================================================ */

/**
 * La griglia si sceglie in base a quanti prodotti ci sono, e la regola è
 * sempre la stessa: nessuna riga a metà. Con 3 prodotti tre colonne, con 4
 * due colonne per due righe, da 5 in su una striscia che scorre — dove
 * l'ultima tessera tagliata è essa stessa l'invito a scorrere.
 */
function ProductShowcase({ items }) {
  const n = items.length
  const variant = n === 1 ? 'solo' : n === 2 ? 'duo' : n === 3 ? 'trio' : n === 4 ? 'quad' : 'strip'
  // Nella striscia la foto è piccola e fissa; nelle griglie segue la colonna.
  const width = variant === 'strip' ? 260 : variant === 'solo' ? 900 : 480

  return (
    <div className={`dr-prods dr-prods--${variant}`}>
      {items.map((p) => (
        <figure className="dr-prod" key={p.key}>
          <div className="dr-prod-ph">
            {p.photo ? (
              <img
                src={proxyImg(p.photo, { w: width })}
                alt=""
                loading="lazy"
                decoding="async"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <span className="dr-prod-fallback" aria-hidden="true">🍽️</span>
            )}
          </div>
          <figcaption className="dr-prod-txt">
            <span className="dr-prod-name">{p.name}</span>
            {p.note && <span className="dr-prod-note">{p.note}</span>}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

/* ============================================================================
   QUANDO — i sette giorni
   ============================================================================ */

function DayStrip({ days }) {
  const today = todayDayOfWeek()
  const label = days.length === 7
    ? 'Valido tutti i giorni'
    : `Valido ${days.map((d) => DAY_FULL[d - 1]).join(', ')}`

  return (
    <div className="dr-days" role="img" aria-label={label}>
      {DAY_SHORT_LABELS.map((letter, i) => {
        const dow = i + 1
        const on = days.includes(dow)
        return (
          <span
            key={dow}
            className={`dr-day ${on ? 'is-on' : 'is-off'} ${dow === today ? 'is-today' : ''}`}
            aria-hidden="true"
          >
            {letter}
          </span>
        )
      })}
    </div>
  )
}

const DAY_FULL = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']

function WindowLine({ deal, slots, allDays }) {
  const detail = windowDetail(deal, slots)
  if (!allDays && !detail) return <p className="dr-when">A qualsiasi ora di apertura</p>
  return (
    <p className="dr-when">
      {allDays && <strong>Tutti i giorni</strong>}
      {allDays && detail && ' · '}
      {detail}
    </p>
  )
}

/** Il pezzo che dice a che ora, o null se lo sconto non guarda l'orologio. */
function windowDetail(deal, slots) {
  // L'orario esplicito vince sulla fascia: se il locale ha scritto
  // 19:00–23:00 è quello che il cliente deve leggere, non «Cena».
  if (deal?.valid_time_from && deal?.valid_time_to) {
    return <>Dalle <strong>{deal.valid_time_from.slice(0, 5)}</strong> alle <strong>{deal.valid_time_to.slice(0, 5)}</strong></>
  }
  if (slots.length > 0) {
    // L'orario in chiaro solo con una fascia sola. Con due, "Pranzo · Cena"
    // diventerebbe "12:00 – 23:30", che promette anche le quattro ore di
    // pomeriggio in cui lo sconto non vale.
    const single = slots.length === 1 ? MEAL_SLOTS[slots[0]] : null
    return (
      <>
        <strong>{formatSlots(slots)}</strong>
        {single && <span className="dr-when-range"> · {single.from} – {single.to}</span>}
      </>
    )
  }
  return null
}

/* ============================================================================
   Normalizzazione
   ============================================================================ */

/**
 * Le condizioni sono un campo libero e chi le scrive separa come gli viene:
 * a capo, punto elenco, o punto e virgola. Tre separatori, una lista sola.
 * Il punto fermo NON è un separatore — "min. 2 persone" si spezzerebbe.
 */
function splitConditions(conditions) {
  if (!conditions) return []
  return String(conditions)
    .split(/\n+|·|•|;/g)
    .map((s) => s.trim().replace(/^[-–—]\s*/, ''))
    .filter(Boolean)
}
