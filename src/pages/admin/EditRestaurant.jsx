import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'
import { RESTAURANT_READABLE_COLUMNS, fetchRestaurantSecrets } from '../../lib/restaurantColumns'
import AdminLayout from '../../components/Layout/AdminLayout'
import DettagliTab from '../../components/admin/tabs/DettagliTab'
import FotoGalleriaTab from '../../components/admin/tabs/FotoGalleriaTab'
import CosaTiConsiglioTab from '../../components/admin/tabs/CosaTiConsiglioTab'
import ScontoTab from '../../components/admin/tabs/ScontoTab'
import CredenzialiTab from '../../components/admin/tabs/CredenzialiTab'
import SeoTab from '../../components/admin/tabs/SeoTab'
import { checkSeoReady, SeoLockedPlaceholder, SEO_MIN_REVIEW_CHARS } from '../../components/admin/tabs/_SeoLockCheck'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
import { toLocalInput, fromLocalInput, publishAtError, formatPublishAt } from '../../lib/scheduledPublish'
import PublishSchedule from '../../components/admin/PublishSchedule'
import { Ring, Sheet, Toast } from '../../components/admin/ui'

const SECTIONS = [
  { key: 'dettagli', num: '01', label: 'Dettagli' },
  { key: 'foto', num: '02', label: 'Foto' },
  { key: 'consiglio', num: '03', label: 'Cosa consigli' },
  { key: 'sconto', num: '04', label: 'Sconti' },
  { key: 'credenziali', num: '05', label: 'Credenziali' },
  { key: 'seo', num: '06', label: 'SEO' },
]

