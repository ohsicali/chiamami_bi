import { useState } from 'react'
import { reverseGeocode } from '../../lib/utils/geocoding'
import { supabase } from '../../lib/supabase'

/**
 * GoogleMapsImportBlock — shared block for auto-filling restaurant data
 * from a Google Maps link. Handles:
 *   - URL paste resolution via POST /api/resolve-maps
 *   - CID URL detection (not resolvable server-side, shows explainer)
 *   - Google CAPTCHA fallback → name-search via same endpoint with {query}
 *   - Mapbox reverse-geocode when coords are returned without address
 *   - Direct parsing of full Google Maps URLs (/place/Name/@lat,lng)
 *
 * Props:
 *   variant   → 'banner' (peach gradient, new page) | 'compact' (line, edit drawer)
 *   onApply   → ({ name, slug, address, website, phone, latitude, longitude,
 *                   google_maps_url, place_id?, place_id_confidence? }) => void
 *   onSlug    → (name) => slug (optional custom slugifier; default below)
 *   currentPlaceId → skip auto place_id fetch if this is already set
 *
 * Migrated from legacy RestaurantForm.jsx (handleGoogleFill + handleNameSearch)
 * and used by both NewRestaurant.jsx and DettagliTab.jsx.
 *
 * BONUS: after a successful import, if we have name+address AND no place_id
 * is yet set, we auto-call /api/admin-actions search-places and apply the
 * top candidate (if confidence >= 0.65) with place_id_verified_at=null.
 * The admin still has to press "Verifica come corretto" to enable the
 * public hours cache — zero risk of mis-applying a wrong place.
 */
