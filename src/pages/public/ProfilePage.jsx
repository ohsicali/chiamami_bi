import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import Footer from '../../components/Layout/Footer'
import SuggestRestaurantSheet from '../../components/Restaurant/SuggestRestaurantSheet'
import CityPickerSheet from '../../components/UI/CityPickerSheet'
import { useCity } from '../../lib/CityContext'
import { useIsDesktop } from '../../lib/hooks/useMediaQuery'

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { savedIds } = useSavedRestaurants(user?.id)
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ savedCount: 0, redemptionsCount: 0, totalSaved: 0 })
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
    supabase.from('discount_redemptions').select('id, discount:discounts(discount_value)', { count: 'exact' }).eq('user_id', user.id).eq('status', 'redeemed')
      .then((redemptions) => {
        const redeemed = redemptions.data || []
        const totalSaved = redeemed.reduce((sum, r) => {
          const val = r.discount?.discount_value
          return sum + (typeof val === 'number' ? val : 0)
        }, 0)
        setStats({
          savedCount: savedIds.size,
          redemptionsCount: redemptions.count || 0,
          totalSaved,
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

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const email = user?.email || ''
  const initial = displayName.charAt(0).toUpperCase()
  const createdAt = profile?.created_at ? new Date(profile.created_at) : (user?.created_at ? new Date(user.created_at) : new Date())
  const memberSince = createdAt.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

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

      {/* Desktop full footer */}
      <div className="hidden md:block"><Footer /></div>

      {/* ── SUGGEST RESTAURANT SHEET ── */}
      {showSuggest && (
        <SuggestRestaurantSheet userId={user?.id} onClose={() => setShowSuggest(false)} />
      )}

      <CityPickerSheet open={cityPickerOpen} onClose={() => setCityPickerOpen(false)} />
    </div>
  )
}
