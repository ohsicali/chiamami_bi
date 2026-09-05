import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'
import DettagliTab from '../../components/admin/tabs/DettagliTab'
import FotoGalleriaTab from '../../components/admin/tabs/FotoGalleriaTab'
import CosaTiConsiglioTab from '../../components/admin/tabs/CosaTiConsiglioTab'
import ScontoTab from '../../components/admin/tabs/ScontoTab'
import CredenzialiTab from '../../components/admin/tabs/CredenzialiTab'
import SeoTab from '../../components/admin/tabs/SeoTab'
import { checkSeoReady, SeoLockedPlaceholder } from '../../components/admin/tabs/_SeoLockCheck'
import TabsShell from '../../components/admin/drawer/TabsShell'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'

const SECTIONS = [
  { key: 'dettagli', num: '01', label: 'Dettagli' },
  { key: 'foto', num: '02', label: 'Foto' },
  { key: 'consiglio', num: '03', label: 'Cosa consigli' },
  { key: 'sconto', num: '04', label: 'Sconto' },
  { key: 'credenziali', num: '05', label: 'Credenziali' },
  { key: 'seo', num: '06', label: 'SEO' },
]

/**
 * EditRestaurant — full-page edit (replaces drawer 720px).
 *
 * User preference (Augusto 24/04): "meglio tutto in pagina, più comodo
 * e intuitivo". Same 6 shared tab components, same save flow, zero
 * feature loss compared to drawer.
 *
 * Route: /admin/restaurant/:id/edit
 */
