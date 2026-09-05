/**
 * motion.js — le costanti di movimento del sito, lato JS.
 *
 * Gemello di `src/styles/globals.css` (token `--ease-*` / `--dur-*`):
 * stesse curve, stesse durate. Prima di questo file ogni componente si
 * inventava la sua curva — c'erano tre "ease-out" diversi, un
 * easeInOutQuad usato per le entrate (sbagliato: un'entrata vuole
 * ease-out) e durate da 150ms a 500ms senza un criterio.
 *
 * Regole che stanno dietro ai valori qui sotto:
 *  · chi entra o esce → ease-out. Mai ease-in su un elemento di UI:
 *    parte lento proprio nell'istante in cui l'utente sta guardando.
 *  · chi si sposta sullo schermo → ease-in-out.
 *  · la UI sta sotto i 300ms. Sopra sembra lenta anche se è "elegante".
 *  · le molle servono dove c'è velocità da trasportare (drag, gesti,
 *    cose interrompibili), non come decorazione.
 */

// ── Curve ──────────────────────────────────────────────────────────
// Le easing native del browser sono troppo deboli per essere notate.
export const EASE_OUT = [0.23, 1, 0.32, 1]        // entrate/uscite
export const EASE_IN_OUT = [0.77, 0, 0.175, 1]    // spostamenti sullo schermo
export const EASE_DRAWER = [0.32, 0.72, 0, 1]     // curva sheet iOS (Ionic)

// ── Durate (secondi, per Framer) ───────────────────────────────────
export const DUR = {
  press: 0.12,   // feedback al tap
  pop: 0.18,     // tooltip, pill, popover piccoli
  menu: 0.22,    // dropdown, select, chip
  reveal: 0.28,  // entrata di card e sezioni
  sheet: 0.32,   // bottom sheet, modali, drawer
}

// ── Molle ──────────────────────────────────────────────────────────
// Sintassi duration/bounce: più leggibile di stiffness/damping e con
// bounce basso (0.1–0.3) resta UI, non giocattolo.
export const SPRING_SNAP = { type: 'spring', duration: 0.32, bounce: 0.12 }
export const SPRING_SOFT = { type: 'spring', duration: 0.45, bounce: 0.2 }
export const SPRING_DRAWER = { type: 'spring', duration: 0.42, bounce: 0 }

// ── Transizioni pronte ─────────────────────────────────────────────
export const TR_POP = { duration: DUR.pop, ease: EASE_OUT }
export const TR_MENU = { duration: DUR.menu, ease: EASE_OUT }
export const TR_REVEAL = { duration: DUR.reveal, ease: EASE_OUT }
export const TR_SHEET = { duration: DUR.sheet, ease: EASE_DRAWER }

/**
 * Stagger: 30–80ms fra un elemento e il successivo. Meno non si legge,
 * più e l'ultimo elemento arriva quando l'utente ha già smesso di
 * guardare. Il tetto serve alle liste lunghe: la decima card non deve
 * aspettare mezzo secondo.
 */
export const STAGGER = 0.05
export function staggerDelay(index, step = STAGGER, cap = 0.24) {
  return Math.min(index * step, cap)
}

/**
 * fadeUp — l'entrata standard: sale di poco e si accende.
 * `reduce` arriva da useReducedMotion(): chi ha chiesto meno movimento
 * ottiene la sola dissolvenza, non l'assenza di animazione.
 */
export function fadeUp(reduce = false, distance = 14) {
  return {
    hidden: { opacity: 0, y: reduce ? 0 : distance },
    visible: { opacity: 1, y: 0, transition: TR_REVEAL },
  }
}

/** Contenitore che sfalsa i figli in `hidden`/`visible`. */
export function staggerParent(step = STAGGER, delayChildren = 0) {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: step, delayChildren } },
  }
}

/** Viewport condiviso per gli ingressi allo scroll: una volta sola,
 *  e fatti partire quando l'elemento è entrato per davvero (non al
 *  primo pixel), altrimenti l'animazione finisce fuori campo. */
export const REVEAL_VIEWPORT = { once: true, amount: 0.15, margin: '0px 0px -10% 0px' }
