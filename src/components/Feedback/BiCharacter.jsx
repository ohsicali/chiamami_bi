import { useId } from 'react'
import './BiCharacter.css'

/**
 * Bi, disegnata — la versione cartoon delle sue foto (29/09, dalle cinque
 * foto mandate dal proprietario: il wrap in strada, gli spaghetti al tavolo,
 * la carbonara, la giacca nera, il selfie con la maglia a righe).
 *
 * Tutta vettoriale, niente immagini: pesa meno di una foto, resta nitida a
 * qualsiasi misura e si anima a pezzi (capelli, occhi, bocca, braccio). I
 * tratti che la fanno riconoscere sono quelli che tornano in tutte le foto:
 * capelli rame vivo con la riga in mezzo, lisci con le punte mosse; occhi
 * castani con la codina dell'eyeliner; tante lentiggini; labbra rosa;
 * orecchini d'oro; la collanina di perline colorate; la giacca nera sulla
 * maglia a righe blu e gialla; e la forchetta con gli spaghetti.
 *
 * `mood` cambia la faccia:
 *   idle  — sorriso chiuso, sbatte le palpebre (in attesa delle stelle)
 *   sad   — 1 stella: sopracciglia in su, bocca all'ingiù
 *   meh   — 2 stelle: bocca dritta
 *   ok    — 3 stelle: sorriso chiuso
 *   smile — 4 stelle: sorriso aperto
 *   love  — 5 stelle e il grazie finale: occhi che sorridono, come nella foto
 * `wave` alza il braccio libero e saluta; `hearts` fa salire i cuori
 * (`heartColor` bianco quando Bi sta sul corallo); `food` la forchetta
 * con gli spaghetti; `clap` le mani davanti al petto che applaudono (tre
 * battute e una pausa — per chi prende un drop, 30/09). Con `clap` la
 * forchetta non c'è: le mani servono tutte e due.
 *
 * Le animazioni sono CSS (BiCharacter.css), non Framer: girano sul
 * compositor anche mentre il resto della schermata si muove, e con "riduci
 * animazioni" si spengono tutte da un posto solo.
 */

const INK = '#22181C'
const SKIN_SHADE = '#EDB396'
const HAIR_LIGHT = '#F39A5E'
const BROW = '#5E2A19'
const LIP = '#D2677A'
const NAIL = '#F2B6AE'
const NAVY = '#27304A'
const BLAZER_EDGE = '#352A2F'

