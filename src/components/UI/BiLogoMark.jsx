/**
 * BiLogoMark — wordmark "Bi" in Alfa Slab One leggermente ruotato.
 *
 * Inline SVG che usa `currentColor` per il fill: il colore lo controlli
 * via la prop `color` o tramite il CSS `color` del genitore. Comodo per
 * animare il colore e fare crossfade fra stati senza usare due asset.
 *
 * viewBox è ritagliato sul glifo (rotato -10°, traslato), per minimizzare
 * il whitespace intorno e far riempire bene il container quando renderizzi
 * a width/height 100%.
 */
export default function BiLogoMark({ style, className, title }) {
  return (
    <svg
      viewBox="170 130 690 670"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={style}
      className={className}
    >
      <text
        transform="matrix(0.984982 -0.172655 0.172655 0.984982 -82.538356 94.072986)"
        x="194.83"
        y="713"
        fontFamily='"Alfa Slab One", serif'
        fontSize="540"
        fill="currentColor"
      >
        Bi
      </text>
    </svg>
  )
}
