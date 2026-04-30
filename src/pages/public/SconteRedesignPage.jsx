import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useActiveDiscounts, useMyDiscounts } from '../../lib/hooks/useDiscounts'
import { useCity } from '../../lib/CityContext'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
import { proxyImg } from '../../lib/supabase'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import Footer from '../../components/Layout/Footer'
import MobileLogoHeader from '../../components/Layout/MobileLogoHeader'
import SconteQRPopup from '../../components/Discount/SconteQRPopup'
import SconteAuthGate from '../../components/Discount/SconteAuthGate'
import { readAndClearPendingDiscountId } from '../../lib/utils/pendingDiscount'
import MetaTags from '../../components/SEO/MetaTags'
import SconteSchemaOrg from '../../components/Discount/SconteSchemaOrg'
import ValidityPill from '../../components/Discount/ValidityPill'
import QRBlockedView from '../../components/Discount/QRBlockedView'
import DiscountDetailPopup from '../../components/Discount/DiscountDetailPopup'
import { checkValidity, formatShortPill, formatDays } from '../../lib/validity'
import './SconteRedesignPage.css'

/* ---------- helpers ---------- */
function slugify(name) {
  return (name || '').toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function getPhoto(restaurant) {
  const p = restaurant?.photos?.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))?.[0]
  return proxyImg(p?.thumb_url || p?.photo_url || null)
}

function shortAddress(addr) {
  if (!addr) return null
  return addr.split(',')[0]
}

function dropDeadline(deal) {
  return deal?.drop_ends_at || deal?.valid_until || null
}

function compactCountdown(targetIso) {
  if (!targetIso) return null
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}g ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function expiryLabel(deal) {
  if (!deal) return null
  if (deal.is_drop) return compactCountdown(dropDeadline(deal))
  if (!deal.valid_until) return null
  const d = new Date(deal.valid_until)
  // if very far (e.g. > 365 days) treat as evergreen → no badge
  const diffDays = (d.getTime() - Date.now()) / 86400000
  if (diffDays > 365) return null
  if (diffDays <= 0) return 'scaduto'
  return `fino al ${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`
}