export default function BiCharacter({
  mood = 'idle',
  wave = false,
  hearts = false,
  food = true,
  clap = false,
  heartColor = '#E8453C',
  className = '',
  style,
  title = 'Bi',
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const hairId = `bi-hair-${uid}`
  const skinId = `bi-skin-${uid}`
  const coatId = `bi-coat-${uid}`
  const stripesId = `bi-stripes-${uid}`
  const clipId = `bi-clip-${uid}`
  const happyEyes = mood === 'love'

  return (
    <svg
      viewBox="0 0 200 220"
      className={`bi-char bi-mood-${mood} ${wave ? 'is-waving' : ''} ${clap ? 'is-clapping' : ''} ${className}`}
      style={style}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={hairId} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor="#DC6630" />
          <stop offset="0.5" stopColor="#C8542A" />
          <stop offset="1" stopColor="#A8431F" />
        </linearGradient>
        <linearGradient id={skinId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBDCC6" />
          <stop offset="1" stopColor="#F3C4A6" />
        </linearGradient>
        <linearGradient id={coatId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2B2025" />
          <stop offset="1" stopColor={INK} />
        </linearGradient>
        <pattern id={stripesId} width="8" height="5.2" patternUnits="userSpaceOnUse">
          <rect width="8" height="5.2" fill="#F1EBB6" />
          <rect width="8" height="2.4" fill={NAVY} />
        </pattern>
        <clipPath id={clipId}>
          <rect x="-20" y="-20" width="240" height="240" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <g className="bi-breath">
          {/* Capelli dietro: tanta massa, onde larghe fin sotto le spalle */}
          <path
            className="bi-hair-back"
            d="M100 18 C58 18 36 48 37 90 C38 108 30 120 32 138 C34 152 24 162 27 180 C30 196 22 208 28 224 L172 224 C178 208 170 196 173 180 C176 162 166 152 168 138 C170 120 162 108 163 90 C164 48 142 18 100 18 Z"
            fill={`url(#${hairId})`}
          />

          {/* Collo, collanina di perline */}
          <path d="M89 126 L111 126 L112.5 163 L87.5 163 Z" fill={SKIN_SHADE} />
          <path d="M89 132 Q100 142 111 132 L111 126 L89 126 Z" fill="#E4A688" />
          <g className="bi-choker">
            {[
              ['#F2C14E', 89.6, 146.2], ['#4E8FD8', 92.1, 147.3], ['#E8453C', 94.6, 148.1], ['#7CC46A', 97.2, 148.6],
              ['#F4EEE4', 99.8, 148.8], ['#E88BB0', 102.4, 148.6], ['#F2C14E', 105, 148.1], ['#4E8FD8', 107.6, 147.3], ['#F08A3C', 110.1, 146.2],
            ].map(([c, x, y]) => <circle key={x} cx={x} cy={y} r="1.35" fill={c} />)}
          </g>

          {/* Giacca nera, maglia a righe blu e gialla (un po' più su: collo corto) */}
          <g transform="translate(0 -7)">
          <path d="M24 236 L24 226 C24 190 54 166 100 166 C146 166 176 190 176 226 L176 236 Z" fill={`url(#${coatId})`} />
          <path d="M76 167 C86 171 94 173 100 173 C106 173 114 171 124 167 L113 236 L87 236 Z" fill={`url(#${stripesId})`} />
          <path d="M79.5 167.5 Q100 177 120.5 167.5" stroke={NAVY} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          {/* baveri */}
          <path d="M74 166 L92.5 236 L66 236 L55 181 Z" fill={BLAZER_EDGE} />
          <path d="M126 166 L107.5 236 L134 236 L145 181 Z" fill={BLAZER_EDGE} />
          <path d="M74 166 L92.5 236 M126 166 L107.5 236" stroke="#120C0F" strokeWidth="1.2" fill="none" />
          </g>

          {/* Braccio che saluta (dietro alle ciocche davanti, sopra il cappotto) */}
          <g className="bi-arm">
            <path d="M44 214 C40 196 38 182 36 168" stroke={INK} strokeWidth="19" strokeLinecap="round" fill="none" />
            <g className="bi-forearm">
              <path d="M36 170 C33 156 31 146 30 136" stroke={INK} strokeWidth="16" strokeLinecap="round" fill="none" />
              <path d="M23.5 139.5 L36.5 136.5" stroke={BLAZER_EDGE} strokeWidth="4" strokeLinecap="round" />
              <g className="bi-hand">
                <ellipse cx="29" cy="124" rx="10" ry="11" fill="#F3C4A6" />
                <rect x="17.5" y="104" width="6" height="17" rx="3" fill="#F3C4A6" transform="rotate(-14 20 112)" />
                <rect x="23.5" y="100" width="6" height="18" rx="3" fill="#F3C4A6" transform="rotate(-5 26 110)" />
                <rect x="29.5" y="100.5" width="6" height="18" rx="3" fill="#F3C4A6" transform="rotate(5 32 110)" />
                <rect x="35" y="104.5" width="5.6" height="15" rx="2.8" fill="#F3C4A6" transform="rotate(15 38 112)" />
                <rect x="37" y="118" width="5.5" height="11" rx="2.75" fill={SKIN_SHADE} transform="rotate(48 40 123)" />
                <g fill={NAIL}>
                  <ellipse cx="19.2" cy="105.2" rx="2.1" ry="2.6" transform="rotate(-14 19.2 105.2)" />
                  <ellipse cx="26.2" cy="101.6" rx="2.1" ry="2.6" transform="rotate(-5 26.2 101.6)" />
                  <ellipse cx="32.8" cy="102" rx="2.1" ry="2.6" transform="rotate(5 32.8 102)" />
                  <ellipse cx="38.9" cy="105.9" rx="2" ry="2.4" transform="rotate(15 38.9 105.9)" />
                </g>
              </g>
            </g>
          </g>

          {/* Le mani che applaudono: gomiti in giù, mani che si toccano
              davanti al petto. Ogni braccio ruota attorno alla sua spalla. */}
          {clap && (
            <g className="bi-clap">
              <g className="bi-clap-arm bi-clap-l">
                <path d="M34 238 C38 214 58 196 84 184" stroke={INK} strokeWidth="17" strokeLinecap="round" fill="none" />
                <path d="M80.5 178.5 L86.5 190.5" stroke={BLAZER_EDGE} strokeWidth="4" strokeLinecap="round" />
                <ellipse cx="93" cy="175" rx="7.6" ry="11.5" fill="#F3C4A6" transform="rotate(-18 93 175)" />
                <ellipse cx="96.6" cy="165.4" rx="2" ry="2.5" fill={NAIL} transform="rotate(-18 96.6 165.4)" />
              </g>
              <g className="bi-clap-arm bi-clap-r">
                <path d="M166 238 C162 214 142 196 116 184" stroke={INK} strokeWidth="17" strokeLinecap="round" fill="none" />
                <path d="M119.5 178.5 L113.5 190.5" stroke={BLAZER_EDGE} strokeWidth="4" strokeLinecap="round" />
                <ellipse cx="107" cy="175" rx="7.6" ry="11.5" fill={SKIN_SHADE} transform="rotate(18 107 175)" />
                <ellipse cx="103.4" cy="165.4" rx="2" ry="2.5" fill={NAIL} transform="rotate(18 103.4 165.4)" />
              </g>
              <g className="bi-clap-spark" stroke="#F2C14E" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M100 157 L100 149" />
                <path d="M90.5 159.5 L85.5 154" />
                <path d="M109.5 159.5 L114.5 154" />
              </g>
            </g>
          )}

          {/* Orecchie e orecchini d'oro a goccia */}
          <ellipse cx="63" cy="98" rx="6" ry="9" fill="#F3C4A6" />
          <ellipse cx="137" cy="98" rx="6" ry="9" fill="#F3C4A6" />
          <g className="bi-earring">
            <circle cx="62.5" cy="108.5" r="1.6" fill="#D4AC68" />
            <path d="M62.5 110 L62.5 113" stroke="#C9A063" strokeWidth="1.1" />
            <ellipse cx="62.5" cy="115.5" rx="2.2" ry="3" fill="#D4AC68" />
          </g>
          <g className="bi-earring bi-earring-r">
            <circle cx="137.5" cy="108.5" r="1.6" fill="#D4AC68" />
            <path d="M137.5 110 L137.5 113" stroke="#C9A063" strokeWidth="1.1" />
            <ellipse cx="137.5" cy="115.5" rx="2.2" ry="3" fill="#D4AC68" />
          </g>

          {/* Faccia */}
          <path
            d="M100 50 C125 50 138 68 138 95 C138 121 122 139 100 139 C78 139 62 121 62 95 C62 68 75 50 100 50 Z"
            fill={`url(#${skinId})`}
          />
          {/* ombra dei capelli sulla fronte */}
          <path d="M70 72 C78 60 90 55 100 55 C110 55 122 60 130 72 C122 64 111 60 100 60 C89 60 78 64 70 72 Z" fill={SKIN_SHADE} opacity=".7" />

          {/* Guance e lentiggini (leggere, come nelle foto) */}
          <ellipse className="bi-blush" cx="78" cy="111" rx="8.5" ry="4.6" fill="#F08576" />
          <ellipse className="bi-blush" cx="122" cy="111" rx="8.5" ry="4.6" fill="#F08576" />
          <g fill="#C27A58" opacity=".75">
            <circle cx="80.5" cy="104.5" r=".9" /><circle cx="85" cy="107.4" r=".75" /><circle cx="77" cy="107.6" r=".75" />
            <circle cx="88.6" cy="104.8" r=".65" /><circle cx="81.8" cy="110.4" r=".6" /><circle cx="74.6" cy="104.6" r=".6" />
            <circle cx="119.5" cy="104.5" r=".9" /><circle cx="115" cy="107.4" r=".75" /><circle cx="123" cy="107.6" r=".75" />
            <circle cx="111.4" cy="104.8" r=".65" /><circle cx="118.2" cy="110.4" r=".6" /><circle cx="125.4" cy="104.6" r=".6" />
            <circle cx="97.2" cy="103.2" r=".55" /><circle cx="102.8" cy="103.2" r=".55" /><circle cx="100" cy="105.6" r=".5" />
            <circle cx="95" cy="106.4" r=".45" /><circle cx="105" cy="106.4" r=".45" />
          </g>

          {/* Sopracciglia scure e piene */}
          <g className="bi-brows">
            <path className="bi-brow bi-brow-l" d="M77 82.5 Q84.5 77 93 80" fill="none" stroke={BROW} strokeWidth="3" strokeLinecap="round" />
            <path className="bi-brow bi-brow-r" d="M123 82.5 Q115.5 77 107 80" fill="none" stroke={BROW} strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* Occhi castani con la codina dell'eyeliner */}
          {happyEyes ? (
            <g className="bi-eyes-happy">
              <path d="M79.5 95.5 Q85.5 89.5 91.8 95" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
              <path d="M120.5 95.5 Q114.5 89.5 108.2 95" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
              <path d="M79.8 94.8 L75.8 92.6 M120.2 94.8 L124.2 92.6" stroke={INK} strokeWidth="1.9" strokeLinecap="round" />
            </g>
          ) : (
            <g className="bi-eyes">
              <path d="M78.8 96.4 Q85.6 88.6 92.6 95.4 Q85.8 101.4 78.8 96.4 Z" fill="#fff" />
              <path d="M121.2 96.4 Q114.4 88.6 107.4 95.4 Q114.2 101.4 121.2 96.4 Z" fill="#fff" />
              <circle cx="86" cy="95.6" r="4.3" fill="#6B3A22" />
              <circle cx="114" cy="95.6" r="4.3" fill="#6B3A22" />
              <circle cx="86" cy="95.6" r="2.2" fill={INK} />
              <circle cx="114" cy="95.6" r="2.2" fill={INK} />
              <circle cx="87.5" cy="94" r="1.3" fill="#fff" />
              <circle cx="115.5" cy="94" r="1.3" fill="#fff" />
              {/* palpebra con l'eyeliner e la codina */}
              <path d="M78.4 96.2 Q85.6 88 93 95 M78.6 96 L74.4 93.2" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M121.6 96.2 Q114.4 88 107 95 M121.4 96 L125.6 93.2" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}

          {/* Naso */}
          <path d="M99.5 102.5 Q97.6 107.8 101 108.8" fill="none" stroke="#D18B6F" strokeWidth="1.6" strokeLinecap="round" />

          {/* Bocca */}
          <Mouth key={mood} mood={mood} />

          {/* Capelli davanti: la riga in mezzo e le due bande che incorniciano il viso */}
          <path
            d="M100 22 C124 22 145 40 145 76 C145 96 147 110 153 130 C140 122 135 104 133 88 C130 70 117 56 101.5 51 L100 49 L98.5 51 C83 56 70 70 67 88 C65 104 60 122 47 130 C53 110 55 96 55 76 C55 40 76 22 100 22 Z"
            fill={`url(#${hairId})`}
          />
          <path d="M98 27 C90 33 83 42 80 53" fill="none" stroke={HAIR_LIGHT} strokeWidth="2.8" strokeLinecap="round" opacity=".8" />
          <path d="M104 27 C118 31 130 42 135 60" fill="none" stroke={HAIR_LIGHT} strokeWidth="2.5" strokeLinecap="round" opacity=".65" />
          <path d="M64 58 C60 66 59 76 59 88" fill="none" stroke={HAIR_LIGHT} strokeWidth="2" strokeLinecap="round" opacity=".5" />

          {/* Ciocche mosse davanti alle spalle, onde larghe */}
          <g className="bi-lock bi-lock-l">
            <path
              d="M58 108 C46 124 58 138 48 154 C38 170 54 182 44 198 C40 208 46 218 50 224 L72 224 C66 212 72 202 69 190 C66 176 78 166 71 150 C66 138 74 122 69 110 Z"
              fill={`url(#${hairId})`}
            />
            <path d="M55 138 C51 148 54 158 49 168 M53 186 C49 196 52 206 55 214" fill="none" stroke={HAIR_LIGHT} strokeWidth="2.2" strokeLinecap="round" opacity=".6" />
          </g>
          <g className="bi-lock bi-lock-r">
            <path
              d="M142 108 C154 124 142 138 152 154 C162 170 146 182 156 198 C160 208 154 218 150 224 L128 224 C134 212 128 202 131 190 C134 176 122 166 129 150 C134 138 126 122 131 110 Z"
              fill={`url(#${hairId})`}
            />
            <path d="M145 138 C149 148 146 158 151 168 M147 186 C151 196 148 206 145 214" fill="none" stroke={HAIR_LIGHT} strokeWidth="2.2" strokeLinecap="round" opacity=".6" />
          </g>

          {/* La forchetta con gli spaghetti, come nelle foto al tavolo */}
          {food && !clap && (
            <g className="bi-food">
              <path d="M150 226 C152 208 156 196 161 186" stroke={INK} strokeWidth="18" strokeLinecap="round" fill="none" />
              <path d="M153 188.5 L169 191.5" stroke={BLAZER_EDGE} strokeWidth="4" strokeLinecap="round" />
              {/* forchetta */}
              <path d="M164 184 L168.5 126" stroke="#C3C8D0" strokeWidth="3.2" strokeLinecap="round" />
              <path d="M166.8 128 L167.6 116 M169 128.2 L169.9 116.2 M171.2 128.4 L172.2 116.4 M164.6 127.8 L165.3 115.8" stroke="#C3C8D0" strokeWidth="1.3" strokeLinecap="round" />
              {/* gli spaghetti arrotolati e quelli che pendono */}
              <path d="M156 130 C154 121 162 116 169 117 C177 118 181 124 179 131 C177 138 160 139 156 130 Z" fill="#F2C14E" />
              <path d="M158 128 C162 123 172 121 177 126 M158.5 132 C164 128 172 127 178 131 M160 124.5 C165 120.5 172 120 175 122" stroke="#E0A231" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <path className="bi-strand" d="M160 135 C158 142 162 148 159 156" stroke="#F2C14E" strokeWidth="2.4" fill="none" strokeLinecap="round" />
              <path className="bi-strand bi-strand-2" d="M165 137 C164 144 167 150 165 160" stroke="#EDB53F" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <path className="bi-strand bi-strand-3" d="M172 136 C173 142 170 147 172 153" stroke="#F2C14E" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <rect x="170" y="121.5" width="4.4" height="3.6" rx="1.2" fill="#B5552F" transform="rotate(12 172 123)" />
              <rect x="159.5" y="127.5" width="4" height="3.4" rx="1.1" fill="#A94B2A" transform="rotate(-15 161.5 129)" />
              <g fill="#3B2D26"><circle cx="165" cy="123" r=".5" /><circle cx="175" cy="129" r=".5" /><circle cx="162" cy="132.5" r=".45" /><circle cx="170.5" cy="132" r=".45" /></g>
              {/* la mano davanti al manico */}
              <ellipse cx="163.5" cy="178" rx="10.5" ry="10.5" fill="#F3C4A6" />
              <rect x="158" y="164" width="16" height="6.6" rx="3.3" fill="#F3C4A6" />
              <rect x="158.5" y="169.8" width="16.5" height="6.4" rx="3.2" fill="#F3C4A6" />
              <rect x="159" y="175.6" width="15.5" height="6" rx="3" fill={SKIN_SHADE} />
              <ellipse cx="156.8" cy="170" rx="4" ry="7" fill="#F3C4A6" transform="rotate(-18 156.8 170)" />
              <ellipse cx="155.4" cy="164.2" rx="2" ry="2.3" fill={NAIL} />
            </g>
          )}
        </g>

        {hearts && (
          <g className="bi-hearts" aria-hidden="true">
            <Heart className="bi-heart bi-heart-1" x={152} y={60} s={1} fill={heartColor} />
            <Heart className="bi-heart bi-heart-2" x={170} y={100} s={0.7} fill={heartColor} />
            <Heart className="bi-heart bi-heart-3" x={32} y={70} s={0.8} fill={heartColor} />
            <Heart className="bi-heart bi-heart-4" x={178} y={40} s={0.55} fill={heartColor} />
          </g>
        )}
      </g>
    </svg>
  )
}

function Mouth({ mood }) {
  if (mood === 'sad') {
    return <path className="bi-mouth" d="M91.5 124 Q100 118 108.5 124" fill="none" stroke={LIP} strokeWidth="3" strokeLinecap="round" />
  }
  if (mood === 'meh') {
    return <path className="bi-mouth" d="M92 121.5 Q100 122.6 108 121" fill="none" stroke={LIP} strokeWidth="3" strokeLinecap="round" />
  }
  if (mood === 'ok' || mood === 'idle') {
    // Il sorriso a labbra chiuse della prima foto.
    return (
      <g className="bi-mouth">
        <path d="M88.5 117.5 Q100 121.2 111.5 117.5 Q100 128.5 88.5 117.5 Z" fill={LIP} />
        <path d="M88.5 117.5 Q100 122.6 111.5 117.5" fill="none" stroke="#A9465A" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M96 124.2 Q100 125.2 104 124.2" fill="none" stroke="#F6B3BE" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    )
  }
  // smile / love: sorriso aperto coi denti, come nella seconda foto
  return (
    <g className="bi-mouth bi-mouth-open">
      <path d="M85.5 116.5 Q100 136.5 114.5 116.5 Q100 121 85.5 116.5 Z" fill="#7E2230" stroke={LIP} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M88 117.8 Q100 122 112 117.8 L111 121 Q100 124.4 89 121 Z" fill="#fff" />
      <path d="M93 127 Q100 123.4 107 127 Q100 131 93 127 Z" fill="#E0607A" />
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
