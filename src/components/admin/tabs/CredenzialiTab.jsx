import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../../lib/supabase'
import FGroup from './_FGroup'
import { FField, FInput, FRow } from './_Fields'

/**
 * CredenzialiTab — PIN management for a restaurant (edit-only).
 *
 * Scope PR15a choice Q4 = "minimal":
 *   - PIN 6-digit display (Alfa Slab One)
 *   - 4 actions: Ri-genera · Copia · Invia al locale · Blocca/Sblocca
 *   - Metadata: last rotation + is_disabled + partner_email
 *
 * No device-sessions history in this PR.
 */
export default function CredenzialiTab({ form, onChange, restaurantId, onPinRotated, onDisableToggled }) {
  const [busy, setBusy] = useState(null) // 'rotate' | 'send' | 'disable' | null
  const [feedback, setFeedback] = useState(null)

  async function callApi(action, extra = {}) {
    const { data: sess } = await supabase.auth.getSession()
    const token = sess?.session?.access_token
    if (!token) throw new Error('Sessione scaduta, rifai il login admin')
    const res = await fetch('/api/admin-actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, restaurant_id: restaurantId, ...extra }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error || 'Errore API')
    return body
  }

  async function handleRotate() {
    if (!confirm('Rigenerare il PIN? Il vecchio smetterà di funzionare subito.')) return
    setBusy('rotate')
    try {
      const { pin, last_pin_rotation_at } = await callApi('rotate-pin')
      onPinRotated?.(pin, last_pin_rotation_at)
      setFeedback({ kind: 'ok', text: `Nuovo PIN: ${pin}` })
    } catch (err) {
      setFeedback({ kind: 'err', text: err.message })
    } finally {
      setBusy(null)
    }
  }

  async function handleToggleDisable() {
    const next = !(form.is_disabled === true)
    const label = next ? 'Bloccare accesso al locale?' : 'Sbloccare accesso al locale?'
    if (!confirm(label)) return
    setBusy('disable')
    try {
      await callApi('toggle-disable', { disabled: next })
      onDisableToggled?.(next)
      setFeedback({ kind: 'ok', text: next ? 'Accesso bloccato' : 'Accesso ripristinato' })
    } catch (err) {
      setFeedback({ kind: 'err', text: err.message })
    } finally {
      setBusy(null)
    }
  }

  async function handleSendEmail() {
    if (!form.partner_email) {
      setFeedback({ kind: 'err', text: 'Aggiungi prima l\'email del ristoratore qui sotto.' })
      return
    }
    if (!form.verify_pin) {
      setFeedback({ kind: 'err', text: 'PIN non impostato — rigeneralo prima.' })
      return
    }
    setBusy('send')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Sessione scaduta')
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'partner',
          to: form.partner_email,
          nomeLocale: form.name,
          pin: form.verify_pin,
          restaurantId,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Errore invio email')
      setFeedback({ kind: 'ok', text: `Email inviata a ${form.partner_email}` })
    } catch (err) {
      setFeedback({ kind: 'err', text: err.message })
    } finally {
      setBusy(null)
    }
  }

  function handleCopy() {
    if (!form.verify_pin) return
    navigator.clipboard?.writeText(form.verify_pin)
    setFeedback({ kind: 'ok', text: 'PIN copiato negli appunti' })
    setTimeout(() => setFeedback(null), 1800)
  }

  return (
    <div>
      <FGroup title="Credenziali PIN · area ristoratore" count="6 cifre · assegnate da Bi" variant="corallo">
        <FRow>
          <FField label="PIN attivo · 6 cifre">
            <FInput
              value={form.verify_pin || '— — — — — —'}
              readOnly
              style={{
                fontFamily: 'var(--font-wordmark, "Alfa Slab One")',
                fontSize: 22,
                letterSpacing: '0.16em',
                fontWeight: 400,
                background: '#fff',
                borderColor: 'var(--color-corallo-soft, #F6B7B1)',
              }}
            />
          </FField>
          <FField label="Email del ristoratore">
            <FInput
              value={form.partner_email}
              onChange={(v) => onChange({ partner_email: v })}
              placeholder="daniele@consorzio.it"
              type="email"
            />
          </FField>
        </FRow>

        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <ActionButton kind="primary" loading={busy === 'rotate'} onClick={handleRotate}>
            ↻ Ri-genera PIN
          </ActionButton>
          <ActionButton onClick={handleCopy} disabled={!form.verify_pin}>
            📋 Copia
          </ActionButton>
          <ActionButton kind="ghost" loading={busy === 'send'} onClick={handleSendEmail}>
            ✉ Invia al locale
          </ActionButton>
          <div style={{ flex: 1 }} />
          <ActionButton kind="danger" loading={busy === 'disable'} onClick={handleToggleDisable}>
            {form.is_disabled ? '✓ Sblocca' : '⊘ Blocca accesso'}
          </ActionButton>
        </div>

        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px dashed rgba(232,69,60,0.25)',
            fontSize: 11,
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
            fontWeight: 600,
            lineHeight: 1.55,
          }}
        >
          <b style={{ color: 'var(--color-ink)' }}>Ultima rotazione:</b>{' '}
          {form.last_pin_rotation_at ? new Date(form.last_pin_rotation_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : 'mai registrata'}
          <span style={{ margin: '0 8px' }}>·</span>
          <b style={{ color: form.is_disabled ? 'var(--color-danger, #C0392B)' : 'var(--color-ink)' }}>Stato:</b>{' '}
          {form.is_disabled ? 'bloccato' : 'attivo'}
          <br />
          Il PIN è l'unico modo per accedere a <code>/verify</code>. Niente email, niente password.
          Se il locale lo perde, rigenerane uno e comunicaglielo tu.
        </div>

        {feedback && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 10,
              background: feedback.kind === 'err' ? 'var(--color-danger-wash, #FCE8E4)' : 'var(--color-green-wash, #E8F5D8)',
              color: feedback.kind === 'err' ? 'var(--color-danger, #C0392B)' : '#2C7A4A',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {feedback.text}
          </div>
        )}
      </FGroup>
    </div>
  )
}

function ActionButton({ kind = 'default', loading, disabled, onClick, children }) {
  const base = {
    border: 0,
    padding: '10px 16px',
    borderRadius: 999,
    fontFamily: 'var(--font-sans)',
    fontWeight: 800,
    fontSize: 12,
    cursor: loading || disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'transform 0.1s, box-shadow 0.15s',
  }
  const styles = {
    primary: {
      background: 'var(--color-corallo, #E8453C)',
      color: '#fff',
      boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
    },
    ghost: {
      background: '#fff',
      border: '1px solid var(--color-line, #EAE3D7)',
      color: 'var(--color-ink, #22181C)',
    },
    danger: {
      background: 'transparent',
      color: 'var(--color-danger, #C0392B)',
    },
    default: {
      background: '#fff',
      border: '1px solid var(--color-line, #EAE3D7)',
      color: 'var(--color-ink, #22181C)',
    },
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} style={{ ...base, ...styles[kind] }}>
      {loading ? '…' : children}
    </button>
  )
}
