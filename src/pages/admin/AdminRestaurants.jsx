import { useState, useEffect, useMemo } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useRestaurants, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { useCategories } from '../../lib/hooks/useCategories'
import AdminLayout from '../../components/Layout/AdminLayout'
import PillTab from '../../components/admin/PillTab'
import EmptyState from '../../components/admin/EmptyState'
import { supabase, isSupabaseConfigured, proxyImg } from '../../lib/supabase'

const PAGE_SIZE = 20
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
const ic = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
const SearchIcon = ({ w = 14 }) => (
  <svg {...ic} width={w} height={w} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
)
const EditIcon = ({ w = 13 }) => (
  <svg {...ic} width={w} height={w} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
)
const TrashIcon = ({ w = 13 }) => (
  <svg {...ic} width={w} height={w} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
)
const OpenIcon = ({ w = 13 }) => (
  <svg {...ic} width={w} height={w} viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
)

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatShortDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })
}

function pickThumb(r) {
  if (!Array.isArray(r.photos) || r.photos.length === 0) return null
  const first = r.photos[0]
  if (typeof first === 'string') return first
  return first?.thumb_url || first?.photo_url || null
}

function categoryTagColor(idx) {
  const palette = ['', 'c', 'g', 'm']
  return palette[idx % palette.length]
}

function CategoryTag({ name, colorKey = '' }) {
  const bg = {
    '': 'var(--color-cream-deep, #F1EBE0)',
    c: 'var(--color-corallo-wash, #FDEDEB)',
    g: 'var(--color-green-wash, #E8F5D8)',
    m: 'var(--color-oro-wash, #F5EDDD)',
  }[colorKey]
  const fg = {
    '': 'var(--color-ink, #22181C)',
    c: 'var(--color-corallo, #E8453C)',
    g: '#2C7A4A',
    m: 'var(--color-oro, #B08954)',
  }[colorKey]
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        background: bg,
        color: fg,
      }}
    >
      {name}
    </span>
  )
}

function DiscountTag({ value }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: 'linear-gradient(135deg, var(--color-green-a, #A3E635), var(--color-green-b, #4ADE80))',
        color: '#0f2c12',
      }}
    >
      {value}
    </span>
  )
}

function StatusPill({ published }) {
  const color = published ? '#2C7A4A' : 'var(--color-ink-55, rgba(34,24,28,0.55))'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: published ? '#2C7A4A' : '#999',
        }}
      />
      {published ? 'Pubblicato' : 'Bozza'}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */
