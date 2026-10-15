import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PrettyDatePicker from './PrettyDatePicker'
import { ProductsEditor, ValidityPicker } from './DiscountRulesFields'
import DiscountPreview from './DiscountPreview'
import { Card, Choices, Field, Sheet, ToggleRow } from './ui'
import { proxyImg } from '../../lib/supabase'
import { toLocalInput, fromLocalInput, defaultPublishInput, formatPublishAt } from '../../lib/scheduledPublish'
import { formatDays, formatSlots } from '../../lib/validity'
import { DEFAULT_CLAIM_WINDOW_DAYS } from '../../lib/dropClaim'
import { getAllLocations, locationName, locationStreet } from '../../lib/utils/restaurantLocations'
import {
  DAY_TIER_TYPES, formUsesDayTiers, presetDayTiers, dayTierProblems, tierDaysLong, normalizeDayTiers,
} from '../../lib/dayTiers'
import { formatTierSummary } from '../../lib/utils/discountFormat'

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

  const sedi = useMemo(() => getAllLocations(restaurant), [restaurant])
  const multiSede = sedi.length > 1
  // Sconto a fasce (15/10): il valore sta nelle fasce, e le fasce devono
  // tornare (due almeno, ognuna coi suoi giorni e la sua cifra).
  const tiered = formUsesDayTiers(form)
  const tierProblems = tiered ? dayTierProblems(form.day_tiers, { type: form.discount_type }) : []
  const missing = [
    !restId && 'il locale',
    multiSede && form.location_mode === 'some' && !(form.valid_location_ids || []).length && 'la sede in cui vale',
    tiered ? (tierProblems.length > 0 && 'le fasce') : (!String(form.discount_value || '').trim() && 'il valore'),
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
                  onPick={(id) => { set({ restaurant_id: id, ...NO_SCOPE }); setNewPartner(null) }}
                  onPickNewPartner={(r) => { set({ restaurant_id: '', ...NO_SCOPE }); setNewPartner({ id: r.id, name: r.name }) }}
                  onClear={() => { set({ restaurant_id: '', ...NO_SCOPE }); setNewPartner(null) }}
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

                {/* Cambia coi giorni (15/10): solo convenzioni in % o €. */}
                {form.kind !== 'drop' && DAY_TIER_TYPES.includes(form.discount_type) && (
                  <div style={{ marginTop: 16 }}>
                    <ToggleRow
                      icon="📅"
                      title="Cambia coi giorni"
                      text="Es. 30% in settimana e 15% nel weekend. Resta uno sconto solo: si usa una volta, e alla cassa vale la cifra del giorno."
                      checked={tiered}
                      onChange={(on) => set((f) => toggleTiers(f, on))}
                    />
                  </div>
                )}

                {tiered && (
                  <DayTiersField
                    tiers={form.day_tiers}
                    type={form.discount_type}
                    problems={tierProblems}
                    onChange={(day_tiers) => set({ day_tiers })}
                  />
                )}

                <div className={tiered ? undefined : 'adm-grid-2'} style={{ marginTop: 16 }}>
                  {!tiered && (
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
                  )}
                  <Field label="Titolo" htmlFor="de-title-input" help={tiered ? 'Senza cifre: le cifre le dicono le fasce, giorno per giorno.' : 'Offerte «paghi X prendi Y»: scrivi 3x2, 2x1.'}>
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
                    hideDays={tiered}
                  />
                </Field>
                {multiSede && (
                  <Field label="In quali sedi vale" hint={`il locale ha ${sedi.length} sedi`}>
                    <LocationScopePicker
                      sedi={sedi}
                      city={restaurant?.city}
                      mode={form.location_mode || 'all'}
                      ids={form.valid_location_ids || []}
                      onChange={(patch) => set(patch)}
                    />
                  </Field>
                )}
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
                {form.kind === 'drop' && <ClaimWindowField form={form} set={set} editing={editing} />}
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
        <dt>Giorni</dt><dd>{formUsesDayTiers(form)
          ? (formatTierSummary({ discount_type: form.discount_type, day_tiers: normalizeDayTiers(form.day_tiers) }) || 'Fasce da completare')
          : (formatDays(form.valid_days) || 'Tutti')}</dd>
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
/** Cambiando locale le sedi scelte non valgono più: si torna a "tutte". */
const NO_SCOPE = { location_mode: 'all', valid_location_ids: [] }

/**
 * "In quali sedi vale" (13/10): tutte, o solo quelle spuntate. Esce solo per
 * i locali con più sedi. Tutte spuntate a mano = "tutte" (si salva NULL, vedi
 * `scopedLocationIds` in DiscountManager).
 */
function LocationScopePicker({ sedi, city, mode, ids, onChange }) {
  const chosen = new Set(ids.map(String))
  const toggle = (id) => {
    const next = chosen.has(id) ? ids.filter((x) => String(x) !== id) : [...ids, id]
    onChange({ valid_location_ids: next })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Choices
        label="In quali sedi vale"
        cols={2}
        colsSm={2}
        value={mode}
        onChange={(m) => onChange(m === 'all'
          ? { location_mode: 'all' }
          // "Solo alcune" parte dalla sede principale: quasi sempre è lei.
          : { location_mode: 'some', valid_location_ids: ids.length ? ids : [String(sedi[0].id)] })}
        options={[
          { id: 'all', emoji: '📍', title: 'In tutte le sedi', hint: `Vale in tutte e ${sedi.length}.` },
          { id: 'some', emoji: '🎯', title: 'Solo in alcune', hint: 'Scegli dove, qui sotto.' },
        ]}
      />
      {mode === 'some' && (
        <div className="adm-sedi" role="group" aria-label="Sedi in cui vale lo sconto">
          {sedi.map((l, i) => {
            const id = String(l.id)
            const on = chosen.has(id)
            return (
              <button
                key={id}
                type="button"
                className="adm-sede"
                aria-pressed={on}
                onClick={() => toggle(id)}
              >
                <span className="adm-sede__num" aria-hidden>{i + 1}</span>
                <span className="adm-sede__txt">
                  <b>{locationName(l, i)}</b>
                  <span>{locationStreet(l.address, city)}</span>
                </span>
                <span className="adm-sede__check" aria-hidden>✓</span>
              </button>
            )
          })}
        </div>
      )}
      <p className="adm-help" style={{ margin: 0 }}>
        {mode === 'some'
          ? 'Chi lo sblocca legge «Vale solo nella sede…» nello sconto e sul QR.'
          : 'Nello sconto si legge «In tutte le sedi del locale».'}
      </p>
    </div>
  )
}

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

/**
 * Quanti giorni ha chi prende il drop per usarlo (12/10). Da quando lo
 * sblocca; passati senza usarlo il codice non vale più e il posto va al
 * primo della lista d'attesa (supabase/drop-claim-window-2026-10-12.sql).
 * Vale per i riscatti fatti da qui in poi: chi l'ha già preso tiene i suoi.
 */
function ClaimWindowField({ form, set, editing }) {
  const days = parseInt(form.claim_window_days, 10) || 0
  const start = form.starts_at ? new Date(form.starts_at).getTime() : null
  const end = !form.no_end_date && form.ends_at ? new Date(form.ends_at).getTime() : null
  // Il drop che finisce prima dei giorni di chi lo prende: alla fine del
  // drop il codice smette di valere per tutti.
  const short = days > 0 && end && start && end - start < days * 86_400_000
  return (
    <Field
      label="Giorni per usarlo"
      hint="da quando lo sblocca: poi il posto passa al primo in lista d'attesa"
      htmlFor="de-claim-days"
      style={{ marginTop: 16 }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          id="de-claim-days"
          className="adm-input"
          type="number"
          inputMode="numeric"
          min="1"
          max="60"
          value={form.claim_window_days ?? ''}
          onChange={(e) => set({ claim_window_days: e.target.value })}
          placeholder="Nessun limite"
          style={{ width: 130 }}
        />
        {[3, 5, DEFAULT_CLAIM_WINDOW_DAYS, 14].map((n) => (
          <button key={n} type="button" className="adm-chip" aria-pressed={days === n} onClick={() => set({ claim_window_days: String(n) })}>{n} giorni</button>
        ))}
        <button type="button" className="adm-chip" aria-pressed={!days} onClick={() => set({ claim_window_days: '' })}>Nessun limite</button>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 12.5, lineHeight: 1.45, color: 'var(--adm-muted)' }}>
        {days > 0
          ? `Chi lo prende ha ${days} ${days === 1 ? 'giorno' : 'giorni'} per usarlo e riceve le email a 4 giorni, 2 giorni e 24 ore. Se non lo usa, il codice non vale più e il posto va al primo in lista: chi trova il drop esaurito può mettersi in lista.`
          : 'Senza limite: chi lo prende lo tiene finché il drop è attivo, e quando è esaurito non c’è la lista d’attesa (come i drop usciti prima del 12/10).'}
        {editing && days > 0 ? ' Cambiarlo vale per chi lo prende da adesso: chi l’ha già preso tiene la sua scadenza.' : ''}
      </p>
      {short && (
        <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.45, color: '#8A2B25', fontWeight: 600 }}>
          Il drop finisce prima: chi lo prende verso la fine avrà meno di {days} giorni, perché alla fine del drop il codice smette di valere per tutti. Per dare a tutti i giorni pieni, togli la data di fine.
        </p>
      )}
    </Field>
  )
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
  // A fasce: niente cifre nel titolo (cambierebbero coi giorni).
  if (formUsesDayTiers(form)) return form.discount_type === 'fixed' ? 'Euro di sconto sul conto' : 'Sconto sul conto'
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
  // Un drop nuovo parte da dieci posti e 7 giorni per usarlo (12/10), senza
  // data di fine: è il tempo di chi lo prende a contare, non quello del
  // drop. Prima partiva da tre giorni di fine, che con i 7 giorni per
  // usarlo avrebbero tolto a tutti metà del tempo. Si cambia sotto.
  if (toDrop && !f.ends_at) {
    next.no_end_date = true
  }
  if (toDrop && !f.max_uses) next.max_uses = '10'
  if (toDrop && f.claim_window_days == null) next.claim_window_days = String(DEFAULT_CLAIM_WINDOW_DAYS)
  if (fromDrop && !toDrop && f.starts_at?.includes('T')) next.starts_at = f.starts_at.split('T')[0]
  if (fromDrop && !toDrop && f.ends_at?.includes('T')) next.ends_at = f.ends_at.split('T')[0]
  // Un drop non è a fasce (ha già posti e countdown): si torna a una cifra.
  if (toDrop && f.tiers_on) return toggleTiers(next, false)
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

