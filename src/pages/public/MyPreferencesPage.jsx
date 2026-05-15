import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'

/**
 * /profile/preferences · "Le mie preferenze per Bi"
 *
 * Pagina semplice di settings memorizzati cross-conversazione. Vengono
 * iniettati nel system prompt di /api/ai così Bi sa la dieta, le zone
 * preferite, il budget max e le note libere — anche al primo messaggio
 * di una nuova chat.
 *
 * Tabella: ai_user_preferences (RLS = solo owner). Schema:
 *   user_id (PK), dietary text[], favorite_zones text[],
 *   price_max smallint, notes text.
 */

const DIETARY_OPTIONS = [
  'Vegetariano',
  'Vegano',
  'Pescetariano',
  'Senza glutine',
  'Senza lattosio',
]

const ZONE_OPTIONS = [
  'Centro',
  'Quadrilatero',
  'Vanchiglia',
  'San Salvario',
  'Crocetta',
  'Aurora',
  'Mo Sarpi',
  'Cit Turin',
]

const PRICE_OPTIONS = [
  { value: 1, label: '€',    sub: 'fino a ~15€' },
  { value: 2, label: '€€',   sub: 'fino a ~30€' },
  { value: 3, label: '€€€',  sub: 'fino a ~50€' },
  { value: 4, label: '€€€€', sub: 'oltre 50€' },
]

export default function MyPreferencesPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const [dietary, setDietary] = useState([])
  const [favoriteZones, setFavoriteZones] = useState([])
  const [priceMax, setPriceMax] = useState(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) { setLoading(false); return }
    let cancelled = false
    supabase
      .from('ai_user_preferences')
      .select('dietary, favorite_zones, price_max, notes')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err && err.code !== 'PGRST116') {
          setError(err.message)
        } else if (data) {
          setDietary(Array.isArray(data.dietary) ? data.dietary : [])
          setFavoriteZones(Array.isArray(data.favorite_zones) ? data.favorite_zones : [])
          setPriceMax(typeof data.price_max === 'number' ? data.price_max : null)
          setNotes(typeof data.notes === 'string' ? data.notes : '')
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [user?.id])

  const toggleInArray = (arr, value, setter) => {
    setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value])
    setSaved(false)
  }

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    setError(null)
    const payload = {
      user_id: user.id,
      dietary,
      favorite_zones: favoriteZones,
      price_max: priceMax,
      notes: notes.trim() || null,
    }
    const { error: upErr } = await supabase
      .from('ai_user_preferences')
      .upsert(payload, { onConflict: 'user_id' })
    setSaving(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (authLoading) return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <div style={{ background: 'var(--color-page, #FAF7F2)', minHeight: '100dvh', paddingBottom: TAB_BAR_HEIGHT + 30 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 40px' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', background: 'var(--color-ink-05)',
            borderRadius: 999, fontSize: 12, fontWeight: 700,
            color: 'var(--color-ink)', border: 0, cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          ← Indietro
        </button>

        <h1 style={{
          fontFamily: 'var(--font-sans)', fontWeight: 900,
          fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1.1,
          marginBottom: 6,
        }}>
          Le mie preferenze per Bi
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-ink-70)', marginBottom: 24 }}>
          Bi le tiene a mente in ogni chat. Le usa come default, non come regola ferrea: se nel momento chiedi qualcosa di diverso, ti ascolta.
        </p>

        {loading ? (
          <div style={{ color: 'var(--color-ink-70)' }}>Caricamento…</div>
        ) : (
          <>
            <Section title="Dieta">
              <ChipRow
                options={DIETARY_OPTIONS}
                selected={dietary}
                onToggle={(v) => toggleInArray(dietary, v, setDietary)}
              />
            </Section>

            <Section title="Zone che preferisci">
              <ChipRow
                options={ZONE_OPTIONS}
                selected={favoriteZones}
                onToggle={(v) => toggleInArray(favoriteZones, v, setFavoriteZones)}
              />
            </Section>

            <Section title="Budget massimo">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PRICE_OPTIONS.map((opt) => {
                  const isActive = priceMax === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setPriceMax(isActive ? null : opt.value); setSaved(false) }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '12px 16px', borderRadius: 14,
                        background: isActive ? 'var(--color-ink, #22181C)' : '#fff',
                        color: isActive ? '#fff' : 'var(--color-ink)',
                        border: `1px solid ${isActive ? 'transparent' : 'var(--color-ink-05)'}`,
                        cursor: 'pointer', minWidth: 80,
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 800 }}>{opt.label}</span>
                      <span style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{opt.sub}</span>
                    </button>
                  )
                })}
              </div>
              {priceMax && (
                <button
                  type="button"
                  onClick={() => { setPriceMax(null); setSaved(false) }}
                  style={{
                    marginTop: 10, fontSize: 12, color: 'var(--color-ink-70)',
                    background: 'transparent', border: 0, cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  Rimuovi limite
                </button>
              )}
            </Section>

            <Section title="Note libere">
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
                placeholder='Es. "Non amo i posti rumorosi, preferisco i bistrot moderni, mi piace il vino naturale"'
                maxLength={500}
                rows={4}
                style={{
                  width: '100%', padding: 12, borderRadius: 12,
                  border: '1px solid var(--color-ink-05)', background: '#fff',
                  fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
                  color: 'var(--color-ink)',
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 6, textAlign: 'right' }}>
                {notes.length} / 500
              </div>
            </Section>

            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '12px 22px', borderRadius: 999,
                  background: saving ? 'var(--color-ink-30, rgba(34,24,28,0.3))' : 'var(--color-corallo, #E8453C)',
                  color: '#fff', fontSize: 14, fontWeight: 800,
                  border: 0, cursor: saving ? 'wait' : 'pointer',
                  boxShadow: saving ? 'none' : '0 6px 14px rgba(232,69,60,.3)',
                }}
              >
                {saving ? 'Salvo…' : 'Salva'}
              </button>
              {saved && (
                <span style={{ fontSize: 13, color: '#065F46', fontWeight: 700 }}>
                  ✓ Salvate. Bi le userà nella prossima chat.
                </span>
              )}
              {error && (
                <span style={{ fontSize: 13, color: '#991B1B' }}>
                  Errore: {error}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 22 }}>
      <h2 style={{
        fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 14,
        letterSpacing: '-0.01em', marginBottom: 10, color: 'var(--color-ink)',
      }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function ChipRow({ options, selected, onToggle }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const isActive = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            style={{
              padding: '8px 14px', borderRadius: 999,
              background: isActive ? 'var(--color-ink, #22181C)' : '#fff',
              color: isActive ? '#fff' : 'var(--color-ink)',
              border: `1px solid ${isActive ? 'transparent' : 'var(--color-ink-05)'}`,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
