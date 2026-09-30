import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'
import { fetchRestaurantSecrets } from '../../lib/restaurantColumns'
import AdminLayout from '../../components/Layout/AdminLayout'
import PillTab from '../../components/admin/PillTab'
import EmptyState from '../../components/admin/EmptyState'
import DiscountEditor from '../../components/admin/DiscountEditor'
import { isExpired as isDiscountExpired, discountEndsAt, maxQuantity } from '../../lib/discounts'
import { useAdminRedemptions } from '../../lib/hooks/useAdminRedemptions'
import LiveRedemptionsPanel from '../../components/admin/LiveRedemptionsPanel'
import { toLocalInput, fromLocalInput, publishAtError, formatPublishAt } from '../../lib/scheduledPublish'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/*                                                                      */
/*  isExpired/isActive riusano `lib/discounts.js` invece di rifare il   */
/*  confronto qui: quella è già la definizione unica del progetto, e     */
/*  gestisce da sola uno sconto/drop senza data di fine (valid_until    */
/*  e drop_ends_at nulli → mai scaduto). Rifarlo qui con `new            */
/*  Date(d.valid_until) < new Date()` è esattamente il bug che ha       */
/*  già causato "tre definizioni diverse" una volta (vedi commento in   */
/*  cima a discounts.js) — con un end date nullo sarebbe tornato a      */
/*  `new Date(null)` = epoca 1970, cioè "sempre scaduto".               */
/* ------------------------------------------------------------------ */
const isExpired = (d) => isDiscountExpired(d)
const isActive = (d) => d.is_active && !isExpired(d)

const formatDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TYPE_LABELS = {
  percentage: 'Percentuale',
  fixed: 'Importo fisso',
  freebie: 'Omaggio',
  special_price: 'Prezzo speciale',
}

const EMPTY_FORM = {
  restaurant_id: '',
  title: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '',
  conditions: '',
  valid_days: [],          // [] = tutti i giorni
  valid_meal_slots: [],    // [] = qualsiasi ora
  products: [],            // foto di cosa lo sconto copre
  kind: 'discount', // 'discount' | 'featured' | 'drop'
  starts_at: new Date().toISOString().split('T')[0],
  ends_at: '',
  no_end_date: false, // true → ends_at resta vuoto apposta, non "non ancora scelto"
  max_uses: '',
  is_active: true,
  // Uscita programmata (supabase/scheduled-publish-2026-09-29.sql): lo
  // sconto resta spento fino a `publish_at` e il giro ogni 5 minuti lo
  // accende; se `send_email` è spuntata parte l'annuncio in quel momento.
  schedule_on: false,
  publish_at: '',
  // Era già online all'apertura del form: niente programmazione, non ha
  // senso nascondere uno sconto che la gente sta già usando.
  was_live: false,
  // Solo alla creazione: l'annuncio a tutti gli utenti. Una modifica non
  // manda mai email (vedi handleSave), e nel form la casella non c'è.
  send_email: true,
  // Sconto di prova: lo vedono solo gli admin e le email scritte qui
  // (supabase/discount-test-mode-2026-09-29.sql). `was_test` ricorda com'era
  // all'apertura, per capire quando "Salva" lo sta pubblicando.
  is_test: false,
  testers: '',
  was_test: false,
  clear_test_redemptions: true,
}

// Le email degli invitati come le scrive l'admin (virgole, spazi, a capo)
// → elenco pulito, minuscolo, senza doppioni.
const parseTesterEmails = (text) =>
  [...new Set(String(text || '').split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))]

// L'ultimo elenco usato, per non riscriverlo a ogni prova con lo stesso locale.
const LAST_TESTERS_KEY = 'cb_admin_last_testers'
const readLastTesters = () => { try { return localStorage.getItem(LAST_TESTERS_KEY) || '' } catch { return '' } }
const writeLastTesters = (v) => { try { localStorage.setItem(LAST_TESTERS_KEY, v) } catch { /* private mode */ } }

// Restituisce il valore di periodo nel formato giusto per l'input
// (date per sconti/evidenza, datetime-local per drop).
const toInputDate = (iso, isDrop) => {
  if (!iso) return ''
  return isDrop ? iso.slice(0, 16) : iso.split('T')[0]
}

/* ------------------------------------------------------------------ */
/*  DropCard — mockup frame 4 style (responsive, replaces table+mobile)*/
/* ------------------------------------------------------------------ */
function countdown(target) {
  if (!target) return { label: 'Scadenza', value: '∞' }
  const diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return { label: 'Scaduto', value: '—' }
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 0) return { label: 'Al termine', value: `${d}g ${h}h` }
  const m = Math.floor((diff % 3600000) / 60000)
  return { label: 'Al termine', value: `${h}h ${m}m` }
}

