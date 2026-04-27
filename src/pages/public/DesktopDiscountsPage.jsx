import { useState, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Footer from '../../components/Layout/Footer'
import { useAuth } from '../../lib/hooks/useAuth'
import { useActiveDiscounts, useMyDiscounts } from '../../lib/hooks/useDiscounts'
import { getCategoryInfo } from '../../lib/hooks/useRestaurants'
import { proxyImg } from '../../lib/supabase'

function slugify(name) {
  return name.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function getPhoto(restaurant) {
  const p = restaurant?.photos?.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))?.[0]
  return proxyImg(p?.thumb_url || p?.photo_url || null)
}

function useCountdown(targetDate) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!targetDate) { setLabel(''); return }
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) { setLabel('Scaduto'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setLabel(d > 0 ? `⏱ ${d}g ${h}h` : `⏱ ${h}h ${m}m`)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [targetDate])
  return label
}

function DropCard({ deal, onClick }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const timer = useCountdown(deal.drop_ends_at || deal.valid_until)
  const cats = r?.category || (r?.cuisine_type ? [r.cuisine_type] : [])
  const catInfo = getCategoryInfo(cats[0])
  const claimed = deal.claimed_count || 0
  const max = deal.max_quantity || 0
  const progressPct = max > 0 ? Math.min(100, Math.round((claimed / max) * 100)) : 50

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(deal)}
      style={{
        background: '#fff', border: '2px solid var(--color-corallo)',
        borderRadius: 20, overflow: 'hidden', cursor: 'pointer',
        transition: 'transform .2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = '' }}
    >
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg,var(--color-corallo) 0%,#D63A31 100%)',
        color: '#fff', padding: '14px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: '-0.01em' }}>{deal.title}</span>
        {timer && (
          <span style={{
            fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
            background: 'rgba(0,0,0,.18)', padding: '4px 9px', borderRadius: 999,
          }}>{timer}</span>
        )}
      </div>
      {/* Progress */}
      <div style={{ height: 4, background: 'var(--color-corallo-soft)' }}>
        <div style={{ height: '100%', background: 'var(--color-corallo)', width: `${progressPct}%`, transition: 'width .4s' }} />
      </div>
      {/* Body */}
      <div style={{ padding: '14px 18px 16px', display: 'grid', gridTemplateColumns: '72px 1fr', gap: 12 }}>
        <div style={{ aspectRatio: '1/1', background: '#ddd', borderRadius: 12, overflow: 'hidden' }}>
          {photo
            ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            : <div style={{ width: '100%', height: '100%', background: '#E8E5DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{catInfo.emoji}</div>
          }
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{r?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 4 }}>
            {catInfo.emoji} {catInfo.name}{r?.address ? ` · ${r.address.split(',')[0]}` : ''}
          </div>
          {max > 0 && (
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-corallo-ink)', marginTop: 6 }}>
              {claimed} su {max} sbloccati
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DiscountCard({ deal, isUsed, redemptionDate, onClick }) {
  const r = deal.restaurant
  const photo = getPhoto(r)
  const cats = r?.category || (r?.cuisine_type ? [r.cuisine_type] : [])
  const catInfo = getCategoryInfo(cats[0])

  const discountText = (() => {
    const v = String(deal.discount_value || '').replace(/[%€]/g, '')
    const isNum = /^\d+(\.\d+)?$/.test(v)
    if (!isNum) return deal.discount_value || deal.title
    return deal.discount_type === 'percentage' ? `-${v}% sul totale` : `-${v}€`
  })()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !isUsed && onClick(deal)}
      style={{
        background: '#fff', borderRadius: 20, overflow: 'hidden',
        border: '1px solid var(--color-ink-05)',
        boxShadow: '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)',
        cursor: isUsed ? 'default' : 'pointer',
        transition: 'transform .2s, box-shadow .2s',
        display: 'flex', flexDirection: 'column',
        opacity: isUsed ? .55 : 1,
        filter: isUsed ? 'grayscale(.2)' : 'none',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!isUsed) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(34,24,28,.08)' } }}
      onMouseLeave={e => { if (!isUsed) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 2px rgba(34,24,28,.04),0 4px 12px rgba(34,24,28,.04)' } }}
    >
      {isUsed && (
        <span style={{
          position: 'absolute', top: 10, right: 10, zIndex: 2,
          background: 'var(--color-ink)', color: '#fff',
          padding: '4px 10px', borderRadius: 999,
          fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em',
          display: 'inline-flex', gap: 4, alignItems: 'center',
        }}>✓ GIÀ USATO</span>
      )}
      {/* Green banner */}
      <div style={{
        background: 'linear-gradient(135deg,#A3E635,#4ADE80)', color: 'var(--color-ink)',
        padding: '13px 16px', fontWeight: 800, fontSize: 15,
        letterSpacing: '-0.01em', textAlign: 'center',
        filter: isUsed ? 'grayscale(.2)' : 'none', opacity: isUsed ? .85 : 1,
      }}>
        {deal.title || discountText}
      </div>
      {/* Photo */}
      <div style={{ aspectRatio: '16/9', background: '#ddd', overflow: 'hidden', filter: isUsed ? 'grayscale(.6)' : 'none' }}>
        {photo
          ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          : <div style={{ width: '100%', height: '100%', background: '#E8E5DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>{catInfo.emoji}</div>
        }
      </div>
      {/* Body */}
      <div style={{ padding: '14px 16px 16px', opacity: isUsed ? .65 : 1 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {r?.name}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--color-ink-70)', marginTop: 4 }}>
          {isUsed && redemptionDate
            ? `Usato il ${new Date(redemptionDate).toLocaleDateString('it-IT')}`
            : deal.conditions || 'Sempre valido'}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ padding: '3px 8px', background: 'var(--color-corallo-soft)', color: 'var(--color-corallo-ink)', borderRadius: 999, fontSize: 10.5, fontWeight: 700 }}>
            {catInfo.emoji} {catInfo.name}
          </span>
          {r?.price_range && (
            <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--color-ink-70)' }}>{'€'.repeat(r.price_range)}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DesktopDiscountsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('available')

  const { activeDrops, regular, featured, loading } = useActiveDiscounts()
  const { active: myActive, used: myUsed, loading: myLoading } = useMyDiscounts(user?.id)

  const allAvailable = [...(featured || []), ...(regular || [])]
  const drops = activeDrops || []

  const handleDiscountClick = useCallback((deal) => {
    const r = deal.restaurant
    if (!r) return
    if (!user) { navigate('/login'); return }
    navigate(`/restaurant/${r.slug || slugify(r.name)}`)
  }, [navigate, user])

  const expiryDate = drops[0]?.drop_ends_at
  const expiryLabel = expiryDate
    ? `Scade ${new Date(expiryDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'numeric' })}`
    : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, maxWidth: 1280, width: '100%', margin: '0 auto', padding: '24px 40px 0' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontWeight: 900, fontSize: 32, letterSpacing: '-0.025em', margin: 0 }}>
              Sconti a Torino
            </h1>
            <div style={{ color: 'var(--color-ink-70)', fontSize: 13.5, marginTop: 4 }}>
              Drop esclusivi, convenzioni sempre valide, e i tuoi sconti salvati.
            </div>
          </div>
          {/* Segmented tabs */}
          <div style={{ display: 'inline-flex', background: 'var(--color-ink-05)', padding: 4, borderRadius: 999, gap: 2 }}>
            {[
              { id: 'available', label: 'Disponibili' },
              { id: 'mine', label: user ? `I miei ${myUsed.length + myActive.length > 0 ? `(${myUsed.length + myActive.length})` : ''}` : 'I miei' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { if (tab.id === 'mine' && !user) { navigate('/login'); return } setActiveTab(tab.id) }}
                style={{
                  padding: '10px 20px', borderRadius: 999, border: 0,
                  fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
                  color: activeTab === tab.id ? '#fff' : 'var(--color-ink-70)',
                  background: activeTab === tab.id ? 'var(--color-ink)' : 'transparent',
                  transition: 'all .2s',
                }}
              >{tab.label}</button>
            ))}
          </div>
        </div>

        {activeTab === 'available' && (
          <>
            {/* Drop della settimana */}
            {drops.length > 0 && (
              <div style={{ margin: '24px 0 40px', paddingBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em', margin: 0 }}>🔥 Drop della settimana</h2>
                  {expiryLabel && (
                    <div style={{ fontSize: 12, color: 'var(--color-ink-70)', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span>Scade <strong>{expiryLabel.replace('Scade ', '')}</strong></span>
                      <span>·</span>
                      <span>Solo per membri</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(drops.length, 3)}, 1fr)`, gap: 18 }}>
                  {drops.slice(0, 3).map(d => (
                    <DropCard key={d.id} deal={d} onClick={handleDiscountClick} />
                  ))}
                </div>
              </div>
            )}

            {/* Sconti disponibili */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '14px 0 18px' }}>
              <h2 style={{ fontWeight: 900, fontSize: 24, letterSpacing: '-0.02em', margin: 0 }}>Sconti disponibili</h2>
              {allAvailable.length > 0 && (
                <span style={{ fontSize: 12.5, color: 'var(--color-ink-70)' }}>
                  {allAvailable.length} convenzioni attive · sempre valide
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ background: '#fff', borderRadius: 20, height: 280, border: '1px solid var(--color-ink-05)', opacity: .5 }} />
                ))}
              </div>
            ) : allAvailable.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-ink-70)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎟️</div>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Nessuno sconto disponibile al momento</div>
                <div style={{ fontSize: 14 }}>Torna presto — nuove convenzioni vengono aggiunte regolarmente.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {allAvailable.map(d => (
                  <DiscountCard key={d.id} deal={d} isUsed={false} onClick={handleDiscountClick} />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'mine' && user && (
          <>
            {(myActive.length === 0 && myUsed.length === 0 && !myLoading) ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--color-ink-70)' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🎟️</div>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Non hai ancora usato nessuno sconto</div>
                <div style={{ fontSize: 14, marginBottom: 24 }}>Esplora i locali e trova le convenzioni attive.</div>
                <button
                  onClick={() => setActiveTab('available')}
                  style={{
                    padding: '12px 28px', borderRadius: 999,
                    background: 'var(--color-ink)', color: '#fff',
                    fontWeight: 800, fontSize: 14, border: 0, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >Vedi sconti disponibili</button>
              </div>
            ) : (
              <>
                {myActive.length > 0 && (
                  <>
                    <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em', margin: '0 0 16px' }}>Sconti attivi</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 36 }}>
                      {myActive.map(r => (
                        <DiscountCard key={r.id} deal={r.discount} isUsed={false} onClick={handleDiscountClick} />
                      ))}
                    </div>
                  </>
                )}
                {myUsed.length > 0 && (
                  <>
                    <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em', margin: '0 0 16px' }}>Già usati</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                      {myUsed.map(r => (
                        <DiscountCard
                          key={r.id}
                          deal={r.discount}
                          isUsed
                          redemptionDate={r.redeemed_at || r.generated_at}
                          onClick={handleDiscountClick}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}
