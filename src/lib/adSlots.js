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
    paths: ['/'],
  },
  list_inline: {
    key: 'list_inline',
    label: 'Elenco ristoranti',
    where: 'Elenco da mobile e colonna di fianco alla mappa da desktop, dopo il 6° locale',
    format: 'compact',
    order: 2,
    paths: ['/list', '/esplora'],
  },
  deals_mid: {
    key: 'deals_mid',
    label: 'Sconti · in mezzo all’elenco',
    where: 'Pagina sconti, tra le convenzioni',
    format: 'compact',
    order: 3,
    paths: ['/sconti', '/deals'],
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

/**
 * Le posizioni presenti su una pagina. Serve al tetto di annunci: contando
 * anche le posizioni non montate, il budget verrebbe consumato da slot
 * invisibili e le posizioni in fondo alla lista non uscirebbero mai.
 */
export function slotsForPath(pathname) {
  return AD_SLOT_LIST.filter((s) => s.paths.includes(pathname))
}

/**
 * Dopo quante schede infilare un annuncio negli elenchi.
 *
 * Sei non è un numero a caso: la griglia degli sconti su desktop è a 3 colonne
 * (2 sotto i 1100px) e l'annuncio occupa una riga intera, quindi solo un
 * multiplo di 6 lascia complete le righe che lo precedono in entrambi i casi.
 * Sotto le sei schede l'annuncio va in fondo all'elenco invece che in mezzo,
 * altrimenti lascerebbe dei buchi nella griglia.
 */
export const LIST_AD_AFTER = 6

export function getSlot(key) {
  return AD_SLOTS[key] || null
}

export function getFormat(slotKey) {
  const slot = AD_SLOTS[slotKey]
  return slot ? AD_FORMATS[slot.format] : null
}