export default function AdminRestaurants() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { allRestaurants: restaurants, loading: dataLoading } = useRestaurants()
  const { categories } = useCategories()

  const [searchParams, setSearchParams] = useSearchParams()
  const queryFromUrl = searchParams.get('q') || ''
  const [search, setSearch] = useState(queryFromUrl)
  const [statusFilter, setStatusFilter] = useState('all') // all | published | draft
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [discountFilter, setDiscountFilter] = useState('all') // all | with | without
  const [sortBy, setSortBy] = useState('recent') // recent | name | views
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState(null)
  const [discountsMap, setDiscountsMap] = useState({})
  const [viewsMap, setViewsMap] = useState({})
  // Override locale dei `moments` per evitare il flash di rifetch:
  // quando l'admin tocca un chip salviamo il nuovo array nello state e in
  // DB; la riga renderizza dall'override se presente, altrimenti da
  // `r.moments`. Il map viene popolato pigramente.
  const [momentsOverrides, setMomentsOverrides] = useState({})
  const [momentsSaving, setMomentsSaving] = useState(null) // `${id}:${key}` mentre salva

  const toggleMoment = async (restaurant, key) => {
    if (!isSupabaseConfigured()) return
    const current = momentsOverrides[restaurant.id] ?? (Array.isArray(restaurant.moments) ? restaurant.moments : [])
    const next = current.includes(key)
      ? current.filter((m) => m !== key)
      : [...current, key]
    const tag = `${restaurant.id}:${key}`
    setMomentsSaving(tag)
    setMomentsOverrides((prev) => ({ ...prev, [restaurant.id]: next }))
    const { error } = await supabase
      .from('restaurants')
      .update({ moments: next, updated_at: new Date().toISOString() })
      .eq('id', restaurant.id)
    if (error) {
      // Rollback ottimistico
      setMomentsOverrides((prev) => ({ ...prev, [restaurant.id]: current }))
      // eslint-disable-next-line no-console
      console.error('toggleMoment failed', error)
    }
    setMomentsSaving((s) => (s === tag ? null : s))
  }

  // Click a row → navigate to full-page edit (replaces drawer overlay).
  // Back-compat: if the URL still carries ?edit=ID (from older bookmarks
  // or from the dashboard Top restaurants link), redirect to the proper
  // edit page so nothing breaks.
  useEffect(() => {
    const legacyEditId = searchParams.get('edit')
    if (legacyEditId) {
      navigate(`/admin/restaurant/${legacyEditId}/edit`, { replace: true })
    }
  }, [searchParams, navigate])

  const openEdit = (id) => {
    navigate(`/admin/restaurant/${id}/edit`)
  }

  // Sync URL ?q= → search state on mount / URL change
  useEffect(() => {
    setSearch(queryFromUrl)
  }, [queryFromUrl])

  // Push search into URL when user types (debounced by React state)
  useEffect(() => {
    const current = searchParams.get('q') || ''
    if (search !== current) {
      const params = new URLSearchParams(searchParams)
      if (search) params.set('q', search)
      else params.delete('q')
      setSearchParams(params, { replace: true })
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Active discounts map (for discount badge + filter)
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false
    async function run() {
      const nowIso = new Date().toISOString()
      const { data } = await supabase
        .from('discounts')
        .select('id, restaurant_id, discount_value, drop_time, is_active, valid_until')
        .eq('is_active', true)
        .gt('valid_until', nowIso)
      if (cancelled) return
      const map = {}
      ;(data || []).forEach((d) => {
        if (!map[d.restaurant_id]) map[d.restaurant_id] = d
      })
      setDiscountsMap(map)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user])

  // Views map last 30d by slug (client aggregate over capped sample)
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    let cancelled = false
    async function run() {
      const since = new Date(Date.now() - MONTH_MS).toISOString()
      const { data } = await supabase
        .from('page_views')
        .select('path')
        .ilike('path', '/r/%')
        .gte('created_at', since)
        .limit(10000)
      if (cancelled) return
      const map = {}
      ;(data || []).forEach((row) => {
        const m = row.path.match(/^\/r\/([^?/]+)/)
        if (!m) return
        map[m[1]] = (map[m[1]] || 0) + 1
      })
      setViewsMap(map)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user])

  // Derived stats
  const stats = useMemo(() => {
    const pub = restaurants.filter((r) => r.is_published !== false).length
    return {
      total: restaurants.length,
      published: pub,
      draft: restaurants.length - pub,
    }
  }, [restaurants])

  // Filtered + sorted
  const filtered = useMemo(() => {
    let result = [...restaurants]

    if (statusFilter === 'published') result = result.filter((r) => r.is_published !== false)
    else if (statusFilter === 'draft') result = result.filter((r) => r.is_published === false)

    if (categoryFilter !== 'all') {
      result = result.filter((r) => {
        const cats = r.category || (r.cuisine_type ? [r.cuisine_type] : [])
        return cats.includes(categoryFilter)
      })
    }

    if (discountFilter === 'with') result = result.filter((r) => discountsMap[r.id])
    else if (discountFilter === 'without') result = result.filter((r) => !discountsMap[r.id])

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.cuisine_type || '').toLowerCase().includes(q) ||
          (r.city || 'Torino').toLowerCase().includes(q) ||
          (r.address || '').toLowerCase().includes(q)
      )
    }

    if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'it'))
    else if (sortBy === 'views') result.sort((a, b) => (viewsMap[b.slug] || 0) - (viewsMap[a.slug] || 0))
    else result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    return result
  }, [restaurants, statusFilter, categoryFilter, discountFilter, search, sortBy, discountsMap, viewsMap])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (pageClamped - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, pageClamped])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [statusFilter, categoryFilter, discountFilter, sortBy])

  async function handleDelete() {
    if (!deleteId || !isSupabaseConfigured()) return
    try {
      await supabase.from('restaurants').delete().eq('id', deleteId)
      setDeleteId(null)
      window.location.reload()
    } catch (err) {
      alert('Errore durante eliminazione: ' + (err?.message || 'unknown'))
    }
  }

  if (authLoading || dataLoading) return <LoadingScreen />
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  return (
    <AdminLayout title="Ristoranti">
      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }} className="max-md:!p-[18px]">
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
            Catalogo › <b style={{ color: 'var(--color-ink)', fontWeight: 800 }}>Ristoranti</b>
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 32,
              letterSpacing: '-0.025em',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              color: 'var(--color-ink, #22181C)',
              flexWrap: 'wrap',
            }}
          >
            Ristoranti
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.06em',
                background: 'var(--color-cream-deep, #F1EBE0)',
                color: 'var(--color-ink, #22181C)',
                padding: '5px 10px',
                borderRadius: 999,
                textTransform: 'uppercase',
              }}
            >
              {stats.total} totali · {stats.published} pubblicati
            </span>
          </h1>
          <div style={{ marginTop: 6, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 14, fontWeight: 500 }}>
            Filtra, edita, archivia la guida.
          </div>
        </div>

        {/* ── Filters ── */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginBottom: 16,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <PillTab active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} count={stats.total}>
            Tutti
          </PillTab>
          <PillTab active={statusFilter === 'published'} onClick={() => setStatusFilter('published')} count={stats.published}>
            Pubblicati
          </PillTab>
          <PillTab active={statusFilter === 'draft'} onClick={() => setStatusFilter('draft')} count={stats.draft}>
            Bozze
          </PillTab>

          <FilterSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="Categoria ▾"
          >
            <option value="all">Tutte le categorie</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            value={discountFilter}
            onChange={setDiscountFilter}
            placeholder="Sconto ▾"
          >
            <option value="all">Sconto · tutti</option>
            <option value="with">Solo con sconto</option>
            <option value="without">Solo senza sconto</option>
          </FilterSelect>

          <FilterSelect value={sortBy} onChange={setSortBy} placeholder="Ordina ▾">
            <option value="recent">Ordina: recenti</option>
            <option value="name">Ordina: nome</option>
            <option value="views">Ordina: più visti</option>
          </FilterSelect>

          {/* Small search */}
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#fff',
              border: '1px solid var(--color-line, #EAE3D7)',
              borderRadius: 999,
              padding: '7px 12px',
              fontSize: 12,
              minWidth: 240,
            }}
          >
            <SearchIcon w={13} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per nome…"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: 'var(--color-ink)',
                padding: 0,
              }}
            />
          </div>
        </div>

        {/* ── Table (desktop) / Card list (mobile) ── */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="🍽"
            title={search ? 'Nessun ristorante trovato' : 'Nessun ristorante'}
            subtitle={search ? `Prova a cambiare filtri o ricerca "${search}"` : 'Aggiungi il primo per iniziare la guida.'}
            cta={!search ? { label: '+ Nuovo ristorante', to: '/admin/restaurant/new' } : null}
          />
        ) : (
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--color-line, #EAE3D7)',
              borderRadius: 18,
              overflow: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
              <thead>
                <tr>
                  <Th style={{ width: 40 }}></Th>
                  <Th>Ristorante</Th>
                  <Th>Categoria</Th>
                  <Th title="Quando andarci — clicca per taggare">Fasce</Th>
                  <Th>Zona</Th>
                  <Th>Sconto</Th>
                  <Th>Aggiunto</Th>
                  <Th>Views 30gg</Th>
                  <Th>Status</Th>
                  <Th style={{ textAlign: 'right' }}>Azioni</Th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, idx) => (
                  <RestaurantRow
                    key={r.id}
                    r={r}
                    idx={idx}
                    discount={discountsMap[r.id]}
                    views={viewsMap[r.slug] || 0}
                    moments={momentsOverrides[r.id] ?? (Array.isArray(r.moments) ? r.moments : [])}
                    momentsSaving={momentsSaving}
                    onToggleMoment={(key) => toggleMoment(r, key)}
                    onDelete={() => setDeleteId(r.id)}
                    onEdit={() => openEdit(r.id)}
                  />
                ))}
              </tbody>
            </table>
            <Paging page={pageClamped} totalPages={totalPages} totalItems={filtered.length} onChange={setPage} />
          </div>
        )}
      </div>

      {/* ── Delete modal ── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(34,24,28,0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#fff',
                borderRadius: 18,
                padding: 28,
                maxWidth: 420,
                width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 20, letterSpacing: '-0.015em', color: 'var(--color-ink)', margin: 0 }}>
                Elimina ristorante?
              </h3>
              <p style={{ fontSize: 14, color: 'var(--color-ink-70, rgba(34,24,28,0.7))', margin: '10px 0 22px', lineHeight: 1.55 }}>
                Questa azione cancella anche sconti, redenzioni e foto collegate. Non è reversibile.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDeleteId(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--color-line, #EAE3D7)',
                    padding: '10px 18px',
                    borderRadius: 999,
                    fontSize: 13,
                    color: 'var(--color-ink)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Annulla
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    background: 'var(--color-danger, #C0392B)',
                    border: 0,
                    padding: '10px 18px',
                    borderRadius: 999,
                    fontSize: 13,
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Elimina
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}

/* ------------------------------------------------------------------ */
/*  Row (desktop) + Card (mobile)                                      */
/* ------------------------------------------------------------------ */
const MOMENT_QUICK = [
  { key: 'colazione', emoji: '🥐', label: 'Colazione' },
  { key: 'pranzo',    emoji: '🍝', label: 'Pranzo' },
  { key: 'aperitivo', emoji: '🥂', label: 'Aperitivo' },
  { key: 'cena',      emoji: '🍷', label: 'Cena' },
  { key: 'dopocena',  emoji: '🍸', label: 'Dopo cena' },
]

function MomentQuickToggles({ moments, onToggle, saving, restaurantId }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
      {MOMENT_QUICK.map((m) => {
        const active = moments.includes(m.key)
        const isSaving = saving === `${restaurantId}:${m.key}`
        return (
          <button
            key={m.key}
            type="button"
            disabled={isSaving}
            onClick={() => onToggle(m.key)}
            title={`${m.label}${active ? ' (attivo)' : ''}`}
            aria-pressed={active}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: `1.5px solid ${active ? 'var(--color-corallo, #E8453C)' : 'var(--color-line, #EAE3D7)'}`,
              background: active ? 'var(--color-corallo, #E8453C)' : '#fff',
              color: active ? '#fff' : 'var(--color-ink, #22181C)',
              fontSize: 14,
              lineHeight: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isSaving ? 'wait' : 'pointer',
              opacity: isSaving ? 0.55 : 1,
              transition: 'all 0.12s',
              padding: 0,
            }}
          >
            {m.emoji}
          </button>
        )
      })}
    </div>
  )
}

