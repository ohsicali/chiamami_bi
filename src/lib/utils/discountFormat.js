// Single source of truth for rendering discount values across the app.
// `discount_value` is stored as free-text (admin can type "5", "5€", "10%",
// "-5€", " 5 € ") and `discount_type` drives the unit. We strip any pre-existing
// unit/sign from the raw value and reapply the canonical symbol so we never
// emit garbage like "5€%" when the type and value disagree.
//
// Discount types:
//   percentage    → "10%"             (% off the bill)
//   fixed         → "5€"              (€ amount off the bill)
//   freebie       → title             (something free / convention)
//   special_price → title || "5€"     (item sold at a fixed price)
//
// Sconto a fasce (`day_tiers`, 15/10 — src/lib/dayTiers.js): il valore è
// quello di oggi a Roma, o della prossima fascia se oggi non vale. Così ogni
// badge del sito (pin, card, QR, email) dice la cifra che si trova alla
// cassa oggi; le fasce tutte insieme le dicono `tierChips` / `formatTierSummary`.

import {
  dayTiers, dealToday, tierDeal, currentTier, todayTier, tierDaysShort, tierDaysLong,
} from '../dayTiers.js'

function cleanNumeric(raw) {
  return String(raw ?? '').replace(/[%€\s]/g, '').replace(/^[-−]/, '').trim()
}

export function formatDiscountValue(deal, now = new Date()) {
  if (!deal) return ''
  if (deal.day_tiers) deal = dealToday(deal, now)
  const raw = String(deal.discount_value ?? '').trim()
  const v = cleanNumeric(raw)
  if (deal.discount_type === 'special_price') {
    if (deal.title) return deal.title
    if (v) return `${v}€`
    return raw
  }
  if (deal.discount_type === 'freebie') return deal.title || raw
  if (!raw) return deal.title || ''
  if (!v) return deal.title || raw
  if (deal.discount_type === 'percentage') return `${v}%`
  if (deal.discount_type === 'fixed') return `${v}€`
  return raw
}

// Italian context word that precedes the discount label.
// e.g., "Aperitivo | sconto 10%" vs "Tramezzini | offerta Tramezzino a 5€".
export function discountContextWord(deal) {
  if (!deal) return 'sconto'
  if (deal.discount_type === 'freebie') return 'convenzione'
  if (deal.discount_type === 'special_price') return 'offerta'
  return 'sconto'
}


/**
 * L'etichetta del badge: il valore secco col segno meno davanti ("−50%").
 *
 * Il valore grezzo sul DB è scritto a mano dall'admin e a volte il segno ce
 * l'ha già ("-10%"): comporre il badge a mano con `-{valore}%` produceva
 * "--10%%". Qui il segno e l'unità li mette `formatDiscountValue`, una volta
 * sola.
 */
export function formatDiscountBadge(deal, now = new Date()) {
  const v = formatDiscountValue(deal, now)
  if (!v) return ''
  return isBareDiscountValue(v) ? `−${v}` : v
}

/**
 * Come sopra, ma per i badge piccoli (francobollo sull'angolo di una foto,
 * riga di lista): lì ci sta un valore, non un titolo. Per omaggi e prezzi
 * speciali `formatDiscountValue` restituisce il titolo della promo ("Paghi 2
 * prendi 3 Veneziane"), che a quelle misure esce dalla card.
 */
export function formatDiscountBadgeShort(deal, now = new Date()) {
  const v = formatDiscountValue(deal, now)
  if (!v) return ''
  return isBareDiscountValue(v) ? `−${v}` : 'OFFERTA'
}

/** "50%", "8€", "5,50€" — un valore e basta, non una frase. */
export function isBareDiscountValue(v) {
  return /^\d+([.,]\d+)?\s*[%€]$/.test(String(v || '').trim())
}


/**
 * Il vantaggio in chiaro: quello che si legge in mezzo secondo.
 *
 * Stava dentro DropCard, ma lo usano anche le email: se le due copie
 * divergono, la card del sito e la ricevuta nella posta raccontano due cose
 * diverse dello stesso sconto. Qui ce n'è una sola.
 *
 * Non guarda MAI `conditions`: quello è il vincolo, non il premio.
 */
export function pickPerk(deal, valueLabel = formatDiscountValue(deal)) {
  if (!deal) return ''
  const title = String(deal.title || '').trim()
  const description = String(deal.description || '').trim()

  // Omaggi e prezzi speciali: il titolo È il vantaggio, parola per parola
  // ("Paghi 2 prendi 3 Veneziane"). Non c'è niente da comporre.
  if (deal.discount_type === 'freebie' || deal.discount_type === 'special_price') {
    return title || description || valueLabel || ''
  }

  // Il titolo, quando dice qualcosa in più del valore secco.
  if (title && normalizeValue(title) !== normalizeValue(valueLabel)) return title
  if (description) return description

  // Sul DB metà dei titoli sono la percentuale e basta ("50%"): lì il
  // vantaggio va scritto in parole, altrimenti resta solo nel badge.
  if (valueLabel) return `${valueLabel} di sconto`
  return ''
}

export function normalizeValue(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}


/* ── Sconto a fasce ─────────────────────────────────────────────────────── */

/**
 * Le fasce pronte da mostrare, in ordine di giorno: badge ("−30%"), giorni
 * corti ("lun–gio") e lunghi ("dal lunedì al giovedì"), e quale è la fascia
 * di oggi (`today`) o, se oggi non vale, quella che arriva (`current`).
 * Vuoto per uno sconto normale.
 */
export function tierChips(deal, now = new Date()) {
  const tiers = dayTiers(deal)
  if (!tiers.length) return []
  const today = todayTier(deal, now)
  const current = currentTier(deal, now)
  return tiers.map((t) => ({
    key: t.days.join(''),
    days: t.days,
    badge: formatDiscountBadge(tierDeal(deal, t), now),
    value: formatDiscountValue(tierDeal(deal, t), now),
    daysShort: tierDaysShort(t.days),
    daysLong: tierDaysLong(t.days),
    today: today?.index === t.index,
    current: current?.index === t.index,
  }))
}

/** "−30% lun–gio · −15% ven–dom" — le fasce in una riga, per email, PDF e testi. */
export function formatTierSummary(deal, now = new Date()) {
  return tierChips(deal, now).map((c) => `${c.badge} ${c.daysShort}`).join(' · ')
}

/**
 * La frase per chi guarda oggi: "Oggi −15% · −30% dal lunedì al giovedì".
 * Se oggi non vale: "Oggi non vale · −30% dal lunedì al giovedì, −15% …".
 */
export function formatTierLine(deal, now = new Date()) {
  const chips = tierChips(deal, now)
  if (!chips.length) return ''
  const today = chips.find((c) => c.today)
  const others = chips.filter((c) => c !== today).map((c) => `${c.badge} ${c.daysLong}`)
  if (today) return [`Oggi ${today.badge}`, ...others].join(' · ')
  return [`Oggi non vale`, others.join(', ')].join(' · ')
}

/** "Oggi −15% · −30% lun–gio": la frase corta, per le righe strette (barra, pillola sulla foto). */
export function formatTierTeaser(deal, now = new Date()) {
  const chips = tierChips(deal, now)
  if (!chips.length) return ''
  const today = chips.find((c) => c.today)
  const rest = chips.filter((c) => c !== today).map((c) => `${c.badge} ${c.daysShort}`)
  return [today ? `Oggi ${today.badge}` : 'Oggi non vale', ...rest].join(' · ')
}
