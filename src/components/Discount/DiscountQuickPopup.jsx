import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import QRCode from 'qrcode'
import ShortCodeCard from './ShortCodeCard'
import DiscountRules from './DiscountRules'
import { formatDiscountBadge, formatDiscountValue } from '../../lib/utils/discountFormat'

/**
 * DiscountQuickPopup — il popup dello sconto sulla pagina del locale.
 *
 * Stessa cornice pulita del vecchio QRCodeDisplay (overlay scuro, card
 * bianca centrata, spring all'apertura) — quella era già "pulita e
 * premium" di suo, non andava sostituita. Quello che cambiava era il
 * bottone: prima "Sblocca" creava il riscatto e mostrava subito il QR,
 * senza dire prima di cosa si trattava. Ora c'è un passaggio in mezzo:
 * il bottone dice "Scopri di più", apre lo stesso popup sulle info dello
 * sconto, e solo da lì "Sblocca sconto" passa al QR — nella stessa card,
 * senza chiuderla e aprirne un'altra.
 *
 * Le stesse info di `DiscountDetailPopup` (Bi Club) — foto prodotto,
 * giorni e fasce valide, condizioni — tramite `DiscountRules`, la
 * componente già costruita per quella pagina. La differenza è solo la
 * cornice: qui niente foto grande del locale in testa, perché chi apre
 * questo popup è già sulla pagina del locale e la foto ce l'ha intorno.
 *
 * Terzo stato, oltre a info/QR: `blockedMessage`. Se lo sconto non è
 * valido ORA (giorno o fascia sbagliati) non si passa mai al QR — si
 * vede questo invece, stessa regola già in vigore ovunque nell'app
 * (`QRBlockedView`, il claim su /sconti).
 *
 * Bottoni a pillola (non `rounded-xl`): stessa forma del banner sopra
 * ("Scopri di più"/"Usa sconto") e di `DiscountDetailPopup` su /sconti —
 * i tre punti in cui si sblocca uno sconto sull'app hanno lo stesso
 * bottone, non tre bottoni diversi.
 */
function QRCanvas({ value, size = 210 }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current || !value) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#1A1A1A', light: '#FFFFFF' },
    })
  }, [value, size])
  return <canvas ref={canvasRef} style={{ width: size, height: size }} />
}

export default function DiscountQuickPopup({
  deal,
  initialUnlocked = false,
  initialRedemption = null, // { qr_code, short_code } se già sbloccato
  claiming = false,
  // Testo pronto quando lo sconto non è valido ORA (giorno o fascia
  // sbagliati): il chiamante lo calcola (stessa logica di `QRBlockedView` e
  // `DiscountDetailPopup`) e lo passa qui — se presente si vede questo al
  // posto delle info o del QR, il riscatto resta comunque salvato.
  blockedMessage = null,
  onClaim,   // async: ritorna { id, qr_code, short_code } | null (blocco/auth gate)
  onClose,
}) {
  const [unlocked, setUnlocked] = useState(initialUnlocked)
  const [redemption, setRedemption] = useState(initialRedemption)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleUnlock() {
    if (claiming) return
    const result = await onClaim?.()
    if (result?.id) {
      setRedemption(result)
      setUnlocked(true)
    }
  }

  const badge = formatDiscountBadge(deal)
  const valueLabel = formatDiscountValue(deal)
  const description = deal?.description && deal.description !== deal.title ? deal.description : null
  const verifyUrl = redemption?.qr_code ? `${window.location.origin}/verify?code=${redemption.qr_code}` : null

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="mx-4 w-full max-w-md rounded-3xl bg-white p-6 shadow-xl overflow-y-auto"
        style={{ maxHeight: '85vh' }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
      >
        {blockedMessage ? (
          <>
            {/* BLOCCO — sconto non valido ora: stesso il riscatto (se già
                creato) resta salvato, ma niente QR fuori finestra. */}
            <div className="text-center mb-5">
              <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 8 }}>🔒</div>
              <h3 className="text-lg font-bold text-primary" style={{ fontFamily: 'var(--font-sans)', fontWeight: 800 }}>
                Non è ancora il momento
              </h3>
              <p className="text-sm text-secondary mt-1.5" style={{ lineHeight: 1.5 }}>{blockedMessage}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white"
            >
              Chiudi
            </button>
          </>
        ) : !unlocked ? (
          <>
            {/* INFO — cosa c'è dietro "Scopri di più" */}
            <div className="text-center mb-5">
              {badge && (
                <span style={{
                  display: 'inline-block', background: 'var(--gradient-sconto)',
                  color: 'var(--color-sconto-ink, #1A4731)', fontWeight: 800, fontSize: 20,
                  padding: '6px 18px', borderRadius: 14, letterSpacing: '-0.01em',
                }}>
                  {badge}
                </span>
              )}
              <h3 className="text-lg font-bold text-primary" style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, marginTop: 10 }}>
                {deal?.title || valueLabel}
              </h3>
              {description && (
                <p className="text-sm text-secondary mt-1.5" style={{ lineHeight: 1.5 }}>{description}</p>
              )}
            </div>

            {/* Su cosa vale, quando, cos'altro c'è da sapere — invisibile
                da sé se lo sconto non ha niente di questo da dire
                (DiscountRules non renderizza nulla in quel caso). */}
            <DiscountRules deal={deal} className="mb-5" />

            <motion.button
              onClick={handleUnlock}
              disabled={claiming}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
              whileTap={{ scale: 0.97 }}
            >
              {claiming ? 'Sblocco…' : '🔓 Sblocca sconto'}
            </motion.button>
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-2 py-2 text-sm text-secondary"
            >
              Chiudi
            </button>
          </>
        ) : (
          <>
            {/* QR — stesso contenuto di prima, invariato */}
            <div className="text-center mb-5">
              <h3 className="text-lg font-bold text-primary" style={{ fontFamily: 'var(--font-sans)', fontWeight: 800 }}>
                Il tuo sconto
              </h3>
              <p className="text-accent font-bold text-xl mt-1">{badge}</p>
              {deal?.title && deal.title !== valueLabel && (
                <p className="text-sm text-secondary mt-0.5">{deal.title}</p>
              )}
            </div>

            <div className="flex justify-center mb-4 rounded-2xl bg-white p-4">
              {verifyUrl ? <QRCanvas value={verifyUrl} size={210} /> : <div className="text-sm text-secondary">Genero QR…</div>}
            </div>

            <div className="rounded-xl bg-accent-light p-3 mb-2">
              <p className="text-xs text-center text-secondary leading-relaxed">
                Mostra questo QR al cameriere. Verrà scansionato con la fotocamera del telefono per validare lo sconto.
              </p>
            </div>

            <div className="mb-5">
              <ShortCodeCard code={redemption?.short_code} />
            </div>

            <motion.button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white"
              whileTap={{ scale: 0.97 }}
            >
              Chiudi
            </motion.button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