function shortExpiryLine(deal) {
  if (!deal) return null
  if (deal.is_drop) {
    const cd = compactCountdown(dropDeadline(deal))
    return cd ? `Scade tra ${cd}` : null
  }
  if (!deal.valid_until) return null
  const diffDays = (new Date(deal.valid_until).getTime() - Date.now()) / 86400000
  if (diffDays > 365) return null
  if (diffDays <= 0) return 'Sconto scaduto'
  return `Scade ${new Date(deal.valid_until).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

function categoryEmoji(name) {
  const map = { Asiatico: '🥟', Matcha: '🍵', Aperitivo: '🥂', Bistrot: '🍽️', Cocktail: '🍸', Panineria: '🥪', Trattoria: '🍝', Barbecue: '🔥', Pizza: '🍕', Bar: '☕' }
  return map[name] || '🍽️'
}

function isDealExpired(deal) {
  const end = dropDeadline(deal)
  if (!end) return false
  return new Date(end).getTime() < Date.now()
}

function dealBadgeText(deal) {
  if (!deal) return ''
  const v = deal.discount_value
  if (!v) return deal.title || ''
  // If value already contains symbol leave as is, else infer from type
  if (/[%€]/.test(v)) return v.startsWith('-') || v.startsWith('−') ? v : `−${v.replace(/^-?/, '')}`
  if (deal.discount_type === 'percentage') return `−${v}%`
  if (deal.discount_type === 'fixed') return `−${v}€`
  return deal.title || v
}

function freebieLabel(deal) {
  // For 'freebie' deals (e.g. "Baozi 1,50€") use title as the badge
  if (deal?.discount_type === 'freebie') return deal.title || deal.discount_value
  return null
}

export default function SconteRedesignPage() {
  return <SconteRedesignPageInner />
}

/* ============================================================================
   Inner page: handles state, URL sync, claim, QR popup, AuthGate.
   ============================================================================ */
function SconteRedesignPageInner() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isDesktop = useIsDesktop()
  const { city: currentCity } = useCity()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = (searchParams.get('tab') === 'miei') ? 'miei' : 'disponibili'
  const sub = (searchParams.get('sub') === 'utilizzati') ? 'utilizzati' : 'disponibili'

  const setTab = useCallback((next) => {
    const sp = new URLSearchParams(searchParams)
    if (next === 'disponibili') sp.delete('tab')
    else sp.set('tab', next)
    if (next !== 'miei') sp.delete('sub')
    setSearchParams(sp, { replace: false })
  }, [searchParams, setSearchParams])

  const setSub = useCallback((next) => {
    const sp = new URLSearchParams(searchParams)
    sp.set('tab', 'miei')
    if (next === 'disponibili') sp.delete('sub')
    else sp.set('sub', next)
    setSearchParams(sp, { replace: false })
  }, [searchParams, setSearchParams])

  const { discounts: allRaw, activeDrops: allActiveDrops, featured: allFeatured, regular: allRegular, loading } =
    useActiveDiscounts()
  const { active: allMyActive, used: allMyUsed, loading: myLoading } = useMyDiscounts(user?.id)

  const cityFilter = useCallback((deal) => {
    if (!currentCity?.name) return true
    return deal.restaurant?.city?.toLowerCase() === currentCity.name.toLowerCase()
  }, [currentCity?.name])
  const myFilter = useCallback((r) => {
    if (!currentCity?.name) return true
    return r.discount?.restaurant?.city?.toLowerCase() === currentCity.name.toLowerCase()
  }, [currentCity?.name])

  // Allineato alla logica della home: tutti gli sconti is_drop (non esauriti)
  // sono drop. La spec §2.1 dice di nasconderli solo se sold-out (presi==totali).
  // Non richiediamo drop_starts_at perché molti drop sul DB lo hanno null.
  const allDropsLocal = useMemo(() => {
    return (allRaw || []).filter((d) => {
      if (!d.is_drop) return false
      const claimed = d.claimed_count || d.total_redeemed || 0
      const max = d.max_quantity || d.max_redemptions || 0
      if (max > 0 && claimed >= max) return false
      // se è già scaduto come timestamp, lo escludiamo
      const end = d.drop_ends_at || d.valid_until
      if (end && new Date(end).getTime() < Date.now()) return false
      return true
    })
  }, [allRaw])
  const allConvLocal = useMemo(() => {
    return (allRaw || []).filter((d) => !d.is_drop)
  }, [allRaw])

  const drops = useMemo(() => allDropsLocal.filter(cityFilter), [allDropsLocal, cityFilter])
  const conv = useMemo(() => allConvLocal.filter(cityFilter), [allConvLocal, cityFilter])
  // Backward-compat per auto-claim post login
  void allActiveDrops; void allFeatured; void allRegular
  const myActive = useMemo(() => allMyActive.filter(myFilter), [allMyActive, myFilter])
  const myUsed = useMemo(() => allMyUsed.filter(myFilter), [allMyUsed, myFilter])

  // Index of redemptions by discount_id so the catalogue can show dynamic CTA
  // ("Apri QR" / "Già usato") instead of hiding entries the user already took.
  const redemptionByDealId = useMemo(() => {
    const map = new Map()
    allMyActive.forEach((r) => map.set(r.discount_id, { ...r, status: r.status || 'generated' }))
    allMyUsed.forEach((r) => {
      // Used wins over generated when both exist (shouldn't happen, defensive)
      map.set(r.discount_id, { ...r, status: r.status || 'redeemed' })
    })
    return map
  }, [allMyActive, allMyUsed])

  // Drop sempre visibili nel catalogo (anche se già presi) — la card cambia CTA.
  // Convenzioni: si nascondono quando già prese (sono tante, eviterebbe duplicazioni).
  const dropsAvailable = drops
  const convAvailable = useMemo(
    () => conv.filter((d) => !redemptionByDealId.has(d.id)),
    [conv, redemptionByDealId]
  )

  const countDisponibili = dropsAvailable.length + convAvailable.length
  const countTuttiIMiei = myActive.length + myUsed.length

  const [claiming, setClaiming] = useState(null)
  const [qrPopup, setQrPopup] = useState(null) // { redemption, deal }
  const [authGate, setAuthGate] = useState(null) // pendingDiscountId | null
  const [toast, setToast] = useState(null)
  const [infoDeal, setInfoDeal] = useState(null) // deal | null per dialog dettagli

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // After login redirect: auto-claim a pending discount saved before the gate.
  // Wait until catalogue & "I miei" are loaded so we know if it's already claimed.
  const [autoClaimed, setAutoClaimed] = useState(false)
  useEffect(() => {
    if (autoClaimed || !user || loading || myLoading) return
    const pending = readAndClearPendingDiscountId()
    if (!pending) { setAutoClaimed(true); return }
    setAutoClaimed(true)
    const all = allRaw || []
    const deal = all.find((d) => d.id === pending)
    if (deal) {
      // small delay so the page mounts first
      setTimeout(() => claimDeal(deal), 50)
    }
    // ensure we're in "miei" tab afterwards
    setTab('miei')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, myLoading, allRaw])

  const goTo = (r) => {
    if (!r) return
    navigate(`/restaurant/${r?.slug || slugify(r?.name || '')}`)
  }

  const claimDeal = useCallback(async (deal) => {
    if (claiming) return
    if (!user) {
      setAuthGate(deal.id)
      return
    }
    setClaiming(deal.id)
    try {
      const { supabase } = await import('../../lib/supabase')
      const { data: existing } = await supabase
        .from('discount_redemptions')
        .select('id, qr_code, status')
        .eq('discount_id', deal.id)
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (existing?.qr_code) {
        setQrPopup({ redemption: { ...existing, discount_id: deal.id }, deal })
        return
      }

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
      let code = 'BiSc-'
      for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))

      let userName = null
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()
        userName = profile?.full_name || null
      } catch { /* best effort */ }

      const { data, error } = await supabase
        .from('discount_redemptions')
        .insert({
          discount_id: deal.id,
          user_id: user.id,
          qr_code: code,
          status: 'generated',
          user_name: userName,
        })
        .select()
        .single()
      if (error) throw error
      await supabase.rpc('increment_discount_redeemed', { discount_uuid: deal.id }).catch(() => {})

      setQrPopup({ redemption: { ...data, discount_id: deal.id }, deal })
    } catch (e) {
      console.error('Claim failed:', e)
      setToast('Non sono riuscito a salvare lo sconto. Riprova.')
    } finally {
      setClaiming(null)
    }
  }, [claiming, user])

  const [qrBlocked, setQrBlocked] = useState(null) // deal | null

  // Click "Apri QR" da I miei vantaggi: se non valid_now → blocked view,
  // altrimenti popup QR normale (PR21 SconteQRPopup).
  const openMyQR = (redemption) => {
    const deal = redemption?.discount
    if (deal && checkValidity(deal) !== 'valid_now') {
      setQrBlocked(deal)
      return
    }
    setQrPopup({ redemption, deal })
  }

  // Wrapper per il claim usato dal nuovo DiscountDetailPopup.
  // Ritorna { id, qr_code } | null se l'utente non è loggato (AuthGate aperto).
  const claimFromPopup = useCallback(async (deal) => {
    if (!user) {
      setAuthGate(deal.id)
      return null
    }
    setClaiming(deal.id)
    try {
      const { supabase } = await import('../../lib/supabase')
      const { data: existing } = await supabase
        .from('discount_redemptions')
        .select('id, qr_code, status')
        .eq('discount_id', deal.id)
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (existing?.qr_code) return existing
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
      let code = 'BiSc-'
      for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
      let userName = null
      try {
        const { data: profile } = await supabase
          .from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        userName = profile?.full_name || null
      } catch { /* best effort */ }
      const { data, error } = await supabase
        .from('discount_redemptions')
        .insert({ discount_id: deal.id, user_id: user.id, qr_code: code, status: 'generated', user_name: userName })
        .select().single()
      if (error) throw error
      await supabase.rpc('increment_discount_redeemed', { discount_uuid: deal.id }).catch(() => {})
      return data
    } catch (e) {
      console.error('Claim failed:', e)
      setToast('Non sono riuscito a salvare lo sconto. Riprova.')
      return null
    } finally {
      setClaiming(null)
    }
  }, [user])

  return (
    <div className="sc-page" style={{ paddingBottom: isDesktop ? 0 : TAB_BAR_HEIGHT + 16 }}>
      <MetaTags
        title="Sconti ristoranti Torino · Bi Club | ChiamamiBi"
        description="Sconti e vantaggi nei ristoranti che ho selezionato a Torino. Drop a tempo, convenzioni sempre valide e promozioni riservate ai membri del Bi Club."
        url="https://chiamamibi.com/sconti"
      />
      <SconteSchemaOrg drops={dropsAvailable} conv={convAvailable} />
      {!isDesktop && <MobileLogoHeader />}
      <div className={isDesktop ? 'sc-shell sc-shell-desktop' : 'sc-shell sc-shell-mobile'}>
        <div className="sc-head-row">
          <header className="sc-page-head">
            <h1>Bi Club</h1>
            <h2 className="sc-page-h2">Sconti e vantaggi nei ristoranti di Torino</h2>
            <p>Drop a tempo, convenzioni sempre valide, e i vantaggi pronti da usare.</p>
          </header>
          <Segment
            tab={tab}
            countDisponibili={countDisponibili}
            countTuttiIMiei={countTuttiIMiei}
            onChange={setTab}
          />
        </div>

        {tab === 'miei' && (
          <SubSegment
            sub={sub}
            countSaved={myActive.length}
            countUsed={myUsed.length}
            onChange={setSub}
          />
        )}

        <div className="sc-body">
          {tab === 'disponibili' && (
            <CatalogoView
              loading={loading}
              drops={dropsAvailable}
              conv={convAvailable}
              claiming={claiming}
              redemptionByDealId={redemptionByDealId}
              onClaim={claimDeal}
              onOpenQR={openMyQR}
              onCardClick={goTo}
              onInfo={(d) => setInfoDeal(d)}
            />
          )}
          {tab === 'miei' && sub === 'disponibili' && (
            <MieiDisponibiliView
              loading={myLoading}
              user={user}
              items={myActive}
              onOpenQR={openMyQR}
              onCardClick={goTo}
            />
          )}
          {tab === 'miei' && sub === 'utilizzati' && (
            <MieiUtilizzatiView
              loading={myLoading}
              user={user}
              items={myUsed}
              isDesktop={isDesktop}
              onCardClick={goTo}
            />
          )}
        </div>
      </div>

      {isDesktop && <Footer />}

      {qrPopup && (
        <SconteQRPopup
          redemptionId={qrPopup.redemption.id}
          qrCode={qrPopup.redemption.qr_code}
          qrPayload={`${window.location.origin}/verify?code=${qrPopup.redemption.qr_code}`}
          restaurantName={qrPopup.deal?.restaurant?.name || 'Ristorante'}
          restaurantSubtitle={[
            qrPopup.deal?.restaurant?.cuisine_type || qrPopup.deal?.restaurant?.category?.[0],
            shortAddress(qrPopup.deal?.restaurant?.address),
          ].filter(Boolean).join(' · ')}
          photoUrl={getPhoto(qrPopup.deal?.restaurant)}
          discountValue={dealBadgeText(qrPopup.deal) || freebieLabel(qrPopup.deal)}
          discountTitle={qrPopup.deal?.title}
          expiresLabel={shortExpiryLine(qrPopup.deal)}
          onClose={() => setQrPopup(null)}
        />
      )}

      {authGate && (
        <SconteAuthGate
          pendingDiscountId={authGate}
          onClose={() => setAuthGate(null)}
        />
      )}

      {infoDeal && (
        <DiscountDetailPopup
          deal={infoDeal}
          photoUrl={getPhoto(infoDeal.restaurant)}
          restaurantUrl={infoDeal.restaurant?.slug
            ? `/restaurant/${infoDeal.restaurant.slug}`
            : `/restaurant/${slugify(infoDeal.restaurant?.name || '')}`}
          claiming={claiming === infoDeal.id}
          onClaim={async () => {
            const result = await claimFromPopup(infoDeal)
            return result
          }}
          onClose={() => setInfoDeal(null)}
        />
      )}

      {qrBlocked && (
        <QRBlockedView
          deal={qrBlocked}
          photoUrl={getPhoto(qrBlocked.restaurant)}
          restaurantName={qrBlocked.restaurant?.name || qrBlocked.title}
          restaurantSubtitle={[
            qrBlocked.restaurant?.cuisine_type || qrBlocked.restaurant?.category?.[0],
            shortAddress(qrBlocked.restaurant?.address),
          ].filter(Boolean).join(' · ')}
          discountValue={dealBadgeText(qrBlocked) || freebieLabel(qrBlocked)}
          onClose={() => setQrBlocked(null)}
        />
      )}

      {toast && <div className="sc-toast" role="status">{toast}</div>}
    </div>
  )
}

/* ============================================================================
   Section components
   ============================================================================ */
function Segment({ tab, countDisponibili, countTuttiIMiei, onChange }) {
  return (
    <div className="sc-segment" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'disponibili'}
        className={`sc-seg ${tab === 'disponibili' ? 'is-active' : ''}`}
        onClick={() => onChange('disponibili')}
      >
        Disponibili {countDisponibili > 0 && <span className="sc-ct">{countDisponibili}</span>}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'miei'}
        className={`sc-seg ${tab === 'miei' ? 'is-active' : ''}`}
        onClick={() => onChange('miei')}
      >
        I miei vantaggi {countTuttiIMiei > 0 && <span className="sc-ct">{countTuttiIMiei}</span>}
      </button>
    </div>
  )
}

function SubSegment({ sub, countSaved, countUsed, onChange }) {
  return (
    <div className="sc-sub-segment" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={sub === 'disponibili'}
        className={`sc-sub ${sub === 'disponibili' ? 'is-active' : ''}`}
        onClick={() => onChange('disponibili')}
      >
        Disponibili {countSaved > 0 && <span className="sc-ct">{countSaved}</span>}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={sub === 'utilizzati'}
        className={`sc-sub ${sub === 'utilizzati' ? 'is-active' : ''}`}
        onClick={() => onChange('utilizzati')}
      >
        Utilizzati {countUsed > 0 && <span className="sc-ct">{countUsed}</span>}
      </button>
    </div>
  )
}

function CatalogoView({ loading, drops, conv, claiming, redemptionByDealId, onClaim, onOpenQR, onCardClick, onInfo }) {
  if (loading) {
    return (
      <div style={{ padding: '24px 16px' }}>
        {[180, 110, 110].map((h, i) => (
          <div key={i} className="skeleton" style={{
            height: h, borderRadius: 16, background: 'rgba(34,24,28,0.04)', marginBottom: 12,
          }} />
        ))}
      </div>
    )
  }

  const empty = drops.length === 0 && conv.length === 0
  if (empty) {
    return (
      <div className="sc-empty">
        <div className="sc-ic">🎟️</div>
        <strong>Nessuno sconto disponibile</strong>
        <p>Torna presto: nuove convenzioni e drop arrivano spesso.</p>
      </div>
    )
  }

  return (
    <>
      {drops.length > 0 && (
        <section className="sc-section">
          <div className="sc-section-head">
            <strong>Drop a tempo</strong>
            <small>{drops.length} {drops.length === 1 ? 'attivo' : 'attivi'}</small>
          </div>
          <div className="sc-drop-track">
            {drops.map((d) => {
              const redemption = redemptionByDealId?.get(d.id) || null
              return (
                <DropCard
                  key={d.id}
                  deal={d}
                  redemption={redemption}
                  claiming={claiming === d.id}
                  onClaim={() => onClaim(d)}
                  onOpenQR={() => onOpenQR({ ...redemption, discount: d })}
                  onClick={() => onCardClick(d.restaurant)}
                  onInfo={() => onInfo(d)}
                />
              )
            })}
          </div>
        </section>
      )}

      {conv.length > 0 && (
        <section className="sc-section">
          <div className="sc-section-head">
            <strong>Convenzioni</strong>
            <small>{conv.length} sempre {conv.length === 1 ? 'valida' : 'valide'}</small>
          </div>
          <div className="sc-conv-list">
            {conv.map((d) => (
              <ConvCard
                key={d.id}
                deal={d}
                claiming={claiming === d.id}
                onClaim={() => onClaim(d)}
                onClick={() => onCardClick(d.restaurant)}
                onInfo={() => onInfo(d)}
              />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function DropCard({ deal, redemption, claiming, onClaim, onOpenQR, onClick, onInfo }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const time = expiryLabel(deal)
  const claimed = deal.claimed_count || deal.total_redeemed || 0
  const max = deal.max_quantity || deal.max_redemptions || 0
  const pct = max > 0 ? Math.min(100, Math.round((claimed / max) * 100)) : 0
  const remaining = Math.max(0, max - claimed)
  const cuisine = r?.cuisine_type || r?.category?.[0]
  const location = r?.neighborhood || r?.city
  const priceStr = r?.price_range != null ? '€'.repeat(r.price_range) : null

  const status = redemption?.status
  const isSaved = status === 'generated'
  const isUsed = status === 'redeemed'

  let ctaLabel = 'Sblocca sconto'
  let ctaOnClick = onClaim
  let ctaDisabled = !!claiming
  if (claiming) ctaLabel = 'Un attimo…'
  else if (isUsed) { ctaLabel = 'Già usato'; ctaDisabled = true; ctaOnClick = () => {} }
  else if (isSaved) { ctaLabel = 'Apri QR'; ctaOnClick = onOpenQR }
  const validityStatus = checkValidity(deal)
  const validityPill = formatShortPill(deal, validityStatus)

  return (
    <div
      className="sc-drop"
      role="button"
      tabIndex={0}
      onClick={(e) => { if (!e.defaultPrevented) onClick() }}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      style={isUsed ? { opacity: 0.55 } : undefined}
    >
      <div className="sc-ph">
        {photo ? (
          <img src={photo} alt={r?.name || ''} loading="lazy" decoding="async" />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'grid', placeItems: 'center',
            background: '#F1ECE3', fontSize: 32,
          }}>🍽️</div>
        )}
        <span className="sc-badge-live">live</span>
        {time && <span className="sc-badge-time">{time}</span>}
      </div>
      <div className="sc-body-c">
        <h4>{r?.name || deal.title}</h4>
        {r?.tagline && <div className="sc-drop-tagline">{r.tagline}</div>}
        <div className="sc-meta sc-drop-meta">
          {cuisine && <span className="sc-cat sc-cat-drop">{categoryEmoji(cuisine)} {cuisine}</span>}
          {location && <><span className="sc-sep">|</span><span>{location}</span></>}
          {priceStr && <><span className="sc-sep">|</span><span>{priceStr}</span></>}
        </div>
        <div className="sc-pill-row"><span className="sc-drop-pct-inline">{dealBadgeText(deal)}</span></div>
        {max > 0 && (
          <div className="sc-progress">
            <div className="sc-progress-labels">
              <span>{claimed} presi</span>
              <span className={remaining <= 3 ? 'sc-few' : ''}>{remaining > 0 ? `${remaining} rimasti` : 'Esauriti'}</span>
            </div>
            <div className="sc-bar"><i style={{ width: `${pct}%` }} /></div>
          </div>
        )}
        <div className="sc-drop-actions">
          <button
            type="button"
            className="sc-cta-info"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInfo() }}
            aria-label="Vedi dettagli drop"
          >
            Dettagli
          </button>
          <button
            type="button"
            className="sc-cta"
            disabled={ctaDisabled}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); ctaOnClick() }}
          >
            {ctaLabel === 'Sblocca sconto' && <LockIcon />}
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function ConvCard({ deal, claiming, onClaim, onInfo }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const cuisine = r?.cuisine_type || r?.category?.[0]
  const isFreebie = deal?.discount_type === 'freebie'
  const badge = isFreebie ? (deal.title || deal.discount_value) : dealBadgeText(deal)
  const location = r?.neighborhood || r?.city
  const priceStr = r?.price_range != null ? '€'.repeat(r.price_range) : null
  const validityStatus = checkValidity(deal)
  const validityPill = formatShortPill(deal, validityStatus)
  const daysShort = (Array.isArray(deal?.valid_days) && deal.valid_days.length > 0 && deal.valid_days.length < 7)
    ? formatDays(deal.valid_days)
    : null

  return (
    <div
      className="sc-conv sc-conv-clean"
      role="button"
      tabIndex={0}
      onClick={(e) => { if (!e.defaultPrevented) onInfo() }}
      onKeyDown={(e) => { if (e.key === 'Enter') onInfo() }}
    >
      <div className="sc-ph">
        {photo ? (
          <img src={photo} alt={r?.name || ''} loading="lazy" decoding="async" />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'grid', placeItems: 'center',
            background: '#F1ECE3', fontSize: 30,
          }}>{categoryEmoji(cuisine)}</div>
        )}
        <span className={`sc-badge-pct ${isFreebie ? 'is-freebie' : ''}`}>{badge}</span>
      </div>
      <div className="sc-body-c">
        <div className="sc-info-stack">
          <div className="sc-top-info">
            <h4>{r?.name || deal.title}</h4>
            <div className="sc-meta">
              {cuisine && <span className="sc-cat">{categoryEmoji(cuisine)} {cuisine}</span>}
              {location && <><span style={{ opacity: 0.35 }}>|</span><span>{location}</span></>}
              {priceStr && <><span style={{ opacity: 0.35 }}>|</span><span>{priceStr}</span></>}
            </div>
          </div>
          <div className="sc-left-info">
            <ValidityPill status={validityStatus} text={validityPill} />
            {daysShort && <span className="sc-when">{daysShort}</span>}
          </div>
        </div>
        <button
          type="button"
          className="sc-cta-mini"
          disabled={!!claiming}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClaim() }}
        >
          {claiming ? '…' : (<><LockIcon />Sblocca</>)}
        </button>
      </div>
    </div>
  )
}

function MieiDisponibiliView({ loading, user, items, onOpenQR, onCardClick }) {
  if (!user) {
    return (
      <div className="sc-empty">
        <div className="sc-ic">🔐</div>
        <strong>Accedi per vedere i tuoi sconti</strong>
        <p>Una volta dentro trovi qui i QR pronti da mostrare.</p>
      </div>
    )
  }
  if (loading) {
    return (
      <div style={{ padding: '20px 16px' }}>
        {[64, 64, 64].map((h, i) => (
          <div key={i} className="skeleton" style={{
            height: h, borderRadius: 14, background: 'rgba(34,24,28,0.04)', marginBottom: 10,
          }} />
        ))}
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="sc-empty">
        <div className="sc-ic">🏷️</div>
        <strong>Nessuno sconto pronto</strong>
        <p>Prendi uno sconto da "Disponibili" e tornerai qui per usarlo.</p>
      </div>
    )
  }

  return (
    <section className="sc-section">
      <div className="sc-section-head">
        <strong>Pronti da usare</strong>
        <small>tap "Apri QR" per mostrarlo al locale</small>
      </div>
      <div className="sc-mine-list">
        {items.map((r) => (
          <MineRow
            key={r.id}
            redemption={r}
            onOpenQR={() => onOpenQR(r)}
            onClick={() => onCardClick(r.discount?.restaurant)}
          />
        ))}
      </div>
    </section>
  )
}

function MineRow({ redemption, onOpenQR, onClick }) {
  const deal = redemption.discount
  const r = deal?.restaurant
  const photo = getPhoto(r)
  const expired = isDealExpired(deal)
  const cuisine = r?.cuisine_type || r?.category?.[0]
  const meta = [cuisine, shortAddress(r?.address)].filter(Boolean).join(' | ')
  const validityStatus = expired ? 'expired' : checkValidity(deal)
  const validityPill = expired ? 'Scaduto' : formatShortPill(deal, validityStatus)
  const pctBadge = dealBadgeText(deal) || freebieLabel(deal)

  return (
    <div
      className={`sc-mine-row ${expired ? 'is-expired' : ''}`}
      role="button"
      tabIndex={0}
      onClick={(e) => { if (!e.defaultPrevented) onClick() }}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
    >
      <div className="sc-ph-mini">
        {photo ? (
          <img src={photo} alt="" loading="lazy" decoding="async" />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'grid', placeItems: 'center',
            background: '#F1ECE3', fontSize: 22,
          }}>🍽️</div>
        )}
        {pctBadge && <span className="sc-pct-corner">{pctBadge}</span>}
      </div>
      <div className="sc-info">
        <h4>{r?.name || deal?.title || 'Ristorante'}</h4>
        {meta && <div className="sc-meta">{meta}</div>}
        <div className="sc-pill-row sc-pill-row-mini">
          <ValidityPill status={validityStatus} text={validityPill} />
        </div>
      </div>
      {/* Bottone Apri QR SEMPRE attivo (anche fuori validità):
          il click apre QRBlockedView se non valid_now. */}
      <button
        type="button"
        className="sc-qr-btn"
        disabled={expired}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!expired) onOpenQR() }}
      >
        {expired ? 'Scaduto' : 'Apri QR'}
      </button>
    </div>
  )
}

function MieiUtilizzatiView({ loading, user, items, isDesktop, onCardClick }) {
  if (!user) {
    return (
      <div className="sc-empty">
        <div className="sc-ic">🔐</div>
        <strong>Accedi per vedere lo storico</strong>
        <p>Qui trovi gli sconti che hai già usato.</p>
      </div>
    )
  }
  if (loading) {
    return (
      <div style={{ padding: '20px 16px' }}>
        {[52, 52, 52].map((h, i) => (
          <div key={i} className="skeleton" style={{
            height: h, borderRadius: 12, background: 'rgba(34,24,28,0.04)', marginBottom: 8,
          }} />
        ))}
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="sc-empty">
        <div className="sc-ic">✨</div>
        <strong>Nessuno sconto utilizzato</strong>
        <p>Quando userai uno sconto, lo trovi qui.</p>
      </div>
    )
  }

  return (
    <section className="sc-section">
      <div className="sc-section-head">
        <strong>Storico</strong>
        <small>già usati · per riusarli prendili dai Disponibili</small>
      </div>
      <div className="sc-used-list">
        {items.map((r) => (
          <UsedRow
            key={r.id}
            redemption={r}
            isDesktop={isDesktop}
            onClick={() => onCardClick(r.discount?.restaurant)}
          />
        ))}
      </div>
    </section>
  )
}

function relativeDays(iso) {
  if (!iso) return null
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
  if (days === 0) return 'oggi'
  if (days === 1) return '1 giorno fa'
  if (days < 7) return `${days} giorni fa`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return '1 settimana fa'
  if (weeks < 5) return `${weeks} settimane fa`
  const months = Math.floor(days / 30)
  if (months === 1) return '1 mese fa'
  return `${months} mesi fa`
}

function UsedRow({ redemption, isDesktop, onClick }) {
  const deal = redemption.discount
  const r = deal?.restaurant
  const photo = getPhoto(r)
  const cuisine = r?.cuisine_type || r?.category?.[0]
  const zona = r?.neighborhood || null
  const isFreebie = deal?.discount_type === 'freebie'
  const tipoLabel = isFreebie ? 'convenzione ' : 'sconto '
  const valueLabel = isFreebie ? (deal?.title || deal?.discount_value) : dealBadgeText(deal)
  const usedAtIso = redemption.redeemed_at || redemption.generated_at
  const usedAtDate = usedAtIso ? new Date(usedAtIso) : null

  return (
    <div
      className="sc-used-row"
      role="button"
      tabIndex={0}
      onClick={(e) => { if (!e.defaultPrevented) onClick() }}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
    >
      <div className="sc-ph-mini">
        {photo ? (
          <img src={photo} alt="" loading="lazy" decoding="async" />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'grid', placeItems: 'center',
            background: '#F1ECE3', fontSize: 18,
          }}>🍽️</div>
        )}
      </div>
      <div className="sc-info">
        <h4>{r?.name || deal?.title || 'Ristorante'}</h4>
        <div className="sc-sub">
          {[cuisine, zona].filter(Boolean).join(' | ')}
          {(cuisine || zona) && ' | '}
          {tipoLabel}<strong>{valueLabel}</strong>
        </div>
      </div>
      {usedAtDate && (
        <div className="sc-when">
          <strong>
            {isDesktop
              ? usedAtDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
              : usedAtDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
            }
          </strong>
          {isDesktop ? relativeDays(usedAtIso) : usedAtDate.getFullYear()}
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   DealInfoSheet — bottom sheet (mobile) / modal centrato (desktop)
   con tutte le info dettagliate dello sconto.
   ============================================================================ */
function DealInfoSheet({ deal, claiming, onClaim, onClose }) {
  const r = deal?.restaurant
  const photo = getPhoto(r)
  const cuisine = r?.cuisine_type || r?.category?.[0]
  const isFreebie = deal?.discount_type === 'freebie'
  const badge = isFreebie ? (deal?.title || deal?.discount_value) : dealBadgeText(deal)
  const dealTitle = deal?.title
  const description = deal?.description
  const conditionLines = (deal?.conditions || '')
    .split(/\n+|•/g).map((s) => s.trim()).filter(Boolean)
  const validUntil = deal?.valid_until ? new Date(deal.valid_until) : null
  const showValidity = validUntil
    && (validUntil.getTime() - Date.now()) / 86400000 <= 365
    && validUntil.getTime() > Date.now()
  const validityLabel = showValidity
    ? `Valido fino al ${validUntil.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'Sempre valido'

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="sc-info-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Dettagli sconto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="sc-info-sheet">
        <button type="button" className="sc-close" aria-label="Chiudi" onClick={onClose}>✕</button>

        {/* HERO: foto full-width con overlay gradient + badge + identità locale */}
        <div className="sc-info-hero">
          {photo ? (
            <img className="sc-info-hero-img" src={photo} alt={r?.name || ''} loading="lazy" decoding="async" />
          ) : (
            <div className="sc-info-hero-fallback">{categoryEmoji(cuisine)}</div>
          )}
          <div className="sc-info-hero-overlay" aria-hidden="true" />
          <span className={`sc-info-hero-badge ${isFreebie ? 'is-freebie' : ''}`}>{badge}</span>
          <div className="sc-info-hero-id">
            <h3>{r?.name || dealTitle}</h3>
            <div className="sc-info-hero-meta">
              {cuisine && <span className="sc-info-hero-cat">{categoryEmoji(cuisine)} {cuisine}</span>}
              {shortAddress(r?.address) && (
                <span className="sc-info-hero-addr">{shortAddress(r?.address)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="sc-info-body">
          {/* COSA OTTIENI: pannello accento corallo */}
          {dealTitle && (
            <div className="sc-info-card sc-info-card-offer">
              <span className="sc-info-card-ic" aria-hidden="true">🎁</span>
              <div className="sc-info-card-content">
                <div className="sc-info-card-label">Cosa ottieni</div>
                <div className="sc-info-card-title">{dealTitle}</div>
                {description && <p className="sc-info-card-desc">{description}</p>}
              </div>
            </div>
          )}

          {/* CONDIZIONI: lista con check */}
          {conditionLines.length > 0 && (
            <div className="sc-info-block">
              <div className="sc-info-block-label">Condizioni</div>
              <ul className="sc-info-checklist">
                {conditionLines.map((c, i) => (
                  <li key={i}>
                    <span className="sc-info-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* VALIDITÀ: pill */}
          <div className="sc-info-validity-pill">
            <span aria-hidden="true">⏱</span>
            {validityLabel}
          </div>
        </div>

        {/* AZIONI sticky in fondo */}
        <div className="sc-info-actions">
          <button type="button" className="sc-btn-secondary" onClick={onClose}>
            Chiudi
          </button>
          <button
            type="button"
            className="sc-btn-primary"
            disabled={!!claiming}
            onClick={onClaim}
          >
            {claiming ? 'Un attimo…' : 'Prendi'}
          </button>
        </div>
      </div>
    </div>
  )
}


/* ============================================================================
   DropInfoSheet — sheet specifico per i drop a tempo:
   countdown live, barra progresso disponibilità, hero ink.
   ============================================================================ */
function DropInfoSheet({ deal, claiming, onClaim, onClose }) {
  const r = deal?.restaurant
  const photo = getPhoto(r)
  const cuisine = r?.cuisine_type || r?.category?.[0]
  const badge = dealBadgeText(deal)
  const dealTitle = deal?.title
  const description = deal?.description
  const conditionLines = (deal?.conditions || '')
    .split(/\n+|•/g).map((s) => s.trim()).filter(Boolean)
  const claimed = deal?.claimed_count || deal?.total_redeemed || 0
  const max = deal?.max_quantity || deal?.max_redemptions || 0
  const remaining = max > 0 ? Math.max(0, max - claimed) : null
  const progressPct = max > 0 ? Math.min(100, Math.round((claimed / max) * 100)) : 0
  const endIso = deal?.drop_ends_at || deal?.valid_until
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const remainingMs = endIso ? new Date(endIso).getTime() - now : null
  const expired = remainingMs !== null && remainingMs <= 0
  const cdParts = (() => {
    if (remainingMs === null || remainingMs <= 0) return null
    const totalS = Math.floor(remainingMs / 1000)
    const days = Math.floor(totalS / 86400)
    const hours = Math.floor((totalS % 86400) / 3600)
    const mins = Math.floor((totalS % 3600) / 60)
    const secs = totalS % 60
    return { days, hours, mins, secs }
  })()

  return (
    <div
      className="sc-drop-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Dettagli drop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="sc-drop-sheet">
        <button type="button" className="sc-close" aria-label="Chiudi" onClick={onClose}>✕</button>

        {/* HERO drop scuro con foto in fondo + live pulse */}
        <div className="sc-drop-hero">
          {photo ? (
            <img className="sc-drop-hero-img" src={photo} alt={r?.name || ''} loading="lazy" decoding="async" />
          ) : (
            <div className="sc-drop-hero-fallback">🍽️</div>
          )}
          <div className="sc-drop-hero-overlay" aria-hidden="true" />
          <span className="sc-drop-hero-live"><i />LIVE</span>
          <div className="sc-drop-hero-pct">{badge}</div>
          <div className="sc-drop-hero-id">
            <h3>{r?.name || dealTitle}</h3>
            <div className="sc-drop-hero-meta">
              {cuisine && <span className="sc-drop-hero-cat">{categoryEmoji(cuisine)} {cuisine}</span>}
              {shortAddress(r?.address) && <span>{shortAddress(r?.address)}</span>}
            </div>
          </div>
        </div>

        <div className="sc-drop-body">
          {/* COUNTDOWN: 4 unità (g · h · m · s) */}
          {cdParts ? (
            <div className="sc-drop-countdown">
              <div className="sc-drop-countdown-label">Termina tra</div>
              <div className="sc-drop-countdown-grid">
                <CdUnit value={cdParts.days} label="giorni" />
                <CdSep />
                <CdUnit value={cdParts.hours} label="ore" />
                <CdSep />
                <CdUnit value={cdParts.mins} label="min" />
                <CdSep />
                <CdUnit value={cdParts.secs} label="sec" />
              </div>
            </div>
          ) : expired ? (
            <div className="sc-drop-countdown is-expired">
              <div className="sc-drop-countdown-label">Drop scaduto</div>
            </div>
          ) : null}

          {/* PROGRESS: presi / disponibili */}
          {max > 0 && (
            <div className="sc-drop-progress">
              <div className="sc-drop-progress-head">
                <strong>{claimed} di {max} presi</strong>
                {remaining !== null && remaining > 0 && (
                  <span>{remaining} {remaining === 1 ? 'rimasto' : 'rimasti'}</span>
                )}
              </div>
              <div className="sc-drop-progress-bar">
                <i style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          {/* COSA OTTIENI */}
          {(dealTitle || description) && (
            <div className="sc-drop-card">
              <div className="sc-drop-card-label">Cosa ottieni</div>
              {dealTitle && <div className="sc-drop-card-title">{dealTitle}</div>}
              {description && <p className="sc-drop-card-desc">{description}</p>}
            </div>
          )}

          {/* CONDIZIONI */}
          {conditionLines.length > 0 && (
            <div className="sc-drop-card">
              <div className="sc-drop-card-label">Condizioni</div>
              <ul className="sc-info-checklist">
                {conditionLines.map((c, i) => (
                  <li key={i}>
                    <span className="sc-info-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="sc-info-actions">
          <button type="button" className="sc-btn-secondary" onClick={onClose}>
            Chiudi
          </button>
          <button
            type="button"
            className="sc-btn-primary"
            disabled={!!claiming || expired}
            onClick={onClaim}
          >
            {expired ? 'Scaduto' : claiming ? 'Un attimo…' : 'Sblocca sconto'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CdUnit({ value, label }) {
  const v = String(value).padStart(2, '0')
  return (
    <div className="sc-cd-unit">
      <div className="sc-cd-num">{v}</div>
      <div className="sc-cd-lbl">{label}</div>
    </div>
  )
}

function CdSep() { return <div className="sc-cd-sep">:</div> }

