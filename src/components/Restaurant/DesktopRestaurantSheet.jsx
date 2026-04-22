import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PhotoCarousel from './PhotoCarousel'
import SaveButton from './SaveButton'
import QRCodeDisplay from '../Discount/QRCodeDisplay'
import { useAuth } from '../../lib/hooks/useAuth'
import { useActiveDiscounts, useUserRedemption } from '../../lib/hooks/useDiscounts'
import { useOrariStatus } from '../../lib/hooks/useOrariStatus'
import { useGeolocation } from '../../lib/hooks/useGeolocation'
import { PRICE_LABELS, getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { getDistance } from '../../lib/utils/distance'
import { proxyImg } from '../../lib/supabase'

const DAY_LABELS = { 0: 'Domenica', 1: 'Lunedì', 2: 'Martedì', 3: 'Mercoledì', 4: 'Giovedì', 5: 'Venerdì', 6: 'Sabato' }
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function fmtTime(h, m) { return `${String(h).padStart(2,'0')}:${String(m ?? 0).padStart(2,'0')}` }

function periodsText(periods) {
  if (!periods || !periods.length) return null
  return periods.map(p => {
    const o = p.open, c = p.close
    if (!o || !c) return null
    return `${fmtTime(o.hour, o.minute)}-${fmtTime(c.hour, c.minute)}`
  }).filter(Boolean).join(' · ')
}

export default function DesktopRestaurantSheet({
  restaurant,
  onClose,
  allRestaurants = [],
  onSelectNearby,
  saved,
  onSaveToggle,
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discounts: activeDiscounts } = useActiveDiscounts()
  const { position } = useGeolocation()
  const { data: orariData, status: orariStatus } = useOrariStatus(restaurant)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [showQR, setShowQR] = useState(false)
  const [generating, setGenerating] = useState(false)

  const discount = activeDiscounts.find(d => d.restaurant_id === restaurant?.id)
  const { redemption, generateRedemption } = useUserRedemption(discount?.id, user?.id)

  if (!restaurant) return null

  const categories = (restaurant.category || (restaurant.cuisine_type ? [restaurant.cuisine_type] : []))
    .map(n => getCategoryInfo(n)).filter(Boolean)
  const primaryCat = categories[0]
  const priceLabel = PRICE_LABELS[restaurant.price_range] || ''
  const mapsUrl = restaurant.google_maps_url || (restaurant.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}` : null)
  const phoneUrl = restaurant.phone ? `tel:${restaurant.phone.replace(/\s/g, '')}` : null
  const websiteUrl = restaurant.website || null
  const photos = restaurant.photos || []
  const photoCount = photos.length
  const openNow = orariStatus?.openNow === true
  const closesAt = orariStatus?.closesAt
  const openText = openNow
    ? (closesAt ? `Aperto ora · chiude alle ${closesAt}` : 'Aperto ora')
    : 'Chiuso ora'

  const periods = orariData?.regularOpeningHours?.periods || []
  const byDay = new Map()
  for (const p of periods) {
    const d = p.open?.day
    if (d == null) continue
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d).push(p)
  }
  const todayDow = new Date().getDay()

  const nearby = (allRestaurants || [])
    .filter(r => r.id !== restaurant.id && r.latitude && r.longitude && restaurant.latitude && restaurant.longitude)
    .map(r => ({ ...r, _dist: getDistance(restaurant.latitude, restaurant.longitude, r.latitude, r.longitude) }))
    .sort((a, b) => a._dist - b._dist)
    .slice(0, 3)

  const handleUnlock = async () => {
    if (!user) {
      navigate('/login', { state: { from: window.location.pathname, discount: true } })
      return
    }
    if (redemption) { setShowQR(true); return }
    setGenerating(true)
    try {
      const r = await generateRedemption()
      if (r) setShowQR(true)
    } finally { setGenerating(false) }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/restaurant/${restaurant.slug || restaurant.id}`
    if (navigator.share) {
      try { await navigator.share({ title: restaurant.name, url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  return (
    <Layout
      restaurant={restaurant}
      onClose={onClose}
      saved={saved}
      onSaveToggle={onSaveToggle}
      handleShare={handleShare}
      photos={photos}
      photoCount={photoCount}
      photoIndex={photoIndex}
      setPhotoIndex={setPhotoIndex}
      primaryCat={primaryCat}
      categories={categories}
      priceLabel={priceLabel}
      mapsUrl={mapsUrl}
      phoneUrl={phoneUrl}
      websiteUrl={websiteUrl}
      openNow={openNow}
      openText={openText}
      byDay={byDay}
      todayDow={todayDow}
      orariData={orariData}
      discount={discount}
      redemption={redemption}
      generating={generating}
      handleUnlock={handleUnlock}
      nearby={nearby}
      onSelectNearby={onSelectNearby}
      showQR={showQR}
      setShowQR={setShowQR}
    />
  )
}

function Layout(p) {
  return (
    <div style={{
      position: 'fixed', top: 84, left: 0, right: 0, bottom: 0, zIndex: 50,
      overflowY: 'auto', background: 'var(--color-page, #FAF7F2)',
      fontFamily: 'var(--font-sans)',
    }}>
      <style>{STYLE}</style>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 40px 120px' }}>
        <BackLink onClose={p.onClose} />
        <Hero {...p} />
        <div className="dsh-body">
          <LeftCol {...p} />
          <RightCol {...p} />
        </div>
      </div>
      {p.discount && <StickyPill {...p} />}
      <QRModal {...p} />
    </div>
  )
}

function BackLink({ onClose }) {
  return (
    <button onClick={onClose} className="dsh-back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
      </svg>
      Torna all'elenco
    </button>
  )
}

function Hero({ restaurant, photos, photoCount, photoIndex, setPhotoIndex, primaryCat, onClose, saved, onSaveToggle, handleShare }) {
  return (
    <div className="sh-hero">
      {photoCount > 0 ? (
        <PhotoCarousel
          photos={photos}
          height="520px"
          restaurantName={restaurant.name}
          city={restaurant.city}
          dotsPosition="center"
          showArrows
          onIndexChange={setPhotoIndex}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: '#ddd', display: 'grid', placeItems: 'center', fontSize: 64 }}>
          {primaryCat?.emoji || '🍽️'}
        </div>
      )}
      <div className="sh-hero-actions">
        <button onClick={onClose} title="Indietro" aria-label="Indietro">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <button onClick={handleShare} title="Condividi" aria-label="Condividi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <path d="m8.6 13.5 6.8 3.9M15.4 6.6 8.6 10.5"/>
          </svg>
        </button>
        <button onClick={onSaveToggle} title={saved ? 'Rimuovi dai salvati' : 'Salva'} className={saved ? 'on' : ''} aria-label="Salva">
          <svg viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
      <div className="sh-hero-meta">
        <div>{primaryCat && <div className="kic">{primaryCat.emoji} {primaryCat.name}</div>}</div>
        {photoCount > 1 && <span className="ph-cnt">📷 {photoIndex + 1} / {photoCount}</span>}
      </div>
    </div>
  )
}

function LeftCol({ restaurant, categories, priceLabel, openNow, openText, mapsUrl, phoneUrl, websiteUrl, discount, handleUnlock, generating, redemption }) {
  const reviewText = restaurant.our_review || ''
  const tipTitle = restaurant.our_tagline || null
  const tipText = restaurant.our_tip || null
  const address = [restaurant.address, restaurant.city].filter(Boolean).join(', ')
  const neighborhood = restaurant.neighborhood
  const moment = restaurant.moment || null
  const discountLabel = discount?.discount_value || discount?.title || null
  const discountDesc = discount?.description || null

  return (
    <div className="sh-left">
      <h1>{restaurant.name}</h1>
      {address && (
        <div className="addr">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          {address}{neighborhood ? ` · ${neighborhood}` : ''}
        </div>
      )}

      <div className="chips">
        {categories[0] && <span className="chip cat">{categories[0].emoji} {categories[0].name}</span>}
        {priceLabel && <span className="chip price">{priceLabel}</span>}
        {moment && <span className="chip moment">{moment}</span>}
        {openNow !== undefined && (
          <span className={openNow ? 'chip open' : 'chip closed'}>
            <span className="d" />{openText}
          </span>
        )}
      </div>

      <div className="sh-ctas">
        {mapsUrl && (
          <a className="main" href={mapsUrl} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            Indicazioni
          </a>
        )}
        {phoneUrl && (
          <a className="ico" href={phoneUrl} title="Chiama" aria-label="Chiama">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </a>
        )}
        {websiteUrl && (
          <a className="ico" href={websiteUrl} target="_blank" rel="noopener noreferrer" title="Sito web" aria-label="Sito web">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>
            </svg>
          </a>
        )}
      </div>

      {discount && (
        <div className="scsh-banner">
          <div>
            <div className="kick">Sconto attivo per te</div>
            <div className="t">{discountLabel}{discountDesc ? ` · ${discountDesc}` : ''}</div>
          </div>
          <button className="cta" onClick={handleUnlock} disabled={generating}>
            {generating ? '…' : (redemption ? 'Mostra QR →' : 'Usa sconto →')}
          </button>
        </div>
      )}

      {reviewText && (
        <div className="sh-section">
          <h3>Secondo Bi</h3>
          {reviewText.split(/\n\n+/).map((para, i) => (
            <p key={i} style={{ marginTop: i === 0 ? 0 : 14 }}>{para}</p>
          ))}
        </div>
      )}

      {(tipText || tipTitle) && (
        <div className="sh-oro">
          <span className="kick">Cosa ti consiglio di prendere</span>
          {tipTitle && <h3>{tipTitle}</h3>}
          {tipText && <p>{tipText}</p>}
        </div>
      )}
    </div>
  )
}
function RightCol({ restaurant, openNow, byDay, todayDow, orariData, nearby, onSelectNearby }) {
  const hasOrari = orariData && byDay.size > 0

  return (
    <div className="sh-side">
      {hasOrari && (
        <div className="side-card">
          <div className={openNow ? 'open-badge' : 'open-badge closed'}>
            <span className="d" />{openNow ? 'Aperto ora' : 'Chiuso ora'}
          </div>
          <h4>Orari</h4>
          <div className="hours-list">
            {DAY_ORDER.map(dow => {
              const dayPeriods = byDay.get(dow) || []
              const isToday = dow === todayDow
              const label = dayPeriods.length === 0 ? 'Chiuso' : periodsText(dayPeriods)
              const dayName = DAY_LABELS[dow] + (isToday ? ' (oggi)' : '')
              return (
                <div key={dow} className={`row${isToday ? ' today' : ''}`}>
                  <span>{dayName}</span>
                  <span className={dayPeriods.length === 0 ? 'closed' : ''}>{label}</span>
                </div>
              )
            })}
          </div>
          <div className="hours-foot">Fonte: Google Places · aggiornato in automatico</div>
        </div>
      )}

      <div className="bi-card">
        <div className="bh">
          <div className="bavatar">B</div>
          <div>
            <div className="bname">Ciao, sono Bi</div>
            <div className="bsub">La tua guida a Torino</div>
          </div>
        </div>
        <p>Non sono una guida scritta a tavolino. Sono un'amica che ha mangiato in tutti questi posti e ti dice dove andare, cosa ordinare e cosa evitare — senza stelle, senza classifiche, senza sponsor.</p>
        <a className="blink" href="/about">Scopri di più →</a>
      </div>

      {nearby.length > 0 && (
        <div className="vicini">
          <h4>Ristoranti vicini</h4>
          <div className="vicini-list">
            {nearby.map(n => {
              const nCat = ((n.category || [])[0] || n.cuisine_type)
              const nCatInfo = nCat ? getCategoryInfo(nCat) : null
              const photo = Array.isArray(n.photos) && n.photos.length > 0
                ? (typeof n.photos[0] === 'string' ? n.photos[0] : (n.photos[0]?.thumb_url || n.photos[0]?.photo_url))
                : null
              return (
                <button key={n.id} className="vicard" onClick={() => onSelectNearby?.(n)}>
                  <div className="vph">
                    {photo ? <img src={proxyImg(photo)} alt={n.name} loading="lazy" /> : <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', fontSize: 20 }}>{nCatInfo?.emoji || '🍽️'}</div>}
                  </div>
                  <div>
                    <div className="vname">{n.name}</div>
                    <div className="vmeta">
                      {nCatInfo && <span className="vcat">{nCatInfo.emoji} {nCatInfo.name}</span>}
                      {n._dist != null && <span>{n._dist < 1 ? `${Math.round(n._dist * 1000)} m` : `${n._dist.toFixed(1)} km`}</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
function StickyPill({ discount, handleUnlock, generating, redemption }) {
  const label = discount?.discount_value || discount?.title || 'Sconto attivo'
  const desc = discount?.description || 'Sempre valido · scheda aggiornata da Bi'
  return (
    <div className="dsk-sticky-disc">
      <div className="lead">
        <span className="t"><span className="dot" />{label}</span>
        <span className="s">{desc}</span>
      </div>
      <button className="cta" onClick={handleUnlock} disabled={generating}>
        {generating ? '…' : (redemption ? 'Mostra QR' : 'Usa sconto')}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
  )
}

function QRModal({ showQR, setShowQR, discount, redemption, restaurant }) {
  if (!showQR || !redemption || !discount) return null
  return (
    <QRCodeDisplay
      redemption={redemption}
      restaurantName={restaurant.name}
      discountTitle={discount.title}
      discountValue={discount.discount_value}
      onClose={() => setShowQR(false)}
    />
  )
}
const STYLE = `
.dsh-back{display:inline-flex;align-items:center;gap:6px;background:transparent;border:0;cursor:pointer;color:var(--color-ink-70,rgba(34,24,28,.7));font-family:var(--font-sans);font-size:13px;font-weight:700;letter-spacing:-.01em;padding:6px 10px 6px 6px;margin-bottom:14px}
.dsh-back:hover{color:var(--color-ink,#22181C)}
.sh-hero{position:relative;height:520px;border-radius:28px;overflow:hidden;margin-bottom:28px;background:#ddd}
.sh-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25) 0%,transparent 30%,transparent 70%,rgba(0,0,0,.6) 100%);pointer-events:none;z-index:2}
.sh-hero-actions{position:absolute;top:20px;right:24px;display:flex;gap:10px;z-index:3}
.sh-hero-actions button{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:0;display:grid;place-items:center;cursor:pointer;color:var(--color-ink,#22181C)}
.sh-hero-actions button svg{width:18px;height:18px}
.sh-hero-actions .on{background:var(--color-corallo,#E8453C);color:#fff}
.sh-hero-meta{position:absolute;left:32px;bottom:24px;right:32px;color:#fff;z-index:3;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
.sh-hero-meta .kic{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.92);margin-bottom:0}
.sh-hero-meta .ph-cnt{background:rgba(0,0,0,.5);padding:5px 12px;border-radius:999px;font-size:11.5px;font-weight:700;color:#fff}

.dsh-body{display:grid;grid-template-columns:1.4fr 1fr;gap:40px;align-items:start}
.sh-left h1{font-family:var(--font-sans);font-weight:900;font-size:52px;letter-spacing:-.035em;line-height:1;color:var(--color-ink,#22181C);margin:0 0 10px}
.sh-left .addr{font-size:14px;color:var(--color-ink-70,rgba(34,24,28,.7));display:flex;align-items:center;gap:6px;margin-bottom:18px}
.sh-left .chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
.sh-left .chip{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:700}
.sh-left .chip.cat{border:1.5px solid var(--color-corallo,#E8453C);color:var(--color-corallo-ink,#C6372F);background:#fff}
.sh-left .chip.price{background:var(--color-ink-05,rgba(34,24,28,.06));color:var(--color-ink,#22181C)}
.sh-left .chip.moment{background:var(--color-oro-soft,#F4E7CC);color:var(--color-oro-deep,#8E6B3E)}
.sh-left .chip.open{background:#E5F3EA;color:#2E7D5B}
.sh-left .chip.open .d{width:6px;height:6px;border-radius:50%;background:#2E7D5B}
.sh-left .chip.closed{background:var(--color-ink-05,rgba(34,24,28,.06));color:var(--color-ink-70,rgba(34,24,28,.7))}
.sh-left .chip.closed .d{width:6px;height:6px;border-radius:50%;background:#9a8e84}

.sh-ctas{display:flex;gap:10px;margin-bottom:28px}
.sh-ctas .main{flex:1;padding:16px 22px;background:var(--color-beige-cta,#F2EDE1);border:0;border-radius:16px;font-weight:800;font-size:14.5px;color:var(--color-ink,#22181C);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;text-decoration:none;font-family:var(--font-sans)}
.sh-ctas .main:hover{background:var(--color-beige-cta-hover,#EADFCB)}
.sh-ctas .main svg{width:18px;height:18px}
.sh-ctas .ico{width:54px;height:54px;border-radius:16px;background:#fff;border:1px solid var(--color-ink-15,rgba(34,24,28,.15));display:grid;place-items:center;cursor:pointer;color:var(--color-ink,#22181C);text-decoration:none}
.sh-ctas .ico:hover{background:var(--color-ink-05,rgba(34,24,28,.06))}
.sh-ctas .ico svg{width:18px;height:18px}

.scsh-banner{margin:0 0 22px;background:linear-gradient(135deg,#A3E635,#4ADE80);border-radius:18px;padding:16px 22px;display:flex;justify-content:space-between;align-items:center;gap:14px;color:var(--color-ink,#22181C)}
.scsh-banner .kick{font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(34,24,28,.7);margin-bottom:4px}
.scsh-banner .t{font-weight:800;font-size:15.5px;letter-spacing:-.01em}
.scsh-banner .cta{background:var(--color-ink,#22181C);color:#fff;padding:8px 16px;border-radius:999px;font-weight:800;font-size:12.5px;border:0;cursor:pointer;white-space:nowrap;font-family:var(--font-sans)}
.scsh-banner .cta:hover{background:#000}

.sh-section{margin-top:22px}
.sh-section h3{font-family:var(--font-sans);font-weight:900;font-size:19px;letter-spacing:-.02em;color:var(--color-ink,#22181C);margin:0 0 10px}
.sh-section p{font-family:var(--font-sans);font-weight:500;font-size:15px;line-height:1.7;color:var(--color-ink,#22181C);margin:0}

.sh-oro{background:linear-gradient(135deg,var(--color-oro,#B08954) 0%,var(--color-oro-deep,#8E6B3E) 100%);color:#fff;border-radius:20px;padding:24px 26px;margin-top:22px}
.sh-oro .kick{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.82);display:inline-flex;gap:8px;align-items:center}
.sh-oro .kick::before{content:"🍴";font-size:14px}
.sh-oro h3{font-family:var(--font-sans);font-weight:900;font-size:22px;letter-spacing:-.02em;margin:8px 0 10px;color:#fff}
.sh-oro p{font-family:var(--font-editorial,'Caveat',cursive);font-size:22px;line-height:1.35;color:#fff;margin:0}

.sh-side .side-card{background:#fff;border:1px solid var(--color-ink-05,rgba(34,24,28,.06));border-radius:20px;padding:22px;margin-bottom:18px;box-shadow:0 1px 3px rgba(34,24,28,.04)}
.sh-side .side-card h4{font-family:var(--font-sans);font-weight:900;font-size:15px;letter-spacing:-.01em;margin:0 0 10px;color:var(--color-ink,#22181C)}
.open-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;background:#E5F3EA;color:#2E7D5B;border-radius:999px;font-size:11.5px;font-weight:800;margin-bottom:10px}
.open-badge .d{width:6px;height:6px;border-radius:50%;background:#2E7D5B}
.open-badge.closed{background:var(--color-ink-05,rgba(34,24,28,.06));color:var(--color-ink-70,rgba(34,24,28,.7))}
.open-badge.closed .d{background:#9a8e84}
.hours-list{font-size:13.5px;color:var(--color-ink,#22181C);line-height:1.9}
.hours-list .row{display:flex;justify-content:space-between;padding:3px 0;gap:12px}
.hours-list .row.today{font-weight:800;color:var(--color-ink,#22181C)}
.hours-list .row .closed{color:rgba(34,24,28,.4)}
.hours-foot{margin-top:10px;font-size:11px;color:rgba(34,24,28,.4)}

.bi-card{background:var(--color-cream-deep,#F1EBE0);border-radius:20px;padding:22px;border:1px solid var(--color-ink-05,rgba(34,24,28,.06));margin-bottom:18px}
.bi-card .bh{display:flex;gap:12px;align-items:center;margin-bottom:10px}
.bi-card .bavatar{width:48px;height:48px;border-radius:50%;background:var(--color-corallo,#E8453C);color:#fff;font-family:var(--font-wordmark,'Alfa Slab One',serif);display:grid;place-items:center;font-size:22px}
.bi-card .bname{font-family:var(--font-sans);font-weight:900;font-size:16px;letter-spacing:-.02em;color:var(--color-ink,#22181C)}
.bi-card .bsub{font-size:11.5px;color:var(--color-ink-70,rgba(34,24,28,.7));margin-top:2px}
.bi-card p{font-family:var(--font-sans);font-size:13px;color:var(--color-ink,#22181C);line-height:1.55;margin:0 0 10px}
.bi-card .blink{display:inline-flex;align-items:center;gap:4px;font-weight:800;font-size:12.5px;color:var(--color-corallo-ink,#C6372F);text-decoration:none}

.vicini h4{font-family:var(--font-sans);font-weight:900;font-size:15px;letter-spacing:-.02em;margin:0 0 12px;color:var(--color-ink,#22181C)}
.vicini-list{display:flex;flex-direction:column;gap:10px}
.vicard{display:grid;grid-template-columns:56px 1fr;gap:10px;padding:10px;background:#fff;border:1px solid var(--color-ink-05,rgba(34,24,28,.06));border-radius:14px;cursor:pointer;text-align:left;font-family:var(--font-sans)}
.vicard:hover{border-color:var(--color-ink-15,rgba(34,24,28,.15))}
.vicard .vph{aspect-ratio:1/1;background:#ddd;border-radius:10px;overflow:hidden}
.vicard .vph img{width:100%;height:100%;object-fit:cover}
.vicard .vname{font-family:var(--font-sans);font-weight:800;font-size:14px;letter-spacing:-.02em;line-height:1.15;color:var(--color-ink,#22181C)}
.vicard .vmeta{font-size:10.5px;color:var(--color-ink-70,rgba(34,24,28,.7));margin-top:3px;display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.vicard .vcat{padding:2px 6px;background:var(--color-corallo-soft,#F6B7B1);color:var(--color-corallo-ink,#C6372F);border-radius:999px;font-size:9.5px;font-weight:700}

.dsk-sticky-disc{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:60;min-width:460px;max-width:640px;background:rgba(250,247,242,.9);backdrop-filter:saturate(140%) blur(14px);-webkit-backdrop-filter:saturate(140%) blur(14px);border:1px solid var(--color-ink-05,rgba(34,24,28,.06));border-radius:999px;padding:8px 10px 8px 22px;display:flex;align-items:center;gap:18px;box-shadow:0 10px 40px rgba(34,24,28,.14),0 2px 8px rgba(34,24,28,.06)}
.dsk-sticky-disc .lead{display:flex;flex-direction:column;line-height:1.1;flex:1;min-width:0}
.dsk-sticky-disc .t{font-family:var(--font-sans);font-weight:900;font-size:16px;letter-spacing:-.01em;color:var(--color-ink,#22181C);display:flex;align-items:center;gap:10px}
.dsk-sticky-disc .t .dot{width:9px;height:9px;border-radius:50%;background:linear-gradient(135deg,#A3E635,#4ADE80);box-shadow:0 0 0 3px rgba(163,230,53,.18);flex-shrink:0}
.dsk-sticky-disc .s{font-family:var(--font-sans);font-size:11.5px;font-weight:700;color:var(--color-ink-70,rgba(34,24,28,.7));margin-top:4px;letter-spacing:.01em}
.dsk-sticky-disc .cta{display:inline-flex;align-items:center;gap:8px;background:var(--color-ink,#22181C);color:#fff;height:42px;padding:0 20px;border-radius:999px;font-family:var(--font-sans);font-weight:800;font-size:13.5px;letter-spacing:-.01em;transition:background .15s ease,transform .15s ease;white-space:nowrap;border:0;cursor:pointer}
.dsk-sticky-disc .cta:hover{background:#000;transform:translateY(-1px)}
.dsk-sticky-disc .cta svg{width:14px;height:14px}
`
