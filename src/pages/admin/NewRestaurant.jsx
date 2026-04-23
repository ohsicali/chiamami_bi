import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { reverseGeocode } from '../../lib/utils/geocoding'
import AdminLayout from '../../components/Layout/AdminLayout'
import DettagliTab from '../../components/admin/tabs/DettagliTab'
import FGroup from '../../components/admin/tabs/_FGroup'
import { FField, FInput } from '../../components/admin/tabs/_Fields'

const EMPTY_FORM = {
  name: '',
  slug: '',
  tagline: '',
  our_review: '',
  our_tip: '',
  address: '',
  city: 'Torino',
  phone: '',
  website: '',
  google_maps_url: '',
  latitude: '',
  longitude: '',
  category: [],
  cuisine_type: '',
  price_range: 2,
  recommended_for: [],
  photos: [],
  partner_email: '',
  is_published: false,
  noindex: false,
  // SEO (compilabili post-save dal drawer con AI)
  seo_title: '',
  seo_description: '',
  og_title: '',
  og_description: '',
  og_image: '',
}

/**
 * NewRestaurant — pagina full-page per creare una scheda ristorante.
 *
 * Scope ristretto alla compilazione essenziale (Dettagli + Maps import +
 * partner email). Foto, piatti, sconti, SEO avanzato vengono completati
 * nel drawer di edit SUBITO dopo il salvataggio, così il flow è continuo:
 *
 *   Nuovo → compila essenziali → Salva → redirect a
 *   /admin/restaurants?edit={newId} → drawer 6 tab aperto in edit.
 *
 * Il PIN viene generato automaticamente al salva.
 * Se partner_email è compilata + "Salva e pubblica", invia email benvenuto.
 */
