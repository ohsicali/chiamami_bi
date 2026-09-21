import { useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * "Mandami una prova": una copia di ogni email nella casella dell'admin.
 *
 * Serve perché una email si giudica solo dove verrà letta davvero. Un
 * rendering nel browser non dice come Gmail taglia lo stile, come Outlook
 * ignora i bordi arrotondati, come appare l'oggetto in elenco sul telefono.
 * Questo bottone chiude il giro: si preme, si guarda la posta.
 *
 * Il server accetta la richiesta solo da un admin e la manda solo
 * all'indirizzo dell'admin stesso, mai a uno passato dal browser.
 */

const TEMPLATES = [
  { key: 'welcome', label: 'Registrazione completata', hint: 'Quando qualcuno crea l’account.' },
  { key: 'new-discount', label: 'Nuovo drop', hint: 'Parte da sola quando pubblichi un drop: card corallo, barra dei posti.' },
  { key: 'new-convention', label: 'Nuova convenzione', hint: 'Lo sconto che non scade: crema e oro, senza countdown.' },
  { key: 'new-place', label: 'Nuovo locale', hint: 'Parte da sola quando pubblichi un locale.' },
  { key: 'discount-claimed', label: 'Sconto preso (col codice)', hint: 'Quando l’utente sblocca uno sconto.' },
  { key: 'discount-used', label: 'Sconto usato', hint: 'Quando il locale scansiona il QR.' },
  { key: 'partner', label: 'Benvenuto ristoratore (col PIN)', hint: 'Quando aggiungi un locale e generi il PIN.' },
  { key: 'suggestion', label: 'Conferma suggerimento', hint: 'A chi ti segnala un locale dal sito.' },
  { key: 'partner-application', label: 'Conferma candidatura', hint: 'A chi candida il proprio locale da /partner.' },
  { key: 'otp', label: 'Codice di recupero', hint: 'Cambio email e password dimenticata.' },
  { key: 'internal-suggestion', label: 'Interna — nuovo suggerimento', hint: 'Quella che arriva a te, non agli utenti.' },
  { key: 'internal-partner-application', label: 'Interna — nuova candidatura', hint: 'Quella che arriva a te, non agli utenti.' },
]

export default function EmailPreviewTool() {
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)

  const send = async (template) => {
    setBusy(template)
    setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sessione scaduta, rientra.')
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: 'preview', template }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.detail || json.error || `Errore ${res.status}`)
      setMsg({ kind: 'ok', text: `Mandata a ${json.to}. Guarda la posta.` })
    } catch (err) {
      setMsg({ kind: 'err', text: err.message })
    } finally {
      setBusy(null)
      setTimeout(() => setMsg(null), 8000)
    }
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-ink)', marginBottom: 4 }}>
        Anteprima email
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', marginBottom: 14 }}>
        Manda a te stesso una copia di prova, per vedere come arriva davvero.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TEMPLATES.map((t) => (
          <div key={t.key} style={row}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ink)' }}>{t.label}</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', marginTop: 2 }}>{t.hint}</div>
            </div>
            <button
              type="button"
              onClick={() => send(t.key)}
              disabled={!!busy}
              style={{ ...btn, opacity: busy ? 0.5 : 1, cursor: busy ? 'default' : 'pointer' }}
            >
              {busy === t.key ? 'Mando…' : 'Provala'}
            </button>
          </div>
        ))}
      </div>

      {msg && (
        <div
          role="status"
          style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, lineHeight: 1.45,
            background: msg.kind === 'ok' ? '#E9F8EF' : '#FDEDEB',
            color: msg.kind === 'ok' ? '#1A4731' : '#8A2B25',
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  )
}

const card = {
  background: '#fff',
  border: '1px solid var(--color-line, #EAE3D7)',
  borderRadius: 14,
  padding: 18,
}

const row = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--color-page, #FAF7F2)',
}

const btn = {
  flex: '0 0 auto',
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: 800,
  borderRadius: 999,
  border: 'none',
  background: 'var(--color-ink, #22181C)',
  color: '#fff',
  fontFamily: 'inherit',
}
