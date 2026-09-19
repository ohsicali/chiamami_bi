import { proxyImg } from '../../lib/supabase'
import './DiscountProductTiles.css'

/**
 * DiscountProductTiles — la striscia di quadrati dentro il banner sconto
 * della scheda ristorante (proposta D3, `docs/mockups/v11-sconti-…html`).
 *
 * Stesso principio delle pastiglie in lista (`ProductDots` in
 * `SconteRedesignPage.jsx`) e della vetrina nello sheet dello sconto
 * (`ProductShowcase` in `DiscountRules.jsx`): mostra le foto vere quando
 * ci sono, non un numero. Qui però il contenitore è un banner che parla
 * d'altro, non la scheda dedicata: le caselle riempiono la riga quando i
 * prodotti sono 3-4, ma un `max-width` (vedi il CSS) ferma la crescita
 * quando sono 1-2 — restano alla stessa dimensione, non diventano due
 * quadrati enormi.
 *
 * Massimo 4 caselle: con più di 4 prodotti le prime 3 sono foto e la
 * quarta diventa "+N", così non si stringe a francobolli illeggibili.
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
              // La casella arriva fino a 180px CSS (il `max-width` nel
              // CSS): su schermo retina/2-3x quei pixel CSS ne servono
              // 2-3 volte tanti, quindi 180px di sorgente uscirebbe
              // sfocato. 560px coprono anche il 3x più spinto, a un peso
              // comunque contenuto — un ritaglio quadrato compresso.
              src={proxyImg(p.photo, { w: 560 })}
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
