/**
 * Pagina admin temporanea per eseguire il backfill dei place_id candidati.
 * Chiama /api/admin-backfill-places con Bearer token dell'admin loggato.
 *
 * NOTA: questo file è temporaneo, da rimuovere dopo il backfill iniziale.
 */
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'

export default function BackfillPlaces() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/" replace />

  async function run({ dry, limit, force }) {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessione scaduta, rifai login')

      const params = new URLSearchParams()
      if (dry) params.set('dry', '1')
      if (limit) params.set('limit', String(limit))
      if (force) params.set('force', '1')

      const res = await fetch(`/api/admin-backfill-places?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Errore backfill')
      setResult(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          Backfill Google Places
        </h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
          Tool temporaneo: popola i <code>place_id</code> candidati per i ristoranti senza associazione.
          Non imposta <code>place_id_verified_at</code>: ogni candidato va verificato manualmente dal form ristorante.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => run({ dry: true, limit: 5 })}
            disabled={running}
            style={btnStyle}
          >
            Dry-run · 5 ristoranti
          </button>
          <button
            onClick={() => run({ dry: true })}
            disabled={running}
            style={btnStyle}
          >
            Dry-run · tutti
          </button>
          <button
            onClick={() => run({ dry: false })}
            disabled={running}
            style={{ ...btnStyle, background: '#2e7d57', color: '#fff' }}
          >
            LIVE · salva su DB
          </button>
          <button
            onClick={() => run({ dry: false, force: true })}
            disabled={running}
            style={{ ...btnStyle, background: '#d97706', color: '#fff' }}
          >
            LIVE · force (riprocessa non verificati)
          </button>
        </div>

        {running && <p style={{ color: '#666' }}>In esecuzione... (può impiegare 1-2 min per 50 ristoranti)</p>}
        {error && (
          <div style={{ padding: 12, background: '#fee', color: '#b00', borderRadius: 8 }}>
            Errore: {error}
          </div>
        )}

        {result && (
          <div>
            <div style={{ padding: 12, background: '#f0f4ff', borderRadius: 8, marginBottom: 16 }}>
              <strong>{result.dry ? '[DRY-RUN] ' : ''}Summary</strong>
              <ul style={{ margin: '8px 0 0 20px', fontSize: 14 }}>
                <li>Totale: {result.summary.total}</li>
                <li>Match trovati: {result.summary.matched}</li>
                <li>Skipped (no match): {result.summary.skipped}</li>
                <li>Errori: {result.summary.errors}</li>
              </ul>
            </div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f6f6f6', textAlign: 'left' }}>
                  <th style={th}>Ristorante</th>
                  <th style={th}>Match</th>
                  <th style={th}>Conf.</th>
                  <th style={th}>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={td}>{r.name}</td>
                    <td style={td}>
                      {r.matched || <em style={{ color: '#999' }}>{r.status || '—'}</em>}
                      {r.address && <div style={{ fontSize: 11, color: '#999' }}>{r.address}</div>}
                    </td>
                    <td style={td}>{r.confidence ?? ''}</td>
                    <td style={{ ...td, color: verdictColor(r.verdict) }}>
                      {r.verdict || (r.error ? 'ERROR' : '')}
                      {r.error && (
                        <div style={{ fontSize: 11, color: '#b00', marginTop: 4, fontFamily: 'monospace' }}>
                          {r.error}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

const btnStyle = {
  padding: '10px 16px',
  fontSize: 14,
  borderRadius: 8,
  border: '1px solid #ddd',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 500,
}
const th = { padding: 10, fontWeight: 600, fontSize: 12, borderBottom: '1px solid #ddd' }
const td = { padding: 10, verticalAlign: 'top' }

function verdictColor(v) {
  if (v === 'HIGH') return '#2e7d57'
  if (v === 'MID') return '#d97706'
  if (v === 'LOW') return '#999'
  if (v === 'ERROR') return '#b00'
  return '#000'
}