/* ------------------------------------------------------------------ */
/*  Sconto a fasce (15/10) — src/lib/dayTiers.js                        */
/* ------------------------------------------------------------------ */

/**
 * Accendere le fasce parte dalla richiesta che le ha fatte nascere (lun–gio
 * e ven–dom), con la cifra già scritta nella prima; spegnerle torna a una
 * cifra sola, quella della prima fascia, e a tutti i giorni.
 */
function toggleTiers(f, on) {
  if (on) {
    const tiers = Array.isArray(f.day_tiers) && f.day_tiers.length >= 2 ? f.day_tiers : presetDayTiers(f.discount_value)
    return { ...f, tiers_on: true, day_tiers: tiers }
  }
  const first = normalizeDayTiers(f.day_tiers)[0]
  return { ...f, tiers_on: false, discount_value: f.discount_value || first?.value || '', valid_days: [] }
}

const TIER_DAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

/**
 * Le fasce: una riga per cifra, ognuna coi suoi giorni. Toccare un giorno
 * lo mette in quella fascia (e lo toglie dall'altra): un giorno sta in una
 * fascia sola, come vuole il trigger del DB. I giorni che non stanno in
 * nessuna fascia sono i giorni in cui lo sconto non vale.
 */
function DayTiersField({ tiers, type, problems, onChange }) {
  const list = Array.isArray(tiers) ? tiers : []
  const unit = unitFor(type)
  const owner = (dow) => list.findIndex((t) => (t.days || []).includes(dow))
  const used = new Set(list.flatMap((t) => t.days || []))
  const free = [1, 2, 3, 4, 5, 6, 7].filter((d) => !used.has(d))

  const patch = (i, p) => onChange(list.map((t, j) => (j === i ? { ...t, ...p } : t)))
  const toggleDay = (i, dow) => {
    const mine = (list[i].days || []).includes(dow)
    onChange(list.map((t, j) => {
      const days = (t.days || []).filter((d) => d !== dow)
      if (j === i && !mine) days.push(dow)
      return { ...t, days: days.sort((a, b) => a - b) }
    }))
  }
  const add = () => onChange([...list, { days: free.slice(0, 1), value: '' }])
  const remove = (i) => onChange(list.filter((_, j) => j !== i))

  return (
    <div className="adm-tiers" style={{ marginTop: 12 }}>
      {list.map((t, i) => {
        const days = t.days || []
        return (
          <div className="adm-tier" key={i}>
            <div className="adm-tier__head">
              <span className="adm-tier__num" aria-hidden>{i + 1}</span>
              <div className="adm-affix adm-tier__value">
                <input
                  type="text"
                  inputMode="decimal"
                  value={t.value}
                  onChange={(e) => patch(i, { value: e.target.value })}
                  placeholder={i === 0 ? '30' : '15'}
                  aria-label={`Cifra della fascia ${i + 1}`}
                  autoComplete="off"
                />
                {unit && <span>{unit}</span>}
              </div>
              <span className="adm-tier__words">{tierDaysLong(days) || 'scegli i giorni'}</span>
              {list.length > 2 && (
                <button type="button" className="adm-btn adm-btn--icon adm-btn--sm" onClick={() => remove(i)} aria-label={`Togli la fascia ${i + 1}`}>✕</button>
              )}
            </div>
            <div className="adm-tier__days" role="group" aria-label={`Giorni della fascia ${i + 1}`}>
              {TIER_DAYS.map((letter, k) => {
                const dow = k + 1
                const mine = days.includes(dow)
                const other = !mine ? owner(dow) : -1
                return (
                  <button
                    key={dow}
                    type="button"
                    className={`adm-tier__day${other >= 0 ? ' is-elsewhere' : ''}`}
                    aria-pressed={mine}
                    onClick={() => toggleDay(i, dow)}
                    title={other >= 0 ? `Ora è nella fascia ${other + 1}: toccalo per spostarlo qui` : undefined}
                  >
                    {letter}
                    {other >= 0 && <small aria-hidden>{other + 1}</small>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {list.length < 7 && (
          <button type="button" className="adm-chip" onClick={add}>＋ Aggiungi una fascia</button>
        )}
        {free.length > 0 && (
          <span className="adm-help">
            {free.length === 7 ? 'Nessun giorno scelto.' : `${tierDaysLong(free).replace(/^./, (c) => c.toUpperCase())}: lo sconto non vale.`}
          </span>
        )}
      </div>

      {problems.length > 0 ? (
        <div className="adm-note adm-note--warn" role="status" style={{ flexDirection: 'column', gap: 4 }}>
          {problems.map((p) => <span key={p}>{p}</span>)}
        </div>
      ) : (
        <p className="adm-help">
          Sul sito si leggono tutte le cifre, con quella di oggi accesa; pin e card piccole dicono quella di oggi.
        </p>
      )}
    </div>
  )
}