function DropCard({ d, testers, selected, notifyLog, notifying, active, partnerTotal, flash, onSelect, onEdit, onNotify, onToggleActive, onDelete }) {
  const isDrop = d.is_drop
  const isFeatured = d.is_featured && !d.is_drop
  const ttl = countdown(discountEndsAt(d))
  // "Presi" = QR/codice generato, "utilizzati" = convalidato dal locale.
  // La barra dei posti conta i presi: è su quelli che il sito pubblico
  // decide "esaurito" (vedi `claimedCount` in lib/discounts.js).
  const taken = d.generated_count || 0
  const used = d.redeemed_count || 0
  const limit = maxQuantity(d)
  const pct = limit ? Math.min(100, Math.round((taken / limit) * 100)) : null
  const usedPct = taken ? Math.round((used / taken) * 100) : 0

  const pillLabel = isDrop ? '🔥 DROP' : isFeatured ? 'EVIDENZA' : 'SCONTO'
  const pillBg = isDrop
    ? 'var(--color-corallo, #E8453C)'
    : isFeatured
      ? 'var(--color-oro, #B08954)'
      : 'var(--color-ink, #22181C)'

  return (
    <div
      style={{
        background: isDrop
          ? 'linear-gradient(135deg, #FFF8F7, #FDECEA)'
          : selected
            ? 'var(--color-corallo-wash, #FDEDEB)'
            : '#fff',
        border: isDrop
          ? '1px solid var(--color-corallo-soft, #F6B7B1)'
          : selected
            ? '1px solid var(--color-corallo, #E8453C)'
            : '1px solid var(--color-line, #EAE3D7)',
        borderRadius: 18,
        padding: 16,
        display: 'grid',
        gridTemplateColumns: '18px 80px 1fr auto auto',
        gap: 14,
        alignItems: 'center',
        transition: 'background 0.15s, border 0.15s',
      }}
      className="dm-row max-md:!grid-cols-[18px_1fr_auto]"
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        onClick={(e) => e.stopPropagation()}
        style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#E8453C', justifySelf: 'center' }}
        aria-label="Seleziona"
        className="dm-row-check"
      />

      <div
        onClick={onEdit}
        style={{
          width: 80,
          height: 80,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #d8cfc1, #ad9b80)',
          position: 'relative',
          flexShrink: 0,
          cursor: 'pointer',
          overflow: 'hidden',
        }}
        className="dm-row-photo max-md:!hidden"
      >
        {d.restaurant_photo && (
          <img
            src={proxyImg(d.restaurant_photo)}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <span
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            background: pillBg,
            color: '#fff',
            fontSize: 9,
            fontWeight: 900,
            padding: '3px 7px',
            borderRadius: 999,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {pillLabel}
        </span>
      </div>

      <div onClick={onEdit} className="dm-row-body" style={{ cursor: 'pointer', minWidth: 0 }}>
        <h4
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 15,
            letterSpacing: '-0.01em',
            margin: 0,
            color: 'var(--color-ink, #22181C)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {d.restaurant?.name || '—'}
          <span style={{ color: 'var(--color-corallo, #E8453C)', fontWeight: 900 }}>{d.discount_value}</span>
          {!active && d.publish_at && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'var(--color-ink, #22181C)',
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              ⏰ Esce {formatPublishAt(d.publish_at)}
            </span>
          )}
          {!active && !d.publish_at && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'var(--color-cream-deep, #F1EBE0)',
                color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Pausa
            </span>
          )}
          {d.is_test && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px dashed var(--color-ink, #22181C)',
                color: 'var(--color-ink, #22181C)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Prova
            </span>
          )}
        </h4>
        <div style={{ fontSize: 11, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontWeight: 600, marginTop: 3 }}>
          {d.title}
          {d.conditions ? ` · ${d.conditions}` : ''}
        </div>
        {d.is_test && (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ink, #22181C)', marginTop: 4 }}>
            Non è online · lo vedono solo gli admin
            {testers?.length ? ` e ${testers.join(', ')}` : ''}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <Counter label="Presi" value={taken} flashKey={flash?.kind === 'taken' ? flash.at : null} />
          <Counter label="Utilizzati" value={used} tone="green" flashKey={flash?.kind === 'used' ? flash.at : null} />
          {taken > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-ink-55, rgba(34,24,28,0.55))' }}>
              {usedPct}% convalidati
            </span>
          )}
        </div>
        {pct !== null && (
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                height: 6,
                background: 'var(--color-cream-deep, #F1EBE0)',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: isDrop
                    ? 'var(--color-corallo, #E8453C)'
                    : 'linear-gradient(135deg, var(--color-green-a, #A3E635), var(--color-green-b, #4ADE80))',
                  borderRadius: 999,
                }}
              />
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
                marginTop: 4,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{taken} / {limit} posti presi</span>
              <span>{pct}%</span>
            </div>
          </div>
        )}
        {partnerTotal?.discounts > 1 && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', marginTop: 8 }}>
            Tutto il locale ({partnerTotal.discounts} sconti):{' '}
            <b style={{ color: 'var(--color-ink, #22181C)' }}>{partnerTotal.taken} presi</b> ·{' '}
            <b style={{ color: '#2C7A4A' }}>{partnerTotal.used} utilizzati</b>
          </div>
        )}
      </div>

      <div
        onClick={onEdit}
        style={{
          textAlign: 'center',
          background: isDrop ? '#fff' : 'var(--color-cream, #F5F0E4)',
          borderRadius: 14,
          padding: '10px 14px',
          minWidth: 92,
          cursor: 'pointer',
        }}
        className="dm-row-ttl max-md:!hidden"
      >
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 20, letterSpacing: '-0.03em', color: 'var(--color-ink)' }}>
          {ttl.value}
        </div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
            marginTop: 2,
          }}
        >
          {ttl.label}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 4,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
        className="dm-row-actions"
        onClick={(e) => e.stopPropagation()}
      >
        <ActionIcon
          onClick={onNotify}
          disabled={notifying || !active || d.is_test}
          title={d.is_test ? 'Sconto di prova: pubblicalo per tutti prima di mandare l\'email' : notifyLog ? `Già inviato a ${notifyLog.sent_count} iscritti — clicca per inviare di nuovo` : !active ? 'Attiva per notificare' : 'Notifica iscritti newsletter'}
          color={notifyLog ? '#2C7A4A' : 'var(--color-ink)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l18-8v18L3 13v-2z" />
            <path d="M11.6 16.8A3 3 0 0 1 8 20" />
          </svg>
        </ActionIcon>
        <ActionIcon onClick={onToggleActive} title={d.is_active ? 'Metti in pausa' : 'Riattiva'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {d.is_active ? (
              <>
                <rect x="6" y="5" width="4" height="14" />
                <rect x="14" y="5" width="4" height="14" />
              </>
            ) : (
              <polygon points="5 3 19 12 5 21 5 3" />
            )}
          </svg>
        </ActionIcon>
        <ActionIcon onClick={onEdit} title="Modifica">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </ActionIcon>
        <ActionIcon onClick={onDelete} title="Elimina" color="var(--color-danger, #C0392B)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </ActionIcon>
      </div>
    </div>
  )
}

/* Contatore sulla card. `flashKey` cambia quando il realtime lo alza: la
   `key` nuova rimonta lo span e fa ripartire l'animazione. */
function Counter({ label, value, tone, flashKey }) {
  const green = tone === 'green'
  return (
    <span
      key={flashKey || 'still'}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 999,
        background: green ? '#E9F8EF' : 'var(--color-cream, #F5F0E4)',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
        animation: flashKey ? 'dm-flash 1.6s ease-out' : 'none',
      }}
    >
      {label}
      <b style={{ fontSize: 14, fontWeight: 900, color: green ? '#2C7A4A' : 'var(--color-ink, #22181C)' }}>{value}</b>
    </span>
  )
}

function ActionIcon({ onClick, disabled, title, color, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 30,
        height: 30,
        borderRadius: 10,
        border: 0,
        background: 'var(--color-cream, #F5F0E4)',
        color: color || 'var(--color-ink)',
        display: 'grid',
        placeItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, accent = 'var(--color-ink)' }) {
  return (
    <div className="adm-stat">
      <div className="adm-stat__label">{label}</div>
      <div className="adm-stat__value" style={{ color: accent }}>{value}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */
function StatusBadge({ discount: d }) {
  const expired = isExpired(d)
  const active = isActive(d)
  const style = {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 999,
    letterSpacing: 0.2,
    fontFamily: "var(--font-sans)",
    whiteSpace: 'nowrap',
  }
  if (expired) return <span style={{ ...style, background: '#f3f3f3', color: '#999' }}>Scaduto</span>
  if (!d.is_active) return <span style={{ ...style, background: '#fef3c7', color: '#b45309' }}>Disattivato</span>
  return <span style={{ ...style, background: '#ecfdf5', color: '#059669' }}>Attivo</span>
}

function DropBadge() {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: 999,
        background: '#B08954',
        color: '#fff',
        letterSpacing: 0.5,
        marginLeft: 6,
        fontFamily: "var(--font-sans)",
      }}
    >
      DROP
    </span>
  )
}

