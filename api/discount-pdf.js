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

function pctText(deal) {
  if (!deal) return ''
  if (deal.discount_type === 'freebie') return deal.title || deal.discount_value || ''
  const v = String(deal.discount_value || '').replace(/[%€]/g, '').trim()
  if (deal.discount_type === 'percentage') return `-${v}%`
  if (deal.discount_type === 'fixed') return `-${v}€`
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
  header: { paddingTop: 10, paddingBottom: 4, paddingHorizontal: 18, alignItems: 'flex-start' },
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
    marginHorizontal: 18, marginTop: 7, height: 65,
    borderRadius: 6, overflow: 'hidden', backgroundColor: '#dcd0c0',
  },
  photo: { width: '100%', height: '100%', objectFit: 'cover' },
  photoFallback: {
    width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1ECE3',
  },
  photoFallbackText: { fontSize: 24, color: '#dcd0c0' },
  /* Info locale */
  info: { paddingHorizontal: 18, paddingTop: 7 },
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
    paddingHorizontal: 18, paddingTop: 7, gap: 9,
  },
  pctBadge: {
    backgroundColor: C.corallo, color: '#fff', fontFamily: 'Poppins', fontWeight: 800,
    fontSize: 17, paddingTop: 4, paddingBottom: 3, paddingHorizontal: 10,
    borderRadius: 5, letterSpacing: -0.6,
  },
  pctClaim: { flex: 1 },
  pctClaimLabel: {
    fontFamily: 'Poppins', fontWeight: 700, fontSize: 5.5, color: C.ink3,
    letterSpacing: 0.8, marginBottom: 1,
  },
  pctClaimText: { fontFamily: 'Poppins', fontWeight: 400, fontSize: 7.5, color: C.ink, lineHeight: 1.2 },
  /* QR */
  qrWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 18, paddingTop: 5,
  },
  qrBox: {
    width: 110, height: 110, backgroundColor: '#fff',
    borderWidth: 1.3, borderColor: C.ink, borderRadius: 7, padding: 5,
  },
  qrImage: { width: '100%', height: '100%' },
  qrHint: { fontFamily: 'Caveat', fontWeight: 700, fontSize: 18, color: C.corallo, marginTop: 3, lineHeight: 1 },
  codeText: { fontFamily: 'Courier', fontSize: 6.5, color: C.ink3, letterSpacing: 1.2, marginTop: 3 },
  scadPill: {
    backgroundColor: C.oroSoft, color: C.oro, fontFamily: 'Poppins', fontWeight: 700,
    fontSize: 7, paddingTop: 3, paddingBottom: 2, paddingHorizontal: 10,
    borderRadius: 100, marginTop: 4, letterSpacing: 0.3,
  },
  /* Footer */
  footer: {
    borderTopWidth: 0.5, borderTopColor: C.line,
    marginHorizontal: 18, marginTop: 5, paddingTop: 5, paddingBottom: 7,
    alignItems: 'center',
  },
  footerUrl: { fontFamily: 'Poppins', fontWeight: 700, fontSize: 7, color: C.ink, letterSpacing: 0.5 },
  footerDisclaimer: { fontFamily: 'Poppins', fontWeight: 400, fontSize: 5.5, color: C.ink3, marginTop: 1.5, letterSpacing: 0.3 },
})

/* ============================================================================
   Document
   ============================================================================ */
function CouponDocument({ ctx }) {
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
      // QR
      React.createElement(
        View, { style: styles.qrWrap },
        React.createElement(
          View, { style: styles.qrBox },
          React.createElement(Image, { src: ctx.qr_data_url, style: styles.qrImage })
        ),
        React.createElement(Text, { style: styles.qrHint }, 'Mostra al ristoratore'),
        React.createElement(Text, { style: styles.codeText }, ctx.codice_testuale),
        ctx.scadenza
          ? React.createElement(Text, { style: styles.scadPill }, `Scade ${ctx.scadenza}`)
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
      id, qr_code, status, generated_at, redeemed_at, user_id,
      discount:discounts(
        id, title, description, discount_type, discount_value, conditions,
        valid_until, drop_ends_at, is_drop,
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
    descrizione_sconto: deal.title || deal.description || 'Valido alla cassa',
    codice_testuale: redemption.qr_code,
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
    // Debug: stato della foto leggibile da DevTools → Network → Response
    // Headers, senza dover andare nei log Vercel.
    res.setHeader('X-Photo-Status', photoDebug.status || 'unknown')
    if (photoDebug.url) res.setHeader('X-Photo-Url', encodeURIComponent(photoDebug.url).slice(0, 800))
    res.setHeader('X-Photos-Found', String(photos?.length || 0))
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