/**
 * EditRestaurant — la scheda del locale, tutta in una pagina.
 *
 * Rifatta il 30/09 (kit grafico in components/admin/admin-ui.css):
 *   - in cima chi è e a che punto è: copertina, stato, e la lista di quello
 *     che manca per uscire (tocchi una voce e vai alla sezione);
 *   - "Quando esce?" subito sotto, finché è in bozza;
 *   - le sezioni una dopo l'altra, con l'indice a sinistra da computer e in
 *     alto da telefono (prima il computer aveva le schede e il telefono lo
 *     scorrimento: due pagine diverse per la stessa cosa);
 *   - una sola barra per salvare, in fondo. Sul telefono prima c'erano i
 *     bottoni in cima (che uscivano dallo schermo: "Salva · pubblic…") più
 *     una barra scura sopra la barra di navigazione.
 *
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
  const [activeSection, setActiveSection] = useState('dettagli')
  const [moreOpen, setMoreOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [restaurant, setRestaurant] = useState(null)
  const [form, setForm] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const clearToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!restaurantId || !isSupabaseConfigured()) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const [{ data: row, error }, secrets] = await Promise.all([
        supabase
          .from('restaurants')
          .select(`${RESTAURANT_READABLE_COLUMNS}, publish_at, notify_on_publish, restaurant_photos(photo_url, thumb_url, caption, sort_order), restaurant_locations(id, label, address, latitude, longitude, sort_order)`)
          .eq('id', restaurantId)
          .single(),
        // PIN ed email del partner non stanno nella select: la tabella non li
        // dà più a nessun browser, l'admin li chiede all'RPC.
        fetchRestaurantSecrets([restaurantId]).catch((err) => {
          console.error('edit secrets error:', err)
          return {}
        }),
      ])
      const data = row ? { ...row, ...(secrets[restaurantId] || {}) } : row
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
      // Uscita programmata: il locale resta in bozza e lo mette online il
      // giro ogni 5 minuti (api/_scheduled-publish.js), con le stesse email
      // della prima pubblicazione fatta da qui.
      const scheduling = alsoPublish !== true && !form.is_published && form.schedule_on
      if (scheduling) {
        const err = publishAtError(form.publish_at)
        if (err) {
          setToast({ kind: 'err', text: err })
          setTimeout(() => setToast(null), 3400)
          return
        }
      }
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

        // Save extra locations to restaurant_locations (delete + re-insert,
        // stesso pattern delle foto). Righe senza indirizzo o coordinate
        // vengono scartate: una sede a metà compilata non deve comparire
        // come pin fantasma sulla mappa.
        await supabase.from('restaurant_locations').delete().eq('restaurant_id', restaurantId)
        if (form.locations?.length > 0) {
          const locationRows = form.locations
            .map((l, i) => ({
              restaurant_id: restaurantId,
              label: l.label || null,
              address: l.address || '',
              latitude: l.latitude !== '' && l.latitude != null ? parseFloat(l.latitude) : null,
              longitude: l.longitude !== '' && l.longitude != null ? parseFloat(l.longitude) : null,
              sort_order: i,
            }))
            .filter((l) => l.address && l.latitude != null && l.longitude != null)
          if (locationRows.length > 0) {
            await supabase.from('restaurant_locations').insert(locationRows)
          }
        }

        setDirty(false)
        setToast({
          kind: 'ok',
          text: isFirstPublish
            ? 'Salvato e pubblicato ✓'
            : restaurant?.is_published
              ? 'Aggiornato ✓'
              : payload.publish_at
                ? `Programmato: esce ${formatPublishAt(payload.publish_at)} ✓`
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
          if (token && form.notify_on_publish) {
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
    [form, restaurantId, restaurant]
  )

  const handleDelete = useCallback(async () => {
    if (!restaurantId) return
    setDeleting(true)
    try {
      // Photo, sconti, partner, sedi extra sono in ON DELETE CASCADE — basta eliminare
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

  // Cosa manca per uscire. Le prime voci servono davvero (senza, la scheda
  // pubblica è vuota o il pin non c'è); il PIN solo se il locale avrà sconti.
  const checklist = useMemo(() => {
    if (!form) return { required: [], optional: [], ready: false }
    const named = form.name.trim() && !/^nuovo ristorante$/i.test(form.name.trim())
    const required = [
      { key: 'name', label: 'Nome e indirizzo', section: 'dettagli', done: !!(named && form.address.trim()) },
      { key: 'map', label: 'Posizione sulla mappa', section: 'dettagli', done: !!(form.latitude && form.longitude) },
      { key: 'photo', label: 'Foto', section: 'foto', done: (form.photos?.length || 0) > 0 },
      { key: 'cat', label: 'Categoria', section: 'dettagli', done: (form.category?.length || 0) > 0 },
      { key: 'story', label: 'Racconto di Bi', section: 'dettagli', done: (form.our_review || '').trim().length >= SEO_MIN_REVIEW_CHARS },
    ]
    const optional = [
      { key: 'pin', label: 'PIN per gli sconti', section: 'credenziali', done: !!form.verify_pin },
    ]
    return { required, optional, ready: required.every((c) => c.done) }
  }, [form])

  const sectionDone = useMemo(() => {
    const r = Object.fromEntries(checklist.required.concat(checklist.optional).map((c) => [c.key, c.done]))
    return {
      dettagli: r.name && r.map && r.cat && r.story,
      foto: r.photo,
      credenziali: r.pin,
      seo: !!(form?.seo_title && form?.seo_description),
    }
  }, [checklist, form?.seo_title, form?.seo_description])

  // Indice delle sezioni: si accende quella che si sta leggendo.
  useEffect(() => {
    if (loading || !form || typeof IntersectionObserver === 'undefined') return undefined
    const els = SECTIONS.map((s) => document.getElementById(`sec-${s.key}`)).filter(Boolean)
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActiveSection(top.target.dataset.section)
      },
      { rootMargin: '-30% 0px -60% 0px' }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, !!form])

  if (authLoading || loading) return <LoadingScreen />
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />
  if (loadError || !form) {
    return (
      <AdminLayout title="Ristorante" focus back={{ to: '/admin/restaurants', label: 'Ristoranti' }}>
        <div className="adm adm-page adm-page--narrow" style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: 36, marginBottom: 14 }} aria-hidden>🔎</div>
          <h2 className="adm-title" style={{ fontSize: 22 }}>Ristorante non trovato</h2>
          <p className="adm-sub" style={{ margin: '10px 0 20px' }}>
            {loadError || 'L\'ID nella URL non corrisponde a nessun ristorante.'}
          </p>
          <Link to="/admin/restaurants" className="adm-btn adm-btn--dark">← Torna alla lista</Link>
        </div>
      </AdminLayout>
    )
  }

  const cover = form.photos?.[0]?.thumb_url || form.photos?.[0]?.url || null
  const status = form.is_disabled
    ? { cls: 'adm-pill--danger', label: 'Accesso bloccato' }
    : form.is_published
      ? { cls: 'adm-pill--live', label: 'In guida', dot: true }
      : restaurant?.publish_at
        ? { cls: 'adm-pill--scheduled', label: `⏰ Esce ${formatPublishAt(restaurant.publish_at)}` }
        : { cls: 'adm-pill--draft', label: 'Bozza', dot: true }
  const saveLabel = form.is_published ? 'Aggiorna' : 'Salva'
  const publishLabel = form.schedule_on ? 'Programma' : 'Pubblica'
  // Gli stessi bottoni nella barra in fondo (telefono) e sotto l'indice
  // (computer). Già pubblicato: un solo "Aggiorna", che sovrascrive i dati
  // senza far partire le email della prima pubblicazione.
  const saveButtons = form.is_published ? (
    <button type="button" className="adm-btn adm-btn--primary" disabled={saving || !dirty} onClick={() => handleSave(true)}>
      {saving ? 'Aggiorno…' : saveLabel}
    </button>
  ) : (
    <>
      {/* Salva — bozza, non pubblica ancora */}
      <button type="button" className="adm-btn adm-btn--soft" disabled={saving || !dirty} onClick={() => handleSave(false)}>
        {saveLabel}
      </button>
      {/* Pubblica — prima pubblicazione, parte la mail (o la programma) */}
      <button type="button" className="adm-btn adm-btn--primary" disabled={saving} onClick={() => handleSave(form.schedule_on ? false : true)}>
        {saving ? 'Salvo…' : publishLabel}
      </button>
    </>
  )

  const goTo = (key) => {
    if (key === 'seo' && !seoReady) key = 'dettagli'
    document.getElementById(`sec-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <AdminLayout title={form.name || 'Ristorante'} focus back={{ to: '/admin/restaurants', label: 'Ristoranti' }}>
      <div className="adm adm-page">
        {/* ── Intestazione: chi è, a che punto è ── */}
        <div className="adm-crumbs adm-crumbs--focus">
          <Link to="/admin/restaurants">Ristoranti</Link> › <b>{form.name || 'Modifica'}</b>
        </div>

        {isNew && (
          <div className="adm-note adm-note--ok" style={{ marginBottom: 14 }}>
            <span aria-hidden>🎉</span>
            <span>Bozza creata. Ora mancano foto, categoria e il racconto di Bi: la lista qui sotto ti dice cosa.</span>
          </div>
        )}

        <section className="adm-card adm-rest-hero">
          <div className="adm-rest-hero__top">
            <div className="adm-rest-hero__cover" aria-hidden>
              {cover ? <img src={proxyImg(cover, { w: 240 })} alt="" /> : <span>🍽️</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <span className={`adm-pill ${status.cls}`}>{status.dot && <i />}{status.label}</span>
                {dirty && <span className="adm-pill adm-pill--warn">Da salvare</span>}
              </div>
              <h1 className="adm-title adm-rest-hero__name">{form.name || 'Senza nome'}</h1>
              <p className="adm-sub" style={{ marginTop: 4 }}>
                {[String(form.address || '').split(',')[0], form.neighborhood, form.city].filter(Boolean).join(' · ') || 'Indirizzo da compilare'}
              </p>
            </div>
            {isDesktop && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <a
                  href={form.slug ? `/restaurant/${form.slug}` : '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="adm-btn"
                  style={{ pointerEvents: form.slug ? 'auto' : 'none', opacity: form.slug ? 1 : 0.5 }}
                >
                  Anteprima ↗
                </a>
                <button type="button" className="adm-btn adm-btn--danger adm-btn--icon" onClick={() => setDeleteOpen(true)} title="Elimina ristorante" aria-label="Elimina ristorante">
                  <TrashIcon />
                </button>
                {/* Da computer si salva anche da qui, senza scendere all'indice. */}
                <div className="adm-savecard adm-savecard--inline">{saveButtons}</div>
              </div>
            )}
          </div>

          <div className="adm-rest-hero__progress">
            <Ring done={checklist.required.filter((c) => c.done).length} total={checklist.required.length} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
                {checklist.ready
                  ? (form.is_published ? 'Scheda completa ✓' : 'Pronto per uscire ✓')
                  : (() => {
                      const n = checklist.required.filter((c) => !c.done).length
                      return n === 1 ? 'Per uscire manca una cosa' : `Per uscire mancano ${n} cose`
                    })()}
              </div>
              <ul className="adm-checklist">
                {[...checklist.required, ...checklist.optional].map((c) => (
                  <li key={c.key} className={c.done ? 'is-done' : ''}>
                    <button type="button" onClick={() => goTo(c.section)}>
                      <i aria-hidden>✓</i>
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Quando esce e se parte l'email — solo finché il locale è in bozza.
            Resta in cima: la prima versione, più in basso, non la trovava
            nessuno (CLAUDE.md → Uscita programmata). */}
        {!form.is_published && (
          <PublishSchedule form={form} onChange={updateField} />
        )}

        {/* ── Sezioni: indice a sinistra (computer) o in alto (telefono) ── */}
        <div className="adm-rest-layout">
          <nav className="adm-rest-nav" aria-label="Sezioni della scheda">
            {SECTIONS.map((s) => {
              const locked = s.key === 'seo' && !seoReady
              const done = sectionDone[s.key]
              return (
                <a
                  key={s.key}
                  href={`#sec-${s.key}`}
                  className={activeSection === s.key ? 'is-active' : ''}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(`sec-${s.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  <span className="adm-num">{s.num}</span>
                  <span className="adm-rest-nav__label">{s.label}</span>
                  {locked ? <span aria-label="bloccato">🔒</span> : done ? <span className="adm-rest-nav__done" aria-label="completo">✓</span> : null}
                </a>
              )
            })}
            <div className="adm-savecard" role="region" aria-label="Salvataggio">
              <span className="adm-actionbar__status">
                <span className={`adm-actionbar__dot${dirty ? ' is-dirty' : ''}`} aria-hidden />
                {saving ? 'Salvo…' : dirty ? 'Da salvare' : 'Tutto salvato'}
              </span>
              <div className="adm-savecard__btns">{saveButtons}</div>
            </div>
          </nav>

          <div className="adm-rest-sections">
            <Section id="sec-dettagli" num="01" title="Dettagli" hint="Nome, indirizzo, categorie, racconto e contatti.">
              <DettagliTab form={form} onChange={updateField} restaurantId={restaurantId} isNew={isNew && !form.google_maps_url} canSchedule={!restaurant?.is_published} />
            </Section>
            <Section id="sec-foto" num="02" title="Foto & galleria" hint="La prima è la copertina su mappa, card e scheda.">
              <FotoGalleriaTab form={form} onChange={updateField} restaurantId={restaurantId} />
            </Section>
            <Section id="sec-consiglio" num="03" title="Cosa ti consiglio" hint="I piatti da non perdere, con le foto.">
              <CosaTiConsiglioTab form={form} onChange={updateField} restaurantId={restaurantId} />
            </Section>
            <Section id="sec-sconto" num="04" title="Sconti" hint="Convenzioni e drop di questo locale.">
              <ScontoTab form={form} restaurantId={restaurantId} />
            </Section>
            <Section id="sec-credenziali" num="05" title="Credenziali PIN" hint="Il PIN con cui il locale convalida gli sconti in /verify.">
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
            <Section id="sec-seo" num="06" title="SEO" locked={!seoReady} hint="Titolo e descrizione per Google e per le condivisioni.">
              {seoReady ? (
                <SeoTab form={form} onChange={updateField} restaurantId={restaurantId} />
              ) : (
                <SeoLockedPlaceholder
                  missing={seoMissing}
                  onGoToDettagli={() => goTo('dettagli')}
                />
              )}
            </Section>
            <div className="adm-actionbar-spacer" />
          </div>
        </div>
      </div>

      {/* ── Barra azioni in fondo: telefono e tablet (da computer i bottoni
          stanno sotto l'indice delle sezioni, dove non coprono niente) ── */}
      <div className="adm adm-actionbar adm-actionbar--edit" role="region" aria-label="Salvataggio">
        <span className="adm-actionbar__status">
          <span className={`adm-actionbar__dot${dirty ? ' is-dirty' : ''}`} aria-hidden />
          {saving ? 'Salvo…' : dirty ? 'Modifiche da salvare' : 'Tutto salvato'}
        </span>
        {!isDesktop && (
          <button
            type="button"
            className="adm-btn adm-btn--soft adm-btn--icon"
            onClick={() => setMoreOpen(true)}
            aria-label="Altre azioni"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </button>
        )}
        {saveButtons}
      </div>

      {/* ── Altre azioni (telefono): anteprima ed elimina ── */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={form.name || 'Ristorante'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <a
            href={form.slug ? `/restaurant/${form.slug}` : '#'}
            target="_blank"
            rel="noreferrer"
            className="adm-bigpick"
            onClick={() => setMoreOpen(false)}
          >
            <span className="adm-bigpick__icon" style={{ background: 'var(--adm-cream)' }} aria-hidden>👀</span>
            <span><b>Anteprima</b><small>Apre la scheda pubblica in una nuova scheda.</small></span>
          </a>
          <Link to={`/admin/discounts?new=1&restaurant=${restaurantId}`} className="adm-bigpick" onClick={() => setMoreOpen(false)}>
            <span className="adm-bigpick__icon" style={{ background: 'linear-gradient(135deg, #A3E635, #4ADE80)' }} aria-hidden>🎟️</span>
            <span><b>Nuovo sconto per questo locale</b><small>Si apre l'editor con il locale già scelto.</small></span>
          </Link>
          <button
            type="button"
            className="adm-bigpick"
            onClick={() => { setMoreOpen(false); setDeleteOpen(true) }}
          >
            <span className="adm-bigpick__icon" style={{ background: 'var(--adm-danger-bg)', color: 'var(--adm-danger)' }} aria-hidden><TrashIcon /></span>
            <span><b style={{ color: 'var(--adm-danger)' }}>Elimina ristorante</b><small>Con foto, sconti e dati partner. Chiede conferma.</small></span>
          </button>
        </div>
      </Sheet>

      {/* ── Modale conferma eliminazione ── */}
      {deleteOpen && (
        <DeleteConfirmModal
          name={form.name}
          deleting={deleting}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      )}

      <Toast toast={toast} onDone={clearToast} />
    </AdminLayout>
  )
}

/* ------------------------------------------------------------------ */
/*  Section — big numbered heading + content wrapper                   */
/* ------------------------------------------------------------------ */
function Section({ id, num, title, hint, locked, children }) {
  return (
    <section id={id} className="adm-rest-section" data-section={id.replace('sec-', '')}>
      <header className="adm-rest-section__head">
        <span className="adm-num" style={{ fontSize: 22 }}>{num}</span>
        <div style={{ minWidth: 0 }}>
          <h2>
            {title}
            {locked && <span className="adm-pill" style={{ marginLeft: 10, verticalAlign: 'middle' }}>🔒 bloccato</span>}
          </h2>
          {hint && <p>{hint}</p>}
        </div>
      </header>
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
    location_label: r.location_label || '',
    phone: r.phone || '',
    website: r.website || '',
    google_maps_url: r.google_maps_url || '',
    menu_url: r.menu_url || '',
    reservation_url: r.reservation_url || '',
    // "Video Instagram": i reel vecchi stanno in `instagram_reel`, quelli
    // messi da qui in `instagram_url` (vedi lib/restaurantVideos.js).
    instagram_url: r.instagram_url || r.instagram_reel || '',
    tiktok_url: r.tiktok_url || '',
    services: r.services || {},
    category: Array.isArray(r.category) ? r.category : [],
    cuisine_type: r.cuisine_type || '',
    price_range: r.price_range ?? 2,
    recommended_for: Array.isArray(r.recommended_for) ? r.recommended_for : [],
    moments: Array.isArray(r.moments) ? r.moments : [],
    latitude: r.latitude != null ? String(r.latitude) : '',
    longitude: r.longitude != null ? String(r.longitude) : '',
    locations: Array.isArray(r.restaurant_locations)
      ? r.restaurant_locations
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((l) => ({
            id: l.id,
            label: l.label || '',
            address: l.address || '',
            latitude: l.latitude != null ? String(l.latitude) : '',
            longitude: l.longitude != null ? String(l.longitude) : '',
          }))
      : [],
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
    schedule_on: !!r.publish_at,
    publish_at: toLocalInput(r.publish_at),
    notify_on_publish: r.notify_on_publish !== false,
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
    location_label: form.location_label || null,
    phone: form.phone || null,
    website: form.website || null,
    google_maps_url: form.google_maps_url || null,
    menu_url: form.menu_url || null,
    reservation_url: form.reservation_url || null,
    instagram_url: form.instagram_url || null,
    // Svuotato il campo, sparisce anche il reel vecchio: sennò la scheda
    // continuerebbe a mostrarlo.
    ...(form.instagram_url ? {} : { instagram_reel: null }),
    tiktok_url: form.tiktok_url || null,
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
  // Una data d'uscita vale solo per un locale ancora in bozza: pubblicato
  // (adesso o prima) non ha più niente da aspettare.
  payload.publish_at = !payload.is_published && form.schedule_on ? fromLocalInput(form.publish_at) : null
  payload.notify_on_publish = form.notify_on_publish !== false
  return payload
}

