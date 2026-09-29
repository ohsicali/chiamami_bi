import { useId } from 'react'
import './BiCharacter.css'

/**
 * Bi, disegnata — la versione cartoon di public/bi-photo.webp.
 *
 * Tutta vettoriale, niente immagini: pesa meno di una foto, resta nitida a
 * qualsiasi misura e si anima a pezzi (capelli, occhi, bocca, braccio). I
 * tratti che la fanno riconoscere sono quelli della foto: capelli rame
 * lunghi e mossi con la riga in mezzo, lentiggini, orecchini d'oro, felpa
 * nera, il bao in mano con lo smalto rosso.
 *
 * `mood` cambia la faccia:
 *   idle  — sorriso chiuso, sbatte le palpebre (in attesa delle stelle)
 *   sad   — 1 stella: sopracciglia in su, bocca all'ingiù
 *   meh   — 2 stelle: bocca dritta
 *   ok    — 3 stelle: sorriso chiuso
 *   smile — 4 stelle: sorriso aperto
 *   love  — 5 stelle e il grazie finale: occhi a mezzaluna, come nella foto
 * `wave` alza il braccio libero e saluta; `hearts` fa salire i cuori
 * (`heartColor` bianco quando Bi sta sul corallo).
 *
 * Le animazioni sono CSS (BiCharacter.css), non Framer: girano sul
 * compositor anche mentre il resto della schermata si muove, e con "riduci
 * animazioni" si spengono tutte da un posto solo.
 */
