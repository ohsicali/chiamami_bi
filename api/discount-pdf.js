/**
 * GET /api/discount-pdf?id=<savedDiscountId>
 *
 * Genera il PDF coupon con @react-pdf/renderer (puro Node).
 *
 * - Logo: PNG bundlato (api/_assets/logo-guida-bi.png) renderizzato
 *   come <Image>.
 * - Font: Poppins (regular/bold/extrabold) + Caveat-Bold, file TTF
 *   bundlati in api/_fonts/ — niente CDN runtime.
 * - Foto ristorante: fetch server-side e passata come Buffer.
 * - Layout: ~419pt totali per stare in singola pagina A6 (148mm).
 *
 * Auth: header `Authorization: Bearer <supabase_access_token>`.
 */

import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  pdf,
  Font,
} from '@react-pdf/renderer'
import React from 'react'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { formatShortCode, isShortCode } from './_short-code.js'
import { formatDays, formatSlots } from '../src/lib/validity.js'

export const config = { maxDuration: 30 }

/* ============================================================================
   Brand tokens (matching template HTML / app)
   ============================================================================ */
const C = {
  page: '#FAF7F2',
  paper: '#FFFFFF',
  ink: '#22181C',
  ink2: '#5C4F54',
  ink3: '#9A8E94',
  line: '#EFE7DD',
  corallo: '#E8453C',
  coralloDark: '#B92E26',
  oro: '#B08954',
  oroSoft: '#F0E4D2',
  // Il verde degli sconti dell'app (--color-sconto-b / --color-sconto-ink):
  // il badge è lo stesso del pass a schermo, non più corallo.
  sconto: '#4ADE80',
  scontoInk: '#1A4731',
  cream: '#F5F0E4',
  coralloWash: '#FDEDEB',
}

/* ============================================================================
   Asset loading (lazy + cached per warm instance)
   ============================================================================ */
const ROOT = process.cwd()
const FONT_DIR = path.join(ROOT, 'api/_fonts')
const ASSET_DIR = path.join(ROOT, 'api/_assets')

let fontsRegistered = false
async function registerFontsOnce() {
  if (fontsRegistered) return
  try {
    Font.register({
      family: 'Poppins',
      fonts: [
        { src: path.join(FONT_DIR, 'Poppins-Regular.ttf'), fontWeight: 400 },
        { src: path.join(FONT_DIR, 'Poppins-Bold.ttf'), fontWeight: 700 },
        { src: path.join(FONT_DIR, 'Poppins-ExtraBold.ttf'), fontWeight: 800 },
      ],
    })
    Font.register({
      family: 'Caveat',
      fonts: [{ src: path.join(FONT_DIR, 'Caveat-Bold.ttf'), fontWeight: 700 }],
    })
    // Alfa Slab One — wordmark del brand "LA GUIDA DI BI"
    // (header del sito live).
    Font.register({
      family: 'AlfaSlabOne',
      fonts: [{ src: path.join(FONT_DIR, 'AlfaSlabOne-Regular.ttf'), fontWeight: 400 }],
    })
    Font.registerHyphenationCallback((w) => [w])
    fontsRegistered = true
  } catch (err) {
    console.warn('[pdf] font registration failed:', err)
  }
}

// Logo PNG legacy non più usato (il "vero" logo del sito è il wordmark
// in Alfa Slab One renderizzato come testo). Mantengo l'asset bundlato
// nel caso serva di nuovo in futuro, ma non lo carichiamo runtime.

/* ============================================================================
   Helpers
   ============================================================================ */
function slugify(name) {
  return (name || 'sconto').toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sconto'
}

function compactCountdown(targetIso) {
  if (!targetIso) return null
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 0) return `tra ${d}g ${h}h`
  if (h > 0) return `tra ${h}h`
  return `tra ${Math.floor((diff % 3600000) / 60000)} min`
}