export default function NewRestaurant() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState(EMPTY_FORM)
  const [mapsUrl, setMapsUrl] = useState('')
  const [mapsFilling, setMapsFilling] = useState(false)
  const [mapsError, setMapsError] = useState(null)
  // Name-search fallback (shown when Google Maps URL resolution hits CAPTCHA)
  const [showNameSearch, setShowNameSearch] = useState(false)
  const [nameQuery, setNameQuery] = useState('')
  const [nameSearching, setNameSearching] = useState(false)
  const [saving, setSaving] = useState(null) // null | 'draft' | 'publish'
  const [saveError, setSaveError] = useState(null)
  const [createdPin, setCreatedPin] = useState(null)
  const [prefillBanner, setPrefillBanner] = useState(null)

  // Pre-fill from URL query params (used when arriving from Candidature
  // via "+ Apri pre-compilata" — carries name/email/city from the application).
  useEffect(() => {
    const name = searchParams.get('name')
    const email = searchParams.get('email')
    const city = searchParams.get('city')
    const phone = searchParams.get('phone')
    const website = searchParams.get('website')
    if (!name && !email && !city && !phone && !website) return
    const patch = {}
    if (name) {
      patch.name = name
      patch.slug = slugify(name)
    }
    if (email) patch.partner_email = email
    if (city) patch.city = city
    if (phone) patch.phone = phone
    if (website) patch.website = website
    setForm((prev) => ({ ...prev, ...patch }))
    setPrefillBanner({
      fields: Object.keys(patch).filter((k) => k !== 'slug').length,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateField(patch) {
    setForm((prev) => ({
      ...prev,
      ...patch,
      // auto-derive slug when name changes and user hasn't manually set slug yet
      ...(patch.name !== undefined && !prev.slug ? { slug: slugify(patch.name) } : {}),
    }))
  }

  async function handleImportFromMaps() {
    const url = mapsUrl.trim()
    if (!url) {
      setMapsError('Incolla un link Google Maps')
      return
    }
    setMapsError(null)
    setMapsFilling(true)
    setShowNameSearch(false)
    try {
      // Reject CID URLs (not resolvable server-side)
      if (/[?&]cid=\d+/.test(url)) {
        setMapsError('Link CID non supportato. Dall\'app Maps: Condividi → Copia link (inizia con maps.app.goo.gl).')
        setMapsFilling(false)
        return
      }

      const patch = {}
      const isShortUrl = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|share\.google)\//i.test(url)
      const placeMatch = url.match(/\/place\/([^/@]+)/)
      const coordMatch = url.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/)

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
          body: JSON.stringify({ url }),
        })
        const data = await res.json()
        if (data?.error) {
          // Google CAPTCHA fallback → offer name-search
          if (data.captcha) {
            setShowNameSearch(true)
            setMapsError('Google ha bloccato il link. Cerca il ristorante per nome qui sotto.')
          } else {
            setMapsError(data.error)
          }
          setMapsFilling(false)
          return
        }
        if (data.name && !isInvalidName(data.name)) patch.name = data.name
        if (data.address) patch.address = data.address
        if (data.website) patch.website = data.website
        if (data.phone) patch.phone = data.phone
        if (data.latitude) patch.latitude = String(data.latitude)
        if (data.longitude) patch.longitude = String(data.longitude)
        if (data.resolved_url && data.resolved_url !== url) patch.google_maps_url = data.resolved_url
      }

      if (!patch.name && !patch.latitude) {
        setMapsError('Non sono riuscito a estrarre dati da questo link.')
        setMapsFilling(false)
        return
      }

      patch.google_maps_url = patch.google_maps_url || url
      if (patch.name) patch.slug = slugify(patch.name)

      // Mapbox reverse-geocode fallback: if we have coords but no address,
      // try to resolve via Mapbox (token VITE_MAPBOX_TOKEN)
      if (patch.latitude && patch.longitude && !patch.address) {
        try {
          const address = await reverseGeocode(parseFloat(patch.latitude), parseFloat(patch.longitude))
          if (address) patch.address = address
        } catch {
          // silent — not fatal
        }
      }

      updateField(patch)
    } catch (err) {
      setMapsError('Errore nella compilazione: ' + err.message)
    } finally {
      setMapsFilling(false)
    }
  }

  // Name-search fallback (Google CAPTCHA path). Calls /api/resolve-maps with
  // { query } instead of { url } — the endpoint uses Google Places text search.
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
        setMapsError(data.error)
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
      if (patch.name) patch.slug = slugify(patch.name)
      updateField(patch)
      setShowNameSearch(false)
      setNameQuery('')
      setMapsError(null)
    } catch (err) {
      setMapsError('Errore ricerca: ' + err.message)
    } finally {
      setNameSearching(false)
    }
  }

  async function handleSave(mode) {
    setSaveError(null)
    if (!form.name.trim()) {
      setSaveError('Il nome è obbligatorio.')
      return
    }
    if (!form.slug.trim()) {
      setSaveError('Lo slug è obbligatorio (auto-derivato dal nome se vuoto).')
      return
    }
    if (!isSupabaseConfigured()) {
      setSaveError('Supabase non configurato.')
      return
    }
    setSaving(mode)

    const pin = generatePin()
    const nowIso = new Date().toISOString()

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      tagline: form.tagline || null,
      our_review: form.our_review || null,
      our_tip: form.our_tip || null,
      address: form.address || null,
      city: form.city || 'Torino',
      phone: form.phone || null,
      website: form.website || null,
      google_maps_url: form.google_maps_url || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      category: form.category,
      cuisine_type: form.cuisine_type || (form.category?.[0] ?? null),
      price_range: form.price_range ?? 2,
      recommended_for: form.recommended_for,
      photos: form.photos,
      partner_email: form.partner_email || null,
      verify_pin: pin,
      last_pin_rotation_at: nowIso,
      is_published: mode === 'publish',
      is_disabled: false,
      noindex: form.noindex === true,
      seo_title: form.seo_title || null,
      seo_description: form.seo_description || null,
      og_title: form.og_title || null,
      og_description: form.og_description || null,
      og_image: form.og_image || null,
    }

    try {
      const { data, error } = await supabase
        .from('restaurants')
        .insert(payload)
        .select('id')
        .single()

      if (error) throw error
      const newId = data.id

      // If publish + partner_email → kick off welcome email.
      // Non-blocking: if email fails, still complete the save.
      if (mode === 'publish' && form.partner_email) {
        try {
          const { data: sess } = await supabase.auth.getSession()
          const token = sess?.session?.access_token
          if (token) {
            await fetch('/api/send-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                type: 'partner',
                to: form.partner_email,
                nomeLocale: form.name.trim(),
                pin,
                restaurantId: newId,
              }),
            })
          }
        } catch (err) {
          console.warn('partner welcome email failed:', err)
        }
      }

      setCreatedPin(pin)
      // Give user 1.2s to see the PIN, then redirect to drawer
      setTimeout(() => {
        navigate(`/admin/restaurants?edit=${newId}`)
      }, 1200)
    } catch (err) {
      setSaveError('Errore salvataggio: ' + (err.message || 'unknown'))
      setSaving(null)
    }
  }

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Nuovo ristorante">
      <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }} className="max-md:!p-[18px]">
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 24,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                letterSpacing: '0.04em',
                marginBottom: 8,
              }}
            >
              Gestione › <Link to="/admin/restaurants" style={{ color: 'inherit', textDecoration: 'none' }}>Ristoranti</Link> ›{' '}
              <b style={{ color: 'var(--color-ink)', fontWeight: 800 }}>Nuovo</b>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 900,
                fontSize: 32,
                letterSpacing: '-0.025em',
                margin: 0,
                color: 'var(--color-ink, #22181C)',
              }}
            >
              Nuovo ristorante
            </h1>
            <div style={{ marginTop: 6, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 14, fontWeight: 500 }}>
              Compila l'essenziale. Foto, piatti, sconti e SEO li finisci nel drawer subito dopo.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
            <SaveButton
              kind="ghost"
              disabled={saving != null}
              loading={saving === 'draft'}
              onClick={() => handleSave('draft')}
            >
              Salva bozza
            </SaveButton>
            <SaveButton
              kind="primary"
              disabled={saving != null}
              loading={saving === 'publish'}
              onClick={() => handleSave('publish')}
            >
              Salva e pubblica
            </SaveButton>
          </div>
        </div>

        {/* ── Error / Success banner ── */}
        {saveError && (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--color-danger-wash, #FCE8E4)',
              color: 'var(--color-danger, #C0392B)',
              borderRadius: 12,
              marginBottom: 16,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {saveError}
          </div>
        )}
        {createdPin && (
          <div
            style={{
              padding: '16px 20px',
              background: 'var(--color-green-wash, #E8F5D8)',
              color: '#2C7A4A',
              borderRadius: 14,
              marginBottom: 16,
              fontSize: 14,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span>✓ Salvato. PIN generato:</span>
            <code
              style={{
                fontFamily: 'var(--font-wordmark, "Alfa Slab One")',
                fontSize: 22,
                letterSpacing: '0.14em',
                padding: '4px 10px',
                background: '#fff',
                borderRadius: 8,
                color: 'var(--color-ink)',
              }}
            >
              {createdPin}
            </code>
            <span style={{ flex: 1 }}>Apro il drawer di edit…</span>
          </div>
        )}

        {/* ── Pre-fill banner (from Candidature query params) ── */}
        {prefillBanner && (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--color-oro-wash, #F5EDDD)',
              color: 'var(--color-oro, #B08954)',
              border: '1px solid rgba(176,137,84,0.25)',
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span aria-hidden>✨</span>
            <span>
              Pre-compilato da Candidature · {prefillBanner.fields} camp{prefillBanner.fields === 1 ? 'o' : 'i'} già valorizzat{prefillBanner.fields === 1 ? 'o' : 'i'}. Rivedi e completa.
            </span>
          </div>
        )}

        {/* ── Google Maps import banner ── */}
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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/… oppure link completo"
              style={{
                flex: 1,
                minWidth: 260,
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
              onClick={handleImportFromMaps}
              disabled={mapsFilling || !mapsUrl.trim()}
              style={{
                background: 'var(--color-corallo, #E8453C)',
                color: '#fff',
                border: 0,
                padding: '10px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                cursor: mapsFilling ? 'wait' : 'pointer',
                fontFamily: 'var(--font-sans)',
                boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
                whiteSpace: 'nowrap',
                opacity: !mapsUrl.trim() ? 0.5 : 1,
              }}
            >
              {mapsFilling ? 'Compilo…' : 'Compila automaticamente'}
            </button>
          </div>
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
          {mapsError && (
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
              {mapsError}
            </div>
          )}

          {/* Name-search fallback (appears when Google blocks the URL resolution) */}
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
        </div>

        {/* ── PIN placeholder info box ── */}
        <FGroup title="Credenziali PIN · al momento del salva" variant="corallo">
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div
              style={{
                flex: '1 1 200px',
                minWidth: 0,
              }}
            >
              <FField
                label="Email del ristoratore (opzionale)"
                hint="Se compilata + pubblicazione, ricevera email benvenuto con il PIN appena generato."
              >
                <FInput
                  value={form.partner_email}
                  onChange={(v) => updateField({ partner_email: v })}
                  placeholder="daniele@consorzio.it"
                  type="email"
                />
              </FField>
            </div>
            <div
              style={{
                flex: '1 1 240px',
                background: '#fff',
                border: '1px dashed var(--color-corallo-soft, #F6B7B1)',
                borderRadius: 10,
                padding: 12,
                fontSize: 12,
                color: 'var(--color-ink-70, rgba(34,24,28,0.7))',
                lineHeight: 1.55,
              }}
            >
              <b style={{ color: 'var(--color-ink)' }}>Il PIN a 6 cifre viene generato al Salva.</b>{' '}
              Lo vedrai subito qui e potrai copiarlo, oppure verrà inviato via email al ristoratore (se hai compilato l'email qui sopra e hai cliccato "Salva e pubblica").
            </div>
          </div>
        </FGroup>

        {/* ── Dettagli tab body ── */}
        <DettagliTab form={form} onChange={updateField} />

        {/* ── Post-save info ── */}
        <div
          style={{
            marginTop: 10,
            padding: '14px 18px',
            background: 'var(--color-cream, #F5F0E4)',
            borderRadius: 14,
            fontSize: 12,
            color: 'var(--color-ink-70, rgba(34,24,28,0.7))',
            lineHeight: 1.6,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }} aria-hidden>💡</span>
          <span>
            <b style={{ color: 'var(--color-ink)' }}>Dopo aver salvato</b> si apre il drawer di edit con tutti i 6 tab: lì completi <b>foto</b>, <b>piatti specifici</b>, <b>sconto</b> e <b>SEO</b> (con il bottone ✨ Genera con AI). La scheda resta in bozza finché clicchi "Salva e pubblica".
          </span>
        </div>

        {/* ── Bottom save actions (mobile handy) ── */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 24,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
          className="md:hidden"
        >
          <SaveButton
            kind="ghost"
            disabled={saving != null}
            loading={saving === 'draft'}
            onClick={() => handleSave('draft')}
          >
            Salva bozza
          </SaveButton>
          <SaveButton
            kind="primary"
            disabled={saving != null}
            loading={saving === 'publish'}
            onClick={() => handleSave('publish')}
          >
            Salva e pubblica
          </SaveButton>
        </div>
      </div>
    </AdminLayout>
  )
}

/* ------------------------------------------------------------------ */
/*  SaveButton                                                         */
/* ------------------------------------------------------------------ */
function SaveButton({ kind, loading, disabled, onClick, children }) {
  const base = {
    padding: '10px 20px',
    borderRadius: 999,
    fontFamily: 'var(--font-sans)',
    fontWeight: 800,
    fontSize: 13,
    cursor: loading || disabled ? 'wait' : 'pointer',
    transition: 'transform 0.1s',
    opacity: disabled ? 0.6 : 1,
    border: 0,
  }
  const styles =
    kind === 'primary'
      ? {
          background: 'var(--color-corallo, #E8453C)',
          color: '#fff',
          boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
        }
      : {
          background: 'transparent',
          border: '1px solid var(--color-line, #EAE3D7)',
          color: 'var(--color-ink, #22181C)',
        }
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} style={{ ...base, ...styles }}>
      {loading ? '…' : children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function slugify(s) {
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

function generatePin() {
  const n = Math.floor(Math.random() * 900000) + 100000
  return String(n)
}