function FeaturedBadge() {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 600,
        padding: '3px 9px',
        borderRadius: 999,
        background: '#fef3c7',
        color: '#B08954',
        marginLeft: 6,
        fontFamily: "var(--font-sans)",
      }}
    >
      Evidenza
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Filter chip                                                        */
/* ------------------------------------------------------------------ */
function FilterChip({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 999,
        border: active ? '1px solid var(--color-ink)' : '1px solid #eee',
        background: active ? 'var(--color-ink)' : '#fff',
        color: active ? '#fff' : '#666',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: "var(--font-sans)",
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
      {count != null && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '1px 6px',
            borderRadius: 10,
            background: active ? 'rgba(255,255,255,0.2)' : '#f3f3f3',
            color: active ? '#fff' : '#999',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */
export default function DiscountManager() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const [discounts, setDiscounts] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [partnerIds, setPartnerIds] = useState(new Set()) // restaurant_ids that are active partners
  const [partnerPins, setPartnerPins] = useState({}) // restaurant_id → pin_code (legacy restaurant_partners)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [filter, setFilter] = useState('all')
  // "Create partner" flow
  const [newPartner, setNewPartner] = useState(null) // { id, name } — restaurant that will be created as partner
  const [pinPopup, setPinPopup] = useState(null)  // { name, pin } — shown after save
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  // Notify subscribers: map of `${type}:${id}` -> { sent_at, sent_count }
  const [notifyLogs, setNotifyLogs] = useState({})
  const [notifyingId, setNotifyingId] = useState(null)
  // L'esito dell'annuncio partito da solo al salvataggio: si vede in un
  // avviso che sparisce, senza fermare chi sta lavorando.
  const [autoNotice, setAutoNotice] = useState(null)
  // Banner pubblicitari che mostrano uno sconto: { [discount_id]: [id, ...] }.
  // Servono in fase di cancellazione — vedi `handleDelete`.
  const [adsByDiscount, setAdsByDiscount] = useState({})
  // Invitati degli sconti di prova: { [discount_id]: ['email', ...] }.
  const [testersByDiscount, setTestersByDiscount] = useState({})

  const [form, setForm] = useState(EMPTY_FORM)
  // Link diretti all'editor: `?new=1` (dal bottone Crea), con
  // `&restaurant=ID` dalla scheda del locale, e `?edit=ID` dalla lista
  // sconti del locale. Si leggono una volta, a dati caricati.
  const [searchParams, setSearchParams] = useSearchParams()
  const [urlHandled, setUrlHandled] = useState(false)

  // Presi / utilizzati, dal vivo: alimenta sia il pannello "In diretta" sia
  // i contatori di ogni card (vedi `useAdminRedemptions`).
  const live = useAdminRedemptions({ enabled: !!user && isAdmin })


  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }
    Promise.all([
      supabase.from('discounts').select('*, products:discount_products(id, name, note, photo_url, thumb_url, sort_order), restaurant:restaurants(id, name)').order('created_at', { ascending: false }),
      supabase.from('restaurants').select('id, name, address, is_published, restaurant_photos(photo_url, thumb_url, sort_order)').order('name'),
      supabase.from('restaurant_partners').select('restaurant_id, pin_code').eq('is_active', true),
      supabase.from('sponsored_placements').select('id, discount_id').not('discount_id', 'is', null),
      // Chi ha un PIN: il PIN non si legge dalla tabella, lo dà l'RPC admin.
      fetchRestaurantSecrets().catch(() => ({})),
      supabase.from('discount_testers').select('discount_id, email').order('created_at'),
    ]).then(([discRes, restRes, partRes, adsRes, secrets, testersRes]) => {
      const tmap = {}
      ;(testersRes?.data || []).forEach((t) => {
        tmap[t.discount_id] = [...(tmap[t.discount_id] || []), t.email]
      })
      setTestersByDiscount(tmap)
      const restPhotoMap = {}
      ;(restRes.data || []).forEach((r) => {
        restPhotoMap[r.id] = r.restaurant_photos?.[0]?.photo_url || null
      })
      const enriched = (discRes.data || []).map((d) => ({
        ...d,
        restaurant_photo: restPhotoMap[d.restaurant_id] || null,
      }))
      setDiscounts(enriched)
      setRestaurants((restRes.data || []).map((r) => {
        const cover = [...(r.restaurant_photos || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
        return {
          id: r.id,
          name: r.name,
          address: r.address,
          is_published: r.is_published,
          photo: cover?.thumb_url || cover?.photo_url || null,
          has_pin: !!secrets[r.id]?.verify_pin,
        }
      }))
      const partnerRows = partRes.data || []
      setPartnerIds(new Set(partnerRows.map((p) => p.restaurant_id)))
      setPartnerPins(Object.fromEntries(partnerRows.filter((p) => p.pin_code).map((p) => [p.restaurant_id, p.pin_code])))
      const adMap = {}
      ;(adsRes.data || []).forEach((a) => {
        adMap[a.discount_id] = [...(adMap[a.discount_id] || []), a.id]
      })
      setAdsByDiscount(adMap)
      setLoading(false)
    })
  }, [])

  // Load notify log rows so we can show "già inviato" state inline.
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    supabase
      .from('email_notifications_log')
      .select('type, item_id, sent_at, sent_count')
      .in('type', ['discount', 'drop'])
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach((row) => {
          map[`${row.type}:${row.item_id}`] = { sent_at: row.sent_at, sent_count: row.sent_count }
        })
        setNotifyLogs(map)
      })
  }, [])

  useEffect(() => {
    if (loading || urlHandled) return
    setUrlHandled(true)
    const editId = searchParams.get('edit')
    const restId = searchParams.get('restaurant')
    if (editId) {
      const d = discounts.find((x) => x.id === editId)
      if (d) handleEdit(d)
    } else if (searchParams.get('new') === '1' || restId) {
      openNew(restaurants.some((r) => r.id === restId) ? restId : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, urlHandled])

  // Salvato o chiuso l'editor, i parametri del link diretto non servono più:
  // senza, ricaricando la pagina si riaprirebbe un "Nuovo sconto".
  useEffect(() => {
    if (!urlHandled || showForm) return
    if (searchParams.has('new') || searchParams.has('edit') || searchParams.has('restaurant')) {
      setSearchParams({}, { replace: true })
    }
  }, [urlHandled, showForm, searchParams, setSearchParams])

  const handleNotify = async (d, { force = false } = {}) => {
    if (!d?.id) return
    const type = d.is_drop ? 'drop' : 'discount'
    // Il megafono sta accanto alla matita: un tocco sbagliato mandava
    // l'email a tutti gli utenti senza chiedere niente. Ora chiede sempre
    // (il "già inviato, vuoi rimandarlo?" resta sotto, per i doppioni).
    if (!force) {
      const who = d.restaurant?.name ? ` di ${d.restaurant.name}` : ''
      const ok = window.confirm(`Mandare l'email su «${d.title}»${who} a tutti gli utenti?\n\nParte subito e non si può annullare.`)
      if (!ok) return
    }
    setNotifyingId(d.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sessione scaduta')
      const res = await fetch('/api/notify-subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type, id: d.id, force }),
      })
      const json = await res.json()
      if (res.status === 409) {
        const sentWhen = new Date(json.sent_at).toLocaleString('it-IT')
        const again = window.confirm(`Già inviato il ${sentWhen} a ${json.sent_count} iscritti.\n\nVuoi inviare di nuovo?`)
        if (again) return handleNotify(d, { force: true })
        return
      }
      if (!res.ok) throw new Error(json.error || 'Errore invio')
      window.alert(`Notifica inviata a ${json.sent} iscritti${json.errors ? ` (${json.errors} errori)` : ''}`)
      setNotifyLogs((prev) => ({
        ...prev,
        [`${type}:${d.id}`]: { sent_at: new Date().toISOString(), sent_count: json.sent },
      }))
    } catch (err) {
      window.alert(`Errore notifica: ${err.message}`)
    } finally {
      setNotifyingId(null)
    }
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setSaveError(null)
    setNewPartner(null)
  }

  const closeEditor = () => {
    setShowForm(false)
    resetForm()
  }

  const openNew = (restaurantId = '') => {
    resetForm()
    if (restaurantId) setForm((f) => ({ ...f, restaurant_id: restaurantId }))
    setShowForm(true)
  }

  const handleEdit = (d) => {
    const kind = d.is_drop ? 'drop' : d.is_featured ? 'featured' : 'discount'
    const isDrop = kind === 'drop'
    const endSource = isDrop ? (d.drop_ends_at || d.valid_until) : d.valid_until
    setForm({
      restaurant_id: d.restaurant_id,
      title: d.title,
      description: d.description || '',
      discount_type: d.discount_type,
      discount_value: d.discount_value,
      conditions: d.conditions || '',
      valid_days: Array.isArray(d.valid_days) ? d.valid_days : [],
      valid_meal_slots: Array.isArray(d.valid_meal_slots) ? d.valid_meal_slots : [],
      products: [...(d.products || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      kind,
      starts_at: toInputDate(isDrop ? (d.drop_starts_at || d.valid_from) : d.valid_from, isDrop),
      ends_at: toInputDate(endSource, isDrop),
      no_end_date: !endSource,
      max_uses: (isDrop ? (d.max_quantity || d.max_redemptions) : d.max_redemptions) || '',
      is_active: d.is_active,
      schedule_on: !!d.publish_at,
      was_live: !!d.is_active,
      publish_at: toLocalInput(d.publish_at),
      // Ancora da uscire: l'email non è partita, e si può ancora decidere.
      send_email: d.publish_at ? d.notify_on_publish !== false : false,
      is_test: !!d.is_test,
      testers: (testersByDiscount[d.id] || []).join(', '),
      was_test: !!d.is_test,
      clear_test_redemptions: true,
    })
    setEditing(d.id)
    setShowForm(true)
  }

  /**
   * Riallinea `discount_products` a quello che c'è nel form.
   *
   * Cancella e reinserisce invece di fare un diff riga per riga: le foto sono
   * al massimo otto, nessuno tiene riferimenti agli id dei prodotti, e un
   * diff su nome/nota/ordine sarebbe tre volte il codice per lo stesso
   * risultato. L'ordine dell'array è l'ordine pubblicato.
   */
  const syncProducts = async (discountId, products) => {
    const rows = (products || [])
      .map((p, i) => ({
        discount_id: discountId,
        name: (p.name || '').trim() || 'Prodotto',
        note: (p.note || '').trim() || null,
        photo_url: p.photo_url || null,
        thumb_url: p.thumb_url || null,
        sort_order: i,
      }))
      // Una riga senza foto e col nome lasciato vuoto è una riga aggiunta per
      // sbaglio: non ha niente da mostrare e non va pubblicata.
      .filter((r) => r.photo_url || r.name !== 'Prodotto')

    const { error: delErr } = await supabase.from('discount_products').delete().eq('discount_id', discountId)
    if (delErr) return { error: delErr.message, rows: [] }
    if (rows.length === 0) return { error: null, rows: [] }

    const { data, error } = await supabase.from('discount_products').insert(rows).select()
    if (error) return { error: error.message, rows: [] }
    return { error: null, rows: data || [] }
  }

  /**
   * Riallinea `discount_testers` all'elenco del form. Uno sconto non di
   * prova non ha invitati: l'elenco vuoto cancella quelli rimasti.
   */
  const syncTesters = async (discountId, emails) => {
    const before = testersByDiscount[discountId] || []
    const same = before.length === emails.length && before.every((e) => emails.includes(e))
    if (same) return { error: null }
    const { error: delErr } = await supabase.from('discount_testers').delete().eq('discount_id', discountId)
    if (delErr) return { error: delErr.message }
    if (emails.length) {
      const { error } = await supabase.from('discount_testers').insert(emails.map((email) => ({ discount_id: discountId, email })))
      if (error) return { error: error.message }
    }
    setTestersByDiscount((prev) => {
      const next = { ...prev }
      if (emails.length) next[discountId] = emails
      else delete next[discountId]
      return next
    })
    return { error: null }
  }

  const handleSave = async () => {
    const restId = form.restaurant_id || newPartner?.id
    if (!restId || !form.title || !form.discount_value) return

    // Vincolo: PIN partner attivo è prerequisito per creare uno sconto.
    // newPartner viene creato con un PIN automaticamente, quindi ok.
    // Un partner "legacy" (presente in restaurant_partners.is_active ma senza
    // verify_pin sulla riga restaurants) è valido: il PIN viene copiato dal
    // record legacy a restaurants.verify_pin più sotto, così CredenzialiTab e
    // ScontoTab vedono lo stato corretto.
    if (!newPartner) {
      const rest = restaurants.find((r) => r.id === restId)
      const isLegacyPartner = rest && partnerIds.has(rest.id)
      if (rest && !rest.has_pin && !isLegacyPartner) {
        setSaveError(
          `${rest.name} non ha il PIN partner attivo. ` +
            'Vai in Ristoranti → apri la scheda → tab Credenziali → "Attiva PIN partner", poi torna qui.'
        )
        return
      }
    }

    if (!editing) {
      // Un locale può avere più sconti attivi insieme — niente più blocco
      // "ha già uno sconto attivo" qui. Restano solo i controlli di
      // sanità sulla data.
      //
      // Guard di sanità: se c'è una data di fine, deve essere nel futuro.
      // Nessuna data (sconto senza scadenza) salta il controllo.
      if (form.ends_at && new Date(form.ends_at) <= new Date()) {
        setSaveError('La data di fine deve essere nel futuro.')
        return
      }
    }
    const testerEmails = form.is_test ? parseTesterEmails(form.testers) : []
    if (form.is_test && testerEmails.length === 0) {
      setSaveError('Sconto di prova: scrivi almeno un\'email di chi lo deve vedere (quella con cui ha l\'account).')
      return
    }
    // Uno sconto di prova non esce per nessuno: la programmazione non vale.
    const scheduling = form.schedule_on && !form.is_test && !form.was_live
    const publishIso = scheduling ? fromLocalInput(form.publish_at) : null
    if (scheduling) {
      const err = publishAtError(form.publish_at)
      if (err) {
        setSaveError(err)
        return
      }
      if (form.ends_at && new Date(form.ends_at) <= new Date(publishIso)) {
        setSaveError('La data di fine deve venire dopo l\'uscita programmata.')
        return
      }
    }

    setSaving(true)
    setSaveError(null)

    // If the user chose a non-partner restaurant, auto-create the partner with a new 6-digit PIN
    let pendingPin = null
    if (newPartner && !editing) {
      const pin = String(Math.floor(100000 + Math.random() * 900000))
      const { error: pErr } = await supabase.from('restaurant_partners').insert({
        restaurant_id: newPartner.id,
        pin_code: pin,
        is_active: true,
      })
      if (!pErr) {
        setPartnerIds((prev) => new Set([...prev, newPartner.id]))
        setPartnerPins((prev) => ({ ...prev, [newPartner.id]: pin }))
        pendingPin = { name: newPartner.name, pin }
        // Also update restaurants column if it exists
        await supabase.from('restaurants').update({ verify_pin: pin }).eq('id', newPartner.id).then(() => {})
      }
    } else if (!editing) {
      // Legacy partner: presente in restaurant_partners ma con restaurants.verify_pin
      // ancora NULL (mai backfillato). Copia il pin_code dal record legacy così
      // CredenzialiTab/ScontoTab e tutti i flow basati su verify_pin lo vedono.
      const rest = restaurants.find((r) => r.id === restId)
      if (rest && !rest.has_pin && partnerPins[restId]) {
        const legacyPin = partnerPins[restId]
        const { error: backfillErr } = await supabase
          .from('restaurants')
          .update({ verify_pin: legacyPin })
          .eq('id', restId)
        if (!backfillErr) {
          setRestaurants((prev) => prev.map((r) => (r.id === restId ? { ...r, has_pin: true } : r)))
        }
      }
    }

    const isDrop = form.kind === 'drop'
    const isFeatured = form.kind === 'featured'
    let startIso = form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString()
    // Programmato: vale da quando esce, non da prima (il "Valido dal" di
    // oggi su uno sconto che esce lunedì direbbe una cosa falsa, e un drop
    // partirebbe col countdown già consumato).
    if (publishIso && startIso < publishIso) startIso = publishIso
    // Campo vuoto → null, non una stringa vuota passata a `new Date()`
    // (tornerebbe Invalid Date): nessuna data di fine è una scelta valida,
    // non un errore di digitazione.
    const endIso = form.ends_at ? new Date(form.ends_at).toISOString() : null
    const uses = form.max_uses ? parseInt(form.max_uses) : null

    const payload = {
      restaurant_id: restId,
      title: form.title,
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      conditions: form.conditions || null,
      // Lista vuota → null, non []: `effectiveValidDays` legge "nessun limite"
      // da entrambi, ma null è quello che c'è già sulle righe storiche e
      // tenere due modi di dire la stessa cosa non aiuta nessuno.
      valid_days: form.valid_days?.length ? form.valid_days : null,
      valid_meal_slots: form.valid_meal_slots?.length ? form.valid_meal_slots : null,
      valid_from: startIso,
      valid_until: endIso,
      max_redemptions: uses,
      is_active: scheduling ? false : form.is_active,
      publish_at: publishIso,
      notify_on_publish: scheduling ? !!form.send_email : true,
      is_drop: isDrop,
      drop_starts_at: isDrop ? startIso : null,
      drop_ends_at: isDrop ? endIso : null,
      max_quantity: isDrop ? uses : null,
      is_featured: isFeatured,
      // Nasce già di prova (mai visibile al pubblico, neanche per un attimo);
      // da prova a normale = pubblicato per tutti.
      is_test: !!form.is_test,
    }
    const withProducts = '*, products:discount_products(id, name, note, photo_url, thumb_url, sort_order), restaurant:restaurants(id, name)'
    const result = editing
      ? await supabase.from('discounts').update(payload).eq('id', editing).select(withProducts).single()
      : await supabase.from('discounts').insert(payload).select(withProducts).single()
    if (result.error) {
      setSaveError(result.error.message || 'Errore nel salvataggio. Riprova.')
      setSaving(false)
      return
    }
    if (result.data) {
      const savedProducts = await syncProducts(result.data.id, form.products)
      if (savedProducts.error) {
        // Lo sconto è salvato: qui fallisce solo l'elenco prodotti. Dirlo e
        // lasciare il form aperto è meglio che chiuderlo facendo credere che
        // le foto siano andate a posto.
        setSaveError(`Sconto salvato, ma le foto dei prodotti no: ${savedProducts.error}`)
        setSaving(false)
        return
      }
      const savedTesters = await syncTesters(result.data.id, testerEmails)
      if (savedTesters.error) {
        setSaveError(`Sconto salvato, ma gli invitati alla prova no: ${savedTesters.error}`)
        setSaving(false)
        return
      }
      if (form.is_test) writeLastTesters(testerEmails.join(', '))
      // Pubblicato adesso: i riscatti fatti durante la prova non sono clienti
      // veri — via, se l'admin lo lascia spuntato (il trigger riallinea i
      // contatori, e con loro vanno le stelle date per prova).
      let clearNotice = null
      if (form.was_test && !form.is_test && form.clear_test_redemptions) {
        const { error: rErr } = await supabase.from('discount_redemptions').delete().eq('discount_id', result.data.id)
        if (rErr) clearNotice = `Sconto pubblicato, ma i riscatti di prova non sono stati cancellati: ${rErr.message}`
      }
      const saved = { ...result.data, products: savedProducts.rows }
      if (editing) setDiscounts((p) => p.map((d) => (d.id === editing ? saved : d)))
      else setDiscounts((p) => [saved, ...p])
      setShowForm(false)
      resetForm()
      if (pendingPin) setPinPopup(pendingPin)

      // L'annuncio parte da solo quando lo sconto nasce già attivo e la
      // casella "Manda l'email" è spuntata. Solo alla creazione: "Salva
      // modifiche" non manda mai email — correggere una didascalia non è
      // un nuovo sconto. Il server fa la stessa verifica (`onCreate`: rifiuta
      // uno sconto che non è appena nato) e tiene il registro dei doppioni.
      if (!editing && result.data.is_active && form.send_email && !result.data.is_test) {
        notifyOnPublish(saved)
      }
      if (clearNotice) {
        setAutoNotice({ kind: 'err', text: clearNotice })
        setTimeout(() => setAutoNotice(null), 7000)
      } else if (publishIso) {
        setAutoNotice({
          kind: 'ok',
          text: `Programmato: esce ${formatPublishAt(publishIso)}${form.send_email ? ' e in quel momento parte l\'email a tutti gli utenti' : ', senza email'}.`,
        })
        setTimeout(() => setAutoNotice(null), 7000)
      } else if (form.was_test && !form.is_test) {
        setAutoNotice({ kind: 'ok', text: 'Sconto pubblicato: ora lo vedono tutti. Nessuna email è partita — se vuoi annunciarlo c\'è il megafono.' })
        setTimeout(() => setAutoNotice(null), 7000)
      }
    }
    setSaving(false)
  }

  /**
   * Manda l'annuncio senza chiedere niente e senza bloccare il salvataggio.
   *
   * Non usa `handleNotify` perché quello è il bottone manuale: mostra
   * finestre di conferma e chiede "vuoi mandarlo di nuovo?", cose che
   * durante un salvataggio automatico non hanno senso. Qui un fallimento
   * finisce in un avviso discreto: lo sconto è comunque salvato, e il
   * bottone "Notifica" resta lì per riprovare a mano.
   */
  const notifyOnPublish = async (d) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch('/api/notify-subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: d.is_drop ? 'drop' : 'discount', id: d.id, onCreate: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setNotifyLogs((prev) => ({
          ...prev,
          [`${d.is_drop ? 'drop' : 'discount'}:${d.id}`]: {
            sent_at: new Date().toISOString(), sent_count: json.sent,
          },
        }))
        setAutoNotice({ kind: 'ok', text: `Annuncio inviato a ${json.sent} iscritti.` })
      } else if (res.status !== 409) {
        setAutoNotice({ kind: 'err', text: `Sconto salvato, ma l'annuncio non è partito: ${json.error || 'errore invio'}. Puoi mandarlo col bottone Notifica.` })
      }
    } catch (err) {
      setAutoNotice({ kind: 'err', text: `Sconto salvato, ma l'annuncio non è partito: ${err.message}` })
    }
    setTimeout(() => setAutoNotice(null), 7000)
  }

  // Quanti banner pubblicitari restano appesi a questi sconti.
  const adsFor = (ids) => ids.flatMap((id) => adsByDiscount[id] || [])

  // Cancella per davvero, e dice come è andata.
  //
  // Il `delete` su `discounts` da solo non basta: un banner pubblicitario di
  // tipo `restaurant_discount` punta allo sconto, la foreign key è ON DELETE
  // SET NULL e il vincolo `sp_variant_coherence` pretende che quel campo non
  // sia mai nullo — il DB rifiuta la riga con un errore 23514. Prima si
  // toglie il banner, poi lo sconto.
  //
  // E soprattutto: prima l'esito non veniva mai letto. La riga spariva
  // dall'elenco comunque, e ricompariva al ricarico della pagina — di qui
  // l'impressione che gli sconti "non si eliminassero".
  const deleteDiscountRows = async (ids) => {
    const adIds = adsFor(ids)
    if (adIds.length > 0) {
      const { error } = await supabase.from('sponsored_placements').delete().in('id', adIds)
      if (error) return error
    }
    const { error, count } = await supabase
      .from('discounts')
      .delete({ count: 'exact' })
      .in('id', ids)
    if (error) return error
    // Nessun errore ma nessuna riga toccata: è la RLS che ha filtrato tutto
    // (sessione scaduta, oppure l'utente non è più admin). Senza questo
    // controllo la cancellazione fallita passerebbe per riuscita.
    if (count === 0) return new Error('Nessuna riga eliminata: controlla di essere ancora loggato come admin.')
    setAdsByDiscount((prev) => {
      const next = { ...prev }
      ids.forEach((id) => delete next[id])
      return next
    })
    return null
  }

  const handleDelete = async (id) => {
    const error = await deleteDiscountRows([id])
    if (error) {
      setAutoNotice({ kind: 'err', text: `Sconto non eliminato: ${error.message}` })
      setTimeout(() => setAutoNotice(null), 7000)
      setDeleteConfirm(null)
      return
    }
    setDiscounts((p) => p.filter((d) => d.id !== id))
    setDeleteConfirm(null)
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDiscounts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredDiscounts.map((d) => d.id)))
    }
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    const ids = [...selectedIds]
    const error = await deleteDiscountRows(ids)
    if (error) {
      setAutoNotice({ kind: 'err', text: `Sconti non eliminati: ${error.message}` })
      setTimeout(() => setAutoNotice(null), 7000)
    } else {
      setDiscounts((p) => p.filter((d) => !selectedIds.has(d.id)))
      setSelectedIds(new Set())
    }
    setBulkDeleteConfirm(false)
    setBulkDeleting(false)
  }

  const handleToggleActive = async (id, currentActive, publishAt = null) => {
    // Accendere a mano uno sconto programmato annulla l'uscita programmata
    // (e con lei l'email di quel momento): meglio dirlo prima.
    if (publishAt && !currentActive) {
      const ok = window.confirm(`Questo sconto esce da solo ${formatPublishAt(publishAt)}.\n\nAccenderlo adesso? L'uscita programmata si annulla e nessuna email parte (c'è sempre il megafono).`)
      if (!ok) return
    }
    const { data } = await supabase
      .from('discounts')
      .update({ is_active: !currentActive, publish_at: null })
      .eq('id', id)
      .select('*, restaurant:restaurants(id, name)')
      .single()
    if (data) setDiscounts((p) => p.map((d) => (d.id === id ? data : d)))
  }

  // I contatori non stanno in `discounts`: arrivano dal realtime e si
  // uniscono qui, così una modifica allo sconto non li azzera e un riscatto
  // non costringe a ricaricare la lista.
  const counted = useMemo(() => discounts.map((d) => {
    const c = live.byDiscount[d.id]
    return { ...d, generated_count: c?.taken || 0, redeemed_count: c?.used || 0 }
  }), [discounts, live.byDiscount])

  // Totali per locale, mostrati sulla card solo se il locale ha più sconti
  // (con uno solo coinciderebbero con quelli della card).
  const partnerTotals = useMemo(() => {
    const map = {}
    counted.forEach((d) => {
      const t = map[d.restaurant_id] || (map[d.restaurant_id] = { discounts: 0, taken: 0, used: 0 })
      t.discounts += 1
      t.taken += d.generated_count
      t.used += d.redeemed_count
    })
    return map
  }, [counted])

  const discountsById = useMemo(() => Object.fromEntries(discounts.map((d) => [d.id, d])), [discounts])

  const stats = useMemo(() => {
    const total = counted.length
    const active = counted.filter((d) => isActive(d)).length
    const drops = counted.filter((d) => d.is_drop && isActive(d)).length
    const redemptions = counted.reduce((s, d) => s + (d.redeemed_count || 0), 0)
    return { total, active, drops, redemptions }
  }, [counted])

  const filteredDiscounts = useMemo(() => {
    if (filter === 'all') return counted
    if (filter === 'active') return counted.filter((d) => isActive(d))
    if (filter === 'drops') return counted.filter((d) => d.is_drop)
    if (filter === 'expired') return counted.filter((d) => isExpired(d))
    if (filter === 'tests') return counted.filter((d) => d.is_test)
    if (filter === 'scheduled') return counted.filter((d) => d.publish_at)
    return counted
  }, [counted, filter])

  const counts = useMemo(() => ({
    all: discounts.length,
    active: discounts.filter((d) => isActive(d)).length,
    drops: discounts.filter((d) => d.is_drop).length,
    expired: discounts.filter((d) => isExpired(d)).length,
    tests: discounts.filter((d) => d.is_test).length,
    scheduled: discounts.filter((d) => d.publish_at).length,
  }), [discounts])

  if (authLoading) return null
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Sconti & Drop">
      {/* BLOCCO 8 — la riga sconto sotto i 1100px (iPad in verticale, finestra
          affiancata, portatile piccolo).

          Nella griglia da cinque colonne la colonna del testo restava larga
          200px scarsi: il nome del locale andava su quattro righe, la
          descrizione su sette, e la riga arrivava a 230px di altezza — sullo
          schermo ne entravano due e mezza.

          Sotto i 1100px diventa una card impilata: foto e nome sopra, scadenza
          e azioni sotto, il testo non va più a capo forzato e ne entrano cinque
          o sei per schermata. Sopra i 1100px non cambia niente. */}
      <style>{`
        @keyframes dm-flash {
          0% { box-shadow: 0 0 0 0 rgba(232,69,60,0.55); transform: scale(1.12); }
          60% { box-shadow: 0 0 0 8px rgba(232,69,60,0); transform: scale(1); }
          100% { box-shadow: 0 0 0 0 rgba(232,69,60,0); }
        }
        @media (max-width: 1100px) and (min-width: 768px) {
          .dm-row {
            grid-template-columns: 18px 56px minmax(0, 1fr) auto !important;
            grid-template-areas:
              "check photo body body"
              "ttl   ttl   .    actions" !important;
            row-gap: 12px !important;
            align-items: start !important;
          }
          .dm-row-check   { grid-area: check; align-self: center; }
          .dm-row-photo   { grid-area: photo; width: 56px !important; height: 56px !important; }
          .dm-row-body    { grid-area: body; }
          .dm-row-ttl     { grid-area: ttl; justify-self: start; min-width: 0 !important; padding: 6px 10px !important; }
          .dm-row-ttl > div:first-child { font-size: 15px !important; }
          .dm-row-actions { grid-area: actions; }
        }
      `}</style>
      <div className="adm adm-page adm-page--wide">
        {/* ── Header ── */}
        <div className="adm-crumbs">Gestione › <b>Sconti & Drop</b></div>
        <div className="adm-head">
          <div>
            <h1 className="adm-title">Sconti & Drop</h1>
            <p className="adm-sub">
              <b style={{ color: 'var(--adm-ink)' }}>{stats.active}</b> online
              {stats.drops > 0 && <> · <b style={{ color: 'var(--adm-coral-ink)' }}>{stats.drops}</b> drop in corso</>}
              {' '}· {stats.total} in tutto
            </p>
          </div>
          <button type="button" onClick={() => openNew()} className="adm-btn adm-btn--primary">
            <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>+</span> Nuovo sconto
          </button>
        </div>

        {/* ── Stats ── (i drop in corallo: è il loro colore) */}
        <div className="adm-stats">
          <StatCard label="Totali" value={stats.total} />
          <StatCard label="Online" value={stats.active} accent="var(--adm-ok)" />
          <StatCard label="Drop live" value={stats.drops} accent="var(--adm-coral)" />
          <StatCard label="Usati" value={stats.redemptions} />
        </div>

        {/* ── In diretta: sconti presi e utilizzati ── */}
        <LiveRedemptionsPanel
          events={live.events}
          usedEvents={live.usedEvents}
          today={live.today}
          status={live.status}
          loaded={live.loaded}
          freshKeys={live.freshKeys}
          now={live.now}
          discountsById={discountsById}
        />

        {/* ── Filter pills (v4 mockup) ── */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginBottom: 16,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <PillTab active={filter === 'all'} count={counts.all} onClick={() => setFilter('all')}>Tutti</PillTab>
          <PillTab active={filter === 'drops'} count={counts.drops} onClick={() => setFilter('drops')}>Drop attivi</PillTab>
          <PillTab active={filter === 'active'} count={counts.active} onClick={() => setFilter('active')}>Sconti sempre attivi</PillTab>
          <PillTab active={filter === 'expired'} count={counts.expired} onClick={() => setFilter('expired')}>Scaduti</PillTab>
          {(counts.scheduled > 0 || filter === 'scheduled') && (
            <PillTab active={filter === 'scheduled'} count={counts.scheduled} onClick={() => setFilter('scheduled')}>Programmati</PillTab>
          )}
          {(counts.tests > 0 || filter === 'tests') && (
            <PillTab active={filter === 'tests'} count={counts.tests} onClick={() => setFilter('tests')}>In prova</PillTab>
          )}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 13 }}>
            Carico…
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filteredDiscounts.length === 0 && (
          <EmptyState
            icon="🎟"
            title={filter === 'all' ? 'Nessuno sconto creato' : 'Nessuno sconto in questa categoria'}
            subtitle={filter === 'all' ? 'Crea il primo sconto per un ristorante partner.' : 'Cambia filtro per vedere altri sconti.'}
            cta={filter === 'all' ? { label: '+ Nuovo sconto', onClick: () => openNew() } : null}
          />
        )}

        {/* Esito dell'annuncio partito da solo dopo il salvataggio. */}
        {autoNotice && (
          <div
            role="status"
            style={{
              padding: '11px 16px',
              borderRadius: 12,
              marginBottom: 12,
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.45,
              background: autoNotice.kind === 'ok' ? '#E9F8EF' : '#FDEDEB',
              color: autoNotice.kind === 'ok' ? '#1A4731' : '#8A2B25',
              border: `1px solid ${autoNotice.kind === 'ok' ? '#BFE9CF' : '#F6C9C4'}`,
            }}
          >
            {autoNotice.text}
          </div>
        )}

        {/* ── Bulk action bar — appears when items are selected ── */}
        {selectedIds.size > 0 && (
          <div
            style={{
              padding: '10px 16px',
              background: 'var(--color-ink, #22181C)',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 12,
              boxShadow: '0 6px 14px rgba(34,24,28,0.15)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {selectedIds.size} {selectedIds.size === 1 ? 'sconto selezionato' : 'sconti selezionati'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Deseleziona
              </button>
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(true)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  background: 'var(--color-danger, #C0392B)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Elimina {selectedIds.size}
              </button>
            </div>
          </div>
        )}

        {/* ── Drop-card list (responsive, mockup frame 4) ── */}
        {!loading && filteredDiscounts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
            {/* Select-all */}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', cursor: 'pointer', marginBottom: 4, paddingLeft: 12 }}>
              <input
                type="checkbox"
                checked={selectedIds.size === filteredDiscounts.length}
                onChange={toggleSelectAll}
                style={{ cursor: 'pointer', width: 14, height: 14 }}
              />
              Seleziona tutti ({filteredDiscounts.length})
            </label>
            {filteredDiscounts.map((d) => (
              <DropCard
                key={d.id}
                d={d}
                testers={testersByDiscount[d.id]}
                selected={selectedIds.has(d.id)}
                notifyLog={notifyLogs[`${d.is_drop ? 'drop' : 'discount'}:${d.id}`]}
                notifying={notifyingId === d.id}
                active={isActive(d)}
                partnerTotal={partnerTotals[d.restaurant_id]}
                flash={live.lastChange?.discount_id === d.id ? live.lastChange : null}
                onSelect={() => toggleSelect(d.id)}
                onEdit={() => handleEdit(d)}
                onNotify={() => handleNotify(d)}
                onToggleActive={() => handleToggleActive(d.id, d.is_active, d.publish_at)}
                onDelete={() => setDeleteConfirm(d)}
              />
            ))}
          </div>
        )}

        {/* ── Editor a tutto schermo (DiscountEditor, 30/09) ── */}
        <DiscountEditor
          open={showForm}
          editing={editing}
          form={form}
          setForm={setForm}
          restaurants={restaurants}
          partnerIds={partnerIds}
          newPartner={newPartner}
          setNewPartner={setNewPartner}
          saving={saving}
          saveError={saveError}
          takenDuringTest={editing ? (live.byDiscount[editing]?.taken || 0) : 0}
          readLastTesters={readLastTesters}
          onSave={handleSave}
          onClose={closeEditor}
        />

        {/* ── PIN popup — shown after auto-creating a partner ── */}
        <AnimatePresence>
          {pinPopup && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPinPopup(null)}
              style={{
                position: 'fixed', inset: 0, zIndex: 200,
                background: 'rgba(26,26,31,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff', borderRadius: 18, border: '1px solid #eee',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 28, maxWidth: 360, width: '100%',
                  fontFamily: "var(--font-sans)", textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-ink)', margin: '0 0 6px' }}>
                  Partner creato!
                </h3>
                <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px', lineHeight: 1.5 }}>
                  <strong>{pinPopup.name}</strong> è ora un ristorante partner. Questo è il codice PIN per la pagina <strong>/verify</strong>:
                </p>
                <div style={{
                  background: '#f9f9f9', border: '2px dashed #D1D5DB', borderRadius: 12, padding: '16px 20px',
                  marginBottom: 20,
                }}>
                  <div style={{ fontSize: 11, color: '#999', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>PIN di accesso</div>
                  <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 8, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {pinPopup.pin}
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#999', margin: '0 0 20px', lineHeight: 1.5 }}>
                  Condividi questo PIN con il ristorante — serve per accedere alla dashboard /verify e validare i QR degli utenti.
                </p>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(pinPopup.pin).catch(() => {}); setPinPopup(null) }}
                  style={{
                    width: '100%', padding: '13px 0', borderRadius: 12,
                    background: 'var(--color-ink)', border: 'none', color: '#fff',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  Copia PIN e chiudi
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bulk delete confirm modal ── */}
        <AnimatePresence>
          {bulkDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setBulkDeleteConfirm(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 110,
                background: 'rgba(26,26,31,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff', borderRadius: 14, border: '1px solid #eee',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 24, maxWidth: 380, width: '100%',
                  fontFamily: "var(--font-sans)",
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', margin: 0, marginBottom: 8 }}>
                  Eliminare {selectedIds.size} {selectedIds.size === 1 ? 'sconto' : 'sconti'}?
                </h3>
                <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px', lineHeight: 1.5 }}>
                  Questa azione non può essere annullata. Tutti i QR code generati per {selectedIds.size === 1 ? 'questo sconto' : 'questi sconti'} diventeranno non validi.
                  {adsFor([...selectedIds]).length > 0 && (
                    <>
                      {' '}Verranno eliminati anche {adsFor([...selectedIds]).length === 1
                        ? 'il banner pubblicitario che mostra'
                        : `i ${adsFor([...selectedIds]).length} banner pubblicitari che mostrano`} {selectedIds.size === 1 ? 'questo sconto' : 'questi sconti'}.
                    </>
                  )}
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setBulkDeleteConfirm(false)}
                    style={{
                      padding: '9px 16px', borderRadius: 8, background: 'transparent',
                      border: '1px solid #eee', color: '#666', fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', fontFamily: "var(--font-sans)",
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    style={{
                      padding: '9px 16px', borderRadius: 8, background: '#dc2626', border: 'none',
                      color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: bulkDeleting ? 'wait' : 'pointer', opacity: bulkDeleting ? 0.7 : 1,
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    {bulkDeleting ? 'Eliminazione...' : `Elimina ${selectedIds.size}`}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Delete confirm modal ── */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 110,
                background: 'rgba(26,26,31,0.5)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  border: '1px solid #eee',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                  padding: 24,
                  maxWidth: 380,
                  width: '100%',
                  fontFamily: "var(--font-sans)",
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', margin: 0, marginBottom: 8 }}>
                  Eliminare lo sconto?
                </h3>
                <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px', lineHeight: 1.5 }}>
                  Sconto di <strong style={{ color: 'var(--color-ink)' }}>{deleteConfirm.restaurant?.name || 'ristorante'}</strong>: questa azione non può essere annullata.
                  {adsFor([deleteConfirm.id]).length > 0 && (
                    <>
                      {' '}Attenzione: {adsFor([deleteConfirm.id]).length === 1
                        ? 'un banner pubblicitario mostra questo sconto e verrà eliminato'
                        : `${adsFor([deleteConfirm.id]).length} banner pubblicitari mostrano questo sconto e verranno eliminati`} insieme a lui.
                    </>
                  )}
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 8,
                      background: 'transparent',
                      border: '1px solid #eee',
                      color: '#666',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(deleteConfirm.id)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 8,
                      background: '#dc2626',
                      border: 'none',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    Elimina
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  )
}

/* ------------------------------------------------------------------ */
/*  Local helpers                                                      */
/* ------------------------------------------------------------------ */
const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 600,
  color: '#999',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

const tdStyle = {
  padding: '14px 16px',
  color: 'var(--color-ink)',
  verticalAlign: 'top',
}

const iconBtnStyle = {
  background: 'transparent',
  border: 'none',
  padding: 6,
  cursor: 'pointer',
  color: '#999',
  borderRadius: 6,
  marginLeft: 2,
}
