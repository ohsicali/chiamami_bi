import { useState, useEffect, cloneElement, lazy, Suspense } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import Footer from '../../components/Layout/Footer'
import MobileLogoHeader from '../../components/Layout/MobileLogoHeader'
import SuggestRestaurantSheet from '../../components/Restaurant/SuggestRestaurantSheet'
import CityPickerSheet from '../../components/UI/CityPickerSheet'
import { useCity } from '../../lib/CityContext'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'
import { PageLoader } from '../../components/UI/LoadingSpinner'

// Caricata solo su desktop: da telefono questo codice non viene scaricato.
const DesktopProfilePage = lazy(() => import('./DesktopProfilePage'))

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { savedIds } = useSavedRestaurants(user?.id)
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ savedCount: 0, redemptionsCount: 0, totalSaved: 0, visitedCount: 0 })
  const [showSuggest, setShowSuggest] = useState(false)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [newsletterEnabled, setNewsletterEnabled] = useState(false)
  const [loadingNewsletter, setLoadingNewsletter] = useState(true)
  const { city: currentCity } = useCity()
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (!user?.id) return

    // Fetch profile
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data) })

    // Fetch stats
    supabase.from('discount_redemptions').select('id, discount:discounts(discount_value, restaurant_id)', { count: 'exact' }).eq('user_id', user.id).eq('status', 'redeemed')
      .then((redemptions) => {
        const redeemed = redemptions.data || []
        const totalSaved = redeemed.reduce((sum, r) => {
          const val = r.discount?.discount_value
          return sum + (typeof val === 'number' ? val : 0)
        }, 0)
        const distinctRestaurants = new Set(redeemed.map(r => r.discount?.restaurant_id).filter(Boolean))
        setStats({
          savedCount: savedIds.size,
          redemptionsCount: redemptions.count || 0,
          totalSaved,
          visitedCount: distinctRestaurants.size,
        })
      })
  }, [user?.id, savedIds.size])

  // Newsletter status
  useEffect(() => {
    if (!user?.email || !isSupabaseConfigured()) { setLoadingNewsletter(false); return }
    supabase.from('newsletter_subscribers').select('id').eq('email', user.email).single()
      .then(({ data }) => { setNewsletterEnabled(!!data); setLoadingNewsletter(false) })
  }, [user?.email])

  const handleToggleNewsletter = async () => {
    const newState = !newsletterEnabled
    setNewsletterEnabled(newState)
    if (newState) { await supabase.from('newsletter_subscribers').upsert({ email: user.email, source: 'profile_toggle' }, { onConflict: 'email' }) }
    else { await supabase.from('newsletter_subscribers').delete().eq('email', user.email) }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const handleShare = async () => {
    const shareData = {
      title: 'La Guida di Bi',
      text: 'Scopri i migliori ristoranti di Torino con La Guida di Bi!',
      url: 'https://chiamamibi.com',
    }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch {}
    } else {
      await navigator.clipboard.writeText(shareData.url)
      alert('Link copiato!')
    }
  }

  if (!authLoading && !user) return <Navigate to="/login" replace />
  if (isDesktop) return <Suspense fallback={<PageLoader />}><DesktopProfilePage /></Suspense>

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const email = user?.email || ''
  const initial = (displayName || '?').charAt(0).toUpperCase()
  const createdAt = profile?.created_at ? new Date(profile.created_at) : (user?.created_at ? new Date(user.created_at) : new Date())
  const memberSince = createdAt.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  // ── Mobile v4 layout — match docs/mockups/v4-mobile-pagine.html §Profilo ──
  if (!isDesktop) {
    return (
      <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-bg)', overflowX: 'hidden' }}>
        <MobileLogoHeader />
        {/* ── Top bar: titolo "Profilo" + ico-btn impostazioni ── */}
        <div style={{
          padding: '10px 20px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--color-page)',
        }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22,
            letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--color-ink)',
          }}>
            Profilo
          </div>
          <button
            onClick={() => navigate('/settings')}
            aria-label="Impostazioni"
            style={{
              marginLeft: 'auto', width: 40, height: 40, borderRadius: '50%',
              background: 'var(--color-ink-05)', display: 'grid', placeItems: 'center',
              border: 0, cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* ── pf-head: avatar gradient + nome + città + Modifica profilo ── */}
        <div style={{
          textAlign: 'center', padding: '16px 20px 12px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: 'linear-gradient(135deg, #F4E7CC, #E8453C)',
            display: 'grid', placeItems: 'center', color: '#fff',
            fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 32,
            letterSpacing: '-0.02em', lineHeight: 1,
            boxShadow: '0 8px 24px rgba(34,24,28,.08)',
            border: '3px solid #fff', marginBottom: 6,
          }}>{initial}</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
            {displayName || 'Profilo'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-ink-70)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-corallo)' }} />
            {currentCity.name}
          </div>
          <button
            onClick={() => navigate('/settings')}
            style={{
              marginTop: 6, padding: '7px 14px', background: 'var(--color-ink-05)',
              borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'var(--color-ink)',
              border: 0, cursor: 'pointer',
            }}
          >Modifica profilo</button>
        </div>

        {/* ── pf-stats: 3-col Salvati / Sconti usati / Visitati ── */}
        <div style={{ margin: '14px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { num: stats.savedCount, lbl: 'Salvati', onClick: () => navigate('/saved') },
            { num: stats.redemptionsCount, lbl: 'Sconti usati', accent: true, onClick: () => navigate('/deals', { state: { tab: 'mine' } }) },
            { num: stats.visitedCount, lbl: 'Visitati', onClick: null },
          ].map((s, i) => (
            <button
              key={i}
              onClick={s.onClick || undefined}
              disabled={!s.onClick}
              style={{
                background: '#fff', border: '1px solid var(--color-ink-05)',
                borderRadius: 14, padding: '14px 10px', textAlign: 'center',
                cursor: s.onClick ? 'pointer' : 'default',
              }}
            >
              <div style={{
                fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 22,
                letterSpacing: '-0.02em', lineHeight: 1,
                color: s.accent ? 'var(--color-corallo-ink)' : 'var(--color-ink)',
              }}>{s.num}</div>
              <div style={{
                fontSize: 10.5, color: 'var(--color-ink-70)', marginTop: 5,
                fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
              }}>{s.lbl}</div>
            </button>
          ))}
        </div>

        {/* ── pf-quote: editorial Caveat (bio Bi) ── */}
        <div style={{
          margin: '16px 16px 0', padding: '16px 18px',
          background: 'var(--color-oro-soft, #F4E7CC)',
          border: '1px solid rgba(176,137,84,.3)', borderRadius: 14,
        }}>
          <div style={{ fontFamily: 'var(--font-hand, "Caveat", cursive)', fontSize: 19, lineHeight: 1.25, color: 'var(--color-ink)' }}>
            "Bi sceglie i posti come li sceglierei io: per come si mangia, non per quante stelle hanno."
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 6, fontWeight: 700 }}>
            — dalla bio di Bi
          </div>
        </div>

        {/* ── SEC: Il mio account ── */}
        <PfSec>Il mio account</PfSec>
        <PfList>
          <PfItem
            onClick={() => navigate('/profile/chat')}
            icVariant="cor"
            icon={<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
            label="Le mie conversazioni con Bi"
            sub="Storia chat AI · suggerimenti personali"
          />
          <PfItem
            onClick={() => navigate('/profile/preferences')}
            icVariant="oro"
            icon={<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>}
            label="Le mie preferenze per Bi"
            sub="Dieta · zone · budget · note libere"
          />
        </PfList>

        {/* ── SEC: Contribuisci ── */}
        <PfSec>Contribuisci</PfSec>
        <PfList>
          <PfItem
            onClick={() => setShowSuggest(true)}
            icVariant="cor"
            icon={<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>}
            label="Suggerisci un locale"
            sub="Bi ci va a mangiare. Se è buono, entra."
          />
          <PfItem
            onClick={() => navigate('/partner')}
            icVariant="oro"
            icon={<svg viewBox="0 0 24 24"><path d="M3 9h18M3 15h18M8 3v18M16 3v18"/></svg>}
            label="Per i locali"
            sub="Vuoi lanciare un drop?"
          />
        </PfList>

        {/* ── SEC: Altro ── */}
        <PfSec>Altro</PfSec>
        <PfList>
          <PfItem
            onClick={() => navigate('/about')}
            icon={<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>}
            label="Come scelgo i locali"
          />
          <PfItem
            onClick={() => { window.location.href = 'mailto:hello@chiamamibi.com' }}
            icon={<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 4l8 8 8-8"/></svg>}
            label="Contatti"
          />
          <PfItem
            onClick={() => navigate('/privacy')}
            icon={<svg viewBox="0 0 24 24"><path d="M12 1l9 4v6c0 5-3.5 9.5-9 11-5.5-1.5-9-6-9-11V5z"/></svg>}
            label="Privacy"
          />
          <PfItem
            onClick={handleLogout}
            danger
            icon={<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>}
            label="Esci"
          />
        </PfList>

        {/* ── Versione ── */}
        <div style={{
          textAlign: 'center', padding: '18px 18px',
          fontSize: 10, color: 'rgba(34,24,28,.4)', letterSpacing: '.06em',
        }}>
          v4.0 · La Guida di Bi
        </div>

        <Footer />

        {showSuggest && (
          <SuggestRestaurantSheet userId={user?.id} userEmail={user?.email ?? null} userName={user?.user_metadata?.full_name ?? null} onClose={() => setShowSuggest(false)} />
        )}
        <CityPickerSheet open={cityPickerOpen} onClose={() => setCityPickerOpen(false)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-bg)', overflowX: 'hidden' }}>
      {/* ── STICKY HEADER — logo + Torino (mobile only) ── */}
      <div className="md:hidden" style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 22px 0',
        background: 'var(--color-page)',
      }}>
        <div className="flex items-center justify-between" style={{ paddingBottom: 14 }}>
          <Link to="/" className="flex flex-col items-start" style={{ gap: 1 }}>
            <img src="/logo-guida-bi.png" alt="La Guida di Bi" style={{ height: 22, width: 'auto' }} />
            <span style={{ fontSize: 9, color: 'var(--color-secondary)', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' }}>by Chiamami Bi</span>
          </Link>
          <button onClick={() => setCityPickerOpen(true)} className="flex items-center gap-1.5" style={{
            fontSize: 12, color: 'var(--color-ink-70)', fontWeight: 600, padding: '6px 12px', borderRadius: 20,
            background: 'rgba(0,0,0,0.04)', border: '1px solid var(--color-bordo)', cursor: 'pointer',
          }}>
            <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--color-success)' }} />
              <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: 'var(--color-success)', opacity: 0.4, animation: 'cityPulse 2s ease-in-out infinite' }} />
            </span>
            {currentCity.name}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
        <div style={{ height: 1, background: 'var(--color-bordo)', margin: '0 -22px' }} />
      </div>

      {/* ── HEADER GRADIENT — full width ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-accent) 0%, #f07068 50%, #e85d4a 100%)',
        padding: isDesktop ? '28px 40px' : '20px 22px 0',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative shapes */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        {isDesktop && <>
          <div style={{ position: 'absolute', top: -40, left: '12%', width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
          <div style={{ position: 'absolute', bottom: -80, right: '8%', width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        </>}

        <div style={{ maxWidth: isDesktop ? 1080 : undefined, margin: isDesktop ? '0 auto' : undefined, position: 'relative' }}>

          {/* Profile info — horizontal on both mobile and desktop */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: isDesktop ? 18 : 12,
            textAlign: 'left',
            position: 'relative', zIndex: 1,
          }}>
            <div style={{
              width: isDesktop ? 68 : 48, height: isDesktop ? 68 : 48,
              minWidth: isDesktop ? 68 : 48,
              borderRadius: '50%', background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-sans)', fontWeight: 900,
              fontSize: isDesktop ? 28 : 20,
              color: 'var(--color-accent)', lineHeight: 1, flexShrink: 0,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            }}>
              {initial}
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: isDesktop ? 20 : 17, fontWeight: 900, color: '#fff', lineHeight: 1.3, letterSpacing: '-0.02em' }}>
                {displayName}
              </div>
              <div style={{ fontSize: isDesktop ? 13 : 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{email}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#fff', letterSpacing: 0.5,
                  background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '4px 12px',
                }}>Amico di Bi</span>
                <span style={{ fontSize: isDesktop ? 11 : 10, color: 'rgba(255,255,255,0.45)' }}>da {memberSince}</span>
              </div>
            </div>

            {/* Settings button — always inline */}
            <button onClick={() => navigate('/settings')} style={{
              width: isDesktop ? 38 : 34, height: isDesktop ? 38 : 34, minWidth: isDesktop ? 38 : 34,
              borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>

          {/* ── MOBILE: Savings bar at bottom of header (hidden on desktop) ── */}
          {!isDesktop && (
            <div style={{
              background: 'rgba(255,255,255,0.1)', borderRadius: '20px 20px 0 0',
              padding: '16px 22px', margin: '20px -22px 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: '-0.02em' }}>
                  {stats.totalSaved}<span style={{ fontSize: 14 }}>€</span>
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>risparmiati con gli sconti di Bi</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT — centered container ── */}
      <div style={{
        maxWidth: isDesktop ? 1080 : undefined,
        margin: isDesktop ? '0 auto' : undefined,
        width: '100%',
        ...(isDesktop ? {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 28,
          padding: '28px 40px 8px',
          alignItems: 'start',
        } : {}),
      }}>

      {/* ═══ LEFT COLUMN (desktop) / TOP (mobile) ═══ */}
      <div>

      {/* ── Section label (desktop only) ── */}
      {isDesktop && (
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--color-ink-70)', marginBottom: 10 }}>
          Le tue statistiche
        </div>
      )}

      {/* ── STATS CARDS — 2 cards row (mobile) / row (desktop) ── */}
      <div style={{
        display: isDesktop ? 'grid' : 'flex',
        gridTemplateColumns: isDesktop ? 'repeat(2, 1fr)' : undefined,
        gap: 10,
        padding: isDesktop ? '0 0 16px' : '18px 22px',
      }}>
        {[
          { value: stats.savedCount, label: 'Salvati', onClick: () => navigate('/saved') },
          { value: stats.redemptionsCount, label: 'Sconti usati', onClick: () => navigate('/deals', { state: { tab: 'mine' } }) },
        ].map((stat, i) => (
          <button key={i} onClick={stat.onClick} style={{
            flex: isDesktop ? undefined : 1,
            background: '#fff', borderRadius: 16, padding: isDesktop ? '18px 14px' : 16,
            textAlign: 'center', border: '1px solid var(--color-bordo)', cursor: 'pointer',
          }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, fontSize: isDesktop ? 24 : 18, color: 'var(--color-primary)', letterSpacing: '-0.02em' }}>{stat.value}</div>
            <div style={{ fontSize: isDesktop ? 11 : 10, color: 'var(--color-secondary)', marginTop: 2 }}>{stat.label}</div>
          </button>
        ))}
      </div>

      {/* ── BI QUOTE — editorial Caveat (v4 §1029-1032) ── */}
      <div style={{
        margin: isDesktop ? '0 0 16px' : '0 22px 16px',
        padding: '16px 18px',
        background: 'var(--color-oro-soft, #F4E7CC)',
        border: '1px solid rgba(176,137,84,.3)',
        borderRadius: 16,
      }}>
        <div style={{
          fontFamily: 'var(--font-hand, "Caveat", cursive)',
          fontSize: 19, lineHeight: 1.25, color: 'var(--color-ink)',
        }}>
          "Bi sceglie i posti come li sceglierei io: per come si mangia,
          non per quante stelle hanno."
        </div>
        <div style={{
          fontSize: 11, color: 'var(--color-ink-70)',
          marginTop: 6, fontWeight: 700,
        }}>
          — dalla bio di Bi
        </div>
      </div>

      {/* ── CARD INVITA UN AMICO (dark) — horizontal on desktop ── */}
      <div style={{
        background: 'var(--color-primary)', borderRadius: 20, padding: isDesktop ? '18px 22px' : 18,
        marginBottom: isDesktop ? 0 : 16,
        marginLeft: isDesktop ? 0 : 22, marginRight: isDesktop ? 0 : 22,
        position: 'relative', overflow: 'hidden',
        ...(isDesktop ? {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        } : {}),
      }}>
        <div style={{
          position: 'absolute', top: -15, right: -15, width: 80, height: 80,
          borderRadius: '50%', background: 'rgba(232, 69, 60,0.15)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#B08954', letterSpacing: 2, marginBottom: 6 }}>
            INVITA UN AMICO
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: isDesktop ? 16 : 15, fontWeight: 900, color: '#fff', marginBottom: 2, letterSpacing: '-0.02em' }}>
            Condividi La Guida di Bi
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: isDesktop ? 0 : 14 }}>
            Fai scoprire i migliori ristoranti di Torino ai tuoi amici
          </div>
        </div>
        <button onClick={handleShare} style={{
          background: '#fff', color: 'var(--color-primary)', borderRadius: 12,
          padding: isDesktop ? '10px 22px' : 11, fontSize: 13, fontWeight: 600, border: 'none',
          cursor: 'pointer',
          width: isDesktop ? 'auto' : '100%',
          flexShrink: 0, position: 'relative', zIndex: 1,
        }}>
          Condividi link
        </button>
      </div>

      </div>{/* end left col */}

      {/* ═══ RIGHT COLUMN (desktop) / BOTTOM (mobile) ═══ */}
      <div>

      {/* ── Section label (desktop only) ── */}
      {isDesktop && (
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--color-ink-70)', marginBottom: 10 }}>
          Azioni rapide
        </div>
      )}

      {/* ── Newsletter TOGGLE — mobile only (desktop version is full-width below) ── */}
      {!isDesktop && (
      <div style={{
        marginBottom: 16, padding: '18px 20px',
        marginLeft: 22, marginRight: 22,
        background: '#fff', borderRadius: 20,
        border: '1px solid var(--color-bordo)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>Newsletter</div>
          <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>Ricevi novità e offerte esclusive</div>
        </div>
        <button onClick={handleToggleNewsletter} disabled={loadingNewsletter} style={{
          position: 'relative', width: 48, height: 28, borderRadius: 14,
          background: newsletterEnabled ? 'var(--color-accent)' : '#D1D5DB',
          border: 'none', cursor: 'pointer', transition: 'background 0.2s',
          flexShrink: 0,
        }}>
          <motion.div
            style={{
              position: 'absolute', top: 2, width: 24, height: 24,
              borderRadius: 12, background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }}
            animate={{ left: newsletterEnabled ? 22 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>
      )}

      {/* ── 4 LINK BUTTONS — 2x2 on desktop and mobile ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        padding: isDesktop ? 0 : '0 22px 16px',
        marginBottom: isDesktop ? 16 : 0,
      }}>
        {[
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ),
            label: 'Impostazioni', onClick: () => navigate('/settings'),
          },
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            ),
            label: 'Chi è Bi', onClick: () => navigate('/about'),
          },
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            ),
            label: 'Ristoratori', onClick: () => navigate('/partner'),
          },
          {
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            ),
            label: 'Consiglia', sublabel: 'un ristorante',
            accent: true, onClick: () => setShowSuggest(true),
          },
        ].map((item, i) => (
          <button key={i} onClick={item.onClick} style={{
            background: item.accent ? 'var(--color-accent)' : '#fff',
            borderRadius: 16, padding: 16, border: item.accent ? 'none' : '1px solid var(--color-bordo)',
            display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start',
            cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: item.accent ? 'rgba(255,255,255,0.2)' : 'var(--color-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {item.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: item.accent ? '#fff' : 'var(--color-primary)' }}>
                {item.label}
              </div>
              {item.sublabel && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{item.sublabel}</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* ── SOCIAL BUTTONS ── */}
      <div style={{ display: 'flex', gap: 10, padding: isDesktop ? 0 : '0 22px 24px' }}>
        <a href="https://www.tiktok.com/@chiamamibi" target="_blank" rel="noopener noreferrer" style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'var(--color-primary)', borderRadius: 14, padding: '13px 0',
          color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13.1a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-.81.07 4.84 4.84 0 01-.38-4.6z" />
          </svg>
          TikTok
        </a>
        <a href="https://www.instagram.com/chiamamibi" target="_blank" rel="noopener noreferrer" style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: '#fff', borderRadius: 14, padding: '13px 0',
          color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
          border: '1px solid var(--color-bordo)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="17.5" cy="6.5" r="1.5" fill="var(--color-primary)" stroke="none" />
          </svg>
          Instagram
        </a>
      </div>

      </div>{/* end right col */}

      </div>{/* end centered container */}

      {/* ── NEWSLETTER — full-width below grid (desktop only) ── */}
      {isDesktop && (
        <div style={{ maxWidth: 1080, margin: '0 auto', width: '100%', padding: '0 40px 32px' }}>
          <div style={{
            padding: '18px 24px',
            background: '#fff', borderRadius: 20,
            border: '1px solid var(--color-bordo)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>Newsletter</div>
              <div style={{ fontSize: 12, color: 'var(--color-secondary)', marginTop: 2 }}>Ricevi novità e offerte esclusive</div>
            </div>
            <button onClick={handleToggleNewsletter} disabled={loadingNewsletter} style={{
              position: 'relative', width: 48, height: 28, borderRadius: 14,
              background: newsletterEnabled ? 'var(--color-accent)' : '#D1D5DB',
              border: 'none', cursor: 'pointer', transition: 'background 0.2s',
              flexShrink: 0,
            }}>
              <motion.div
                style={{
                  position: 'absolute', top: 2, width: 24, height: 24,
                  borderRadius: 12, background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }}
                animate={{ left: newsletterEnabled ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>
      )}

      {/* ── FOOTER MINIMAL — mobile only ── */}
      <div className="md:hidden" style={{ flex: 1 }} />
      <div className="md:hidden" style={{ padding: '8px 22px', paddingBottom: 16 }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 16,
            background: 'transparent', border: '1.5px solid var(--color-bordo)',
            color: 'var(--color-secondary)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Esci dall'account
        </button>
      </div>
      <div className="md:hidden" style={{ textAlign: 'center', padding: '8px 22px', paddingBottom: TAB_BAR_HEIGHT + 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
          <a href="/privacy" style={{ fontSize: 12, color: 'var(--color-secondary)', textDecoration: 'none' }}>Privacy</a>
          <span style={{ fontSize: 12, color: 'var(--color-bordo)' }}>·</span>
          <a href="/terms" style={{ fontSize: 12, color: 'var(--color-secondary)', textDecoration: 'none' }}>Termini</a>
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-bordo)' }}>La Guida di Bi · v1.0</div>
      </div>

      {/* ── LOGOUT — desktop ── */}
      <div className="hidden md:flex" style={{ justifyContent: 'center', padding: '8px 40px 24px' }}>
        <button
          onClick={handleLogout}
          style={{
            padding: '12px 32px', borderRadius: 14,
            background: 'transparent', border: '1.5px solid var(--color-bordo)',
            color: 'var(--color-secondary)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Esci dall'account
        </button>
      </div>

      <Footer />

      {/* ── SUGGEST RESTAURANT SHEET ── */}
      {showSuggest && (
        <SuggestRestaurantSheet userId={user?.id} userEmail={user?.email ?? null} userName={user?.user_metadata?.full_name ?? null} onClose={() => setShowSuggest(false)} />
      )}

      <CityPickerSheet open={cityPickerOpen} onClose={() => setCityPickerOpen(false)} />
    </div>
  )
}

// ── pf-list helpers (mobile v4) ──
function PfSec({ children }) {
  return (
    <div style={{
      padding: '18px 20px 6px', fontSize: 10, fontWeight: 800,
      letterSpacing: '.12em', color: 'rgba(34,24,28,.4)', textTransform: 'uppercase',
    }}>{children}</div>
  )
}

function PfList({ children }) {
  return (
    <div style={{
      margin: '0 16px', background: '#fff',
      border: '1px solid var(--color-ink-05)', borderRadius: 14, overflow: 'hidden',
    }}>{children}</div>
  )
}

function PfItem({ icon, label, sub, onClick, icVariant, danger }) {
  const icBg = icVariant === 'cor' ? 'var(--color-corallo-soft)'
    : icVariant === 'oro' ? 'var(--color-oro-soft, #F4E7CC)'
    : 'var(--color-ink-05)'
  const icColor = icVariant === 'cor' ? 'var(--color-corallo-ink)'
    : icVariant === 'oro' ? 'var(--color-oro)'
    : 'var(--color-ink)'
  // icon is a <svg viewBox="0 0 24 24"> with path children — clone with sizing + stroke attrs
  const sizedIcon = icon ? cloneElement(icon, {
    width: 14, height: 14, fill: 'none', stroke: 'currentColor',
    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
  }) : null
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '14px 16px', background: 'transparent', border: 0,
        borderBottom: '1px solid var(--color-ink-05)', cursor: 'pointer',
        textAlign: 'left', fontFamily: 'inherit',
      }}
    >
      <span style={{
        width: 32, height: 32, borderRadius: 10, background: icBg,
        display: 'grid', placeItems: 'center', color: icColor, flexShrink: 0,
      }}>{sizedIcon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em',
          color: danger ? 'var(--color-corallo-ink)' : 'var(--color-ink)',
        }}>{label}</span>
        {sub && (
          <span style={{ display: 'block', fontSize: 11, color: 'var(--color-ink-70)', marginTop: 1, fontWeight: 500 }}>
            {sub}
          </span>
        )}
      </span>
      {!danger && <span style={{ color: 'rgba(34,24,28,.4)', fontSize: 14 }}>›</span>}
    </button>
  )
}
