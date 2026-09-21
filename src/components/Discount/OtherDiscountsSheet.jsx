import { motion } from 'framer-motion'
import { formatDiscountBadge } from '../../lib/utils/discountFormat'

/**
 * OtherDiscountsSheet — elenco degli altri sconti attivi dello stesso
 * locale, quando ce n'è più di uno.
 *
 * La scheda del locale mostra sempre UN sconto in primo piano (barra
 * fissa mobile, banner/pillola desktop): qui c'è il resto, raggiungibile
 * col tag "+N altri" — niente sparisce, semplicemente non tutto sta nello
 * stesso riquadro. Selezionare una riga porta quello sconto in primo
 * piano al posto di chi c'era prima.
 */
export default function OtherDiscountsSheet({ discounts, onSelect, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[70vh] overflow-y-auto rounded-3xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-base font-bold text-primary"
            style={{ fontFamily: 'var(--font-sans)', fontWeight: 800 }}
          >
            Altri sconti di questo locale
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="text-secondary text-2xl leading-none px-1"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {discounts.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d)}
              className="w-full flex items-center justify-between gap-3 rounded-2xl bg-accent-light px-4 py-3 text-left"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-primary truncate">
                  {d.title || formatDiscountBadge(d)}
                </span>
                {d.description && (
                  <span className="block text-xs text-secondary truncate mt-0.5">{d.description}</span>
                )}
              </span>
              <span className="flex-shrink-0 text-accent font-bold text-sm">{formatDiscountBadge(d)}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
