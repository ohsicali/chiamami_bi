import { useState, useEffect } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import Footer from '../../components/Layout/Footer'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import SuggestRestaurantSheet from '../../components/Restaurant/SuggestRestaurantSheet'

const STROKE = '1.6'

const Icon = {
  Settings: ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  About: ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  Store: ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1-5h16l1 5" />
      <path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
    </svg>
  ),
  Plus: ({ size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Arrow: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  Share: ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  Logout: ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Instagram: ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  ),
  TikTok: ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M19.6 6.3a4.85 4.85 0 0 1-3-1.5 4.85 4.85 0 0 1-1.4-3H12v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .6 0 .8.1V8.5a5.8 5.8 0 0 0-.8 0 5.7 5.7 0 1 0 5.7 5.7V8.7a7.9 7.9 0 0 0 4.5 1.4V6.9c-.1 0-.1 0 0-.6z" />
    </svg>
  ),
}

export default function DesktopProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { savedIds } = useSavedRestaurants(user?.id)
  const [profile, setProfile] = useState(null)
  const [redemptionsCount, setRedemptionsCount] = useState(0)
  const [suggestionsCount, setSuggestionsCount] = useState(0)
  const [newsletterEnabled, setNewsletterEnabled] = useState(false)
  const [loadingNewsletter, setLoadingNewsletter] = useState(true)
  const [showSuggest, setShowSuggest] = useState(false)

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return

    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data) })

    supabase.from('discount_redemptions').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'redeemed')
      .then(({ count }) => setRedemptionsCount(count || 0))

    supabase.from('restaurant_suggestions').select('id', { count: 'exact' }).eq('user_id', user.id)
      .then(({ count }) => setSuggestionsCount(count || 0))
      .catch(() => setSuggestionsCount(0))
  }, [user?.id])

  useEffect(() => {
    if (!user?.email || !isSupabaseConfigured()) { setLoadingNewsletter(false); return }
    supabase.from('newsletter_subscribers').select('id').eq('email', user.email).single()
      .then(({ data }) => { setNewsletterEnabled(!!data); setLoadingNewsletter(false) })
  }, [user?.email])

  const handleToggleNewsletter = async () => {
    const next = !newsletterEnabled
    setNewsletterEnabled(next)
    if (next) {
      await supabase.from('newsletter_subscribers').upsert({ email: user.email, source: 'profile_desktop' }, { onConflict: 'email' })
    } else {
      await supabase.from('newsletter_subscribers').delete().eq('email', user.email)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const handleShare = async () => {
    const shareData = { title: 'La Guida di Bi', text: 'Scopri i migliori ristoranti di Torino con La Guida di Bi!', url: 'https://chiamamibi.com' }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch {}
    } else {
      await navigator.clipboard.writeText(shareData.url)
      alert('Link copiato!')
    }
  }

  if (!authLoading && !user) return <Navigate to="/login" replace />

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const initial = (displayName || '?').charAt(0).toUpperCase()
  const createdAt = profile?.created_at ? new Date(profile.created_at) : (user?.created_at ? new Date(user.created_at) : new Date())
  const memberSince = createdAt.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  const stats = [
    { num: savedIds.size, lbl: 'Salvati' },
    { num: redemptionsCount, lbl: 'Sconti usati' },
    { num: suggestionsCount, lbl: 'Suggerimenti' },
  ]

  const actions = [
    { Icon: Icon.Settings, title: 'Impostazioni', sub: 'Preferenze, notifiche, città', href: '/settings' },
    { Icon: Icon.About, title: 'Chi è Bi', sub: 'La storia, la guida', href: '/about' },
    { Icon: Icon.Store, title: 'Per i ristoratori', sub: 'Candida il tuo locale', href: '/partner' },
    { Icon: Icon.Plus, title: 'Suggerisci un locale', sub: 'Un posto che ami a Torino', onClick: () => setShowSuggest(true), accent: true },
  ]

  return (
    <div style={{ minHeight: 'calc(100vh - 80px)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', padding: '40px 32px 0' }}>

        {/* ── Hero — minimal ink monochrome ── */}
        <div style={{
          background: '#22181C', color: '#fff',
          borderRadius: 20, padding: '40px 44px', marginBottom: 32,
          display: 'flex', gap: 28, alignItems: 'center', position: 'relative', overflow: 'hidden',
        }}>
          {/* Avatar — minimale, no shadow drammatico */}
          <div style={{
            width: 76, height: 76, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
            color: '#fff',
            display: 'grid', placeItems: 'center', flexShrink: 0,
            fontFamily: 'var(--font-sans, "Poppins", sans-serif)',
            fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em',
          }}>
            {initial}
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
              Profilo · Amico di Bi
            </div>
            <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.025em', lineHeight: 1.05 }}>
              {displayName || 'Amico'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
              Iscritto da {memberSince} · Torino
            </div>
          </div>

          {/* Settings link — ghost button */}
          <button
            onClick={() => navigate('/settings')}
            aria-label="Impostazioni"
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              display: 'grid', placeItems: 'center', cursor: 'pointer',
              color: '#fff', flexShrink: 0,
            }}
          >
            <Icon.Settings size={16} color="#fff" />
          </button>
        </div>

        {/* ── 2 columns ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>

          {/* LEFT — Stats */}
          <div>
            <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-ink-70)', marginBottom: 14, marginTop: 0 }}>
              Statistiche
            </h3>

            {/* 3 stat tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
              {stats.map(s => (
                <div key={s.lbl} style={{
                  background: '#fff', border: '1px solid var(--color-ink-05)', borderRadius: 14,
                  padding: '20px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 32, letterSpacing: '-0.03em', color: 'var(--color-ink)', lineHeight: 1 }}>{s.num}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 8, fontWeight: 600, letterSpacing: '0.02em' }}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Invite card */}
            <div style={{
              background: '#fff', border: '1px solid var(--color-ink-05)',
              borderRadius: 14, padding: '20px 22px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>Invita un amico</div>
                <div style={{ fontSize: 12, color: 'var(--color-ink-70)', marginTop: 4, lineHeight: 1.4 }}>
                  Condividi La Guida di Bi
                </div>
              </div>
              <button
                onClick={handleShare}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', background: 'var(--color-ink)', color: '#fff',
                  borderRadius: 999, fontWeight: 700, fontSize: 12.5, border: 0, cursor: 'pointer', fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon.Share size={14} color="#fff" />
                Condividi
              </button>
            </div>

            {/* Newsletter toggle */}
            <div style={{
              marginTop: 12, background: '#fff', border: '1px solid var(--color-ink-05)',
              borderRadius: 14, padding: '18px 22px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>Newsletter</div>
                <div style={{ fontSize: 12, color: 'var(--color-ink-70)', marginTop: 4, lineHeight: 1.4 }}>
                  Una mail al mese — locali nuovi, drop esclusivi
                </div>
              </div>
              <button
                onClick={handleToggleNewsletter}
                disabled={loadingNewsletter}
                aria-label={newsletterEnabled ? 'Disattiva newsletter' : 'Attiva newsletter'}
                style={{
                  width: 42, height: 24, borderRadius: 999,
                  background: newsletterEnabled ? 'var(--color-ink)' : 'var(--color-ink-15)',
                  border: 0, cursor: 'pointer', position: 'relative', flexShrink: 0,
                  transition: 'background .2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2,
                  left: newsletterEnabled ? 'calc(100% - 22px)' : 2,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,.18)',
                }} />
              </button>
            </div>
          </div>

          {/* RIGHT — Actions */}
          <div>
            <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-ink-70)', marginBottom: 14, marginTop: 0 }}>
              Azioni
            </h3>

            {/* 2×2 action grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {actions.map(a => {
                const I = a.Icon
                return (
                  <div
                    key={a.title}
                    role="button"
                    tabIndex={0}
                    onClick={a.onClick ? a.onClick : () => navigate(a.href)}
                    onKeyDown={e => e.key === 'Enter' && (a.onClick ? a.onClick() : navigate(a.href))}
                    style={{
                      background: '#fff',
                      color: 'var(--color-ink)',
                      border: '1px solid var(--color-ink-05)',
                      borderRadius: 14, padding: '20px',
                      cursor: 'pointer',
                      transition: 'border-color .15s, transform .15s',
                      display: 'flex', flexDirection: 'column', gap: 14,
                      minHeight: 130,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-ink-15)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-ink-05)'; e.currentTarget.style.transform = '' }}
                  >
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      color: 'var(--color-ink)',
                    }}>
                      <I size={18} color="var(--color-ink)" />
                      <Icon.Arrow size={14} color="var(--color-ink-40)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>{a.title}</div>
                      <div style={{ fontSize: 12, marginTop: 4, color: 'var(--color-ink-70)', lineHeight: 1.4 }}>{a.sub}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Social buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <button
                onClick={() => window.open('https://instagram.com/chiamamibi', '_blank')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  padding: '13px 16px', borderRadius: 12,
                  background: '#fff', border: '1px solid var(--color-ink-05)',
                  color: 'var(--color-ink)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'border-color .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-ink-15)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-ink-05)' }}
              >
                <Icon.Instagram size={15} color="var(--color-ink)" />
                Instagram
              </button>
              <button
                onClick={() => window.open('https://tiktok.com/@chiamamibi', '_blank')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  padding: '13px 16px', borderRadius: 12,
                  background: '#fff', border: '1px solid var(--color-ink-05)',
                  color: 'var(--color-ink)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'border-color .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-ink-15)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-ink-05)' }}
              >
                <Icon.TikTok size={15} color="var(--color-ink)" />
                TikTok
              </button>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                marginTop: 12, width: '100%', padding: '14px 18px',
                background: '#fff', border: '1px solid var(--color-ink-05)', borderRadius: 12,
                color: 'var(--color-ink-70)', fontWeight: 600, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'border-color .15s, color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-ink-15)'; e.currentTarget.style.color = 'var(--color-ink)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-ink-05)'; e.currentTarget.style.color = 'var(--color-ink-70)' }}
            >
              <Icon.Logout size={14} color="currentColor" />
              Esci dall'account
            </button>
          </div>
        </div>
      </div>

      <Footer />

      {showSuggest && <SuggestRestaurantSheet userId={user?.id ?? null} userEmail={user?.email ?? null} userName={user?.user_metadata?.full_name ?? null} onClose={() => setShowSuggest(false)} />}
    </div>
  )
}
