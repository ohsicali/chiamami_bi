import { Fragment, useState, useMemo, useCallback, useEffect } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useActiveDiscounts, useMyDiscounts } from '../../lib/hooks/useDiscounts'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
import { proxyImg } from '../../lib/supabase'
import { PhotoOrEmoji } from '../../components/UI/SmartImage'
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
import { filterActiveDrops, filterActiveConventions, sortByExpiry, msUntilEnd } from '../../lib/discounts'
import DropCard from '../../components/Discount/DropCard'
import AdSlot from '../../components/Ads/AdBanner'
import { LIST_AD_AFTER } from '../../lib/adSlots'
import { formatDiscountValue, discountContextWord } from '../../lib/utils/discountFormat'
import './SconteRedesignPage.css'
import { formatPrice } from '../../lib/utils/price'
import { slugify } from '../../lib/utils/slug'

/* ---------- helpers ---------- */

function getPhoto(restaurant, opts) {
  const p = restaurant?.photos?.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))?.[0]
  return proxyImg(p?.thumb_url || p?.photo_url || null, opts || { w: 800 })
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
  return formatDiscountValue(deal)
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

  // BLOCCO 0 — nessun filtro città qui, ed è deliberato.
  // Il Bi Club è il catalogo completo: ogni sconto attivo compare sempre,
  // ovunque sia il locale. La città resta un badge informativo sulla card.
  // Prima c'era un `cityFilter` che confrontava `restaurant.city` con la città
  // selezionata: nascondeva Shoro (Poirino) e Birrificio (Anzola) a chi aveva
  // Torino selezionata — 6 sconti attivi in admin, 4 visibili qui.
  // La selezione è corretta solo in home (unica vetrina curata).
  const drops = useMemo(() => sortByExpiry(filterActiveDrops(allRaw)), [allRaw])
  const conv = useMemo(() => filterActiveConventions(allRaw), [allRaw])
  // Backward-compat per auto-claim post login
  void allActiveDrops; void allFeatured; void allRegular
  const myActive = allMyActive
  const myUsed = allMyUsed

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
      // maybeSingle: 0 rows is the normal first-unlock case, .single() makes
      // that look like an error response and obscures real failures.
      const { data: existing } = await supabase
        .from('discount_redemptions')
        .select('id, qr_code, status')
        .eq('discount_id', deal.id)
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

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
      if (error) {
        // Insert may have committed server-side even if the chained select
        // came back with an error. Re-fetch before declaring failure so we
        // don't show "Non sono riuscito a salvare" while the row sits in
        // the DB and shows up in "I miei vantaggi".
        const { data: recovered } = await supabase
          .from('discount_redemptions')
          .select('*')
          .eq('discount_id', deal.id)
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!recovered) throw error
        setQrPopup({ redemption: { ...recovered, discount_id: deal.id }, deal })
        return
      }
      await supabase.rpc('increment_discount_redeemed', { discount_uuid: deal.id }).catch(() => {})

      setQrPopup({ redemption: { ...data, discount_id: deal.id }, deal })
    } catch (e) {
      console.error('Claim failed:', e)
      // The insert can commit server-side even when the JS promise rejects
      // (chained .select() RLS read miss, network glitch on the return-leg,
      // or stale cached client running pre-fix code). Try one last recovery
      // fetch before declaring failure, so the user gets the QR popup
      // instead of a misleading "non sono riuscito a salvare" toast while
      // the row already sits in the DB.
      try {
        const { supabase } = await import('../../lib/supabase')
        const { data: recovered } = await supabase
          .from('discount_redemptions')
          .select('*')
          .eq('discount_id', deal.id)
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (recovered?.qr_code) {
          setQrPopup({ redemption: { ...recovered, discount_id: deal.id }, deal })
          return
        }
      } catch { /* recovery best-effort */ }
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
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
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
      if (error) {
        // Insert may have committed even when the chained select errors —
        // re-fetch before treating this as failure so the popup transitions
        // to the unlocked QR state instead of showing the error toast.
        const { data: recovered } = await supabase
          .from('discount_redemptions')
          .select('*')
          .eq('discount_id', deal.id)
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (recovered) return recovered
        throw error
      }
      await supabase.rpc('increment_discount_redeemed', { discount_uuid: deal.id }).catch(() => {})
      return data
    } catch (e) {
      console.error('Claim failed:', e)
      // Mirror the recovery in claimDeal: if the insert silently committed
      // but the promise rejected, return the row so the popup transitions
      // to the unlocked QR view instead of showing the error toast.
      try {
        const { supabase } = await import('../../lib/supabase')
        const { data: recovered } = await supabase
          .from('discount_redemptions')
          .select('*')
          .eq('discount_id', deal.id)
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (recovered?.qr_code) return recovered
      } catch { /* recovery best-effort */ }
      setToast('Non sono riuscito a salvare lo sconto. Riprova.')
      return null
    } finally {
      setClaiming(null)
    }
  }, [user])

  return (
    <div className="sc-page" style={{ paddingBottom: isDesktop ? 0 : `calc(${TAB_BAR_HEIGHT + 28}px + env(safe-area-inset-bottom, 0px))` }}>
      <MetaTags
        title="Sconti ristoranti Torino · Bi Club | ChiamamiBi"
        description="Sconti e vantaggi nei ristoranti che ho selezionato a Torino. Drop a tempo, convenzioni sempre valide e promozioni riservate ai membri del Bi Club."
        url="https://chiamamibi.com/sconti"
        canonical="https://chiamamibi.com/sconti"
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
          {/* BLOCCO 5 — porta a vetri, non porta chiusa.
              Chi non è registrato la pagina la vede: le card restano lì,
              sfocate, con sopra il conteggio VERO. "6 sconti ti aspettano"
              converte più di "Registrati per continuare" perché dice quanto
              c'è dietro il vetro. Un muro opaco fa tornare indietro.
              Il numero si aggiorna da solo: è lo stesso conteggio del
              catalogo, non una costante scritta a mano. */}
          {tab === 'disponibili' && !user && !loading && countDisponibili > 0 && (
            <ClubGate count={countDisponibili} />
          )}
          {tab === 'disponibili' && (
            <CatalogoView
              blurred={!user}
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
          photoUrl={getPhoto(qrPopup.deal?.restaurant, { w: 1200 })}
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
          photoUrl={getPhoto(infoDeal.restaurant, { w: 1200 })}
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
          photoUrl={getPhoto(qrBlocked.restaurant, { w: 1200 })}
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

function CatalogoView({ loading, blurred, drops, conv, claiming, redemptionByDealId, onClaim, onOpenQR, onCardClick, onInfo }) {
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

  // L'annuncio sta in mezzo alle convenzioni solo se l'elenco è abbastanza
  // lungo da avere un "in mezzo".
  const adInList = conv.length > LIST_AD_AFTER

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
    // O è sfocato tutto o è visibile tutto: mezze informazioni nascoste
    // lasciano il dubbio su cosa manchi, e il dubbio non fa registrare.
    <div className={blurred ? 'sc-catalogo is-blurred' : 'sc-catalogo'} aria-hidden={blurred || undefined}>
      {drops.length > 0 && (
        <DropSection
          drops={drops}
          claiming={claiming}
          redemptionByDealId={redemptionByDealId}
          onClaim={onClaim}
          onOpenQR={onOpenQR}
          onCardClick={onCardClick}
        />
      )}

      {conv.length > 0 && (
        <section className="sc-section">
          <div className="sc-section-head">
            <strong>Convenzioni</strong>
            <small>{conv.length} sempre {conv.length === 1 ? 'valida' : 'valide'}</small>
          </div>
          <div className="sc-conv-list">
            {conv.map((d, i) => (
              <Fragment key={d.id}>
                {adInList && i === LIST_AD_AFTER && (
                  <div className="sc-ad-slot"><AdSlot slot="deals_mid" /></div>
                )}
                <ConvCard
                  deal={d}
                  claiming={claiming === d.id}
                  onClaim={() => onClaim(d)}
                  onClick={() => onCardClick(d.restaurant)}
                  onInfo={() => onInfo(d)}
                />
              </Fragment>
            ))}
          </div>
        </section>
      )}

      {/* Con poche convenzioni l'annuncio va in fondo invece che in mezzo:
          occupa una riga intera e dentro una griglia ancora incompleta
          lascerebbe delle celle vuote accanto alle ultime schede. */}
      {!adInList && (
        <section className="sc-section">
          <div className="sc-ad-band"><AdSlot slot="deals_mid" /></div>
        </section>
      )}
    </div>
  )
}

/* ============================================================================
   BLOCCO 4 — Bi Club, layout adattivo per N drop contemporanei.

   Il layout cambia in base a quanti drop sono attivi; non è una griglia fissa
   che si riempie male quando i drop sono pochi.

     1 drop    → card grande a tutta larghezza
     2 drop    → due card affiancate, stessa dignità (nessuna gerarchia)
     3 o più   → griglia da tre in versione compatta
     6 o più   → paginazione, non scroll infinito: chi arriva in fondo deve
                 capire che è finito

   Su mobile sono SEMPRE impilate a tutta larghezza. Prima era uno scroll
   orizzontale con snap: un carosello nasconde le card e obbliga a trascinare
   per scoprire che esistono. Se ti viene voglia di rimettere `overflow-x`
   qui, è la stessa idea che stiamo togliendo.

   L'ordine è per scadenza (il più vicino a finire per primo) e arriva già
   ordinato da `sortByExpiry` a monte.
   ========================================================================= */

const DROPS_PER_PAGE = 6

function DropSection({ drops, claiming, redemptionByDealId, onClaim, onOpenQR, onCardClick }) {
  const [page, setPage] = useState(0)
  const pageCount = Math.ceil(drops.length / DROPS_PER_PAGE)
  const paginated = pageCount > 1
  const visible = paginated
    ? drops.slice(page * DROPS_PER_PAGE, (page + 1) * DROPS_PER_PAGE)
    : drops

  // La taglia della card segue il numero di drop TOTALI, non di quelli in
  // pagina: se cambiasse pagina per pagina le card si ridimensionerebbero
  // sotto le dita di chi naviga.
  const size = drops.length === 1 ? 'large' : 'narrow'
  const layout = drops.length === 1 ? 'single' : drops.length === 2 ? 'duo' : 'grid'

  return (
    <section className="sc-section">
      <div className="sc-section-head">
        <strong>Drop a tempo</strong>
        <small>{dropSectionSummary(drops)}</small>
      </div>

      <div className={`sc-drops sc-drops--${layout}`}>
        {visible.map((d) => {
          const redemption = redemptionByDealId?.get(d.id) || null
          const status = redemption?.status
          const isSaved = status === 'generated'
          const isUsed = status === 'redeemed'
          const busy = claiming === d.id

          let label = '🔓 Sblocca sconto'
          let action = () => onClaim(d)
          let disabled = busy
          if (busy) label = 'Un attimo…'
          else if (isUsed) { label = 'Già usato'; disabled = true; action = () => {} }
          else if (isSaved) { label = 'Apri il QR'; action = () => onOpenQR({ ...redemption, discount: d }) }

          const validityStatus = checkValidity(d)

          return (
            <DropCard
              key={d.id}
              deal={d}
              size={size}
              taken={isSaved || isUsed}
              ctaLabel={label}
              ctaDisabled={disabled}
              validityNote={validityStatus === 'valid_now' ? null : formatShortPill(d, validityStatus)}
              onUnlock={action}
              onDiscover={() => onCardClick(d.restaurant)}
            />
          )
        })}
      </div>

      {paginated && (
        <nav className="sc-drops-pager" aria-label="Pagine dei drop">
          <button
            type="button"
            className="sc-drops-pager-btn"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Precedenti
          </button>
          <span className="sc-drops-pager-count">
            {page + 1} di {pageCount}
          </span>
          <button
            type="button"
            className="sc-drops-pager-btn"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
          >
            Successivi →
          </button>
        </nav>
      )}
    </section>
  )
}

/**
 * "3 attivi · il primo scade tra 2 giorni" — il quadro prima di scorrere,
 * così chi arriva sa quanti sono e quanto tempo ha senza contare le card.
 */
function dropSectionSummary(drops) {
  const n = drops.length
  const base = `${n} ${n === 1 ? 'attivo' : 'attivi'}`
  // `drops` arriva ordinato per scadenza: il primo è il più vicino a finire.
  const ms = msUntilEnd(drops[0])
  if (ms === null || ms <= 0) return base
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return `${base} · il primo scade tra meno di un'ora`
  if (hours < 24) return `${base} · il primo scade tra ${hours} ${hours === 1 ? 'ora' : 'ore'}`
  const days = Math.round(hours / 24)
  return `${base} · il primo scade tra ${days} ${days === 1 ? 'giorno' : 'giorni'}`
}

/* ============================================================================
   BLOCCO 5 — il pannello sopra il catalogo sfocato.

   Non è un muro: dietro si vedono le card, si capisce che ci sono davvero, e
   il numero dice quante. Da qui si registra o si accede — e si torna esatta-
   mente su questa pagina, non in home.
   ========================================================================= */
function ClubGate({ count }) {
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`
  return (
    <div className="sc-club-gate">
      <div className="sc-club-gate-card">
        <span className="sc-club-gate-count">🔒 {count} {count === 1 ? 'sconto ti aspetta' : 'sconti ti aspettano'}</span>
        <h3>Entra nel Bi Club</h3>
        <p>Gratis · 20 secondi · poi mostri il QR al locale e paghi meno.</p>
        <Link to="/login" state={{ returnTo, mode: 'register' }} className="sc-btn-primary">
          Registrati gratis
        </Link>
        <Link to="/login" state={{ returnTo }} className="sc-club-gate-login">
          Ho già un account
        </Link>
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
  const isFreebie = deal?.discount_type === 'freebie' || deal?.discount_type === 'special_price'
  const badge = formatDiscountValue(deal)
  const location = r?.neighborhood || r?.city
  const priceStr = formatPrice(r?.price_range)
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
        <PhotoOrEmoji src={photo} alt={r?.name || ''} emoji={categoryEmoji(cuisine)} fallbackStyle={{ fontSize: 30 }} />
        <span className={`sc-badge-pct ${isFreebie ? 'is-freebie' : ''}`}>{badge}</span>
      </div>
      <div className="sc-body-c">
        <div className="sc-info-stack">
          <div className="sc-top-info">
            <h4>{r?.name || deal.title}</h4>
            <div className="sc-meta">
              {cuisine && <span className="sc-cat">{cuisine}</span>}
              {location && <><span className="sc-sep">|</span><span>{location}</span></>}
              {priceStr && <><span className="sc-sep">|</span><span>{priceStr}</span></>}
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
  const location = r?.neighborhood || r?.city
  const priceStr = formatPrice(r?.price_range)
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
        <PhotoOrEmoji src={photo} alt="" emoji={categoryEmoji(cuisine)} fallbackStyle={{ fontSize: 22 }} />
        {pctBadge && <span className="sc-pct-corner">{pctBadge}</span>}
      </div>
      <div className="sc-info">
        <h4>{r?.name || deal?.title || 'Ristorante'}</h4>
        <div className="sc-meta">
          {cuisine && <span className="sc-cat">{cuisine}</span>}
          {location && <><span className="sc-sep">|</span><span>{location}</span></>}
          {priceStr && <><span className="sc-sep">|</span><span>{priceStr}</span></>}
        </div>
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
  const tipoLabel = `${discountContextWord(deal)} `
  const valueLabel = formatDiscountValue(deal)
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
        <PhotoOrEmoji src={photo} alt="" emoji={categoryEmoji(cuisine)} fallbackStyle={{ fontSize: 18 }} />
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
  const isFreebie = deal?.discount_type === 'freebie' || deal?.discount_type === 'special_price'
  const badge = formatDiscountValue(deal)
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
          <PhotoOrEmoji
            src={photo}
            alt={r?.name || ''}
            emoji={categoryEmoji(cuisine)}
            imgClassName="sc-info-hero-img"
            fallbackClassName="sc-info-hero-fallback"
          />
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
          <PhotoOrEmoji
            src={photo}
            alt={r?.name || ''}
            emoji={categoryEmoji(cuisine)}
            imgClassName="sc-drop-hero-img"
            fallbackClassName="sc-drop-hero-fallback"
          />
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

