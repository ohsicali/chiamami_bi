/**
 * Le stesse regole di formattazione che usa il sito, riesportate per le
 * funzioni serverless.
 *
 * Il file vero sta in src/lib/utils/discountFormat.js ed è JavaScript senza
 * React, quindi importabile da qui senza trascinarsi dietro nulla. Questo
 * ponte esiste perché la ricevuta che arriva nella posta deve dire
 * esattamente quello che dice la card sul sito: due copie della stessa
 * regola, prima o poi, divergono.
 */
export {
  formatDiscountValue,
  formatDiscountBadge,
  formatDiscountBadgeShort,
  isBareDiscountValue,
  pickPerk,
} from '../../src/lib/utils/discountFormat.js'
