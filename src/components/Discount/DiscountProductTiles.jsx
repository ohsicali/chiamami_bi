import { proxyImg } from '../../lib/supabase'
import './DiscountProductTiles.css'

/**
 * DiscountProductTiles — la striscia di quadrati dentro il banner sconto
 * della scheda ristorante (proposta D3, `docs/mockups/v11-sconti-…html`).
 *
 * Stesso principio delle pastiglie in lista (`ProductDots` in
 * `SconteRedesignPage.jsx`) e della vetrina nello sheet dello sconto
 * (`ProductShowcase` in `DiscountRules.jsx`): mostra le foto vere quando
 * ci sono, non un numero. Qui però il contenitore è largo e basso — il
 * banner del locale, non una scheda dedicata — quindi la forma è una riga
 * di quadrati pari, non una griglia.
 *
 * Massimo 4 caselle: con più di 4 prodotti le prime 3 sono foto e la
 * quarta diventa "+N", così la riga non si allunga mai oltre la larghezza
 * del banner né si stringe a francobolli illeggibili.
 */
const MAX_TILES = 4

export default function DiscountProductTiles({ items, className = '' }) {
  if (!Array.isArray(items) || items.length === 0) return null

  const hasOverflow = items.length > MAX_TILES
  const visible = hasOverflow ? items.slice(0, MAX_TILES - 1) : items.slice(0, MAX_TILES)
  const restCount = items.length - visible.length

  return (
    <div className={`dpt-row ${className}`.trim()} role="list" aria-label="Prodotti coperti dallo sconto">
      {visible.map((p) => (
        <div className="dpt-tile" role="listitem" key={p.key}>
          {p.photo ? (
            <img
              src={proxyImg(p.photo, { w: 160 })}
              alt=""
              loading="lazy"
              decoding="async"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <span className="dpt-fallback" aria-hidden="true">🍽️</span>
          )}
        </div>
      ))}
      {hasOverflow && (
        <div className="dpt-tile dpt-more" aria-hidden="true">+{restCount}</div>
      )}
    </div>
  )
}
