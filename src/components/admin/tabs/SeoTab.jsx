import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import FGroup from './_FGroup'
import { FField, FInput, FTextarea, FRow, CharCounter } from './_Fields'

/**
 * SeoTab — SEO meta editor with live SERP preview and AI pre-fill.
 *
 * "✨ Genera con AI" calls /api/admin-actions (action=ai-seo-suggest) that
 * runs Claude Haiku 4.5 server-side. Augusto reviews + saves manually.
 *
 * Auto pre-fill alla prima visita SOLO se TUTTI i campi SEO sono vuoti.
 * Errori e stato sempre visibili in alto (banner) — niente fallimenti silenziosi.
 */
export default function SeoTab({ form, onChange, restaurantId }) {
  const [aiState, setAiState] = useState('idle') // 'idle' | 'loading' | 'ok' | 'err'
  const [aiError, setAiError] = useState(null)
  const [aiOkMsg, setAiOkMsg] = useState(null)
  const autoRanRef = useRef(false)

  const allSeoEmpty =
    !form.seo_title && !form.seo_description && !form.og_title && !form.og_description

  // First-visit auto-run: only if all SEO fields are empty.
  useEffect(() => {
    if (autoRanRef.current) return
    if (!restaurantId) return
    if (!allSeoEmpty) return
    autoRanRef.current = true
    handleGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  async function handleGenerate() {
    setAiState('loading')
    setAiError(null)
    setAiOkMsg(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Sessione scaduta. Esci e rifai il login admin.')

      const res = await fetch('/api/admin-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'ai-seo-suggest', restaurant_id: restaurantId }),
      })

      let body = null
      try {
        body = await res.json()
      } catch {
        throw new Error(`Risposta non valida (HTTP ${res.status}).`)
      }

      if (!res.ok) {
        const msg = body?.error || `Errore HTTP ${res.status}`
        // Special-case: server senza ANTHROPIC_API_KEY
        if (/ANTHROPIC_API_KEY/i.test(msg)) {
          throw new Error(
            'Variabile ANTHROPIC_API_KEY non configurata sul server. ' +
              'Aggiungila su Vercel → Settings → Environment Variables, poi redeploy.'
          )
        }
        throw new Error(msg)
      }

      const patch = {
        seo_title: body.seo_title || form.seo_title,
        seo_description: body.seo_description || form.seo_description,
        og_title: body.og_title || form.og_title,
        og_description: body.og_description || form.og_description,
      }
      onChange(patch)

      const filled = ['seo_title', 'seo_description', 'og_title', 'og_description'].filter(
        (k) => body[k]
      ).length
      setAiState('ok')
      setAiOkMsg(
        filled === 4
          ? 'AI ha compilato tutti i campi SEO. Rivedi e salva.'
          : `AI ha compilato ${filled}/4 campi. Rivedi e salva.`
      )
    } catch (err) {
      console.error('[SeoTab] AI generate failed:', err)
      setAiError(err.message || 'Errore sconosciuto')
      setAiState('err')
      // Se è stata l'auto-run silenziosa, mostriamo comunque l'errore: l'utente
      // deve sapere che la generazione è fallita.
    }
  }

  const canonical = form.slug ? `https://chiamamibi.com/r/${form.slug}` : 'https://chiamamibi.com/r/…'

  return (
    <div>
      {/* ── Banner AI sempre in alto, sempre visibile ── */}
      <AiBanner
        state={aiState}
        error={aiError}
        okMsg={aiOkMsg}
        onGenerate={handleGenerate}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
          gap: 16,
        }}
        className="max-md:!grid-cols-1"
      >
        {/* ── LEFT: form fields ── */}
        <div>
          <FGroup title="Meta tags · motori di ricerca">
            <FRow one>
              <FField
                label={<LabelWithCounter text="Title tag" value={form.seo_title} max={60} />}
                hint="Appare come titolo blu nei risultati Google. 60 caratteri max."
              >
                <FInput
                  value={form.seo_title}
                  onChange={(v) => onChange({ seo_title: v })}
                  placeholder={form.name ? `${form.name} · ${form.city || 'Torino'} · Guida di Bi` : ''}
                  maxLength={90}
                />
              </FField>
            </FRow>
            <FRow one>
              <FField
                label={<LabelWithCounter text="Meta description" value={form.seo_description} max={160} />}
                hint="Il paragrafo grigio sotto il title blu. 160 caratteri max."
              >
                <FTextarea
                  value={form.seo_description}
                  onChange={(v) => onChange({ seo_description: v })}
                  rows={3}
                  placeholder="Descrizione sintetica che invogli al click."
                  maxLength={220}
                />
              </FField>
            </FRow>
            <FRow one>
              <FField label="URL canonico" hint="Auto-derivato dallo slug.">
                <FInput value={canonical} readOnly />
              </FField>
            </FRow>
          </FGroup>

          <FGroup title="Open Graph · condivisione social">
            <FRow one>
              <FField label={<LabelWithCounter text="OG Title" value={form.og_title} max={70} />}>
                <FInput
                  value={form.og_title}
                  onChange={(v) => onChange({ og_title: v })}
                  placeholder="Se vuoto, userà il Title tag sopra."
                  maxLength={100}
                />
              </FField>
            </FRow>
            <FRow one>
              <FField label={<LabelWithCounter text="OG Description" value={form.og_description} max={200} />}>
                <FTextarea
                  value={form.og_description}
                  onChange={(v) => onChange({ og_description: v })}
                  rows={3}
                  placeholder="Testo mostrato su WhatsApp / Facebook / LinkedIn quando condividi il link."
                  maxLength={260}
                />
              </FField>
            </FRow>
            <FRow one>
              <FField label="OG Image (URL)" hint="Se vuoto, userà la prima foto del ristorante. Formato consigliato 1200×630.">
                <FInput
                  value={form.og_image}
                  onChange={(v) => onChange({ og_image: v })}
                  placeholder="https://…/cover-1200x630.jpg"
                />
              </FField>
            </FRow>
          </FGroup>

          <FGroup title="Indicizzazione">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={form.noindex}
                onChange={(e) => onChange({ noindex: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              <span>
                <b>Escludi da Google</b>{' '}
                <span style={{ color: 'var(--color-ink-55, rgba(34,24,28,0.55))' }}>· meta robots noindex</span>
              </span>
            </label>
            <div style={{ fontSize: 11, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', lineHeight: 1.5, marginLeft: 26 }}>
              Usalo per schede in bozza, test, o locali chiusi. Google le ignora.
            </div>
          </FGroup>
        </div>

        {/* ── RIGHT: previews ── */}
        <div>
          <FGroup title="Preview Google" count="come apparirà nei risultati">
            <div
              style={{
                background: '#fff',
                padding: 16,
                borderRadius: 10,
                border: '1px solid var(--color-line, #EAE3D7)',
                fontFamily: 'arial, sans-serif',
              }}
            >
              <div style={{ fontSize: 13, color: '#202124', marginBottom: 2, fontWeight: 500 }}>
                {form.slug ? `chiamamibi.com › r › ${form.slug}` : 'chiamamibi.com › r › …'}
              </div>
              <div
                style={{
                  color: '#1a0dab',
                  fontSize: 20,
                  lineHeight: 1.3,
                  textDecoration: 'none',
                  marginBottom: 3,
                  fontFamily: 'arial, sans-serif',
                  fontWeight: 400,
                }}
              >
                {form.seo_title || form.name + ' · ' + (form.city || 'Torino') + ' · Guida di Bi'}
              </div>
              <div style={{ fontSize: 14, color: '#4d5156', lineHeight: 1.58, fontFamily: 'arial, sans-serif' }}>
                {form.seo_description || form.tagline || 'Nessuna meta description — scrivine una per ottimizzare il click-through.'}
              </div>
            </div>
          </FGroup>

          <FGroup title="Preview social" count="WhatsApp · Facebook · LinkedIn">
            <SocialCardPreview
              title={form.og_title || form.seo_title || form.name}
              description={form.og_description || form.seo_description || form.tagline}
              image={form.og_image || pickFallbackImage(form)}
              url={canonical}
            />
          </FGroup>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  AiBanner — stato AI sempre visibile in cima alla tab               */
/* ------------------------------------------------------------------ */
function AiBanner({ state, error, okMsg, onGenerate }) {
  const isLoading = state === 'loading'
  const isErr = state === 'err'
  const isOk = state === 'ok'

  // Background coerente con lo stato
  let bg, border, accent
  if (isErr) {
    bg = 'var(--color-danger-wash, #FCE8E4)'
    border = 'var(--color-danger, #C0392B)'
    accent = 'var(--color-danger, #C0392B)'
  } else if (isOk) {
    bg = 'var(--color-green-wash, #E8F5D8)'
    border = '#7BA85A'
    accent = '#2C7A4A'
  } else {
    bg = 'linear-gradient(135deg, #FFF1EF, #FCE4E1)'
    border = 'var(--color-corallo-soft, #F6B7B1)'
    accent = 'var(--color-corallo, #E8453C)'
  }

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }} aria-hidden>
        {isLoading ? '⏳' : isErr ? '⚠️' : isOk ? '✓' : '✨'}
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 15,
            letterSpacing: '-0.01em',
            color: accent,
            marginBottom: 3,
          }}
        >
          {isLoading
            ? 'Sto generando i metadati SEO…'
            : isErr
              ? 'Generazione AI fallita'
              : isOk
                ? okMsg || 'AI ha compilato i campi SEO'
                : 'Genera SEO con AI'}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          {isLoading
            ? "Claude Haiku sta scrivendo title, meta description e og tag a partire dai dettagli del ristorante."
            : isErr
              ? error
              : isOk
                ? 'Rivedi i campi qui sotto. Se non ti convincono, clicca di nuovo.'
                : 'Compila title, meta description e og tag a partire da nome, racconto e categoria. Rivedi tu prima di salvare.'}
        </div>
      </div>
      <button
        type="button"
        onClick={onGenerate}
        disabled={isLoading}
        style={{
          background: isErr ? 'var(--color-danger, #C0392B)' : 'var(--color-corallo, #E8453C)',
          color: '#fff',
          border: 0,
          padding: '10px 18px',
          borderRadius: 999,
          fontFamily: 'var(--font-sans)',
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: '0.04em',
          cursor: isLoading ? 'wait' : 'pointer',
          boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
          textTransform: 'uppercase',
          flexShrink: 0,
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {isLoading ? 'Sto generando…' : isErr ? '↻ Riprova' : isOk ? '↻ Rigenera' : '✨ Genera con AI'}
      </button>
    </div>
  )
}

function LabelWithCounter({ text, value, max }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>{text}</span>
      <CharCounter value={value} max={max} />
    </span>
  )
}

function SocialCardPreview({ title, description, image, url }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid var(--color-line, #EAE3D7)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          aspectRatio: '1200 / 630',
          background: image
            ? `url(${image}) center/cover no-repeat`
            : 'linear-gradient(135deg, #d8cfc1, #ad9b80)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          padding: 14,
        }}
      >
        {!image && (
          <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, background: 'rgba(0,0,0,0.4)', padding: '4px 10px', borderRadius: 999 }}>
            Placeholder: userà la foto cover
          </div>
        )}
      </div>
      <div style={{ padding: 12, background: '#f2f3f5' }}>
        <div style={{ fontSize: 11, color: '#65676b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
          {(url || '').replace(/^https?:\/\//, '')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#050505', lineHeight: 1.3, marginBottom: 2 }}>
          {title || 'Titolo del link (OG title)'}
        </div>
        <div style={{ fontSize: 13, color: '#65676b', lineHeight: 1.3 }}>
          {description || 'Descrizione del link (OG description)'}
        </div>
      </div>
    </div>
  )
}

function pickFallbackImage(form) {
  if (!Array.isArray(form.photos) || form.photos.length === 0) return null
  const first = form.photos[0]
  if (typeof first === 'string') return first
  return first?.photo_url || first?.url || null
}
