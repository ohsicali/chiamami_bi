/**
 * GET /api/discount/pdf/[id] — generate the discount coupon PDF.
 *
 * Renders the official template at docs/templates/pdf-coupon-template.html
 * with puppeteer-core + @sparticuz/chromium (50MB chromium binary, well
 * under the 250MB Vercel function size cap).
 *
 * Auth: requires the user's Supabase access token in `Authorization: Bearer`
 * header. Only the owner of the redemption can download.
 *
 * Variables substituted in the template:
 *   {{locale_nome}}, {{locale_categoria}}, {{locale_indirizzo}},
 *   {{percentuale}}, {{descrizione_sconto}}, {{codice_testuale}},
 *   {{scadenza}}.
 *
 * Special replacements:
 *   - .cp-qr-placeholder div → <img src="data:image/png;base64,..."> from QR
 *   - logo /logo-guida-bi.svg → absolute URL (puppeteer can't load relative)
 *   - .cp-photo placeholder unsplash src → real restaurant photo URL
 */

import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const config = {
  // Serverless function (default Node.js runtime). The chromium binary is
  // included via @sparticuz/chromium and unpacked at /tmp at runtime.
  maxDuration: 30,
}

function slugify(name) {
  return (name || 'sconto').toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sconto'
}

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function compactCountdown(targetIso) {
  if (!targetIso) return null
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 0) return `tra ${d}g ${h}h`
  if (h > 0) return `tra ${h}h`
  const m = Math.floor((diff % 3600000) / 60000)
  return `tra ${m} min`
}