export default function GoogleMapsImportBlock({
  variant = 'banner',
  onApply,
  onSlug = defaultSlugify,
  currentPlaceId,
}) {
  const [url, setUrl] = useState('')
  const [filling, setFilling] = useState(false)
  const [error, setError] = useState(null)
  const [showNameSearch, setShowNameSearch] = useState(false)
  const [nameQuery, setNameQuery] = useState('')
  const [nameSearching, setNameSearching] = useState(false)
  const [expanded, setExpanded] = useState(variant === 'banner')

  async function handleImportFromUrl() {
    const u = url.trim()
    if (!u) {
      setError('Incolla un link Google Maps')
      return
    }
    setError(null)
    setFilling(true)
    setShowNameSearch(false)
    try {
      if (/[?&]cid=\d+/.test(u)) {
        setError('Link CID non supportato. Dall\'app Maps: Condividi → Copia link (inizia con maps.app.goo.gl).')
        setFilling(false)
        return
      }

      const patch = {}
      const isShortUrl = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|share\.google)\//i.test(u)
      const placeMatch = u.match(/\/place\/([^/@]+)/)
      const coordMatch = u.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/)

      if (!isShortUrl && placeMatch) {
        const name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
        if (!isInvalidName(name)) patch.name = name
        if (coordMatch) {
          patch.latitude = String(parseFloat(coordMatch[1]))
          patch.longitude = String(parseFloat(coordMatch[2]))
        }
      } else {
        const res = await fetch('/api/resolve-maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: u }),
        })
        const data = await res.json()
        if (data?.error) {
          if (data.captcha) {
            setShowNameSearch(true)
            setError('Google ha bloccato il link. Cerca il ristorante per nome qui sotto.')
          } else {
            setError(data.error)
          }
          setFilling(false)
          return
        }
        if (data.name && !isInvalidName(data.name)) patch.name = data.name
        if (data.address) patch.address = data.address
        if (data.website) patch.website = data.website
        if (data.phone) patch.phone = data.phone
        if (data.latitude) patch.latitude = String(data.latitude)
        if (data.longitude) patch.longitude = String(data.longitude)
        if (data.resolved_url && data.resolved_url !== u) patch.google_maps_url = data.resolved_url
      }

      if (!patch.name && !patch.latitude) {
        setError('Non sono riuscito a estrarre dati da questo link.')
        setFilling(false)
        return
      }

      patch.google_maps_url = patch.google_maps_url || u

      if (patch.name && onSlug) patch.slug = onSlug(patch.name)

      if (patch.latitude && patch.longitude && !patch.address) {
        try {
          const address = await reverseGeocode(parseFloat(patch.latitude), parseFloat(patch.longitude))
          if (address) patch.address = address
        } catch {
          // silent — not fatal
        }
      }

      // Estrai la città dall'indirizzo (anziché lasciare il default "Torino")
      if (patch.address) {
        const city = extractCityFromAddress(patch.address)
        if (city) patch.city = city
      }

      onApply?.(patch)
      if (variant === 'compact') setUrl('')

      // Auto-fetch place_id if we have enough data and none is set yet.
      if (patch.name && !currentPlaceId) {
        tryAutoFetchPlaceId(patch.name, patch.address || '')
      }
    } catch (err) {
      setError('Errore nella compilazione: ' + err.message)
    } finally {
      setFilling(false)
    }
  }

  async function tryAutoFetchPlaceId(name, address) {
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) return
      const res = await fetch('/api/admin-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'search-places', name, address }),
      })
      const data = await res.json()
      if (!res.ok) return
      const top = data.candidates?.[0]
      if (top && top.confidence >= 0.65) {
        onApply?.({
          place_id: top.place_id,
          place_id_confidence: top.confidence,
          place_id_verified_at: null,
        })
      }
    } catch {
      // silent — admin can still "Cerca su Google" manually from the Places block
    }
  }

  async function handleNameSearch() {
    const q = nameQuery.trim()
    if (!q) return
    setNameSearching(true)
    try {
      const res = await fetch('/api/resolve-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      if (data?.error) {
        setError(data.error)
        setNameSearching(false)
        return
      }
      const patch = {}
      if (data.name) patch.name = data.name
      if (data.address) patch.address = data.address
      if (data.latitude) patch.latitude = String(data.latitude)
      if (data.longitude) patch.longitude = String(data.longitude)
      if (data.phone) patch.phone = data.phone
      if (data.website) patch.website = data.website
      if (data.resolved_url) patch.google_maps_url = data.resolved_url
      if (patch.name && onSlug) patch.slug = onSlug(patch.name)
      if (patch.address) {
        const city = extractCityFromAddress(patch.address)
        if (city) patch.city = city
      }
      onApply?.(patch)
      setShowNameSearch(false)
      setNameQuery('')
      setError(null)

      // Auto-fetch place_id from name-search result too
      if (patch.name && !currentPlaceId) {
        tryAutoFetchPlaceId(patch.name, patch.address || '')
      }
    } catch (err) {
      setError('Errore ricerca: ' + err.message)
    } finally {
      setNameSearching(false)
    }
  }

  // ── Compact variant (edit drawer): single line, collapsible ──
  if (variant === 'compact') {
    if (!expanded) {
      return (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            background: 'transparent',
            border: '1px dashed var(--color-corallo-soft, #F6B7B1)',
            color: 'var(--color-corallo, #E8453C)',
            padding: '8px 14px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            marginBottom: 10,
          }}
        >
          📍 Aggiorna da Google Maps
        </button>
      )
    }
    return (
      <div
        style={{
          background: 'var(--color-corallo-wash, #FDEDEB)',
          border: '1px solid var(--color-corallo-soft, #F6B7B1)',
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-corallo, #E8453C)',
          }}
        >
          📍 Aggiorna da Google Maps
          <button
            type="button"
            onClick={() => { setExpanded(false); setUrl(''); setError(null); setShowNameSearch(false) }}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
              fontSize: 14,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>
        {renderForm()}
      </div>
    )
  }

  // ── Banner variant (new page): big gradient card ──
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #FFF1EF, #FCE4E1)',
        border: '1px solid var(--color-corallo-soft, #F6B7B1)',
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          fontFamily: 'var(--font-sans)',
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-corallo, #E8453C)',
        }}
      >
        📍 Importa da Google Maps
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0,
            textTransform: 'none',
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
          }}
        >
          opzionale
        </span>
      </div>
      {renderForm()}
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
          fontWeight: 600,
          lineHeight: 1.5,
        }}
      >
        Precompila nome, indirizzo, telefono, website, coordinate. Poi tu revisioni e aggiungi la voce editoriale.
      </div>
    </div>
  )

  function renderForm() {
    return (
      <>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://maps.app.goo.gl/… oppure link completo"
            style={{
              flex: 1,
              minWidth: 220,
              border: '1px solid var(--color-corallo-soft, #F6B7B1)',
              borderRadius: 10,
              padding: '10px 14px',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              background: '#fff',
              outline: 'none',
              color: 'var(--color-ink)',
            }}
          />
          <button
            type="button"
            onClick={handleImportFromUrl}
            disabled={filling || !url.trim()}
            style={{
              background: 'var(--color-corallo, #E8453C)',
              color: '#fff',
              border: 0,
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: filling ? 'wait' : 'pointer',
              fontFamily: 'var(--font-sans)',
              boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
              whiteSpace: 'nowrap',
              opacity: !url.trim() ? 0.5 : 1,
            }}
          >
            {filling ? 'Compilo…' : 'Compila auto'}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              background: 'var(--color-danger-wash, #FCE8E4)',
              color: 'var(--color-danger, #C0392B)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {showNameSearch && (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              background: '#fff',
              borderRadius: 10,
              border: '1px dashed var(--color-corallo-soft, #F6B7B1)',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--color-corallo, #E8453C)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                width: '100%',
                marginBottom: 2,
              }}
            >
              🔎 Cerca per nome
            </div>
            <input
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNameSearch())}
              placeholder="Nome del ristorante + zona (es. Consorzio Torino)"
              style={{
                flex: 1,
                minWidth: 220,
                border: '1px solid var(--color-line, #EAE3D7)',
                borderRadius: 10,
                padding: '9px 12px',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                background: '#fff',
                outline: 'none',
                color: 'var(--color-ink)',
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleNameSearch}
              disabled={nameSearching || !nameQuery.trim()}
              style={{
                background: 'var(--color-ink, #22181C)',
                color: '#fff',
                border: 0,
                padding: '9px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                cursor: nameSearching || !nameQuery.trim() ? 'wait' : 'pointer',
                fontFamily: 'var(--font-sans)',
                opacity: !nameQuery.trim() ? 0.5 : 1,
              }}
            >
              {nameSearching ? 'Cerco…' : 'Cerca'}
            </button>
          </div>
        )}
      </>
    )
  }
}

function defaultSlugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function isInvalidName(name) {
  const cities = ['torino', 'milano', 'roma', 'napoli', 'firenze', 'bologna', 'genova', 'palermo']
  return /^\d+$/.test(name) || cities.includes(name.toLowerCase())
}

/**
 * Estrae la città da un indirizzo formattato Google.
 * Esempi:
 *  - "Via Roma 10, 10100 Torino TO, Italia"  → "Torino"
 *  - "Piazza Duomo 5, 20121 Milano MI, Italy" → "Milano"
 *  - "Via Garibaldi 1, Asti, Italia"          → "Asti" (no CAP)
 *  - "23 Rue de Rivoli, 75001 Paris, France"  → "Paris"
 */
function extractCityFromAddress(address) {
  if (!address || typeof address !== 'string') return null
  const segments = address.split(',').map((s) => s.trim()).filter(Boolean)
  if (!segments.length) return null

  // 1. Cerca segmento con CAP italiano/EU all'inizio: "10100 Torino TO" o "75001 Paris"
  for (const seg of segments) {
    const m = seg.match(/^\d{4,5}\s+(.+?)(?:\s+[A-Z]{2})?$/)
    if (m) {
      const city = m[1].trim()
      // Filtra eventuali codici provincia rimasti incollati (es. "Torino TO")
      return city.replace(/\s+[A-Z]{2}$/, '').trim()
    }
  }

  // 2. Fallback: il segmento prima dell'ultimo (che di solito è il paese)
  const COUNTRY_NAMES = [
    'italia', 'italy', 'francia', 'france', 'spagna', 'spain',
    'germania', 'germany', 'svizzera', 'switzerland', 'austria',
    'regno unito', 'united kingdom', 'uk',
  ]
  if (segments.length >= 2) {
    const last = segments[segments.length - 1].toLowerCase()
    if (COUNTRY_NAMES.includes(last)) {
      return segments[segments.length - 2].replace(/\s+[A-Z]{2}$/, '').trim()
    }
  }

  // 3. Ultimo tentativo: l'ultimo segmento se non sembra un paese
  const last = segments[segments.length - 1]
  if (last && !COUNTRY_NAMES.includes(last.toLowerCase())) {
    return last.replace(/\s+[A-Z]{2}$/, '').trim()
  }

  return null
}
