import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PrettyDatePicker from './PrettyDatePicker'
import { ProductsEditor, ValidityPicker } from './DiscountRulesFields'
import DiscountPreview from './DiscountPreview'
import { Card, Choices, Field, Sheet, ToggleRow } from './ui'
import { proxyImg } from '../../lib/supabase'
import { toLocalInput, fromLocalInput, defaultPublishInput, formatPublishAt } from '../../lib/scheduledPublish'
import { formatDays, formatSlots } from '../../lib/validity'

/**
 * L'editor di uno sconto, a tutto schermo (30/09).
 *
 * Prima era una finestrella da 520px con diciotto campi uno sotto l'altro,
 * e il tipo di offerta (drop o convenzione) — la scelta che decide tutto il
 * resto — stava a metà. Qui è un percorso in sei blocchi numerati, con
 * accanto (computer) o a un tocco (telefono) l'anteprima di come lo vedrà
 * chi apre il sito, drop corallo o convenzione crema e oro:
 *
 *   01 Per quale locale · 02 Che tipo · 03 L'offerta · 04 Regole
 *   05 Durata e posti · 06 Come esce (subito / programmata / prova / pausa)
 *
 * Tutta la logica del salvataggio resta in DiscountManager (`handleSave`):
 * qui ci sono solo i campi, che scrivono nello stesso `form` di prima. Le
 * regole sulle email non cambiano — l'annuncio parte solo creando, mai
 * salvando una modifica (CLAUDE.md → "Modificare uno sconto non manda email").
 */
