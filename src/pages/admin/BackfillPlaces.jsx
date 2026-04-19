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
  const [reviewItems, setReviewItems] = useState(null)
  const [rowBusy, setRowBusy] = useState({})

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/" replace />

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sessione scaduta, rifai login')
    return { Authorization: `Bearer ${session.access_token}` }
  }

  async function run({ dry, limit, force, action, minConf }) {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const params = new URLSearchParams()
      if (dry) params.set('dry', '1')
      if (limit) params.set('limit', String(limit))
      if (force) params.set('force', '1')
      if (action) params.set('action', action)
      if (minConf != null) params.set('minConf', String(minConf))

      const res = await fetch(`/api/admin-backfill-places?${params}`, {
        headers: await authHeaders(),
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

  async function loadReview() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin-backfill-places?action=list-unverified', {
        headers: await authHeaders(),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Errore')
      setReviewItems(json.items)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  async function verifyRow(id) {
    setRowBusy(b => ({ ...b, [id]: 'verify' }))
    try {
      const res = await fetch(`/api/admin-backfill-places?action=verify-one&ids=${id}`, {
        headers: await authHeaders(),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setReviewItems(items => items.filter(i => i.id !== id))
    } catch (e) {
      setError(e.message)
    } finally {
      setRowBusy(b => { const n = { ...b }; delete n[id]; return n })
    }
  }

  async function clearRow(id) {
    if (!confirm('Rimuovi il place_id candidato? Dovrai associarlo a mano dal form ristorante.')) return
    setRowBusy(b => ({ ...b, [id]: 'clear' }))
    try {
      const res = await fetch(`/api/admin-backfill-places?action=clear-one&id=${id}`, {
        headers: await authHeaders(),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setReviewItems(items => items.filter(i => i.id !== id))
    } catch (e) {
      setError(e.message)
    } finally {
      setRowBusy(b => { const n = { ...b }; delete n[id]; return n })
    }
  }

  function verdictOf(conf) {
    if (conf == null) return '—'
    if (conf >= 0.6) return 'HIGH'
    if (conf >= 0.35) return 'MID'
    return 'LOW'
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
          <button
            onClick={() => {
              if (confirm('Verifico tutti i candidati con confidence ≥ 0.9? Questa azione imposta place_id_verified_at=now() e rende gli orari visibili al pubblico.')) {
                run({ action: 'verify-high', minConf: 0.9 })
              }
            }}
            disabled={running}
            style={{ ...btnStyle, background: '#1e40af', color: '#fff' }}
          >
            Auto-verifica HIGH (conf ≥ 0.9)
          </button>
          <button
            onClick={loadReview}
            disabled={running}
            style={{ ...btnStyle, background: '#6b21a8', color: '#fff' }}
          >
            Review candidati non verificati
          </button>
        </div>

        {reviewItems && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 10 }}>
              {reviewItems.length} candidati da verificare. Clicca sul link Google Maps per controllare, poi Verifica o Rimuovi.
            </p>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f6f6f6', textAlign: 'left' }}>
                  <th style={th}>Ristorante</th>
                  <th style={th}>Conf.</th>
                  <th style={th}>Verdict</th>
                  <th style={th}>Check</th>
                  <th style={th}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {reviewItems.map(i => (
                  <tr key={i.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={td}>
                      <strong>{i.name}</strong>
                      <div style={{ fontSize: 11, color: '#999' }}>{i.address}</div>
                    </td>
                    <td style={td}>{i.place_id_confidence?.toFixed(2) ?? '—'}</td>
                    <td style={{ ...td, color: verdictColor(verdictOf(i.place_id_confidence)) }}>
                      {verdictOf(i.place_id_confidence)}
                    </td>
                    <td style={td}>
                      <a
                        href={`https://www.google.com/maps/place/?q=place_id:${i.place_id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#1e40af', textDecoration: 'underline' }}
                      >
                        Apri su Maps
                      </a>
                    </td>
                    <td style={td}>
                      <button
                        onClick={() => verifyRow(i.id)}
                        disabled={!!rowBusy[i.id]}
                        style={{ ...miniBtn, background: '#2e7d57', color: '#fff', marginRight: 6 }}
                      >
                        {rowBusy[i.id] === 'verify' ? '...' : '✓ Verifica'}
                      </button>
                      <button
                        onClick={() => clearRow(i.id)}
                        disabled={!!rowBusy[i.id]}
                        style={{ ...miniBtn, background: '#b00', color: '#fff' }}
                      >
                        {rowBusy[i.id] === 'clear' ? '...' : '✗ Rimuovi'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {running && <p style={{ color: '#666' }}>In esecuzione... (può impiegare 1-2 min per 50 ristoranti)</p>}
        {error && (
          <div style={{ padding: 12, background: '#fee', color: '#b00', borderRadius: 8 }}>
            Errore: {error}
          </div>
        )}

        {result && result.action === 'verify-high' && (
          <div>
            <div style={{ padding: 12, background: '#e7f3ee', borderRadius: 8, marginBottom: 16 }}>
              <strong>✓ Auto-verifica completata</strong>
              <p style={{ margin: '8px 0 0', fontSize: 14 }}>
                {result.verified} ristoranti verificati (confidence ≥ {result.minConf}).
                Gli orari sono ora visibili in pubblico.
              </p>
            </div>
            {result.items?.length > 0 && (
              <ul style={{ fontSize: 13, columns: 2 }}>
                {result.items.map(i => (
                  <li key={i.id}>{i.name} <span style={{ color: '#888' }}>({i.confidence})</span></li>
                ))}
              </ul>
            )}
          </div>
        )}

        {result && result.summary && (
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
const miniBtn = {
  padding: '6px 10px', fontSize: 12, borderRadius: 6, border: 'none',
  cursor: 'pointer', fontWeight: 500,
}

function verdictColor(v) {
  if (v === 'HIGH') return '#2e7d57'
  if (v === 'MID') return '#d97706'
  if (v === 'LOW') return '#999'
  if (v === 'ERROR') return '#b00'
  return '#000'
}
