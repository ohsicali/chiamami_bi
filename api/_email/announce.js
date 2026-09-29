/**
 * L'annuncio a tutti gli utenti: "nuovo in guida" (locale) e "nuovo sconto"
 * (convenzione o drop).
 *
 * Stava tutto dentro api/notify-subscribers.js; è uscito di lì perché dal
 * 29/09 lo chiamano in due: il bottone dell'admin (megafono, prima
 * pubblicazione) e il giro delle uscite programmate
 * (api/_scheduled-publish.js), che parte da pg_cron senza nessun admin
 * collegato. Stesse regole per tutti e due: registro dei doppioni in
 * `email_notifications_log`, destinatari da `recipientsFor`.
 */
import { newDiscountEmail, newRestaurantEmail } from './templates.js'
import { sendBatch, buildMessage, recipientsFor, unsubscribeUrl } from './send.js'
import { formatDiscountBadge, pickPerk } from './discount.js'
import { countdownWords } from './content.js'
import { claimedCount, remainingCount, discountEndsAt, isExpired } from '../../src/lib/discounts.js'

const SITE_URL = 'https://chiamamibi.com'

/**
 * Manda l'annuncio e lo scrive nel registro.
 *
 * Ritorna `{ status, body }` con lo stesso significato delle risposte HTTP
 * dell'endpoint: 200 spedito (o nessun destinatario), 404 non annunciabile
 * (non pubblicato, spento, di prova…), 409 già mandato, 500 errore.
 *
 * @param {object} admin  client Supabase con service role
 * @param {{ type: 'restaurant'|'discount'|'drop', id: string, sentBy?: string|null, force?: boolean }} opts
 */
export async function announce(admin, { type, id, sentBy = null, force = false }) {
  // Dedup. Sconto e drop contano insieme: uno sconto passato da "sconto" a
  // "drop" (o il contrario) è sempre lo stesso sconto, e chi ha già
  // ricevuto l'email non deve riceverla una seconda volta per quello.
  if (!force) {
    const { data: existingRows } = await admin
      .from('email_notifications_log')
      .select('sent_at, sent_count')
      .in('type', type === 'restaurant' ? ['restaurant'] : ['discount', 'drop'])
      .eq('item_id', id)
      .order('sent_at', { ascending: false })
      .limit(1)
    const existing = existingRows?.[0]
    if (existing) {
      return {
        status: 409,
        body: { error: 'Already sent', sent_at: existing.sent_at, sent_count: existing.sent_count },
      }
    }
  }

  let payload
  try {
    payload = await loadPayload(admin, type, id)
  } catch (err) {
    return { status: 404, body: { error: err.message } }
  }

  // I destinatari sono TUTTI gli utenti registrati che non hanno spento
  // l'interruttore di questo tipo — non più la sola lista newsletter, che
  // era un insieme separato e molto più piccolo. Il filtro sta dentro
  // `recipientsFor`: così nessun punto di invio può dimenticarsi di
  // applicarlo.
  const kind = type === 'restaurant' ? 'new-place' : 'new-discount'
  let recipients
  try {
    recipients = await recipientsFor(admin, kind)
  } catch (err) {
    return { status: 500, body: { error: err.message } }
  }
  if (recipients.length === 0) {
    return { status: 200, body: { sent: 0, message: 'Nessun destinatario per questo tipo' } }
  }

  // Ogni messaggio è diverso dall'altro: il link per scegliere cosa ricevere
  // porta il token di quella persona. Per questo si costruisce dentro al
  // ciclo e non una volta sola fuori.
  const messages = recipients.map((r) => {
    const mail = buildMail(type, payload, unsubscribeUrl(r.token))
    return buildMessage({ to: r.email, token: r.token, ...mail })
  })

  const { sent, failed: errors, errors: errorDetails } = await sendBatch(messages)

  await admin
    .from('email_notifications_log')
    .upsert(
      {
        type,
        item_id: id,
        sent_count: sent,
        error_count: errors,
        sent_by: sentBy,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'type,item_id' }
    )

  return { status: 200, body: { sent, errors, total: recipients.length, errorDetails } }
}

// ---------------------------------------------------------------
// Payload loaders
// ---------------------------------------------------------------

