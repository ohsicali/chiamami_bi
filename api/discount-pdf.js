/**
 * GET /api/discount-pdf?id=<savedDiscountId>
 *
 * Genera il PDF coupon allineato visualmente al template ufficiale
 * docs/templates/pdf-coupon-template.html.
 *
 * Implementazione: @react-pdf/renderer (puro Node, no chromium binary).
 * Scelta dopo che puppeteer-core + @sparticuz/chromium fallivano su Vercel
 * con `libnss3.so: cannot open shared object file` indipendentemente dalla
 * versione (full o min). React-PDF è 100% JS, zero dipendenze native.
 *
 * Auth: header `Authorization: Bearer <supabase_access_token>`. Solo il
 * proprietario della redemption può scaricare.
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
} from '@react-pdf/renderer'
import React from 'react'

export const config = { maxDuration: 30 }

/* ============================================================================
   Token brand (matching template HTML)
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
   Font: usiamo solo i built-in di react-pdf (Helvetica) per evitare la
   dipendenza da CDN esterni che possono dare 404 e bloccare il render.
   Il design del template usa Poppins (bold/extrabold) → Helvetica-Bold è
   visivamente vicino. La caption "Mostra al ristoratore" che nel template
   è in Caveat, qui usa Helvetica-BoldOblique color corallo come fallback.
   ============================================================================ */

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

function getMainPhoto(restaurant) {
  const p = restaurant?.photos?.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))?.[0]
  return p?.photo_url || p?.thumb_url || null
}

/* ============================================================================
   Stili — replica del template HTML pdf-coupon-template.html
   A6 = 105 × 148 mm = 297.6 × 419.5 pt (1mm ≈ 2.835pt).
   ============================================================================ */
const styles = StyleSheet.create({
  page: { backgroundColor: C.page, color: C.ink, padding: 0, flexDirection: 'column' },
  /* Header */
  header: { paddingTop: 18, paddingBottom: 8, paddingHorizontal: 22 },
  logoText: {
    fontFamily: 'Helvetica-Bold', fontSize: 18, color: C.corallo,
    letterSpacing: 0.5, lineHeight: 1.05,
  },
  tagline: {
    fontFamily: 'Helvetica-Bold', fontSize: 6, color: C.ink3,
    letterSpacing: 1.7, marginTop: 3, marginLeft: 1,
  },
  divider: { height: 0.5, backgroundColor: C.line, marginHorizontal: 22, marginTop: 4 },
  /* Photo */
  photoWrap: {
    marginHorizontal: 22, marginTop: 11, height: 90,
    borderRadius: 7, overflow: 'hidden', backgroundColor: '#dcd0c0',
  },
  photo: { width: '100%', height: '100%', objectFit: 'cover' },
  /* Info locale */
  info: { paddingHorizontal: 22, paddingTop: 11 },
  localeName: {
    fontFamily: 'Helvetica-Bold', fontSize: 17, color: C.ink,
    lineHeight: 1.05, letterSpacing: -0.3,
  },
  localeMeta: {
    fontFamily: 'Helvetica', fontSize: 7.5, color: C.ink2,
    lineHeight: 1.3, marginTop: 3,
  },
  /* Pct row */
  pctRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 11, gap: 9,
  },
  pctBadge: {
    backgroundColor: C.corallo, color: '#fff', fontFamily: 'Helvetica-Bold',
    fontSize: 20, paddingVertical: 5, paddingHorizontal: 11,
    borderRadius: 6, letterSpacing: -0.6,
  },
  pctClaim: { flex: 1, flexDirection: 'column' },
  pctClaimLabel: {
    fontFamily: 'Helvetica-Bold', fontSize: 6, color: C.ink3,
    letterSpacing: 0.8, marginBottom: 2,
  },
  pctClaimText: {
    fontFamily: 'Helvetica', fontSize: 7.5, color: C.ink, lineHeight: 1.25,
  },
  /* QR */
  qrWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 22, paddingTop: 11,
  },
  qrBox: {
    width: 142, height: 142, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: C.ink, borderRadius: 8, padding: 8,
  },
  qrImage: { width: '100%', height: '100%' },
  qrHint: {
    fontFamily: 'Helvetica-BoldOblique', fontSize: 16, color: C.corallo,
    marginTop: 7, lineHeight: 1,
  },
  codeText: {
    fontFamily: 'Courier', fontSize: 7, color: C.ink3, letterSpacing: 1.5, marginTop: 5,
  },
  scadPill: {
    backgroundColor: C.oroSoft, color: C.oro, fontFamily: 'Helvetica-Bold',
    fontSize: 7, paddingVertical: 4, paddingHorizontal: 12,
    borderRadius: 100, marginTop: 6, letterSpacing: 0.3,
  },
  /* Footer */
  footer: {
    borderTopWidth: 0.5, borderTopColor: C.line,
    marginHorizontal: 22, marginTop: 9, paddingTop: 7, paddingBottom: 14,
    alignItems: 'center',
  },
  footerUrl: {
    fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.ink, letterSpacing: 0.5,
  },
  footerDisclaimer: {
    fontFamily: 'Helvetica', fontSize: 5.5, color: C.ink3, marginTop: 2, letterSpacing: 0.3,
  },
})

