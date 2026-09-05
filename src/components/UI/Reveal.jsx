import { motion, useReducedMotion } from 'framer-motion'
import { REVEAL_VIEWPORT, TR_REVEAL, riseFrom, staggerDelay } from '../../lib/motion'

/**
 * Reveal — una sezione che entra quando arriva a schermo.
 *
 * Perché esiste: la home era completamente ferma. Non è decorazione —
 * il feed carica i dati in modo asincrono e le sezioni comparivano di
 * colpo a caricamento finito ("preventing a jarring change"). Con
 * l'entrata il salto diventa un arrivo.
 *
 * Vincoli che rispetta:
 *  · `once: true` — si vede scendendo, non risale scrollando su e giù.
 *    Una sezione che rientra ogni volta diventa rumore.
 *  · solo transform + opacity, niente layout.
 *  · con "riduci movimento" resta la dissolvenza, sparisce lo spostamento.
 *  · `index` sfalsa gli elementi di una griglia di 50ms l'uno dall'altro.
 *
 * @param {number} index  posizione nella lista, per lo stagger
 * @param {number} y      quanto sale entrando (14px default)
 * @param {string} as     tag da renderizzare (div, section, li…)
 */
export default function Reveal({
  children,
  index = 0,
  y = 14,
  delay = 0,
  as = 'div',
  className = '',
  style,
  ...rest
}) {
  const reduce = useReducedMotion()
  const Tag = motion[as] || motion.div
  // Stringa `transform` e non la scorciatoia `y`: queste entrate partono
  // mentre la home carica le foto e l'utente scrolla, cioè col thread
  // principale occupato — la scorciatoia perderebbe frame lì.
  const rise = riseFrom(y, reduce)

  return (
    <Tag
      className={className}
      style={style}
      initial={rise.from}
      whileInView={rise.to}
      viewport={REVEAL_VIEWPORT}
      transition={{ ...TR_REVEAL, delay: delay + staggerDelay(index) }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