export default function EditRestaurant() {
  const { id: restaurantId } = useParams()
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isNew = searchParams.get('new') === '1'

  const isDesktop = useIsDesktop()
  const [activeTab, setActiveTab] = useState('dettagli')
  const [loading, setLoading] = useState(true)
  const [restaurant, setRestaurant] = useState(null)
  const [form, setForm] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [notifyOnPublish, setNotifyOnPublish] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!restaurantId || !isSupabaseConfigured()) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*, restaurant_photos(photo_url, thumb_url, caption, sort_order)')
        .eq('id', restaurantId)
        .single()
      if (cancelled) return
      if (error) {
        setLoadError(error.message || 'Ristorante non trovato')
        setLoading(false)
        return
      }
      setRestaurant(data)
      setForm(toFormState(data))
      setDirty(false)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  // Warn on page leave if dirty
  useEffect(() => {
    if (!dirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const updateField = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }, [])

  const handleSave = useCallback(
    async (alsoPublish) => {
      if (!form) return
      setSaving(true)
      const isFirstPublish = alsoPublish === true && !restaurant?.is_published
      try {
        const payload = toDbPayload(form, alsoPublish)
        const { error } = await supabase.from('restaurants').update(payload).eq('id', restaurantId)
        if (error) throw error

        // Save photos to restaurant_photos (delete + re-insert)
        await supabase.from('restaurant_photos').delete().eq('restaurant_id', restaurantId)
        if (form.photos?.length > 0) {
          const photoRows = form.photos
            .map((p, i) => ({
              restaurant_id: restaurantId,
              photo_url: p.url || p.photo_url || '',
              thumb_url: p.thumb_url || null,
              caption: p.caption || '',
              sort_order: i,
            }))
            .filter((p) => p.photo_url)
          if (photoRows.length > 0) {
            await supabase.from('restaurant_photos').insert(photoRows)
          }
        }

        setDirty(false)
        setToast({
          kind: 'ok',
          text: isFirstPublish
            ? 'Salvato e pubblicato ✓'
            : restaurant?.is_published
              ? 'Aggiornato ✓'
              : 'Salvato ✓',
        })
        setRestaurant((prev) => ({ ...prev, ...payload }))
        setTimeout(() => setToast(null), 2400)

        // On first publish: auto-send PIN email to partner + notify subscribers
        if (isFirstPublish) {
          const { data: sess } = await supabase.auth.getSession()
          const token = sess?.session?.access_token

          // Auto-send PIN to partner (fire-and-forget)
          if (token && form.partner_email && form.verify_pin) {
            fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                type: 'partner',
                to: form.partner_email,
                nomeLocale: form.name,
                pin: form.verify_pin,
                restaurantId,
              }),
            }).catch(() => {})
          }

          // Notify newsletter subscribers (fire-and-forget, only if toggle is on)
          if (token && notifyOnPublish) {
            fetch('/api/notify-subscribers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ type: 'restaurant', id: restaurantId }),
            }).catch(() => {})
          }
        }
      } catch (err) {
        setToast({ kind: 'err', text: `Errore: ${err.message || 'save failed'}` })
        setTimeout(() => setToast(null), 3400)
      } finally {
        setSaving(false)
      }
    },
    [form, restaurantId, restaurant, notifyOnPublish]
  )

  const handleDelete = useCallback(async () => {
    if (!restaurantId) return
    setDeleting(true)
    try {
      // Photo, sconti, partner sono in ON DELETE CASCADE — basta eliminare
      // la riga di restaurants.
      const { error } = await supabase.from('restaurants').delete().eq('id', restaurantId)
      if (error) throw error
      navigate('/admin/restaurants', { replace: true })
    } catch (err) {
      setToast({ kind: 'err', text: `Errore eliminazione: ${err.message || 'unknown'}` })
      setTimeout(() => setToast(null), 3400)
      setDeleting(false)
      setDeleteOpen(false)
    }
  }, [restaurantId, navigate])

  // SEO lock: until minimum data is filled, the SEO section shows a
  // checklist instead of the form.
  const { ready: seoReady, missing: seoMissing } = useMemo(
    () => (form ? checkSeoReady(form) : { ready: false, missing: [] }),
    [form]
  )

  if (authLoading || loading) return <LoadingScreen />
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />
  if (loadError || !form) {
    return (
      <AdminLayout title="Ristorante">
        <div style={{ padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 14 }}>🔎</div>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, margin: 0, color: 'var(--color-ink)' }}>
            Ristorante non trovato
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', margin: '10px 0 18px' }}>
            {loadError || 'L\'ID nella URL non corrisponde a nessun ristorante.'}
          </p>
          <Link
            to="/admin/restaurants"
            style={{
              background: 'var(--color-ink, #22181C)',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: 999,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 800,
              fontFamily: 'var(--font-sans)',
            }}
          >
            ← Torna alla lista
          </Link>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title={`Modifica ${form.name}`}>
      <div
        style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}
        className="max-md:!p-[18px] max-md:!pb-[180px]"
      >
        {/* ── Header ── */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
              letterSpacing: '0.04em',
              marginBottom: 8,
            }}
          >
            Gestione ›{' '}
            <Link to="/admin/restaurants" style={{ color: 'inherit', textDecoration: 'none' }}>
              Ristoranti
            </Link>{' '}
            ›{' '}
            <b style={{ color: 'var(--color-ink)', fontWeight: 800 }}>
              {form.name || 'Modifica'}
            </b>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 240 }}>
              <h1
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 900,
                  fontSize: 32,
                  letterSpacing: '-0.025em',
                  margin: 0,
                  color: 'var(--color-ink, #22181C)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                {form.name || 'Ristorante'}
                {!form.is_published && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'var(--color-cream-deep, #F1EBE0)',
                      color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Bozza
                  </span>
                )}
                {form.is_disabled && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'var(--color-danger-wash, #FCE8E4)',
                      color: 'var(--color-danger, #C0392B)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Accesso bloccato
                  </span>
                )}
              </h1>
              <div
                style={{
                  marginTop: 6,
                  color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {dirty ? 'Modifiche non salvate · ricordati di salvare.' : 'Tutto salvato.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                title="Elimina ristorante"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-line, #EAE3D7)',
                  color: 'var(--color-danger, #C0392B)',
                  padding: '9px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ display: 'inline-flex', width: 14, height: 14 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 6m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3" />
                  </svg>
                </span>
                Elimina
              </button>
              <a
                href={form.slug ? `/r/${form.slug}` : '#'}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-line, #EAE3D7)',
                  color: 'var(--color-ink, #22181C)',
                  padding: '9px 16px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                  fontFamily: 'var(--font-sans)',
                  pointerEvents: form.slug ? 'auto' : 'none',
                  opacity: form.slug ? 1 : 0.5,
                }}
              >
                Anteprima
              </a>
              {form.is_published ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave(true)}
                  style={{
                    background: 'var(--color-corallo, #E8453C)',
                    color: '#fff',
                    border: 0,
                    padding: '10px 18px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: saving ? 'wait' : 'pointer',
                    boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {saving ? 'Aggiorno…' : 'Aggiorna'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSave(false)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--color-line, #EAE3D7)',
                      color: 'var(--color-ink, #22181C)',
                      padding: '9px 16px',
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: saving ? 'wait' : 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Salva
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSave(true)}
                    style={{
                      background: 'var(--color-corallo, #E8453C)',
                      color: '#fff',
                      border: 0,
                      padding: '10px 18px',
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: saving ? 'wait' : 'pointer',
                      boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {saving ? 'Salvo…' : 'Salva · pubblica'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Toggle "notifica iscritti" — visibile solo se il ristorante non è ancora pubblicato */}
          {!form.is_published && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="notify-on-publish"
                type="checkbox"
                checked={notifyOnPublish}
                onChange={(e) => setNotifyOnPublish(e.target.checked)}
                style={{ accentColor: 'var(--color-corallo, #E8453C)', width: 14, height: 14 }}
              />
              <label
                htmlFor="notify-on-publish"
                style={{
                  fontSize: 12,
                  color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                Notifica iscritti newsletter alla pubblicazione
              </label>
            </div>
          )}
        </div>

        {isDesktop ? (
          /* ── Desktop: tab switcher (pre-PR15h design) ── */
          <TabsShell
            tabs={SECTIONS.map((s) => ({
              key: s.key,
              label: s.label,
              locked: s.key === 'seo' && !seoReady,
              lockedReason: 'Completa prima nome, città e racconto nei Dettagli.',
            }))}
            activeKey={activeTab}
            onChange={setActiveTab}
          >
            {activeTab === 'dettagli' && (
              <DettagliTab form={form} onChange={updateField} restaurantId={restaurantId} isNew={isNew} />
            )}
            {activeTab === 'foto' && (
              <FotoGalleriaTab form={form} onChange={updateField} restaurantId={restaurantId} />
            )}
            {activeTab === 'consiglio' && (
              <CosaTiConsiglioTab form={form} onChange={updateField} restaurantId={restaurantId} />
            )}
            {activeTab === 'sconto' && (
              <ScontoTab form={form} restaurantId={restaurantId} />
            )}
            {activeTab === 'credenziali' && (
              <CredenzialiTab
                form={form}
                onChange={updateField}
                restaurantId={restaurantId}
                onPinRotated={(pin, at) => {
                  setForm((prev) => ({ ...prev, verify_pin: pin, last_pin_rotation_at: at }))
                  setRestaurant((prev) => ({ ...prev, verify_pin: pin, last_pin_rotation_at: at }))
                }}
                onDisableToggled={(flag) => {
                  setForm((prev) => ({ ...prev, is_disabled: flag }))
                  setRestaurant((prev) => ({ ...prev, is_disabled: flag }))
                }}
              />
            )}
            {activeTab === 'seo' && (
              seoReady ? (
                <SeoTab form={form} onChange={updateField} restaurantId={restaurantId} />
              ) : (
                <SeoLockedPlaceholder
                  missing={seoMissing}
                  onGoToDettagli={() => setActiveTab('dettagli')}
                />
              )
            )}
          </TabsShell>
        ) : (
          /* ── Mobile: quick-nav pill + scroll unico ── */
          <>
            <nav
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 5,
                background: 'var(--color-page, #FAF7F2)',
                padding: '8px 0 12px',
                marginBottom: 8,
                borderBottom: '1px solid var(--color-line, #EAE3D7)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  background: '#fff',
                  border: '1px solid var(--color-line, #EAE3D7)',
                  borderRadius: 999,
                  padding: 4,
                  width: 'fit-content',
                  maxWidth: '100%',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                }}
              >
                {SECTIONS.map((s) => {
                  const locked = s.key === 'seo' && !seoReady
                  return (
                    <a
                      key={s.key}
                      href={`#sec-${s.key}`}
                      onClick={(e) => {
                        e.preventDefault()
                        document.getElementById(`sec-${s.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                        background: 'transparent',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-wordmark, "Alfa Slab One")', color: 'var(--color-corallo, #E8453C)', fontSize: 10 }}>
                        {s.num}
                      </span>
                      {locked && <span aria-hidden style={{ fontSize: 10 }}>🔒</span>}
                      {s.label}
                    </a>
                  )
                })}
              </div>
            </nav>

            <Section id="sec-dettagli" num="01" title="Dettagli">
              <DettagliTab form={form} onChange={updateField} restaurantId={restaurantId} isNew={isNew} />
            </Section>
            <Section id="sec-foto" num="02" title="Foto & galleria">
              <FotoGalleriaTab form={form} onChange={updateField} restaurantId={restaurantId} />
            </Section>
            <Section id="sec-consiglio" num="03" title="Cosa ti consiglio">
              <CosaTiConsiglioTab form={form} onChange={updateField} restaurantId={restaurantId} />
            </Section>
            <Section id="sec-sconto" num="04" title="Sconto">
              <ScontoTab form={form} restaurantId={restaurantId} />
            </Section>
            <Section id="sec-credenziali" num="05" title="Credenziali PIN">
              <CredenzialiTab
                form={form}
                onChange={updateField}
                restaurantId={restaurantId}
                onPinRotated={(pin, at) => {
                  setForm((prev) => ({ ...prev, verify_pin: pin, last_pin_rotation_at: at }))
                  setRestaurant((prev) => ({ ...prev, verify_pin: pin, last_pin_rotation_at: at }))
                }}
                onDisableToggled={(flag) => {
                  setForm((prev) => ({ ...prev, is_disabled: flag }))
                  setRestaurant((prev) => ({ ...prev, is_disabled: flag }))
                }}
              />
            </Section>
            <Section id="sec-seo" num="06" title="SEO" locked={!seoReady}>
              {seoReady ? (
                <SeoTab form={form} onChange={updateField} restaurantId={restaurantId} />
              ) : (
                <SeoLockedPlaceholder
                  missing={seoMissing}
                  onGoToDettagli={() =>
                    document.getElementById('sec-dettagli')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                />
              )}
            </Section>
          </>
        )}
      </div>

      {/* ── Floating mobile action bar — stile nav admin, staccata sopra ── */}
      {!isDesktop && (
        <div
          style={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
            background: 'rgba(34,24,28,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 24,
            padding: '8px 8px 8px 14px',
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            zIndex: 25,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {/* Status dot + label */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: dirty ? 'var(--color-corallo, #E8453C)' : '#86E5A8',
                flexShrink: 0,
                boxShadow: dirty
                  ? '0 0 0 4px rgba(232,69,60,0.18)'
                  : '0 0 0 4px rgba(134,229,168,0.18)',
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {dirty ? 'Da salvare' : 'Salvato'}
            </span>
          </div>

          <div style={{ flex: 1 }} />

          {form.is_published ? (
            // Già pubblicato: un solo bottone "Aggiorna" — sovrascrive i
            // dati senza far partire le mail di prima-pubblicazione.
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => handleSave(true)}
              style={{
                background: 'var(--color-corallo, #E8453C)',
                color: '#fff',
                border: 0,
                padding: '9px 16px',
                borderRadius: 18,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
                cursor: saving || !dirty ? 'not-allowed' : 'pointer',
                opacity: saving || !dirty ? 0.4 : 1,
                boxShadow: '0 6px 14px rgba(232,69,60,0.45)',
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Aggiorno…' : 'Aggiorna'}
            </button>
          ) : (
            <>
              {/* Salva (ghost chiaro) — bozza, non pubblica ancora */}
              <button
                type="button"
                disabled={saving || !dirty}
                onClick={() => handleSave(false)}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 0,
                  color: '#fff',
                  padding: '9px 14px',
                  borderRadius: 18,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  cursor: saving || !dirty ? 'not-allowed' : 'pointer',
                  opacity: saving || !dirty ? 0.4 : 1,
                  fontFamily: 'inherit',
                }}
              >
                Salva
              </button>

              {/* Pubblica (corallo) — prima pubblicazione, parte la mail */}
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                style={{
                  background: 'var(--color-corallo, #E8453C)',
                  color: '#fff',
                  border: 0,
                  padding: '9px 16px',
                  borderRadius: 18,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  cursor: saving ? 'wait' : 'pointer',
                  boxShadow: '0 6px 14px rgba(232,69,60,0.45)',
                  fontFamily: 'inherit',
                }}
              >
                {saving ? 'Salvo…' : 'Pubblica'}
              </button>
            </>
          )}

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 22,
              background: 'rgba(255,255,255,0.15)',
              margin: '0 2px',
              flexShrink: 0,
            }}
            aria-hidden
          />

          {/* Elimina */}
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            title="Elimina ristorante"
            aria-label="Elimina ristorante"
            style={{
              background: 'transparent',
              border: 0,
              color: '#FF8A82',
              width: 36,
              height: 36,
              borderRadius: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            <TrashIcon />
          </button>
        </div>
      )}

      {/* ── Modale conferma eliminazione ── */}
      {deleteOpen && (
        <DeleteConfirmModal
          name={form.name}
          deleting={deleting}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      )}

      {/* Save toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            style={{
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: toast.kind === 'err' ? 'var(--color-danger, #C0392B)' : 'var(--color-ink, #22181C)',
              color: '#fff',
              padding: '12px 20px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              fontFamily: 'var(--font-sans)',
              zIndex: 100,
            }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}

/* ------------------------------------------------------------------ */
/*  Section — big numbered heading + content wrapper                   */
/* ------------------------------------------------------------------ */
function Section({ id, num, title, locked, children }) {
  return (
    <section id={id} style={{ paddingTop: 28, scrollMarginTop: 72 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
          marginBottom: 16,
          paddingBottom: 10,
          borderBottom: '1px solid var(--color-line, #EAE3D7)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-wordmark, "Alfa Slab One")',
            color: 'var(--color-corallo, #E8453C)',
            fontSize: 20,
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}
        >
          {num}
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: '-0.02em',
            margin: 0,
            color: 'var(--color-ink, #22181C)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {title}
          {locked && (
            <span
              aria-hidden
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 999,
                background: 'var(--color-cream-deep, #F1EBE0)',
                color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              🔒 bloccato
            </span>
          )}
        </h2>
      </div>
      {children}
    </section>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 6m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3" />
    </svg>
  )
}

function DeleteConfirmModal({ name, deleting, onCancel, onConfirm }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => !deleting && onCancel()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(34,24,28,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: 26,
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 30px 60px rgba(0,0,0,0.3)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--color-danger-wash, #FCE8E4)',
            color: 'var(--color-danger, #C0392B)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 6m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3" />
          </svg>
        </div>
        <h3
          style={{
            margin: 0,
            fontWeight: 900,
            fontSize: 20,
            color: 'var(--color-ink, #22181C)',
            textAlign: 'center',
            letterSpacing: '-0.02em',
          }}
        >
          Eliminare {name || 'questo ristorante'}?
        </h3>
        <p
          style={{
            margin: '10px 0 22px',
            fontSize: 13,
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Verranno eliminati anche foto, sconti e dati partner collegati. <b>L'azione è
          irreversibile.</b>
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-line, #EAE3D7)',
              color: 'var(--color-ink, #22181C)',
              padding: '10px 18px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              cursor: deleting ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            style={{
              background: 'var(--color-danger, #C0392B)',
              color: '#fff',
              border: 0,
              padding: '10px 18px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              cursor: deleting ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 6px 14px rgba(192,57,43,0.32)',
            }}
          >
            {deleting ? 'Elimino…' : 'Sì, elimina'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-page, #FAF7F2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid var(--color-corallo, #E8453C)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'edit-spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes edit-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Form-state ↔ DB mapping (same shape as RestaurantDrawer)          */
/* ------------------------------------------------------------------ */

function toFormState(r) {
  return {
    id: r.id,
    name: r.name || '',
    slug: r.slug || '',
    tagline: r.tagline || '',
    our_review: r.our_review || '',
    our_tip: r.our_tip || '',
    address: r.address || '',
    city: r.city || 'Torino',
    neighborhood: r.neighborhood || '',
    phone: r.phone || '',
    website: r.website || '',
    google_maps_url: r.google_maps_url || '',
    menu_url: r.menu_url || '',
    reservation_url: r.reservation_url || '',
    instagram_url: r.instagram_url || '',
    services: r.services || {},
    category: Array.isArray(r.category) ? r.category : [],
    cuisine_type: r.cuisine_type || '',
    price_range: r.price_range ?? 2,
    recommended_for: Array.isArray(r.recommended_for) ? r.recommended_for : [],
    moments: Array.isArray(r.moments) ? r.moments : [],
    latitude: r.latitude != null ? String(r.latitude) : '',
    longitude: r.longitude != null ? String(r.longitude) : '',
    photos: Array.isArray(r.restaurant_photos)
      ? r.restaurant_photos
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((p) => ({
            url: p.photo_url || '',
            photo_url: p.photo_url || '',
            thumb_url: p.thumb_url || null,
            caption: p.caption || '',
            sort_order: p.sort_order ?? 0,
          }))
      : [],
    is_published: r.is_published !== false,
    is_disabled: r.is_disabled === true,
    verify_pin: r.verify_pin || '',
    partner_email: r.partner_email || '',
    last_pin_rotation_at: r.last_pin_rotation_at || null,
    place_id: r.place_id || '',
    place_id_confidence: r.place_id_confidence ?? null,
    place_id_verified_at: r.place_id_verified_at || null,
    hours_cache_updated_at: r.hours_cache_updated_at || null,
    seo_title: r.seo_title || '',
    seo_description: r.seo_description || '',
    og_title: r.og_title || '',
    og_description: r.og_description || '',
    og_image: r.og_image || '',
    noindex: r.noindex === true,
  }
}

function toDbPayload(form, alsoPublish) {
  const payload = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    tagline: form.tagline || null,
    our_review: form.our_review || null,
    our_tip: form.our_tip || null,
    address: form.address || null,
    city: form.city || 'Torino',
    neighborhood: form.neighborhood || null,
    phone: form.phone || null,
    website: form.website || null,
    google_maps_url: form.google_maps_url || null,
    menu_url: form.menu_url || null,
    reservation_url: form.reservation_url || null,
    instagram_url: form.instagram_url || null,
    services: form.services || {},
    category: form.category,
    cuisine_type: form.cuisine_type || (form.category?.[0] ?? null),
    price_range: form.price_range ?? 2,
    recommended_for: form.recommended_for,
    moments: Array.isArray(form.moments) ? form.moments : [],
    latitude: form.latitude !== '' && form.latitude != null ? parseFloat(form.latitude) || null : null,
    longitude: form.longitude !== '' && form.longitude != null ? parseFloat(form.longitude) || null : null,
    partner_email: form.partner_email || null,
    place_id: form.place_id || null,
    place_id_confidence: form.place_id_confidence,
    place_id_verified_at: form.place_id_verified_at,
    seo_title: form.seo_title || null,
    seo_description: form.seo_description || null,
    og_title: form.og_title || null,
    og_description: form.og_description || null,
    og_image: form.og_image || null,
    noindex: form.noindex === true,
    updated_at: new Date().toISOString(),
  }
  if (alsoPublish === true) payload.is_published = true
  else payload.is_published = form.is_published
  return payload
}