/* ============================================================================
   Doc component
   ============================================================================ */
function CouponDocument({ ctx }) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      // A6 = 105 × 148 mm
      { size: { width: 297.6, height: 419.5 }, style: styles.page },
      // HEADER
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.logoText }, 'LA GUIDA DI BI'),
        React.createElement(Text, { style: styles.tagline }, 'BY CHIAMAMI BI')
      ),
      React.createElement(View, { style: styles.divider }),
      // PHOTO
      ctx.photoBuffer
        ? React.createElement(
            View,
            { style: styles.photoWrap },
            React.createElement(Image, { src: ctx.photoBuffer, style: styles.photo })
          )
        : React.createElement(View, { style: styles.photoWrap }),
      // NOME + META
      React.createElement(
        View,
        { style: styles.info },
        React.createElement(Text, { style: styles.localeName }, ctx.locale_nome),
        React.createElement(
          Text,
          { style: styles.localeMeta },
          [ctx.locale_categoria, ctx.locale_indirizzo].filter(Boolean).join(' · ')
        )
      ),
      // PERCENTUALE
      React.createElement(
        View,
        { style: styles.pctRow },
        React.createElement(Text, { style: styles.pctBadge }, ctx.percentuale || '—'),
        React.createElement(
          View,
          { style: styles.pctClaim },
          React.createElement(Text, { style: styles.pctClaimLabel }, 'SCONTO RISERVATO'),
          React.createElement(Text, { style: styles.pctClaimText }, ctx.descrizione_sconto)
        )
      ),
      // QR
      React.createElement(
        View,
        { style: styles.qrWrap },
        React.createElement(
          View,
          { style: styles.qrBox },
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
        View,
        { style: styles.footer },
        React.createElement(Text, { style: styles.footerUrl }, 'chiamamibi.com'),
        React.createElement(
          Text,
          { style: styles.footerDisclaimer },
          'Codice valido una sola volta · La guida di Bi'
        )
      )
    )
  )
}

/* ============================================================================
   Helpers binari
   ============================================================================ */
async function fetchImageBuffer(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const c of stream) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  return Buffer.concat(chunks)
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
          id, name, slug, address, cuisine_type, category,
          photos:restaurant_photos(id, photo_url, thumb_url, sort_order)
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

  // Costruiamo il context per il component PDF.
  const cuisine = restaurant.cuisine_type || (Array.isArray(restaurant.category) ? restaurant.category[0] : null) || 'Locale'
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

  // QR data URL — payload identico al sistema scan ristoratore.
  const qrPayload = `${siteUrl}/verify?code=${redemption.qr_code}`
  ctx.qr_data_url = await QRCode.toDataURL(qrPayload, {
    width: 600,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  })

  // Foto: react-pdf legge URL ma su serverless con CORS può fallire. Fetch
  // server-side e passiamo il Buffer.
  const photoUrl = getMainPhoto(restaurant)
  ctx.photoBuffer = await fetchImageBuffer(photoUrl)

  try {
    const doc = React.createElement(CouponDocument, { ctx })
    const stream = await pdf(doc).toBuffer()
    const buffer = Buffer.isBuffer(stream) ? stream : await streamToBuffer(stream)

    const filename = `sconto-${slugify(restaurant.name)}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Cache-Control', 'private, no-store')
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