function RestaurantRow({ r, idx, discount, views, moments, momentsSaving, onToggleMoment, onDelete, onEdit }) {
  const cats = (r.category || (r.cuisine_type ? [r.cuisine_type] : [])).map((n) => getCategoryInfo(n)).filter(Boolean)
  const firstCat = cats[0]
  const isPublished = r.is_published !== false
  const thumb = proxyImg(pickThumb(r))
  const isDrop = discount?.drop_time != null
  const zona = r.city && r.city !== 'Torino' ? r.city : '—'
  return (
    <tr
      onClick={onEdit}
      style={{
        borderBottom: '1px solid var(--color-line, #EAE3D7)',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-cream, #F5F0E4)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <Td>
        <input type="checkbox" onClick={(e) => e.stopPropagation()} onChange={() => {}} aria-label={`Seleziona ${r.name}`} />
      </Td>
      <Td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {thumb ? (
            <img src={thumb} alt="" loading="lazy" decoding="async" style={{ width: 56, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div
              style={{
                width: 56,
                height: 40,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #d8cfc1, #ad9b80)',
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--color-ink)' }}>{r.name}</div>
            <div style={{ fontWeight: 600, color: 'var(--color-ink-55, rgba(34,24,28,0.55))', fontSize: 11, marginTop: 2 }}>
              {isDrop ? '+ drop attivo 🔥' : (r.website || r.address || '').slice(0, 48) || '—'}
            </div>
          </div>
        </div>
      </Td>
      <Td>{firstCat ? <CategoryTag name={firstCat.name} colorKey={categoryTagColor(idx)} /> : '—'}</Td>
      <Td>
        <MomentQuickToggles
          moments={moments}
          onToggle={onToggleMoment}
          saving={momentsSaving}
          restaurantId={r.id}
        />
      </Td>
      <Td>{zona}</Td>
      <Td>{discount ? <DiscountTag value={discount.discount_value} /> : <span style={{ color: 'var(--color-ink-55, rgba(34,24,28,0.55))' }}>—</span>}</Td>
      <Td>{formatShortDate(r.created_at)}</Td>
      <Td>
        <b style={{ fontWeight: 900 }}>{views > 0 ? views.toLocaleString('it-IT') : '—'}</b>
      </Td>
      <Td>
        <StatusPill published={isPublished} />
      </Td>
      <Td style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit() }} style={actionBtn} title="Modifica">
            <EditIcon w={13} />
          </button>
          <a
            href={`/r/${r.slug}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={actionBtn}
            title="Apri scheda pubblica"
          >
            <OpenIcon w={13} />
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            style={{ ...actionBtn, color: 'var(--color-danger, #C0392B)' }}
            title="Elimina"
          >
            <TrashIcon w={13} />
          </button>
        </div>
      </Td>
    </tr>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub UI                                                             */
/* ------------------------------------------------------------------ */
function FilterSelect({ value, onChange, children, placeholder }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
      style={{
        background: '#fff',
        border: '1px solid var(--color-line, #EAE3D7)',
        borderRadius: 999,
        padding: '8px 14px',
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--color-ink)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        outline: 'none',
        appearance: 'none',
        paddingRight: 28,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 4l3 3 3-3' stroke='%2322181C' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
      }}
    >
      {children}
    </select>
  )
}

function Paging({ page, totalPages, totalItems, onChange }) {
  const prev = Math.max(1, page - 1)
  const next = Math.min(totalPages, page + 1)
  const numbers = pageNumbers(page, totalPages)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 18px',
        borderTop: '1px solid var(--color-line, #EAE3D7)',
        background: 'var(--color-cream, #F5F0E4)',
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
      }}
    >
      <span>
        {totalItems} risultati · pagina {page} di {totalPages}
      </span>
      <div style={{ flex: 1 }} />
      <PageButton onClick={() => onChange(prev)} disabled={page === 1}>‹</PageButton>
      {numbers.map((n, i) =>
        n === '…' ? (
          <span key={i} style={{ padding: '0 4px' }}>…</span>
        ) : (
          <PageButton key={i} active={n === page} onClick={() => onChange(n)}>
            {n}
          </PageButton>
        )
      )}
      <PageButton onClick={() => onChange(next)} disabled={page === totalPages}>›</PageButton>
    </div>
  )
}

function PageButton({ active, disabled, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        display: 'grid',
        placeItems: 'center',
        background: active ? 'var(--color-ink, #22181C)' : '#fff',
        color: active ? '#fff' : 'var(--color-ink)',
        border: `1px solid ${active ? 'var(--color-ink, #22181C)' : 'var(--color-line, #EAE3D7)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  )
}

function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 3) return [1, 2, 3, 4, '…', total]
  if (current >= total - 2) return [1, '…', total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-page, #FAF7F2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid #E8453C',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
function Th({ style, children }) {
  return (
    <th
      style={{
        textAlign: 'left',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
        padding: '12px 16px',
        background: 'var(--color-cream, #F5F0E4)',
        borderBottom: '1px solid var(--color-line, #EAE3D7)',
        ...style,
      }}
    >
      {children}
    </th>
  )
}

function Td({ style, children }) {
  return <td style={{ padding: '12px 16px', verticalAlign: 'middle', ...style }}>{children}</td>
}

const actionBtn = {
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--color-cream, #F5F0E4)',
  border: 'none',
  color: 'var(--color-ink)',
  cursor: 'pointer',
  textDecoration: 'none',
  padding: 0,
}
