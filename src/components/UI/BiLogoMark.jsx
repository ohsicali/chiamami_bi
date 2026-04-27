/**
 * BiLogoMark — wordmark "Bi" in Alfa Slab One leggermente ruotato.
 *
 * Inline SVG che usa `currentColor` per il fill: il colore lo controlli
 * via la prop `color` o tramite il CSS `color` del genitore. Comodo per
 * animare il colore e fare crossfade fra stati senza usare due asset.
 *
 * Coordinate prese da public/bi_logo_def_centrato.svg — il file è già
 * posizionato in modo che il glifo sia visivamente al centro del
 * canvas 1000x1000, quindi usiamo viewBox 0 0 1000 1000.
 */
export default function BiLogoMark({ style, className, title }) {
  return (
    <svg
      viewBox="0 0 1000 1000"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={style}
      className={className}
    >
      <text
        transform="matrix(0.984982 -0.172655 0.172655 0.984982 -78.912597 93.757615)"
        x="194.83"
        y="692"
        fontFamily='"Alfa Slab One", serif'
        fontSize="540"
        fill="currentColor"
      >
        Bi
      </text>
    </svg>
  )
}
