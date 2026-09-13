import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import MobileLogoHeader from '../../components/Layout/MobileLogoHeader'
import Footer from '../../components/Layout/Footer'
import MetaTags from '../../components/SEO/MetaTags'

/**
 * "Scegli cosa ricevere" — la pagina in fondo a ogni email.
 *
 * Ci si arriva col token, senza accedere: chi apre la posta sul telefono
 * non deve ricordarsi la password per smettere di ricevere email. Il token
 * è un uuid che sta solo dentro le email di quella persona, e le due
 * funzioni Postgres che usa (`get_email_prefs_by_token`,
 * `set_email_prefs_by_token`) restituiscono e toccano solo la riga di quel
 * token — non l'indirizzo, non il nome, niente.
 *
 * Le tre voci sono quelle che si possono spegnere. Le ricevute (hai preso
 * lo sconto, l'hai usato) non compaiono perché non si spengono: senza,
 * qualcuno resterebbe senza il proprio codice.
 */

const SWITCHES = [
  {
    key: 'new_discounts',
    label: 'Nuovi sconti',
    hint: 'Quando entra uno sconto nuovo o parte un drop a tempo.',
  },
  {
    key: 'new_places',
    label: 'Nuovi locali',
    hint: 'Quando aggiungo un posto nuovo alla guida.',
  },
  {
    key: 'my_discounts',
    label: 'I miei sconti',
    hint: 'Promemoria sugli sconti che hai preso e non ancora usato.',
  },
]

export default function EmailPreferencesPage() {
  const [params] = useSearchParams()
  const token = params.get('t')

  // Senza token lo stato è già noto al primo render: ricavarlo evita di
  // impostarlo dentro l'effetto, che farebbe un secondo render a vuoto.
  const [state, setState] = useState(() => (token ? 'loading' : 'notfound')) // loading | ready | notfound | error
  const [prefs, setPrefs] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('get_email_prefs_by_token', { p_token: token })
      if (cancelled) return
      if (error) { setState('error'); return }
      const row = Array.isArray(data) ? data[0] : data
      if (!row) { setState('notfound'); return }
      setPrefs(row)
      setState('ready')
    })()
    return () => { cancelled = true }
  }, [token])

  const save = useCallback(async (next) => {
    setPrefs(next)          // l'interruttore si muove subito
    setSaving(true)
    const { data, error } = await supabase.rpc('set_email_prefs_by_token', {
      p_token: token,
      p_new_discounts: next.new_discounts,
      p_new_places: next.new_places,
      p_my_discounts: next.my_discounts,
    })
    setSaving(false)
    if (error) { setState('error'); return }
    const row = Array.isArray(data) ? data[0] : data
    if (row) setPrefs(row)  // la verità è quella del server
    setSavedAt(Date.now())
  }, [token])

  const allOff = prefs && !prefs.new_discounts && !prefs.new_places && !prefs.my_discounts

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-page)', display: 'flex', flexDirection: 'column' }}>
      <MetaTags title="Preferenze email · ChiamamiBi" noindex />
      <MobileLogoHeader />

      <main style={{ flex: 1, width: '100%', maxWidth: 560, margin: '0 auto', padding: '18px 20px 40px' }}>
        <h1 style={{
          fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 26, lineHeight: 1.15,
          letterSpacing: '-0.02em', color: 'var(--color-ink)', margin: '10px 0 6px',
        }}>
          Scegli cosa ricevere
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--color-ink-70)', margin: '0 0 22px' }}>
          Decidi tu quali email ti arrivano. Vale da subito, senza bisogno di accedere.
        </p>

        {state === 'loading' && (
          <p style={{ fontSize: 14, color: 'var(--color-ink-70)' }}>Un attimo…</p>
        )}

        {state === 'notfound' && (
          <Box>
            <strong style={{ display: 'block', marginBottom: 6 }}>Questo link non è più valido.</strong>
            Apri l&rsquo;ultima email che ti ho mandato e usa il link in fondo, oppure cambia le
            preferenze dal tuo profilo dopo aver fatto accesso.
            <div style={{ marginTop: 14 }}>
              <Link to="/login" style={linkBtn}>Vai all&rsquo;accesso</Link>
            </div>
          </Box>
        )}

        {state === 'error' && (
          <Box tone="err">
            <strong style={{ display: 'block', marginBottom: 6 }}>Non sono riuscito a salvare.</strong>
            Riprova fra poco. Se continua, scrivimi a{' '}
            <a href="mailto:info@chiamamibi.com" style={{ color: 'var(--color-corallo)' }}>info@chiamamibi.com</a>.
          </Box>
        )}

        {state === 'ready' && prefs && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SWITCHES.map((s) => (
                <Switch
                  key={s.key}
                  label={s.label}
                  hint={s.hint}
                  checked={!!prefs[s.key]}
                  onChange={(v) => save({ ...prefs, [s.key]: v })}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => save({ new_discounts: false, new_places: false, my_discounts: false })}
              style={{
                marginTop: 18, background: 'none', border: 'none', padding: '8px 0',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
                color: 'var(--color-ink-70)', textDecoration: 'underline', cursor: 'pointer',
              }}
            >
              Non mandarmi più niente
            </button>

            <p aria-live="polite" style={{ fontSize: 13, color: 'var(--color-ink-70)', marginTop: 14, minHeight: 20 }}>
              {saving ? 'Salvo…' : savedAt ? 'Salvato.' : ''}
            </p>

            {allOff && (
              <Box>
                Va bene così. Le uniche email che continuerai a ricevere sono quelle che
                rispondono a qualcosa che fai tu: quando prendi uno sconto ti serve il codice,
                e quello te lo mando comunque.
              </Box>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}

function Switch({ label, hint, checked, onChange }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer',
      background: '#fff', border: '1px solid var(--color-line, rgba(34,24,28,.10))',
      borderRadius: 16, padding: '16px 18px',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 20, height: 20, accentColor: 'var(--color-corallo)', flex: '0 0 auto' }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, color: 'var(--color-ink)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 13.5, lineHeight: 1.45, color: 'var(--color-ink-70)', marginTop: 3 }}>{hint}</span>
      </span>
    </label>
  )
}

function Box({ children, tone }) {
  return (
    <div style={{
      marginTop: 18, padding: '16px 18px', borderRadius: 16, fontSize: 14, lineHeight: 1.55,
      background: tone === 'err' ? 'var(--color-corallo-wash, #FDEDEB)' : 'var(--color-cream, #F5F0E4)',
      color: 'var(--color-ink-70)',
    }}>
      {children}
    </div>
  )
}

const linkBtn = {
  display: 'inline-block', padding: '11px 20px', borderRadius: 999,
  background: 'var(--color-ink)', color: '#fff', fontSize: 14, fontWeight: 700,
  textDecoration: 'none',
}
