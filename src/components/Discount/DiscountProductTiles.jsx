import { proxyImg } from '../../lib/supabase'
import './DiscountProductTiles.css'

/**
 * DiscountProductTiles — la striscia di quadrati dentro il banner sconto
 * della scheda ristorante (proposta D3, `docs/mockups/v11-sconti-…html`).
 *
 * Stesso principio delle pastiglie in lista (`ProductDots` in
 * `SconteRedesignPage.jsx`) e della vetrina nello sheet dello sconto
 * (`ProductShowcase` in `DiscountRules.jsx`): mostra le foto vere quando
 * ci sono, non un numero. Qui però è solo un accenno dentro un banner che
 * parla d'altro, non la scheda dedicata: le caselle sono piccole e a
 * dimensione fissa (vedi il CSS) apposta — con 2 prodotti la riga deve
 * restare corta, non diventare due caselle enormi.
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
              // La casella è 42px CSS, ma su schermo retina/2-3x quei
              // pixel CSS ne servono 2-3 volte tanti: 42px di sorgente
              // uscirebbe sfocato su ogni telefono. 140px coprono anche il
              // 3x più spinto, a un peso trascurabile — un ritaglio
              // quadrato piccolo e compresso.
              src={proxyImg(p.photo, { w: 140 })}
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