function formatExpiryLabel(deal) {
  if (!deal) return null
  const isDrop = !!deal.is_drop
  const end = deal.drop_ends_at || deal.valid_until
  if (!end) return null
  if (isDrop) return compactCountdown(end)
  const d = new Date(end)
  if (d.getTime() < Date.now()) return null
  const diffDays = (d.getTime() - Date.now()) / 86400000
  if (diffDays > 365) return null
  return `il ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

/**
 * La riga "quando vale" del coupon — sempre presente, anche quando lo
 * sconto non ha limiti. Il PDF è l'unica versione dello sconto che il
 * ristoratore vede senza passare dall'app: se il cliente lo stampa e si
 * presenta di martedì su uno sconto valido solo a cena dal lunedì al
 * giovedì, la regola deve essere leggibile sulla carta stessa, non solo
 * nell'app che magari non ha più sotto mano.
 *
 * Stessa formattazione di `DiscountRules`/`QRBlockedView` lato app
 * (`formatDays`/`formatSlots` da `src/lib/validity.js`), così le due
 * versioni non raccontano regole diverse per lo stesso sconto.
 */
function formatValidityLine(deal) {
  const days = Array.isArray(deal?.valid_days) ? deal.valid_days : []
  const hasDayLimit = days.length > 0 && days.length < 7
  const dayPart = hasDayLimit ? formatDays(days) : 'Tutti i giorni'

  const slots = Array.isArray(deal?.valid_meal_slots) ? deal.valid_meal_slots : []
  let timePart = null
  if (deal?.valid_time_from && deal?.valid_time_to) {
    // Orario esplicito: vince sulla fascia, come lato app.
    timePart = `${deal.valid_time_from.slice(0, 5)}–${deal.valid_time_to.slice(0, 5)}`
  } else if (slots.length > 0) {
    timePart = formatSlots(slots)
  }
  return timePart ? `${dayPart} · ${timePart}` : dayPart
}

function pctText(deal) {
  if (!deal) return ''
  if (deal.discount_type === 'freebie') return deal.title || deal.discount_value || ''
  if (deal.discount_type === 'special_price') return deal.title || `${String(deal.discount_value || '').replace(/[%€\s]/g, '').replace(/^[-−]/, '').trim()}€`
  const v = String(deal.discount_value || '').replace(/[%€\s]/g, '').replace(/^[-−]/, '').trim()
  // Col segno meno, come ogni badge sconto del sito (`formatDiscountBadge`
  // in src/lib/utils/discountFormat.js).
  if (deal.discount_type === 'percentage') return `−${v}%`
  if (deal.discount_type === 'fixed') return `−${v}€`
  return deal.discount_value || deal.title || ''
}

function shortAddress(addr) {
  if (!addr) return ''
  return addr.split(',')[0].trim()
}

function getMainPhotoUrl(restaurant) {
  const p = restaurant?.photos?.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))?.[0]
  return p?.photo_url || p?.thumb_url || null
}

async function fetchImageBuffer(url, { siteUrl, debug } = {}) {
  if (!url) {
    if (debug) debug.status = 'no-url'
    console.warn('[pdf] photo: empty url')
    return null
  }
  if (debug) debug.url = url
  const isSupabaseStorage = /supabase\.co\/storage\//.test(url)
  const fetchUrl = (isSupabaseStorage && siteUrl)
    ? `${siteUrl}/api/img?url=${encodeURIComponent(url)}`
    : url
  if (debug) debug.fetchUrl = fetchUrl
  console.log('[pdf] photo source:', { original: url, fetch: fetchUrl, viaProxy: fetchUrl !== url })

  // Helper: una volta scaricati i byte, convertiamo SEMPRE in JPEG con
  // sharp. react-pdf supporta solo PNG/JPEG (no WebP/HEIC/AVIF) — le foto
  // dei ristoranti sono salvate in WebP, quindi senza conversione il PDF
  // riceveva un Buffer "accettato" ma non renderizzato (fail silente).
  const convertToJpeg = async (buf, ctype) => {
    try {
      const { default: sharp } = await import('sharp')
      const out = await sharp(buf).rotate().jpeg({ quality: 80 }).toBuffer()
      if (debug) debug.status = `ok-${out.length}b-from-${ctype || 'unknown'}`
      console.log('[pdf] photo converted bytes:', out.length, 'from', ctype)
      return out
    } catch (err) {
      console.warn('[pdf] sharp conversion failed:', err.message)
      if (debug) debug.status = `convert-failed-${err.message}`
      return null
    }
  }

  try {
    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChiamamiBi-PDF/1.0)',
        'Accept': 'image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.warn('[pdf] photo fetch non-200:', res.status, res.statusText, fetchUrl)
      if (debug) debug.status = `non-200-${res.status}-via-${fetchUrl !== url ? 'proxy' : 'direct'}`
      if (fetchUrl !== url) {
        console.log('[pdf] photo retry direct:', url)
        const r2 = await fetch(url, { signal: AbortSignal.timeout(15_000) })
        if (r2.ok) {
          const ab = await r2.arrayBuffer()
          return convertToJpeg(Buffer.from(ab), r2.headers.get('content-type'))
        }
        if (debug) debug.status += `,retry-direct-${r2.status}`
      }
      return null
    }
    const ab = await res.arrayBuffer()
    return convertToJpeg(Buffer.from(ab), res.headers.get('content-type'))
  } catch (err) {
    console.warn('[pdf] photo fetch error:', err.message, fetchUrl)
    if (debug) debug.status = `error-${err.message}`
    return null
  }
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const c of stream) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  return Buffer.concat(chunks)
}

/* ============================================================================
   Stili — A6 = 105 × 148 mm = 297.6 × 419.5 pt.
   Ottimizzato per stare in 1 pagina.
   ============================================================================ */
const styles = StyleSheet.create({
  page: { backgroundColor: C.page, fontFamily: 'Poppins', color: C.ink, padding: 0, flexDirection: 'column' },
  /* Header — wordmark "LA GUIDA DI BI" in Alfa Slab One (come live) */
  header: { paddingTop: 8, paddingBottom: 3, paddingHorizontal: 18, alignItems: 'flex-start' },
  logoText: {
    fontFamily: 'AlfaSlabOne', fontSize: 19, color: C.corallo,
    letterSpacing: 0.5, lineHeight: 1.05,
  },
  tagline: {
    fontFamily: 'Poppins', fontWeight: 700, fontSize: 5.5, color: C.ink3,
    letterSpacing: 1.5, marginTop: 2, marginLeft: 1,
  },
  divider: { height: 0.5, backgroundColor: C.line, marginHorizontal: 18, marginTop: 3 },
  /* Photo */
  photoWrap: {
    marginHorizontal: 18, marginTop: 5, height: 60,
    borderRadius: 6, overflow: 'hidden', backgroundColor: '#dcd0c0',
  },
  photo: { width: '100%', height: '100%', objectFit: 'cover' },
  photoFallback: {
    width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1ECE3',
  },
  photoFallbackText: { fontSize: 24, color: '#dcd0c0' },
  /* Info locale */
  info: { paddingHorizontal: 18, paddingTop: 5 },
  localeName: {
    fontFamily: 'Poppins', fontWeight: 700, fontSize: 15, color: C.ink,
    lineHeight: 1.05, letterSpacing: -0.3,
  },
  localeMeta: {
    fontFamily: 'Poppins', fontWeight: 400, fontSize: 7.5, color: C.ink2,
    lineHeight: 1.3, marginTop: 2,
  },
  /* Pct row */
  pctRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 5, gap: 9,
  },
  pctBadge: {
    backgroundColor: C.sconto, color: C.scontoInk, fontFamily: 'Poppins', fontWeight: 800,
    fontSize: 17, paddingTop: 4, paddingBottom: 3, paddingHorizontal: 10,
    borderRadius: 5, letterSpacing: -0.6,
  },
  pctClaim: { flex: 1 },
  pctClaimLabel: {
    fontFamily: 'Poppins', fontWeight: 700, fontSize: 5.5, color: C.ink3,
    letterSpacing: 0.8, marginBottom: 1,
  },
  pctClaimText: { fontFamily: 'Poppins', fontWeight: 400, fontSize: 7.5, color: C.ink, lineHeight: 1.2 },
  /* Validità — quando vale, in chiaro sulla carta stessa */
  validityRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 18, marginTop: 3, gap: 6,
    backgroundColor: C.oroSoft, borderRadius: 5,
    paddingVertical: 3, paddingHorizontal: 9,
  },
  validityLabel: {
    fontFamily: 'Poppins', fontWeight: 700, fontSize: 5.5, color: C.oro,
    letterSpacing: 0.7,
  },
  validityText: {
    fontFamily: 'Poppins', fontWeight: 700, fontSize: 8, color: C.ink,
    letterSpacing: -0.1,
  },
  /* Lo strappo tratteggiato fra il locale e il QR, come nel pass a schermo */
  tear: {
    marginHorizontal: 18, marginTop: 5,
    borderTopWidth: 0.8, borderTopColor: C.line, borderStyle: 'dashed',
  },
  /* QR — su bianco, con i quattro angoli di mira del pass (niente cornice
     piena: la fotocamera la scambierebbe per parte del codice). */
  qrWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 18, paddingTop: 3,
  },
  qrBox: {
    width: 100, height: 100, backgroundColor: '#fff',
    borderRadius: 7, padding: 7, position: 'relative',
  },
  qrImage: { width: '100%', height: '100%' },
  corner: { position: 'absolute', width: 14, height: 14, borderColor: C.ink },
  cornerTL: { top: 0, left: 0, borderTopWidth: 1.6, borderLeftWidth: 1.6, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 1.6, borderRightWidth: 1.6, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 1.6, borderLeftWidth: 1.6, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 1.6, borderRightWidth: 1.6, borderBottomRightRadius: 6 },
  qrHint: { fontFamily: 'Caveat', fontWeight: 700, fontSize: 18, color: C.corallo, marginTop: 2, lineHeight: 1 },
  codeLabel: {
    fontFamily: 'Poppins', fontWeight: 700, fontSize: 5.5, color: C.ink3,
    letterSpacing: 1.1, marginTop: 4,
  },
  /* Il codice a caselle, la prima (l'unica lettera) in corallo: come
     ShortCodeCard sull'app. */
  codeRow: { flexDirection: 'row', marginTop: 3 },
  codeCell: {
    width: 14, height: 17, marginHorizontal: 1.2, borderRadius: 3.5,
    backgroundColor: C.cream, borderWidth: 0.6, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  codeCellLetter: { backgroundColor: C.corallo, borderColor: C.corallo },
  codeCellGap: { marginLeft: 5 },
  codeChar: { fontFamily: 'Courier-Bold', fontSize: 11, color: C.ink },
  codeCharLetter: { color: '#fff' },
  scadPill: {
    backgroundColor: C.oroSoft, color: C.oro, fontFamily: 'Poppins', fontWeight: 700,
    fontSize: 7, paddingTop: 3, paddingBottom: 2, paddingHorizontal: 10,
    borderRadius: 100, marginTop: 4, letterSpacing: 0.3,
  },
  // Corallo solo per i drop (scadono), come la pillola del pass e le email.
  scadPillDrop: { backgroundColor: C.coralloWash, color: C.coralloDark },
  /* Footer */
  footer: {
    borderTopWidth: 0.5, borderTopColor: C.line,
    marginHorizontal: 18, marginTop: 3, paddingTop: 4, paddingBottom: 5,
    alignItems: 'center',
  },
  footerUrl: { fontFamily: 'Poppins', fontWeight: 700, fontSize: 7, color: C.ink, letterSpacing: 0.5 },
  footerDisclaimer: { fontFamily: 'Poppins', fontWeight: 400, fontSize: 5.5, color: C.ink3, marginTop: 1.5, letterSpacing: 0.3 },
})

/* ============================================================================
   Document
   ============================================================================ */
export function CouponDocument({ ctx }) {
  return React.createElement(
    Document, null,
    React.createElement(
      Page,
      { size: { width: 297.6, height: 419.5 }, style: styles.page },
      // HEADER (wordmark Alfa Slab One + tagline)
      React.createElement(
        View, { style: styles.header },
        React.createElement(Text, { style: styles.logoText }, 'LA GUIDA DI BI'),
        React.createElement(Text, { style: styles.tagline }, 'BY CHIAMAMI BI')
      ),
      React.createElement(View, { style: styles.divider }),
      // PHOTO
      React.createElement(
        View, { style: styles.photoWrap },
        ctx.photoBuffer
          ? React.createElement(Image, { src: ctx.photoBuffer, style: styles.photo })
          : React.createElement(View, { style: styles.photoFallback },
              React.createElement(Text, { style: styles.photoFallbackText }, '🍽'))
      ),
      // NOME + META
      React.createElement(
        View, { style: styles.info },
        React.createElement(Text, { style: styles.localeName }, ctx.locale_nome),
        React.createElement(
          Text, { style: styles.localeMeta },
          [ctx.locale_categoria, ctx.locale_indirizzo].filter(Boolean).join(' · ')
        )
      ),
      // PERCENTUALE
      React.createElement(
        View, { style: styles.pctRow },
        React.createElement(Text, { style: styles.pctBadge }, ctx.percentuale || '—'),
        React.createElement(
          View, { style: styles.pctClaim },
          React.createElement(Text, { style: styles.pctClaimLabel }, 'VANTAGGIO DEL CLUB'),
          React.createElement(Text, { style: styles.pctClaimText }, ctx.descrizione_sconto)
        )
      ),
      // VALIDITÀ — giorni + fascia, sempre in chiaro sulla carta
      ctx.validita
        ? React.createElement(
            View, { style: styles.validityRow },
            React.createElement(Text, { style: styles.validityLabel }, 'QUANDO VALE'),
            React.createElement(Text, { style: styles.validityText }, ctx.validita)
          )
        : null,
      React.createElement(View, { style: styles.tear }),
      // QR
      React.createElement(
        View, { style: styles.qrWrap },
        React.createElement(
          View, { style: styles.qrBox },
          React.createElement(Image, { src: ctx.qr_data_url, style: styles.qrImage }),
          ...['cornerTL', 'cornerTR', 'cornerBL', 'cornerBR'].map((k) =>
            React.createElement(View, { key: k, style: [styles.corner, styles[k]] }))
        ),
        React.createElement(Text, { style: styles.qrHint }, 'Mostralo al ristoratore'),
        ctx.codice_chars
          ? React.createElement(Text, { style: styles.codeLabel }, 'NON LEGGE IL QR? DETTA IL CODICE')
          : null,
        ctx.codice_chars
          ? React.createElement(
              View, { style: styles.codeRow },
              ...ctx.codice_chars.map((ch, i) => React.createElement(
                View,
                { key: i, style: [styles.codeCell, i === 0 ? styles.codeCellLetter : null, i === 3 ? styles.codeCellGap : null].filter(Boolean) },
                React.createElement(Text, { style: [styles.codeChar, i === 0 ? styles.codeCharLetter : null].filter(Boolean) }, ch)
              ))
            )
          : null,
        ctx.scadenza
          ? React.createElement(
              Text,
              { style: [styles.scadPill, ctx.is_drop ? styles.scadPillDrop : null].filter(Boolean) },
              ctx.is_drop ? `Scade tra ${ctx.scadenza}` : `Valido fino al${ctx.scadenza.replace(/^il/, '')}`
            )
          : null
      ),
      // FOOTER
      React.createElement(
        View, { style: styles.footer },
        React.createElement(Text, { style: styles.footerUrl }, 'chiamamibi.com'),
        React.createElement(Text, { style: styles.footerDisclaimer },
          'Codice valido una sola volta · La guida di Bi')
      )
    )
  )
}

/* ============================================================================
   Handler
   ============================================================================ */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'Server configuration error' })
    return
  }

  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await adminClient.auth.getUser(token)
  if (userErr || !userData?.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const userId = userData.user.id

  const redemptionId = req.query?.id
  if (!redemptionId) {
    res.status(400).json({ error: 'Missing id' })
    return
  }

  const { data: redemption, error: redErr } = await adminClient
    .from('discount_redemptions')
    .select(`
      id, qr_code, short_code, status, generated_at, redeemed_at, user_id,
      discount:discounts(
        id, title, description, discount_type, discount_value, conditions,
        valid_until, drop_ends_at, is_drop,
        valid_days, valid_meal_slots, valid_time_from, valid_time_to,
        restaurant:restaurants(
          id, name, slug, address, cuisine_type, category
        )
      )
    `)
    .eq('id', redemptionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (redErr || !redemption) {
    res.status(404).json({ error: 'Sconto non trovato' })
    return
  }

  const deal = redemption.discount
  const restaurant = deal?.restaurant
  if (!deal || !restaurant) {
    res.status(404).json({ error: 'Dati sconto incompleti' })
    return
  }

  // Query separata per le foto: il join nidificato a 3 livelli
  // (redemption → discount → restaurant → photos) a volte non popola
  // `photos` in Supabase REST. Più affidabile fare una query diretta.
  const { data: photos, error: photosErr } = await adminClient
    .from('restaurant_photos')
    .select('photo_url, thumb_url, sort_order')
    .eq('restaurant_id', restaurant.id)
    .order('sort_order', { ascending: true })
    .limit(3)
  if (photosErr) console.warn('[pdf] photos query err:', photosErr.message)
  console.log('[pdf] photos rows:', photos?.length || 0, photos?.[0])
  restaurant.photos = photos || []

  const cuisine = restaurant.cuisine_type
    || (Array.isArray(restaurant.category) ? restaurant.category[0] : null)
    || 'Locale'
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://chiamamibi.com').replace(/\/$/, '')

  const ctx = {
    locale_nome: restaurant.name || 'Ristorante',
    locale_categoria: cuisine,
    locale_indirizzo: shortAddress(restaurant.address),
    percentuale: pctText(deal),
    is_drop: !!deal.is_drop,
    descrizione_sconto: deal.title || deal.description || 'Valido alla cassa',
    validita: formatValidityLine(deal),
    codice_testuale: redemption.qr_code,
    // Il codice da dettare al ristoratore quando la fotocamera non legge il
    // QR: spezzato in due gruppi di tre, come sull'app.
    codice_breve: formatShortCode(redemption.short_code),
    // Le sei caselle: solo se il codice ha la forma giusta, come ShortCodeCard.
    codice_chars: isShortCode(redemption.short_code)
      ? String(redemption.short_code).toUpperCase().split('')
      : null,
    scadenza: formatExpiryLabel(deal),
  }

  // QR
  const qrPayload = `${siteUrl}/verify?code=${redemption.qr_code}`
  ctx.qr_data_url = await QRCode.toDataURL(qrPayload, {
    width: 600, margin: 1, color: { dark: '#000000', light: '#FFFFFF' },
  })

  // Foto del ristorante (server-side fetch, eventualmente via /api/img).
  // Determiniamo l'host della richiesta corrente per costruire il proxy
  // URL: in preview Vercel diverso da prod.
  const reqHost = req.headers['x-forwarded-host'] || req.headers.host
  const reqProto = req.headers['x-forwarded-proto'] || 'https'
  const apiBaseUrl = reqHost ? `${reqProto}://${reqHost}` : siteUrl

  const photoUrl = getMainPhotoUrl(restaurant)
  console.log('[pdf] photo url from DB:', photoUrl, 'apiBase:', apiBaseUrl)
  const photoDebug = {}
  ctx.photoBuffer = await fetchImageBuffer(photoUrl, { siteUrl: apiBaseUrl, debug: photoDebug })

  // Font (registrazione lazy una sola volta per warm instance).
  await registerFontsOnce()

  try {
    const doc = React.createElement(CouponDocument, { ctx })
    const result = await pdf(doc).toBuffer()
    const buffer = Buffer.isBuffer(result) ? result : await streamToBuffer(result)

    const filename = `sconto-${slugify(restaurant.name)}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Cache-Control', 'private, no-store')
    // Photo resolution status is logged server-side only; it was previously
    // exposed via X-Photo-Url/X-Photo-Status response headers, which leaked
    // internal storage URLs to the client.
    if (photoDebug.status !== 'ok') {
      console.warn('[pdf] photo status:', photoDebug.status, photoDebug.url || '')
    }
    res.status(200).end(buffer)
  } catch (err) {
    console.error('[pdf] react-pdf render failed:', err && err.stack ? err.stack : err)
    if (!res.headersSent) {
      res.status(500).json({ error: `PDF render failed: ${err?.message || 'unknown'}` })
    } else {
      try { res.end() } catch { /* ignore */ }
    }
  }
}
