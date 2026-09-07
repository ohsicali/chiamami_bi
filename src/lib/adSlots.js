/**
 * Registro delle posizioni pubblicitarie.
 *
 * Una posizione esiste solo dove il componente <AdSlot> è montato: tenere
 * l'elenco qui invece che in database evita di poter creare in admin slot che
 * poi non compaiono da nessuna parte. Il DB conserva solo la `key`.
 *
 * Per aprire una posizione nuova: aggiungi una voce qui e monta <AdSlot
 * slot="chiave" /> nel punto giusto. Nessuna migrazione necessaria.
 */

export const AD_FORMATS = {
  hero: {
    key: 'hero',
    label: 'Hero',
    // Misure reali del componente, mostrate all'admin per sapere cosa chiedere
    // al cliente. Mobile: larghezza piena × 178px. Desktop: 440 × 280px.
    sizeHint: 'Foto orizzontale · min 1200px di larghezza',
    image: 'cover',
    limits: { headline: 24, subtitle: 110 },
  },
  inline: {
    key: 'inline',
    label: 'Card nel feed',
    sizeHint: 'Foto orizzontale · min 800px di larghezza',
    image: 'cover',
    limits: { headline: 45, subtitle: 70 },
  },
  compact: {
    key: 'compact',
    label: 'Riga compatta',
    sizeHint: 'Logo quadrato · min 256px (oppure foto orizzontale)',
    image: 'logo',
    limits: { headline: 30, subtitle: 60 },
  },
}

export const AD_SLOTS = {
  home_hero: {
    key: 'home_hero',
    label: 'Home · banner grande',
    where: 'Home, sotto “Ultimi aggiunti”',
    format: 'hero',
    order: 1,
  },
  home_feed: {
    key: 'home_feed',
    label: 'Home · dentro i risultati',
    where: 'Home, tra le card dei locali aperti adesso',
    format: 'inline',
    order: 2,
  },
  list_inline: {
    key: 'list_inline',
    label: 'Elenco ristoranti',
    where: 'Pagina /list e colonna sinistra della mappa, dopo il 6° locale',
    format: 'compact',
    order: 3,
  },
}

export const AD_SLOT_LIST = Object.values(AD_SLOTS).sort((a, b) => a.order - b.order)

/**
 * Tetto di annunci mostrati contemporaneamente in una pagina. Con tre
 * posizioni aperte, senza tetto la home ne mostrerebbe due e l'elenco uno:
 * il limite serve soprattutto in prospettiva, quando le posizioni saranno di
 * più. Gli slot vengono riempiti in ordine di `order`.
 */
export const MAX_ADS_PER_PAGE = 2

/** Ogni quante schede infilare un annuncio negli elenchi lunghi. */
export const LIST_AD_AFTER = 6

export function getSlot(key) {
  return AD_SLOTS[key] || null
}

export function getFormat(slotKey) {
  const slot = AD_SLOTS[slotKey]
  return slot ? AD_FORMATS[slot.format] : null
}