export async function loadPayload(admin, type, id) {
  if (type === 'restaurant') {
    const { data: r, error } = await admin
      .from('restaurants')
      .select('id, name, slug, address, neighborhood, city, tagline, our_review, our_tip, is_published, cuisine_type, price_range')
      .eq('id', id)
      .single()
    if (error || !r) throw new Error('Restaurant not found')
    if (!r.is_published) throw new Error('Restaurant is not published — publish it before sending')

    return { restaurant: r, ...(await photoSet(admin, id)) }
  }

  if (type === 'discount' || type === 'drop') {
    const { data: d, error } = await admin
      .from('discounts')
      .select('id, title, description, conditions, discount_type, discount_value, valid_until, valid_days, valid_meal_slots, valid_time_from, valid_time_to, is_drop, drop_starts_at, drop_ends_at, max_quantity, max_redemptions, claimed_count, total_redeemed, restaurant_id, is_active, is_test')
      .eq('id', id)
      .single()
    if (error || !d) throw new Error('Discount not found')
    if (!d.is_active) throw new Error('Discount is not active')
    // Uno sconto di prova non si annuncia a nessuno: prima "Pubblica per tutti".
    if (d.is_test) throw new Error('Sconto di prova: pubblicalo per tutti prima di mandare l\'email')
    if (type === 'drop' && !d.is_drop) throw new Error('This discount is not a drop')
    // Un'uscita programmata può arrivare dopo la fine dello sconto (data di
    // fine scelta prima dell'uscita): annunciarlo manderebbe tutti su uno
    // sconto che non c'è più.
    if (isExpired(d)) throw new Error('Lo sconto è già scaduto')

    // `our_review` e `tagline` non servono allo sconto in sé: servono
    // all'email. Un annuncio fatto di sola offerta è un volantino, e si
    // legge come tale — la riga in cui Bi dice perché quel posto merita è
    // l'unica parte che nessun altro potrebbe aver scritto.
    const { data: r } = await admin
      .from('restaurants')
      .select('id, name, slug, address, neighborhood, city, cuisine_type, price_range, tagline, our_review, is_published')
      .eq('id', d.restaurant_id)
      .single()
    if (!r) throw new Error('Restaurant linked to discount not found')
    // Lo sconto di un locale ancora in bozza (o programmato per dopo) non si
    // vede da nessuna parte: l'email porterebbe a una scheda che non esiste.
    if (!r.is_published) throw new Error('Il locale non è ancora pubblicato: esce prima il locale, poi lo sconto')

    return { discount: d, restaurant: r, ...(await photoSet(admin, r.id)) }
  }

  throw new Error('Unknown type')
}

/**
 * Le foto del locale: le prime quattro, più quante ne esistono in tutto.
 *
 * Prima se ne prendeva una sola, perché una sola ne entrava: l'email aveva
 * una fascia in cima e basta. Adesso "nuovo in guida" e le convenzioni
 * mostrano un mosaico 1+3, e il conteggio totale serve al "+N" sull'ultima
 * tessera — senza, il badge direbbe sempre lo stesso numero o non ci
 * sarebbe affatto.
 *
 * Qui serve la foto grande, non la `thumb_url`: quella è il ritaglio da
 * 400px delle card, e dentro una fascia larga 600 arrivava sgranata. Il
 * ridimensionamento lo fa `/api/img` a valle (vedi `croppedPhoto` in
 * _email/blocks.js).
 */
async function photoSet(admin, restaurantId) {
  const { data, count } = await admin
    .from('restaurant_photos')
    .select('photo_url, thumb_url, sort_order', { count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true })
    .limit(4)
  const photos = (data || []).map((r) => r.photo_url || r.thumb_url).filter(Boolean)
  return { photos, photoCount: count ?? photos.length, photo: photos[0] || null }
}

// ---------------------------------------------------------------
// Email rendering
// ---------------------------------------------------------------
//
// L'HTML non sta più qui: lo fanno i template in _email/, gli stessi che
// usano le ricevute degli sconti. Prima ogni email aveva il suo HTML
// scritto a mano e le due famiglie si erano già allontanate — intestazioni
// diverse, piè di pagina diverso, nessun link per scegliere cosa ricevere.

const SLUG_URL = (slug) => `${SITE_URL}/restaurant/${slug}`

/** Da payload a { subject, html, text }. */
function buildMail(type, p, unsubUrl) {
  if (type === 'restaurant') {
    const r = p.restaurant
    return newRestaurantEmail({
      restaurantName: r.name,
      tagline: r.tagline,
      review: r.our_review,
      city: r.city,
      cuisine: r.cuisine_type,
      priceRange: r.price_range,
      address: r.address,
      neighborhood: r.neighborhood,
      photos: p.photos,
      photoCount: p.photoCount,
      href: SLUG_URL(r.slug),
      unsubscribeUrl: unsubUrl,
    })
  }

  const d = p.discount
  const r = p.restaurant
  // È `is_drop` a scegliere il template, non il `type` della chiamata: il
  // colore dell'email dice che tipo di sconto è (corallo = scade, crema e
  // oro = non scade), e sbagliarlo brucia l'urgenza anche sui drop veri.
  const isDrop = type === 'drop' || !!d.is_drop
  // I posti restano nel drop e solo lì. `remainingCount` torna null quando
  // lo sconto non ha un tetto: la barra allora non si disegna, perché una
  // barra su una quantità illimitata racconterebbe una scarsità inventata.
  const left = isDrop ? remainingCount(d) : null
  return newDiscountEmail({
    value: formatDiscountBadge(d),
    restaurantName: r.name,
    perk: pickPerk(d),
    conditions: (d.conditions || '').trim() || null,
    review: (r.our_review || r.tagline || '').trim() || null,
    city: r.city,
    cuisine: r.cuisine_type,
    priceRange: r.price_range,
    address: r.address,
    neighborhood: r.neighborhood,
    photos: p.photos,
    photoCount: p.photoCount,
    href: `${SITE_URL}/sconti`,
    scheda: r.slug ? SLUG_URL(r.slug) : null,
    isDrop,
    countdown: isDrop ? countdownWords(discountEndsAt(d)) : null,
    taken: left === null ? null : claimedCount(d),
    left,
    // Quando vale davvero: il chip della convenzione (pranzo, cena, giorni,
    // scadenza) e la riga del drop ("valido solo a cena") vengono da qui.
    validity: {
      days: d.valid_days,
      slots: d.valid_meal_slots,
      timeFrom: d.valid_time_from,
      timeTo: d.valid_time_to,
      until: d.valid_until,
    },
    unsubscribeUrl: unsubUrl,
  })
}
