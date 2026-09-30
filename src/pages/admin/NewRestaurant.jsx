import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'
import GoogleMapsImportBlock from '../../components/admin/GoogleMapsImportBlock'
import { Card, Field, Steps } from '../../components/admin/ui'

/**
 * NewRestaurant — "Aggiungi un locale", percorso in tre passi (30/09).
 *
 * Prima la pagina creava una bozza "Nuovo ristorante" appena si apriva e
 * rimandava alla scheda: bastava aprirla per sbaglio (o tornare indietro)
 * e in elenco restava una riga vuota — lo screenshot del proprietario ne
 * aveva due. Adesso la riga nasce solo quando c'è un nome vero:
 *
 *   1. Trova   → link di Google Maps o ricerca per nome (GoogleMapsImportBlock)
 *   2. Controlla → nome, indirizzo, contatti, già precompilati e correggibili;
 *                  avvisa se in guida c'è già un locale con quel nome
 *   3. Crea    → bozza con i dati, e si va alla scheda per foto e racconto
 *
 * Il locale nasce sempre in bozza: pubblicarlo (e far partire le email)
 * resta una scelta fatta dalla scheda.
 */
const STEPS = ['Trova', 'Controlla', 'Crea']

const EMPTY = {
  name: '',
  address: '',
  city: 'Torino',
  neighborhood: '',
  phone: '',
  website: '',
  latitude: '',
  longitude: '',
  google_maps_url: '',
  place_id: '',
  place_id_confidence: null,
  place_id_verified_at: null,
}

