import { useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * GooglePlacesBlock — manage the Google Place ID association + hours refresh.
 *
 * Legacy feature migrated from RestaurantForm.jsx ("Google Places" section).
 * Critical for production: the public RestaurantSheet reads
 * `restaurant.hours_cache` to show real opening hours. Without a verified
 * place_id the cache never gets populated and the sheet falls back to
 * "Chiama per orari".
 *
 * Flow:
 *   1. Admin clicks "Cerca su Google" → POST /api/admin-actions
 *      (action: search-places, name, address) → list of candidates
 *   2. Admin picks the correct one → place_id + confidence stored in form
 *   3. Admin clicks "Verifica come corretto" → sets place_id_verified_at
 *   4. Admin clicks "Aggiorna orari ora" (edit mode only) → GET
 *      /api/places-details?restaurantId=X → hours_cache updated on DB
 *
 * Props:
 *   form        → current restaurant form state (name, address, place_id, …)
 *   onChange    → (patch) => void
 *   restaurantId → only in edit mode; enables "refresh hours now" button
 */
export default function GooglePlacesBlock({ form, onChange, restaurantId }) {
  const [searching, setSearching] = useState(false)
  const [candidates, setCandidates] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [feedback, setFeedback] = useState(null)

  async function handleSearch() {
    if (!form.name?.trim()) {
      setFeedback({ kind: 'err', text: 'Inserisci prima nome del locale.' })
      return
    }
    setSearching(true)
    setCandidates(null)
    setFeedback(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Sessione scaduta')
      const res = await fetch('/api/admin-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'search-places',
          name: form.name,
          address: form.address,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore ricerca')
      setCandidates(data.candidates || [])
      if (!data.candidates?.length) {
        setFeedback({ kind: 'info', text: 'Nessun candidato trovato.' })
      }
    } catch (err) {
      setFeedback({ kind: 'err', text: err.message })
    } finally {
      setSearching(false)
    }
  }

  function handlePickCandidate(c) {
    onChange({
      place_id: c.place_id,
      place_id_confidence: c.confidence,
      place_id_verified_at: null,
    })
    setCandidates(null)
    setFeedback({ kind: 'ok', text: 'Place ID impostato — verifica poi salva.' })
  }

  function handleVerify() {
    onChange({ place_id_verified_at: new Date().toISOString() })
    setFeedback({ kind: 'ok', text: 'Verificato. Il sito pubblico ora mostrerà gli orari.' })
  }

  function handleUnverify() {
    onChange({ place_id_verified_at: null })
    setFeedback({ kind: 'info', text: 'Verifica rimossa.' })
  }

  async function handleRefreshHours() {
    if (!restaurantId) return
    if (!form.place_id_verified_at) {
      setFeedback({ kind: 'err', text: 'Verifica prima il Place ID.' })
      return
    }
    setRefreshing(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/places-details?restaurantId=${restaurantId}&force=1`)
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || data.reason || 'Errore')
      setFeedback({
        kind: 'ok',
        text: data.cached ? 'Orari già aggiornati (cache <24h).' : 'Orari aggiornati da Google.',
      })
    } catch (err) {
      setFeedback({ kind: 'err', text: `Errore aggiornamento: ${err.message}` })
    } finally {
      setRefreshing(false)
    }
  }

  const hasId = Boolean(form.place_id?.trim())
  const isVerified = Boolean(form.place_id_verified_at)
  const lastHoursUpdate = form.hours_cache_updated_at
    ? new Date(form.hours_cache_updated_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--color-line, #EAE3D7)',
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
          marginBottom: 12,
        }}
      >
        <h4
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
            margin: 0,
          }}
        >
          🕐 Orari automatici da Google
        </h4>
        <StatusChip hasId={hasId} verified={isVerified} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Place ID input + search */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <input
            type="text"
            value={form.place_id || ''}
            onChange={(e) => onChange({ place_id: e.target.value, place_id_verified_at: null })}
            placeholder="Place ID (es. ChIJN1t_tDeuEmsRUsoyG83frY4)"
            style={{
              flex: 1,
              minWidth: 220,
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: 12,
              border: '1px solid var(--color-line, #EAE3D7)',
              borderRadius: 10,
              padding: '9px 12px',
              background: 'var(--color-page, #FAF7F2)',
              color: 'var(--color-ink)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching || !form.name?.trim()}
            style={{
              background: 'var(--color-ink, #22181C)',
              color: '#fff',
              border: 0,
              padding: '9px 16px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              cursor: searching ? 'wait' : 'pointer',
              fontFamily: 'var(--font-sans)',
              whiteSpace: 'nowrap',
              opacity: !form.name?.trim() ? 0.5 : 1,
            }}
          >
            {searching ? 'Cerco…' : '🔎 Cerca su Google'}
          </button>
        </div>

        {/* Candidates list */}
        {candidates && candidates.length > 0 && (
          <div
            style={{
              background: 'var(--color-cream, #F5F0E4)',
              borderRadius: 12,
              padding: 10,
              border: '1px solid var(--color-line, #EAE3D7)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                marginBottom: 6,
              }}
            >
              {candidates.length} candidat{candidates.length === 1 ? 'o' : 'i'} — clicca quello giusto:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {candidates.map((c) => {
                const confColor =
                  c.confidence >= 0.8
                    ? '#2C7A4A'
                    : c.confidence >= 0.5
                      ? 'var(--color-oro, #B08954)'
                      : 'var(--color-ink-55, rgba(34,24,28,0.55))'
                return (
                  <button
                    key={c.place_id}
                    type="button"
                    onClick={() => handlePickCandidate(c)}
                    style={{
                      textAlign: 'left',
                      padding: 10,
                      borderRadius: 10,
                      background: '#fff',
                      border: '1px solid var(--color-line, #EAE3D7)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 13, color: 'var(--color-ink)' }}>{c.display_name}</strong>
                      <span style={{ fontSize: 11, fontWeight: 800, color: confColor }}>
                        {(c.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                        marginTop: 2,
                      }}
                    >
                      {c.address}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Verify + refresh actions */}
        {hasId && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {!isVerified ? (
              <button
                type="button"
                onClick={handleVerify}
                style={{
                  background: 'var(--color-ink, #22181C)',
                  color: '#fff',
                  border: 0,
                  padding: '8px 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                ✓ Verifica come corretto
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUnverify}
                style={{
                  background: 'transparent',
                  color: 'var(--color-ink, #22181C)',
                  border: '1px solid var(--color-line, #EAE3D7)',
                  padding: '7px 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Rimuovi verifica
              </button>
            )}
            {restaurantId && isVerified && (
              <button
                type="button"
                onClick={handleRefreshHours}
                disabled={refreshing}
                style={{
                  background: 'var(--color-corallo, #E8453C)',
                  color: '#fff',
                  border: 0,
                  padding: '8px 14px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: refreshing ? 'wait' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
                }}
              >
                {refreshing ? 'Aggiorno…' : '🔄 Aggiorna orari ora'}
              </button>
            )}
          </div>
        )}

        {/* Status line */}
        <div style={{ fontSize: 11, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontWeight: 600, lineHeight: 1.55 }}>
          {!hasId && (
            <>Senza Place ID verificato, la scheda pubblica mostra "Chiama per orari" come fallback.</>
          )}
          {hasId && !isVerified && (
            <>Place ID impostato ma <b>non verificato</b>. Il sito non userà questi orari finché non cliccchi "Verifica".</>
          )}
          {isVerified && form.place_id_confidence != null && (
            <>
              Verificato con confidence <b>{(form.place_id_confidence * 100).toFixed(0)}%</b>
              {lastHoursUpdate ? <> · Ultimo aggiornamento orari: <b>{lastHoursUpdate}</b></> : <> · Gli orari verranno caricati al primo hit della scheda pubblica (o clicca "Aggiorna ora").</>}
            </>
          )}
          {isVerified && form.place_id_confidence == null && lastHoursUpdate && (
            <>Verificato · Ultimo aggiornamento orari: <b>{lastHoursUpdate}</b></>
          )}
        </div>

        {/* Feedback toast inline */}
        {feedback && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              background:
                feedback.kind === 'err'
                  ? 'var(--color-danger-wash, #FCE8E4)'
                  : feedback.kind === 'ok'
                    ? 'var(--color-green-wash, #E8F5D8)'
                    : 'var(--color-cream, #F5F0E4)',
              color:
                feedback.kind === 'err'
                  ? 'var(--color-danger, #C0392B)'
                  : feedback.kind === 'ok'
                    ? '#2C7A4A'
                    : 'var(--color-ink-70, rgba(34,24,28,0.7))',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {feedback.text}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusChip({ hasId, verified }) {
  const spec = !hasId
    ? { bg: 'var(--color-cream-deep, #F1EBE0)', fg: 'var(--color-ink-55, rgba(34,24,28,0.55))', text: 'Non associato' }
    : verified
      ? { bg: 'var(--color-green-wash, #E8F5D8)', fg: '#2C7A4A', text: 'Verificato' }
      : { bg: 'var(--color-oro-wash, #F5EDDD)', fg: 'var(--color-oro, #B08954)', text: 'Da verificare' }
  return (
    <span
      style={{
        marginLeft: 'auto',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        background: spec.bg,
        color: spec.fg,
      }}
    >
      {spec.text}
    </span>
  )
}