export default function DiscountEditor({
  open,
  editing,
  form,
  setForm,
  restaurants,
  partnerIds,
  newPartner,
  setNewPartner,
  saving,
  saveError,
  takenDuringTest = 0,
  readLastTesters,
  onSave,
  onClose,
}) {
  const scrollRef = useRef(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Blocca lo scroll della pagina sotto (e lo "swipe di lato" su iPhone).
  useEffect(() => {
    if (!open) return undefined
    const html = document.documentElement
    const body = document.body
    const prev = [html.style.overflow, body.style.overflow]
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape' && !previewOpen) onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      html.style.overflow = prev[0]
      body.style.overflow = prev[1]
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, previewOpen])

  const restId = form.restaurant_id || newPartner?.id
  const restaurant = useMemo(() => restaurants.find((r) => r.id === restId) || null, [restaurants, restId])
  const set = (patch) => setForm((f) => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) }))

  const missing = [
    !restId && 'il locale',
    !String(form.discount_value || '').trim() && 'il valore',
    !String(form.title || '').trim() && 'il titolo',
  ].filter(Boolean)
  const canSave = missing.length === 0 && !saving

  const mode = form.is_test ? 'test' : form.schedule_on ? 'scheduled' : form.is_active ? 'now' : 'paused'
  const saveLabel = saving
    ? 'Salvo…'
    : editing
      ? 'Salva modifiche'
      : mode === 'scheduled'
        ? 'Programma sconto'
        : mode === 'test'
          ? 'Crea la prova'
          : 'Crea sconto'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="editor"
          ref={scrollRef}
          className="adm adm-editor"
          role="dialog"
          aria-modal="true"
          aria-labelledby="de-title"
          // Solo opacità: una trasformazione qui farebbe da riferimento
          // alla barra `position: fixed` qui dentro, che scorrerebbe via.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <header className="adm-editor__bar">
            <button type="button" className="adm-btn adm-btn--icon" onClick={onClose} aria-label="Chiudi senza salvare">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
            <h2 id="de-title">
              {editing ? 'Modifica sconto' : 'Nuovo sconto'}
              {restaurant && <span style={{ fontWeight: 600, color: 'var(--adm-muted)' }}> · {restaurant.name}</span>}
            </h2>
          </header>

          <div className="adm-editor__grid">
            <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 01 — Per quale locale */}
              <Card>
                <StepTitle num="01" title="Per quale locale" hint={editing ? 'Il locale di uno sconto già creato non si cambia.' : 'Solo i locali con il PIN attivo possono convalidare gli sconti.'} />
                <RestaurantPicker
                  editing={editing}
                  restaurants={restaurants}
                  partnerIds={partnerIds}
                  value={form.restaurant_id}
                  newPartner={newPartner}
                  onPick={(id) => { set({ restaurant_id: id }); setNewPartner(null) }}
                  onPickNewPartner={(r) => { set({ restaurant_id: '' }); setNewPartner({ id: r.id, name: r.name }) }}
                  onClear={() => { set({ restaurant_id: '' }); setNewPartner(null) }}
                />
              </Card>

              {/* 02 — Che tipo */}
              <Card>
                <StepTitle num="02" title="Che tipo di sconto" hint="Decide colore, countdown e posti: il drop brucia in fretta, la convenzione resta." />
                <Choices
                  label="Tipo di sconto"
                  cols={3}
                  colsSm={1}
                  value={form.kind}
                  onChange={(kind) => setForm((f) => switchKind(f, kind))}
                  options={[
                    { id: 'discount', variant: 'conv', emoji: '🤝', title: 'Convenzione', hint: 'Sempre valida finché la tieni accesa. Crema e oro, niente countdown.' },
                    { id: 'drop', variant: 'drop', emoji: '🔥', title: 'Drop', hint: 'A tempo e a posti contati. Corallo, countdown e barra dei posti.' },
                    { id: 'featured', variant: 'conv', emoji: '⭐', title: 'In evidenza', hint: 'Una convenzione messa in primo piano.' },
                  ]}
                />
              </Card>

              {/* 03 — L'offerta */}
              <Card>
                <StepTitle num="03" title="L'offerta" hint="Il valore finisce nel badge verde, il titolo è il vantaggio in parole." />
                <Field label="Com'è lo sconto">
                  <div className="adm-chips" role="radiogroup" aria-label="Com'è lo sconto">
                    {TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={form.discount_type === t.id}
                        className="adm-chip"
                        onClick={() => set({ discount_type: t.id })}
                      >
                        <span aria-hidden>{t.icon}</span> {t.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="adm-grid-2" style={{ marginTop: 16 }}>
                  <Field label={valueLabel(form.discount_type)} htmlFor="de-value" help={valueHelp(form.discount_type)}>
                    <div className="adm-affix">
                      <input
                        id="de-value"
                        type="text"
                        inputMode={form.discount_type === 'percentage' || form.discount_type === 'fixed' || form.discount_type === 'special_price' ? 'decimal' : 'text'}
                        value={form.discount_value}
                        onChange={(e) => set({ discount_value: e.target.value })}
                        placeholder={valuePlaceholder(form.discount_type)}
                        autoComplete="off"
                      />
                      {unitFor(form.discount_type) && <span>{unitFor(form.discount_type)}</span>}
                    </div>
                  </Field>
                  <Field label="Titolo" htmlFor="de-title-input" help="Offerte «paghi X prendi Y»: scrivi 3x2, 2x1.">
                    <input
                      id="de-title-input"
                      className="adm-input adm-input--big"
                      type="text"
                      value={form.title}
                      onChange={(e) => set({ title: e.target.value })}
                      placeholder={titlePlaceholder(form.discount_type)}
                    />
                    {suggestTitle(form) && !String(form.title || '').trim() && (
                      <button type="button" className="adm-chip" style={{ alignSelf: 'flex-start', minHeight: 32, fontSize: 12 }} onClick={() => set({ title: suggestTitle(form) })}>
                        ✨ Usa «{suggestTitle(form)}»
                      </button>
                    )}
                  </Field>
                </div>
              </Card>

              {/* 04 — Regole */}
              <Card>
                <StepTitle num="04" title="Regole" hint="Tutto facoltativo. Lasciato vuoto, vale su tutto, tutti i giorni, a ogni ora." />
                <Field label="Quando vale" hint="giorni e fasce">
                  <ValidityPicker
                    days={form.valid_days}
                    slots={form.valid_meal_slots}
                    onChange={(patch) => set(patch)}
                  />
                </Field>
                <Field label="Su cosa vale" hint="foto dei prodotti">
                  <ProductsEditor
                    products={form.products}
                    folder={editing || form.restaurant_id || newPartner?.id || 'nuovi'}
                    onChange={(products) => set({ products })}
                  />
                </Field>
                <Field label="Altre regole" hint="una per riga" htmlFor="de-rules">
                  <textarea
                    id="de-rules"
                    className="adm-textarea"
                    value={form.conditions}
                    onChange={(e) => set({ conditions: e.target.value })}
                    placeholder={'Es. Escluso asporto\nMinimo 2 persone'}
                    rows={3}
                  />
                </Field>
              </Card>

              {/* 05 — Durata e posti */}
              <Card>
                <StepTitle num="05" title="Durata e posti" hint={form.kind === 'drop' ? 'Un drop ha un inizio e una fine con l\'ora, e di solito pochi posti.' : 'Una convenzione può anche non scadere mai.'} />
                <div className="adm-grid-2">
                  <Field label={form.kind === 'drop' ? 'Inizio' : 'Valido dal'}>
                    <PrettyDatePicker
                      value={form.starts_at}
                      onChange={(v) => set({ starts_at: v })}
                      withTime={form.kind === 'drop'}
                      placeholder="Scegli data"
                    />
                  </Field>
                  <Field label={form.kind === 'drop' ? 'Fine' : 'Valido fino al'}>
                    {form.no_end_date ? (
                      <div className="adm-input" style={{ display: 'flex', alignItems: 'center', color: 'var(--adm-muted)' }}>♾️ Nessuna scadenza</div>
                    ) : (
                      <PrettyDatePicker
                        value={form.ends_at}
                        onChange={(v) => set({ ends_at: v })}
                        withTime={form.kind === 'drop'}
                        minDate={form.starts_at?.split('T')[0]}
                        placeholder="Scegli data"
                      />
                    )}
                  </Field>
                </div>
                <div style={{ marginTop: 12 }}>
                  <ToggleRow
                    icon="♾️"
                    title="Nessuna data di fine"
                    text="Resta valido finché non lo spegni tu."
                    checked={form.no_end_date}
                    onChange={(on) => set((f) => ({ no_end_date: on, ends_at: on ? '' : f.ends_at }))}
                  />
                </div>
                <Field
                  label={form.kind === 'drop' ? 'Quanti posti' : 'Quante volte si può usare'}
                  hint={form.kind === 'drop' ? 'quanti sconti metti in palio' : 'vuoto = illimitato'}
                  htmlFor="de-uses"
                  style={{ marginTop: 16 }}
                >
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      id="de-uses"
                      className="adm-input"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={form.max_uses}
                      onChange={(e) => set({ max_uses: e.target.value })}
                      placeholder={form.kind === 'drop' ? 'Es. 10' : 'Illimitato'}
                      style={{ width: 130 }}
                    />
                    {(form.kind === 'drop' ? [5, 10, 20, 50] : [50, 100]).map((n) => (
                      <button key={n} type="button" className="adm-chip" aria-pressed={String(form.max_uses) === String(n)} onClick={() => set({ max_uses: String(n) })}>{n}</button>
                    ))}
                    {form.kind !== 'drop' && (
                      <button type="button" className="adm-chip" aria-pressed={!form.max_uses} onClick={() => set({ max_uses: '' })}>∞</button>
                    )}
                  </div>
                </Field>
              </Card>

              {/* 06 — Come esce */}
              <Card>
                <StepTitle num="06" title="Come esce" hint="Online, a un'ora precisa, solo per chi lo prova col locale, o fermo." />
                <Choices
                  label="Come esce"
                  cols={4}
                  colsSm={2}
                  value={mode}
                  onChange={(m) => setForm((f) => switchMode(f, m, { editing, readLastTesters }))}
                  options={[
                    { id: 'now', emoji: '⚡', title: form.was_live ? 'Online' : 'Online subito', hint: 'Lo vedono tutti' },
                    { id: 'scheduled', emoji: '📅', title: 'Programmato', hint: form.was_live ? 'Già online: non si programma' : 'Esce da solo', disabled: form.was_live && mode !== 'scheduled' },
                    { id: 'test', emoji: '🧪', title: 'Solo prova', hint: 'Solo gli invitati' },
                    { id: 'paused', emoji: '⏸', title: 'In pausa', hint: 'Nascosto a tutti' },
                  ]}
                />

                {mode === 'scheduled' && (
                  <Field label="Esce il" htmlFor="de-when" help="Se il locale non è ancora online, lo sconto aspetta lui ed esce insieme." style={{ marginTop: 16 }}>
                    <input
                      id="de-when"
                      className="adm-input"
                      type="datetime-local"
                      value={form.publish_at}
                      min={toLocalInput(new Date().toISOString())}
                      onChange={(e) => set({ publish_at: e.target.value })}
                      style={{ maxWidth: 300 }}
                    />
                  </Field>
                )}

                {mode === 'test' && (
                  <Field
                    label="Chi lo vede"
                    hint="email degli account"
                    htmlFor="de-testers"
                    help="Separate da virgola. Lo trovano in home, nel Bi Club e sulla scheda del locale. Nessuna email parte."
                    style={{ marginTop: 16 }}
                  >
                    <input
                      id="de-testers"
                      className="adm-input"
                      type="text"
                      value={form.testers}
                      onChange={(e) => set({ testers: e.target.value })}
                      placeholder="nome@esempio.it"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </Field>
                )}

                {form.was_test && !form.is_test && (
                  <div className="adm-note adm-note--warn" style={{ marginTop: 14, flexDirection: 'column', gap: 8 }}>
                    <span>Era una prova: salvando la pubblichi, da adesso la vedono tutti.</span>
                    {takenDuringTest > 0 && (
                      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={form.clear_test_redemptions}
                          onChange={(e) => set({ clear_test_redemptions: e.target.checked })}
                          style={{ accentColor: '#E8453C', width: 16, height: 16, marginTop: 2 }}
                        />
                        <span>
                          Cancella {takenDuringTest === 1 ? 'lo sconto preso' : `i ${takenDuringTest} sconti presi`} durante la prova
                          (contatori e posti ripartono da zero)
                        </span>
                      </label>
                    )}
                  </div>
                )}

                {/* Email agli utenti: si sceglie solo creando o programmando.
                    Modificando lo si dice chiaro: era proprio la paura di
                    rimandare l'annuncio a tenere ferme le correzioni. */}
                <div style={{ marginTop: 14 }}>
                  {mode === 'test' ? null : mode === 'scheduled' ? (
                    <ToggleRow
                      icon="✉️"
                      title="Email a tutti gli utenti quando esce"
                      text="Parte una volta sola, all'ora dell'uscita."
                      checked={form.send_email}
                      onChange={(v) => set({ send_email: v })}
                    />
                  ) : editing ? (
                    <div className="adm-note">
                      <span aria-hidden>🔕</span>
                      <span>Salvare le modifiche <b>non manda nessuna email</b>: lo sconto si aggiorna e basta. Per riannunciarlo c'è il megafono sulla card.</span>
                    </div>
                  ) : (
                    <ToggleRow
                      icon="✉️"
                      title="Email a tutti gli utenti"
                      text={form.is_active ? 'Parte una volta sola, appena crei lo sconto.' : 'In pausa non parte: potrai mandarla col megafono.'}
                      checked={form.is_active && form.send_email}
                      disabled={!form.is_active}
                      onChange={(v) => set({ send_email: v })}
                    />
                  )}
                </div>
              </Card>

              {saveError && (
                <div className="adm-note adm-note--err" role="alert">{saveError}</div>
              )}
              <div className="adm-actionbar-spacer" />
            </main>

            <aside className="adm-editor__aside">
              <DiscountPreview form={form} restaurant={restaurant} />
              <div className="adm-savecard adm-savecard--editor" style={{ marginTop: 14 }}>
                <span className="adm-actionbar__status">
                  <span className={`adm-actionbar__dot${missing.length ? ' is-dirty' : ''}`} aria-hidden />
                  {missing.length ? `Manca ${missing.join(', ')}` : 'Pronto'}
                </span>
                <button type="button" className="adm-btn adm-btn--primary adm-btn--block" onClick={onSave} disabled={!canSave}>
                  {saveLabel}
                </button>
              </div>
              <Summary form={form} mode={mode} editing={editing} />
            </aside>
          </div>

          <div className="adm-actionbar adm-actionbar--editor">
            <span className="adm-actionbar__status">
              <span className={`adm-actionbar__dot${missing.length ? ' is-dirty' : ''}`} aria-hidden />
              {missing.length ? `Manca ${missing.join(', ')}` : editing ? 'Pronto da salvare' : 'Pronto'}
            </span>
            <button type="button" className="adm-btn adm-btn--soft adm-preview-btn" onClick={() => setPreviewOpen(true)} aria-label="Anteprima">
              <span aria-hidden>👀</span><em>Anteprima</em>
            </button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={onSave} disabled={!canSave}>
              {saveLabel}
            </button>
          </div>

          <Sheet open={previewOpen} onClose={() => setPreviewOpen(false)} title="Come lo vedono">
            <div style={{ marginTop: 14 }}>
              <DiscountPreview form={form} restaurant={restaurant} />
              <Summary form={form} mode={mode} editing={editing} />
            </div>
          </Sheet>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ */

function StepTitle({ num, title, hint }) {
  return (
    <div className="adm-step-title">
      <span className="adm-num">{num}</span>
      <div>
        <h3>{title}</h3>
        {hint && <p>{hint}</p>}
      </div>
    </div>
  )
}

function Summary({ form, mode, editing }) {
  const end = form.no_end_date || !form.ends_at
    ? 'Nessuna scadenza'
    : new Date(form.ends_at).toLocaleString('it-IT', form.kind === 'drop'
      ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'long', year: 'numeric' })
  const uses = parseInt(form.max_uses, 10)
  const exit = {
    now: editing ? 'Online' : 'Online appena lo crei',
    scheduled: `Esce ${formatPublishAt(fromLocalInput(form.publish_at)) || '…'}`,
    test: 'Solo per gli invitati',
    paused: 'In pausa, nascosto',
  }[mode]
  const email = mode === 'test'
    ? 'Nessuna (prova)'
    : mode === 'scheduled'
      ? (form.send_email ? 'A tutti, all\'uscita' : 'Nessuna')
      : editing
        ? 'Nessuna (è una modifica)'
        : (form.is_active && form.send_email ? 'A tutti, subito' : 'Nessuna')
  return (
    <div className="adm-card adm-card--flat adm-editor__summary">
      <dl>
        <dt>Giorni</dt><dd>{formatDays(form.valid_days) || 'Tutti'}</dd>
        <dt>Fasce</dt><dd>{formatSlots(form.valid_meal_slots)}</dd>
        <dt>Scade</dt><dd>{end}</dd>
        <dt>{form.kind === 'drop' ? 'Posti' : 'Utilizzi'}</dt><dd>{Number.isFinite(uses) && uses > 0 ? uses : 'Illimitati'}</dd>
        <dt>Uscita</dt><dd>{exit}</dd>
        <dt>Email</dt><dd>{email}</dd>
      </dl>
    </div>
  )
}

/**
 * La scelta del locale: il selezionato in una card, altrimenti la ricerca
 * con foto e indirizzo. Sotto, per chi non ha ancora il PIN, la strada
 * vecchia: lo si aggiunge come partner e il PIN nasce al salvataggio.
 */
function RestaurantPicker({ editing, restaurants, partnerIds, value, newPartner, onPick, onPickNewPartner, onClear }) {
  const [q, setQ] = useState('')
  const [showOthers, setShowOthers] = useState(false)
  const selected = restaurants.find((r) => r.id === (value || newPartner?.id))

  if (selected) {
    return (
      <div className="adm-picked">
        <Thumb r={selected} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <b>{selected.name}</b>
          <small>
            {newPartner
              ? '➕ Diventa partner salvando: il PIN si crea da solo'
              : [shortAddress(selected.address), selected.is_published === false ? 'in bozza' : null].filter(Boolean).join(' · ') || 'PIN attivo ✓'}
          </small>
        </span>
        {!editing && (
          <button type="button" className="adm-btn adm-btn--sm" onClick={onClear}>Cambia</button>
        )}
      </div>
    )
  }

  const needle = q.toLowerCase().trim()
  const match = (r) => !needle || r.name.toLowerCase().includes(needle) || String(r.address || '').toLowerCase().includes(needle)
  const eligible = restaurants.filter((r) => (r.has_pin || partnerIds.has(r.id)) && match(r))
  const others = restaurants.filter((r) => !r.has_pin && !partnerIds.has(r.id) && match(r)).slice(0, 30)

  return (
    <div>
      <div className="adm-affix" style={{ borderRadius: 14 }}>
        <span style={{ background: 'transparent', padding: '0 4px 0 14px', fontSize: 15 }} aria-hidden>🔎</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca il locale…"
          aria-label="Cerca il locale"
          autoComplete="off"
          style={{ minHeight: 48, fontSize: 16, fontWeight: 500, letterSpacing: 0, padding: '0 14px 0 8px' }}
        />
      </div>
      <ul className="adm-pick-list">
        {eligible.length === 0 && (
          <li style={{ padding: '12px 10px', fontSize: 13, color: 'var(--adm-muted)' }}>
            {needle ? `Nessun locale con PIN per «${q}».` : 'Nessun locale con il PIN attivo.'}
          </li>
        )}
        {eligible.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onPick(r.id)}>
              <Thumb r={r} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{r.name}</b>
                <small>{[shortAddress(r.address), r.is_published === false ? 'in bozza' : null].filter(Boolean).join(' · ') || '—'}</small>
              </span>
              <span className="adm-pill adm-pill--live" style={{ fontSize: 10 }}>PIN ✓</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="adm-btn adm-btn--ghost adm-btn--sm"
        style={{ marginTop: 8, color: 'var(--adm-gold-deep)' }}
        onClick={() => setShowOthers((v) => !v)}
      >
        {showOthers ? '− Nascondi' : '+ Il locale non ha ancora il PIN'}
      </button>
      {showOthers && (
        <div className="adm-note adm-note--warn" style={{ marginTop: 8, flexDirection: 'column', gap: 8 }}>
          <span>Sceglilo qui: salvando lo sconto diventa partner e il PIN si crea da solo (te lo mostro alla fine).</span>
          <ul className="adm-pick-list" style={{ margin: 0, width: '100%' }}>
            {others.length === 0 && <li style={{ padding: '10px', fontSize: 13 }}>Nessun altro locale.</li>}
            {others.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onPickNewPartner(r)}>
                  <Thumb r={r} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{r.name}</b>
                    <small>{shortAddress(r.address) || '—'}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Thumb({ r }) {
  const src = r?.photo ? proxyImg(r.photo, { w: 120 }) : null
  return (
    <span className="adm-pick-thumb" aria-hidden>
      {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> : '🍽️'}
    </span>
  )
}

function shortAddress(a) {
  return String(a || '').split(',')[0].trim()
}

/* ------------------------------------------------------------------ */
/*  Tipo di sconto → etichette dei campi                               */
/* ------------------------------------------------------------------ */

const TYPES = [
  { id: 'percentage', icon: '%', label: 'Percentuale' },
  { id: 'fixed', icon: '€', label: 'Euro di sconto' },
  { id: 'freebie', icon: '🎁', label: 'Omaggio' },
  { id: 'special_price', icon: '🏷️', label: 'Prezzo speciale' },
]

const unitFor = (t) => (t === 'percentage' ? '%' : t === 'fixed' || t === 'special_price' ? '€' : '')
const valueLabel = (t) => ({ percentage: 'Quanto sconto', fixed: 'Quanti euro', freebie: 'Cosa regali', special_price: 'A che prezzo' }[t] || 'Valore')
const valuePlaceholder = (t) => ({ percentage: '20', fixed: '5', freebie: 'Caffè', special_price: '5' }[t] || '')
const valueHelp = (t) => ({
  percentage: 'Solo il numero: il segno meno e il % li mette il sito.',
  fixed: 'Solo il numero: diventa «−5€» nel badge.',
  freebie: 'Nel badge va il titolo: scrivilo bene qui a destra.',
  special_price: 'Il prezzo scontato di un prodotto.',
}[t])
const titlePlaceholder = (t) => ({
  percentage: 'Es. 20% sul conto',
  fixed: 'Es. 5€ di sconto sul conto',
  freebie: 'Es. Caffè omaggio col dolce',
  special_price: 'Es. Tramezzino a 5€',
}[t] || '')

function suggestTitle(form) {
  const v = String(form.discount_value || '').replace(/[%€\s-−]/g, '').trim()
  if (!v || !/^\d+([.,]\d+)?$/.test(v)) return ''
  if (form.discount_type === 'percentage') return `${v}% sul conto`
  if (form.discount_type === 'fixed') return `${v}€ di sconto sul conto`
  return ''
}

/**
 * Cambiare tipo tra drop e convenzione converte le date: il drop le vuole
 * con l'ora (datetime-local), la convenzione solo col giorno.
 */
function switchKind(f, kind) {
  if (f.kind === kind) return f
  const next = { ...f, kind }
  const toDrop = kind === 'drop'
  const fromDrop = f.kind === 'drop'
  if (toDrop && f.starts_at && !f.starts_at.includes('T')) next.starts_at = `${f.starts_at}T19:00`
  if (toDrop && f.ends_at && !f.ends_at.includes('T')) next.ends_at = `${f.ends_at}T23:00`
  // Un drop senza fine né posti non è un drop: si parte da tre giorni e
  // dieci posti, che si cambiano sotto (Durata e posti).
  if (toDrop && !f.ends_at) {
    const d = new Date(Date.now() + 3 * 86400000)
    const pad = (n) => String(n).padStart(2, '0')
    next.ends_at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:00`
    next.no_end_date = false
  }
  if (toDrop && !f.max_uses) next.max_uses = '10'
  if (fromDrop && !toDrop && f.starts_at?.includes('T')) next.starts_at = f.starts_at.split('T')[0]
  if (fromDrop && !toDrop && f.ends_at?.includes('T')) next.ends_at = f.ends_at.split('T')[0]
  return next
}

/**
 * Le quattro uscite in un colpo solo, al posto dei tre interruttori di prima
 * (pubblicato / programma / prova) che si potevano accendere in combinazioni
 * senza senso. Scrivono gli stessi campi che `handleSave` già legge.
 */
function switchMode(f, mode, { editing, readLastTesters }) {
  if (mode === 'now') return { ...f, is_active: true, schedule_on: false, is_test: false }
  if (mode === 'paused') return { ...f, is_active: false, schedule_on: false, is_test: false }
  if (mode === 'scheduled') {
    if (f.was_live) return f
    return {
      ...f,
      is_test: false,
      schedule_on: true,
      publish_at: f.publish_at || defaultPublishInput(),
      // Creando, l'annuncio all'uscita è la scelta di default.
      send_email: !editing ? true : f.send_email,
    }
  }
  if (mode === 'test') {
    return {
      ...f,
      is_test: true,
      is_active: true,
      schedule_on: false,
      testers: f.testers || readLastTesters?.() || '',
    }
  }
  return f
}