export default function BiCharacter({
  mood = 'idle',
  wave = false,
  hearts = false,
  bao = true,
  heartColor = '#E8453C',
  className = '',
  style,
  title = 'Bi',
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const hairId = `bi-hair-${uid}`
  const skinId = `bi-skin-${uid}`
  const clipId = `bi-clip-${uid}`
  const happyEyes = mood === 'love'

  return (
    <svg
      viewBox="0 0 200 220"
      className={`bi-char bi-mood-${mood} ${wave ? 'is-waving' : ''} ${className}`}
      style={style}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={hairId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D9692F" />
          <stop offset="0.55" stopColor="#C2552A" />
          <stop offset="1" stopColor="#A2401F" />
        </linearGradient>
        <linearGradient id={skinId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBDDCA" />
          <stop offset="1" stopColor="#F4C7AD" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="-20" y="-20" width="240" height="240" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <g className="bi-breath">
          {/* Capelli dietro: la massa che scende oltre le spalle */}
          <path
            className="bi-hair-back"
            d="M100 20 C60 20 38 50 39 90 C40 110 32 124 34 142 C36 158 26 170 30 188 C33 202 28 212 32 224 L168 224 C172 212 167 202 170 188 C174 170 164 158 166 142 C168 124 160 110 161 90 C162 50 140 20 100 20 Z"
            fill={`url(#${hairId})`}
          />

          {/* Felpa */}
          <path d="M26 226 C26 188 56 164 100 164 C144 164 174 188 174 226 Z" fill="#22181C" />
          <path d="M60 196 C62 208 62 218 60 226 M140 196 C138 208 138 218 140 226" stroke="#2F2428" strokeWidth="2" fill="none" strokeLinecap="round" />

          {/* Collo e scollo */}
          <path d="M89 128 L111 128 L112 166 Q100 174 88 166 Z" fill="#EDB89D" />
          <path d="M88 136 Q100 146 112 136 L112 128 L88 128 Z" fill="#E3A98C" />
          <path d="M84 165.5 Q100 180 116 165.5" fill="none" stroke="#3B2E33" strokeWidth="5.5" strokeLinecap="round" />

          {/* Braccio che saluta (dietro ai capelli davanti, sopra la felpa) */}
          <g className="bi-arm">
            <path d="M44 214 C40 196 38 182 36 168" stroke="#22181C" strokeWidth="19" strokeLinecap="round" fill="none" />
            <g className="bi-forearm">
              <path d="M36 170 C33 156 31 146 30 136" stroke="#22181C" strokeWidth="16" strokeLinecap="round" fill="none" />
              <path d="M24.5 139 L36 136.5" stroke="#3B2E33" strokeWidth="5" strokeLinecap="round" />
              <g className="bi-hand">
                <ellipse cx="29" cy="124" rx="10" ry="11" fill="#F4C7AD" />
                <rect x="17.5" y="104" width="6" height="17" rx="3" fill="#F4C7AD" transform="rotate(-14 20 112)" />
                <rect x="23.5" y="100" width="6" height="18" rx="3" fill="#F4C7AD" transform="rotate(-5 26 110)" />
                <rect x="29.5" y="100.5" width="6" height="18" rx="3" fill="#F4C7AD" transform="rotate(5 32 110)" />
                <rect x="35" y="104.5" width="5.6" height="15" rx="2.8" fill="#F4C7AD" transform="rotate(15 38 112)" />
                <rect x="37" y="118" width="5.5" height="11" rx="2.75" fill="#EDB89D" transform="rotate(48 40 123)" />
              </g>
            </g>
          </g>

          {/* Orecchie e orecchini d'oro */}
          <ellipse cx="63.5" cy="98" rx="6" ry="9" fill="#F4C7AD" />
          <ellipse cx="136.5" cy="98" rx="6" ry="9" fill="#F4C7AD" />
          <g className="bi-earring">
            <circle cx="62.5" cy="112" r="4.2" fill="none" stroke="#C9A063" strokeWidth="1.9" />
          </g>
          <g className="bi-earring bi-earring-r">
            <circle cx="137.5" cy="112" r="4.2" fill="none" stroke="#C9A063" strokeWidth="1.9" />
          </g>

          {/* Faccia */}
          <path
            d="M100 50 C124 50 137 68 137 94 C137 121 121 139 100 139 C79 139 63 121 63 94 C63 68 76 50 100 50 Z"
            fill={`url(#${skinId})`}
          />
          {/* ombra dei capelli sulla fronte */}
          <path d="M70 72 C78 60 90 55 100 55 C110 55 122 60 130 72 C122 64 111 60 100 60 C89 60 78 64 70 72 Z" fill="#EDB89D" opacity=".7" />

          {/* Guance e lentiggini */}
          <ellipse className="bi-blush" cx="78" cy="111" rx="8.5" ry="4.8" fill="#F28676" />
          <ellipse className="bi-blush" cx="122" cy="111" rx="8.5" ry="4.8" fill="#F28676" />
          <g fill="#CF8460" opacity=".8">
            <circle cx="80" cy="105" r=".95" /><circle cx="84.5" cy="108" r=".8" /><circle cx="76.5" cy="108.5" r=".75" />
            <circle cx="88.5" cy="105.5" r=".7" /><circle cx="81.5" cy="110.5" r=".6" />
            <circle cx="120" cy="105" r=".95" /><circle cx="115.5" cy="108" r=".8" /><circle cx="123.5" cy="108.5" r=".75" />
            <circle cx="111.5" cy="105.5" r=".7" /><circle cx="118.5" cy="110.5" r=".6" />
            <circle cx="97" cy="104" r=".6" /><circle cx="103" cy="104" r=".6" /><circle cx="100" cy="106.5" r=".55" />
          </g>

          {/* Sopracciglia */}
          <g className="bi-brows">
            <path className="bi-brow bi-brow-l" d="M78.5 83.5 Q85 79.5 92 82" fill="none" stroke="#9A4522" strokeWidth="2.3" strokeLinecap="round" />
            <path className="bi-brow bi-brow-r" d="M121.5 83.5 Q115 79.5 108 82" fill="none" stroke="#9A4522" strokeWidth="2.3" strokeLinecap="round" />
          </g>

          {/* Occhi */}
          {happyEyes ? (
            <g className="bi-eyes-happy">
              <path d="M79.5 96.5 Q85.5 89.5 91.5 96.5" fill="none" stroke="#22181C" strokeWidth="2.7" strokeLinecap="round" />
              <path d="M108.5 96.5 Q114.5 89.5 120.5 96.5" fill="none" stroke="#22181C" strokeWidth="2.7" strokeLinecap="round" />
              <path d="M79.8 95.5 L76.8 93.5 M120.2 95.5 L123.2 93.5" stroke="#22181C" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          ) : (
            <g className="bi-eyes">
              <ellipse cx="85.5" cy="95" rx="4.3" ry="5.3" fill="#22181C" />
              <ellipse cx="114.5" cy="95" rx="4.3" ry="5.3" fill="#22181C" />
              <circle cx="87" cy="93" r="1.55" fill="#fff" />
              <circle cx="116" cy="93" r="1.55" fill="#fff" />
              <path d="M80.3 91.3 L77.6 89.4 M119.7 91.3 L122.4 89.4" stroke="#22181C" strokeWidth="1.4" strokeLinecap="round" />
            </g>
          )}

          {/* Naso */}
          <path d="M99.5 103 Q97.8 107.8 101 108.8" fill="none" stroke="#D38F73" strokeWidth="1.6" strokeLinecap="round" />

          {/* Bocca */}
          <Mouth key={mood} mood={mood} />

          {/* Capelli davanti: la riga in mezzo e le due bande sulla fronte */}
          <path
            d="M100 24 C123 24 143 42 143 77 C143 96 145 110 150 128 C139 120 134 104 132 88 C129 70 117 56 101.5 51 L100 49 L98.5 51 C83 56 71 70 68 88 C66 104 61 120 50 128 C55 110 57 96 57 77 C57 42 77 24 100 24 Z"
            fill={`url(#${hairId})`}
          />
          <path d="M98 29 C90 35 84 43 81 53" fill="none" stroke="#EE8C52" strokeWidth="2.6" strokeLinecap="round" opacity=".85" />
          <path d="M104 29 C117 33 129 43 134 60" fill="none" stroke="#EE8C52" strokeWidth="2.4" strokeLinecap="round" opacity=".7" />
          <path d="M66 58 C62 66 61 76 61 86" fill="none" stroke="#EE8C52" strokeWidth="2" strokeLinecap="round" opacity=".55" />

          {/* Ciocche mosse davanti alle spalle */}
          <g className="bi-lock bi-lock-l">
            <path
              d="M59 110 C49 126 58 140 50 156 C42 172 55 184 47 200 C44 208 48 218 52 224 L71 224 C66 212 71 202 68 191 C65 176 76 166 70 150 C66 138 73 124 70 112 Z"
              fill={`url(#${hairId})`}
            />
            <path d="M56 140 C53 150 55 160 51 170 M55 186 C52 196 54 206 56 214" fill="none" stroke="#EE8C52" strokeWidth="2" strokeLinecap="round" opacity=".65" />
          </g>
          <g className="bi-lock bi-lock-r">
            <path
              d="M141 110 C151 126 142 140 150 156 C158 172 145 184 153 200 C156 208 152 218 148 224 L129 224 C134 212 129 202 132 191 C135 176 124 166 130 150 C134 138 127 124 130 112 Z"
              fill={`url(#${hairId})`}
            />
            <path d="M144 140 C147 150 145 160 149 170 M145 186 C148 196 146 206 144 214" fill="none" stroke="#EE8C52" strokeWidth="2" strokeLinecap="round" opacity=".65" />
          </g>

          {/* Il bao, come nella foto */}
          {bao && (
            <g className="bi-bao">
              <path d="M152 226 C154 208 158 194 163 184" stroke="#22181C" strokeWidth="18" strokeLinecap="round" fill="none" />
              <path d="M155 187 L170.5 189.5" stroke="#3B2E33" strokeWidth="5" strokeLinecap="round" />
              <ellipse cx="166" cy="172" rx="10.5" ry="11" fill="#F4C7AD" />
              {/* pane sotto, ripieno, pane sopra */}
              <path d="M140 157 Q158 167 176 157 Q177 166 158 168 Q139 166 140 157 Z" fill="#F6ECDD" />
              <path d="M140.5 153.5 Q158 161 175.5 153.5 L176 157.5 Q158 165 140 157.5 Z" fill="#9E3A22" />
              <path d="M143 155.5 Q150 158.5 156 158.6" fill="none" stroke="#C4583A" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M140 154 Q141 138 158 137 Q175 138 176 154 Q158 160 140 154 Z" fill="#FFF9F0" />
              <path d="M147 143 Q155 139.5 164 141" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
              <path d="M142 153 Q158 158 174 153" fill="none" stroke="#E7D8C2" strokeWidth="1.2" />
              {/* dita con lo smalto, sul bordo del pane come nella foto */}
              <rect x="164.5" y="145" width="7" height="19" rx="3.5" fill="#F4C7AD" transform="rotate(-6 168 154)" />
              <rect x="171" y="148.5" width="6.6" height="17" rx="3.3" fill="#F4C7AD" transform="rotate(-14 174 157)" />
              <rect x="176" y="154" width="6" height="14" rx="3" fill="#EDB89D" transform="rotate(-24 179 161)" />
              <ellipse cx="167.5" cy="147.6" rx="2.6" ry="3" fill="#E8453C" transform="rotate(-6 167.5 147.6)" />
              <ellipse cx="174.4" cy="151.3" rx="2.4" ry="2.8" fill="#E8453C" transform="rotate(-14 174.4 151.3)" />
              <ellipse cx="179.6" cy="156.8" rx="2.2" ry="2.5" fill="#E8453C" transform="rotate(-24 179.6 156.8)" />
              <path d="M166 150.6 L169.6 150.2 M172.8 154.2 L176 153.4" stroke="#E3A98C" strokeWidth="0.9" strokeLinecap="round" />
            </g>
          )}
        </g>

        {hearts && (
          <g className="bi-hearts" aria-hidden="true">
            <Heart className="bi-heart bi-heart-1" x={150} y={62} s={1} fill={heartColor} />
            <Heart className="bi-heart bi-heart-2" x={168} y={96} s={0.7} fill={heartColor} />
            <Heart className="bi-heart bi-heart-3" x={34} y={70} s={0.8} fill={heartColor} />
            <Heart className="bi-heart bi-heart-4" x={176} y={44} s={0.55} fill={heartColor} />
          </g>
        )}
      </g>
    </svg>
  )
}

function Mouth({ mood }) {
  if (mood === 'sad') {
    return <path className="bi-mouth" d="M91 124 Q100 117.5 109 124" fill="none" stroke="#8A2424" strokeWidth="2.6" strokeLinecap="round" />
  }
  if (mood === 'meh') {
    return <path className="bi-mouth" d="M92 121.5 Q100 122.5 108 121" fill="none" stroke="#8A2424" strokeWidth="2.6" strokeLinecap="round" />
  }
  if (mood === 'ok' || mood === 'idle') {
    return <path className="bi-mouth" d="M89 118.5 Q100 128 111 118.5" fill="none" stroke="#8A2424" strokeWidth="2.7" strokeLinecap="round" />
  }
  // smile / love: sorriso aperto coi denti, come nella foto
  return (
    <g className="bi-mouth bi-mouth-open">
      <path d="M85.5 117 Q100 137 114.5 117 Q100 121.5 85.5 117 Z" fill="#8A2424" />
      <path d="M88 118.2 Q100 122.4 112 118.2 L111 121.3 Q100 124.8 89 121.3 Z" fill="#fff" />
      <path d="M93 127.5 Q100 123.8 107 127.5 Q100 131.6 93 127.5 Z" fill="#E8604F" />
    </g>
  )
}

function Heart({ x, y, s = 1, className, fill }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        className={className}
        d="M0 6 C-3 1 -11 1.5 -11 -5 C-11 -10 -5 -12 0 -7 C5 -12 11 -10 11 -5 C11 1.5 3 1 0 6 Z"
        fill={fill}
      />
    </g>
  )
}