export default function NewRestaurant() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [data, setData] = useState(EMPTY)
  const [fromGoogle, setFromGoogle] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [dupes, setDupes] = useState({ name: '', rows: [] })

  const applyImport = useCallback((patch) => {
    setData((prev) => ({ ...prev, ...pickKnown(patch) }))
    // Il place_id arriva in un secondo giro (vedi tryAutoFetchPlaceId):
    // non deve far saltare di nuovo il passo.
    if (patch.name || patch.address || patch.latitude) {
      setFromGoogle(true)
      setStep(1)
    }
  }, [])

  // Doppioni: stesso nome (o quasi) già in guida o in bozza.
  useEffect(() => {
    const name = data.name.trim()
    if (step !== 1 || name.length < 3 || !isSupabaseConfigured()) return undefined
    let cancelled = false
    const id = setTimeout(async () => {
      const { data: rows } = await supabase
        .from('restaurants')
        .select('id, name, address, is_published')
        .ilike('name', `%${name.replace(/[%_]/g, '')}%`)
        .limit(3)
      if (!cancelled) setDupes({ name, rows: rows || [] })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [data.name, step])

  async function handleCreate() {
    const name = data.name.trim()
    if (!name) {
      setError('Serve almeno il nome del locale.')
      return
    }
    if (!isSupabaseConfigured()) {
      setError('Supabase non configurato.')
      return
    }
    setError(null)
    setCreating(true)
    setStep(2)

    const lat = parseFloat(data.latitude)
    const lng = parseFloat(data.longitude)
    const base = {
      name,
      address: data.address.trim(),
      city: data.city.trim() || 'Torino',
      neighborhood: data.neighborhood.trim() || null,
      phone: data.phone.trim() || null,
      website: data.website.trim() || null,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      google_maps_url: data.google_maps_url || null,
      place_id: data.place_id || null,
      place_id_confidence: data.place_id_confidence,
      place_id_verified_at: null,
      // PIN opzionale: alla creazione NON viene generato. L'admin lo attiva
      // dalla sezione Credenziali quando serve (è prerequisito per gli sconti).
      partner_email: null,
      verify_pin: null,
      last_pin_rotation_at: null,
      is_published: false,
      is_disabled: false,
      category: [],
      recommended_for: [],
      moments: [],
      photos: [],
      price_range: 2,
    }

    // Lo slug è il nome pulito; se è già preso (due "Da Mario") si aggiunge
    // un pezzetto che lo rende unico, come faceva la versione di prima.
    const clean = slugify(name) || 'locale'
    let result = await supabase.from('restaurants').insert({ ...base, slug: clean }).select('id').single()
    if (result.error && (result.error.code === '23505' || /duplicate|unique/i.test(result.error.message || ''))) {
      result = await supabase
        .from('restaurants')
        .insert({ ...base, slug: `${clean}-${Date.now().toString(36).slice(-4)}` })
        .select('id')
        .single()
    }
    if (result.error) {
      setCreating(false)
      setStep(1)
      setError('Non sono riuscito a crearlo: ' + (result.error.message || 'errore sconosciuto'))
      return
    }
    navigate(`/admin/restaurant/${result.data.id}/edit?new=1`, { replace: true })
  }

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  const hasPin = data.latitude && data.longitude
  // I doppioni valgono per il nome scritto adesso, non per uno di prima.
  const shownDupes = step === 1 && dupes.name === data.name.trim() ? dupes.rows : []
  const canCreate = data.name.trim().length > 0 && !creating

  return (
    <AdminLayout title="Aggiungi un locale" focus back={{ to: '/admin/restaurants', label: 'Ristoranti' }}>
      <div className="adm adm-page adm-page--narrow">
        <div className="adm-crumbs adm-crumbs--focus">
          <Link to="/admin/restaurants">Ristoranti</Link> › <b>Aggiungi un locale</b>
        </div>
        <div className="adm-head" style={{ marginBottom: 18 }}>
          <div>
            <h1 className="adm-title">Aggiungi un locale</h1>
            <p className="adm-sub">Parti da Google Maps: nome, indirizzo e contatti si compilano da soli. Foto e racconto dopo, nella scheda.</p>
          </div>
        </div>

        <Steps steps={STEPS} current={step} />

        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <motion.div key="find" {...stepMotion}>
              <Card
                icon="📍"
                iconBg="var(--adm-coral-wash)"
                title="Dove si trova?"
                hint="Incolla il link di Google Maps, oppure cerca il locale per nome."
              >
                <GoogleMapsImportBlock variant="hero" onApply={applyImport} />
              </Card>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  type="button"
                  className="adm-btn adm-btn--ghost"
                  onClick={() => { setFromGoogle(false); setStep(1) }}
                >
                  Non è su Google? Scrivo io i dati →
                </button>
              </div>
            </motion.div>
          )}

          {step >= 1 && (
            <motion.div key="check" {...stepMotion}>
              {fromGoogle && (
                <div className="adm-note adm-note--ok" style={{ marginBottom: 14 }}>
                  <span aria-hidden>✨</span>
                  <span>Trovato su Google Maps. Controlla che sia giusto e correggi quello che serve.</span>
                </div>
              )}

              <Card icon="🍽️" title="Il locale" hint="Questi dati si vedono sulla scheda pubblica.">
                <Field label="Nome" hint="obbligatorio" htmlFor="nr-name">
                  <input
                    id="nr-name"
                    className="adm-input adm-input--big"
                    value={data.name}
                    onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Es. Trattoria da Bi"
                    autoFocus={!fromGoogle}
                  />
                </Field>

                {shownDupes.length > 0 && (
                  <div className="adm-note adm-note--warn" style={{ marginTop: 10, flexDirection: 'column', gap: 6 }}>
                    <b>C'è già qualcosa di simile in guida:</b>
                    {shownDupes.map((r) => (
                      <Link key={r.id} to={`/admin/restaurant/${r.id}/edit`} style={{ color: 'inherit' }}>
                        {r.name}{r.address ? ` · ${String(r.address).split(',')[0]}` : ''}{r.is_published === false ? ' (bozza)' : ''} →
                      </Link>
                    ))}
                  </div>
                )}

                <Field label="Indirizzo" htmlFor="nr-address" style={{ marginTop: 16 }}>
                  <input
                    id="nr-address"
                    className="adm-input"
                    value={data.address}
                    onChange={(e) => setData((d) => ({ ...d, address: e.target.value }))}
                    placeholder="Via Roma 1, Torino"
                  />
                </Field>
                <div className="adm-grid-2" style={{ marginTop: 16 }}>
                  <Field label="Città" htmlFor="nr-city">
                    <input
                      id="nr-city"
                      className="adm-input"
                      value={data.city}
                      onChange={(e) => setData((d) => ({ ...d, city: e.target.value }))}
                    />
                  </Field>
                  <Field label="Quartiere" hint="facoltativo" htmlFor="nr-hood">
                    <input
                      id="nr-hood"
                      className="adm-input"
                      value={data.neighborhood}
                      onChange={(e) => setData((d) => ({ ...d, neighborhood: e.target.value }))}
                      placeholder="Es. San Salvario"
                    />
                  </Field>
                </div>
                <div className="adm-grid-2" style={{ marginTop: 16 }}>
                  <Field label="Telefono" hint="facoltativo" htmlFor="nr-phone">
                    <input
                      id="nr-phone"
                      className="adm-input"
                      type="tel"
                      value={data.phone}
                      onChange={(e) => setData((d) => ({ ...d, phone: e.target.value }))}
                      placeholder="011 …"
                    />
                  </Field>
                  <Field label="Sito" hint="facoltativo" htmlFor="nr-web">
                    <input
                      id="nr-web"
                      className="adm-input"
                      type="url"
                      inputMode="url"
                      value={data.website}
                      onChange={(e) => setData((d) => ({ ...d, website: e.target.value }))}
                      placeholder="https://…"
                      autoCapitalize="none"
                    />
                  </Field>
                </div>

                <div
                  className={`adm-note ${hasPin ? 'adm-note--ok' : 'adm-note--warn'}`}
                  style={{ marginTop: 16 }}
                >
                  <span aria-hidden>{hasPin ? '📍' : '⚠️'}</span>
                  <span>
                    {hasPin
                      ? 'Posizione sulla mappa trovata: il pin è pronto.'
                      : 'Ancora senza posizione sulla mappa: la metti nella scheda (Dettagli → Google Maps) prima di pubblicarlo.'}
                  </span>
                </div>
              </Card>

              {error && (
                <div className="adm-note adm-note--err" style={{ marginTop: 14 }} role="alert">{error}</div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="adm-btn adm-btn--lg"
                  onClick={() => { setStep(0); setError(null) }}
                  disabled={creating}
                >
                  ← Cerca di nuovo
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn--primary adm-btn--lg"
                  style={{ flex: 1, minWidth: 220 }}
                  onClick={handleCreate}
                  disabled={!canCreate}
                >
                  {creating ? 'Creo la bozza…' : 'Crea la bozza e continua →'}
                </button>
              </div>
              <p className="adm-help" style={{ marginTop: 10, textAlign: 'center' }}>
                Nasce in bozza: nessuno lo vede e nessuna email parte finché non lo pubblichi.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  )
}

const stepMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.24, ease: [0.23, 1, 0.32, 1] },
}

// Solo i campi che questa pagina sa salvare (GoogleMapsImportBlock manda
// anche lo slug, che qui si ricalcola dal nome definitivo).
function pickKnown(patch) {
  const out = {}
  for (const k of Object.keys(EMPTY)) {
    if (patch[k] != null && patch[k] !== '') out[k] = typeof EMPTY[k] === 'string' ? String(patch[k]) : patch[k]
  }
  return out
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}