function formatExpiry(deal) {
  if (!deal) return null
  const isDrop = !!deal.is_drop
  const end = deal.drop_ends_at || deal.valid_until
  if (!end) return null
  if (isDrop) return compactCountdown(end)
  const d = new Date(end)
  if (d.getTime() < Date.now()) return null
  // Far-future "evergreen" valid_until → don't render scad
  const diffDays = (d.getTime() - Date.now()) / 86400000
  if (diffDays > 365) return null
  return `il ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

function pctText(deal) {
  if (!deal) return ''
  if (deal.discount_type === 'freebie') return deal.title || deal.discount_value || ''
  const v = String(deal.discount_value || '').replace(/[%€]/g, '').trim()
  if (deal.discount_type === 'percentage') return `−${v}%`
  if (deal.discount_type === 'fixed') return `−${v}€`
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

let templateCache = null
async function loadTemplate() {
  if (templateCache) return templateCache
  // includeFiles in vercel.json puts this file relative to project root.
  const filePath = path.join(process.cwd(), 'docs/templates/pdf-coupon-template.html')
  templateCache = await readFile(filePath, 'utf8')
  return templateCache
}

function buildHtml(template, ctx) {
  let html = template

  // Substitute the {{...}} placeholders.
  const repl = {
    '{{locale_nome}}': escapeHtml(ctx.locale_nome),
    '{{locale_categoria}}': escapeHtml(ctx.locale_categoria),
    '{{locale_indirizzo}}': escapeHtml(ctx.locale_indirizzo),
    '{{percentuale}}': escapeHtml(ctx.percentuale),
    '{{descrizione_sconto}}': escapeHtml(ctx.descrizione_sconto),
    '{{codice_testuale}}': escapeHtml(ctx.codice_testuale),
    '{{scadenza}}': escapeHtml(ctx.scadenza),
  }
  for (const [k, v] of Object.entries(repl)) {
    html = html.split(k).join(v)
  }

  // Logo: convert relative path to absolute URL so puppeteer headless can
  // load it (the rendering happens off the live site).
  if (ctx.site_url) {
    html = html.replace('src="/logo-guida-bi.svg"', `src="${ctx.site_url}/logo-guida-bi.svg"`)
  }

  // Photo placeholder (unsplash demo URL) → real restaurant photo, or fallback.
  if (ctx.locale_foto) {
    html = html.replace(
      /<img src="https:\/\/images\.unsplash\.com[^"]*" alt="\{\{locale_nome\}\}">/,
      `<img src="${ctx.locale_foto}" alt="${escapeHtml(ctx.locale_nome)}">`
    )
    // Above won't match if {{locale_nome}} was already substituted — fall back:
    html = html.replace(
      /<img src="https:\/\/images\.unsplash\.com[^"]*"[^>]*>/,
      `<img src="${ctx.locale_foto}" alt="">`
    )
  } else {
    // Replace with a soft tinted placeholder instead of unsplash demo.
    html = html.replace(
      /<img src="https:\/\/images\.unsplash\.com[^"]*"[^>]*>/,
      ''
    )
  }

  // QR placeholder div → real QR png as data URL.
  html = html.replace(
    '<div class="cp-qr-placeholder"></div>',
    `<img src="${ctx.qr_data_url}" alt="QR sconto">`
  )

  // Hide scadenza block if no expiry.
  if (!ctx.scadenza) {
    html = html.replace(
      /<div class="cp-scad">[^<]*<\/div>/,
      ''
    )
  }

  // Hide the "notes" instruction block (visible only when previewing the
  // template in Chrome — not part of the PDF output).
  html = html.replace(/<div class="notes">[\s\S]*?<\/div>\s*<\/body>/, '</body>')

  return html
}

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

  // 1) Auth: prendiamo il token dall'header Authorization.
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

  // 2) Lookup redemption — solo se appartiene all'utente.
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

  // 3) Costruisci il payload del template.
  const cuisine = restaurant.cuisine_type || (Array.isArray(restaurant.category) ? restaurant.category[0] : null) || 'Locale'
  const ctx = {
    locale_nome: restaurant.name || 'Ristorante',
    locale_categoria: cuisine,
    locale_indirizzo: shortAddress(restaurant.address),
    locale_foto: getMainPhoto(restaurant),
    percentuale: pctText(deal),
    descrizione_sconto: deal.title || deal.description || 'Valido alla cassa',
    codice_testuale: redemption.qr_code,
    scadenza: formatExpiry(deal),
    site_url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://chiamamibi.com').replace(/\/$/, ''),
  }

  // QR payload identico al sistema scan ristoratore esistente.
  const qrPayload = `${ctx.site_url}/verify?code=${redemption.qr_code}`
  ctx.qr_data_url = await QRCode.toDataURL(qrPayload, {
    width: 600,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  })

  // 4) Carica template + sostituisci placeholders.
  let template
  try {
    template = await loadTemplate()
  } catch (err) {
    console.error('Cannot load template:', err)
    res.status(500).json({ error: 'Template not available' })
    return
  }
  const html = buildHtml(template, ctx)

  // 5) Render con puppeteer-core + @sparticuz/chromium-min.
  // chromium-min NON include il binario nel bundle (≈100MB di librerie +
  // chromium): lo scarica da GitHub releases al primo cold-start, lo cacha
  // in /tmp. Il fork "chromium" pieno aveva bug di shared libraries
  // mancanti su Vercel ("libnss3.so: No such file or directory").
  let browser
  try {
    const [chromiumMod, puppeteerMod] = await Promise.all([
      import('@sparticuz/chromium-min'),
      import('puppeteer-core'),
    ])
    const chromium = chromiumMod.default || chromiumMod
    const puppeteer = puppeteerMod.default || puppeteerMod

    // URL del bundle chromium pre-built dalla release ufficiale Sparticuz.
    // Versione allineata alla libreria (131.0.1).
    const CHROMIUM_PACK_URL = process.env.CHROMIUM_PACK_URL
      || 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'

    const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL)
    console.log('[pdf] launching chromium:', { executablePath, argsCount: chromium.args?.length })

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    // domcontentloaded è più robusto su serverless di networkidle0 (che
    // può hangare se Google Fonts impiega troppo). Diamo poi un piccolo
    // wait esplicito ai font.
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    try { await page.evaluateHandle('document.fonts.ready') } catch { /* font opzionali */ }

    const pdfBytes = await page.pdf({
      format: 'A6',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    // page.pdf() può ritornare Uint8Array in puppeteer-core v23: convertiamo
    // sempre a Buffer prima di scrivere così Vercel non corrompe i byte.
    const pdfBuffer = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes)

    const filename = `sconto-${slugify(restaurant.name)}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', pdfBuffer.length)
    res.setHeader('Cache-Control', 'private, no-store')
    res.status(200).end(pdfBuffer)
  } catch (err) {
    console.error('[pdf] render failed:', err && err.stack ? err.stack : err)
    if (!res.headersSent) {
      res.status(500).json({ error: `PDF render failed: ${err?.message || 'unknown'}` })
    } else {
      try { res.end() } catch { /* ignore */ }
    }
  } finally {
    if (browser) {
      try { await browser.close() } catch { /* ignore */ }
    }
  }
}
