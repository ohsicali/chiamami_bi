import { useState, useEffect } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import SuggestRestaurantSheet from '../../components/Restaurant/SuggestRestaurantSheet'

const COG_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

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
    { icon: '⚙️', title: 'Impostazioni', sub: 'Preferenze, notifiche, città', href: '/settings' },
    { icon: '👋', title: 'Chi è Bi', sub: 'La mia storia, la guida', href: '/about' },
    { icon: '🏪', title: 'Per i ristoratori', sub: 'Candida il tuo locale', href: '/partner' },
    { icon: '✨', title: 'Consiglia un locale', sub: 'Un posto che amo a Torino', onClick: () => setShowSuggest(true), coral: true },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 40px 40px' }}>

        {/* ── Hero corallo ── */}
        <div style={{
          background: 'linear-gradient(135deg,var(--color-corallo) 0%,#C6372F 100%)',
          color: '#fff', borderRadius: 28, padding: '36px 44px', marginBottom: 28,
          display: 'flex', gap: 28, alignItems: 'center', position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative circle */}
          <div style={{
            position: 'absolute', bottom: -60, right: -60,
            width: 360, height: 360, borderRadius: '50%',
            background: 'rgba(255,255,255,.08)',
            pointerEvents: 'none',
          }} />

          {/* Avatar */}
          <div style={{
            width: 92, height: 92, borderRadius: '50%', background: '#fff',
            color: 'var(--color-corallo)',
            fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
            display: 'grid', placeItems: 'center', fontSize: 40, flexShrink: 0,
            boxShadow: '0 8px 24px rgba(34,24,28,.08)', position: 'relative', zIndex: 1,
          }}>
            {initial}
          </div>

          {/* Info */}
          <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 34, letterSpacing: '-0.025em', lineHeight: 1.05 }}>
              Ciao, {displayName || 'Amico'}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '5px 11px', background: 'rgba(255,255,255,.22)', borderRadius: 999, fontSize: 12, fontWeight: 700, letterSpacing: '.02em' }}>
                Amico di Bi
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.82)' }}>
                da {memberSince} · Torino
              </span>
            </div>
          </div>

          {/* Cog button → settings */}
          <button
            onClick={() => navigate('/settings')}
            style={{
              position: 'absolute', top: 28, right: 32,
              width: 42, height: 42, borderRadius: '50%',
              background: 'rgba(255,255,255,.18)', border: 0,
              display: 'grid', placeItems: 'center', cursor: 'pointer', zIndex: 2,
            }}
          >{COG_SVG}</button>
        </div>

        {/* ── 2 columns ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          {/* LEFT — Stats */}
          <div>
            <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-ink-70)', marginBottom: 12 }}>
              Le tue statistiche
            </h3>

            {/* 3 stat tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {stats.map(s => (
                <div key={s.lbl} style={{
                  background: '#fff', border: '1px solid var(--color-ink-05)', borderRadius: 16,
                  padding: '16px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontWeight: 900, fontSize: 28, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>{s.num}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-ink-70)', marginTop: 4, fontWeight: 700 }}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Invite card */}
            <div style={{
              background: 'var(--color-ink)', color: '#fff',
              borderRadius: 18, padding: '22px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20,
            }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: '-0.01em' }}>Invita un amico</div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>
                  Condividi La Guida di Bi con chi sa dove si mangia
                </div>
              </div>
              <button
                onClick={handleShare}
                style={{
                  padding: '10px 18px', background: '#fff', color: 'var(--color-ink)',
                  borderRadius: 999, fontWeight: 800, fontSize: 12.5, border: 0, cursor: 'pointer', fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >Condividi</button>
            </div>

            {/* Newsletter toggle */}
            <div style={{
              marginTop: 16, background: '#fff', border: '1px solid var(--color-ink-05)',
              borderRadius: 16, padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Newsletter di Bi</div>
                <div style={{ fontSize: 11.5, color: 'var(--color-ink-70)', marginTop: 3 }}>
                  Novità, locali nuovi, drop esclusivi — una mail al mese.
                </div>
              </div>
              <button
                onClick={handleToggleNewsletter}
                disabled={loadingNewsletter}
                aria-label={newsletterEnabled ? 'Disattiva newsletter' : 'Attiva newsletter'}
                style={{
                  width: 44, height: 26, borderRadius: 999,
                  background: newsletterEnabled ? 'var(--color-corallo)' : 'var(--color-ink-15)',
                  border: 0, cursor: 'pointer', position: 'relative', flexShrink: 0,
                  transition: 'background .2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2,
                  left: newsletterEnabled ? 'calc(100% - 24px)' : 2,
                  width: 22, height: 22, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,.15)',
                }} />
              </button>
            </div>
          </div>

          {/* RIGHT — Actions */}
          <div>
            <h3 style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-ink-70)', marginBottom: 12 }}>
              Azioni rapide
            </h3>

            {/* 2×2 action grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {actions.map(a => (
                <div
                  key={a.title}
                  role="button"
                  tabIndex={0}
                  onClick={a.onClick ? a.onClick : () => navigate(a.href)}
                  onKeyDown={e => e.key === 'Enter' && (a.onClick ? a.onClick() : navigate(a.href))}
                  style={{
                    background: a.coral ? 'var(--color-corallo)' : '#fff',
                    color: a.coral ? '#fff' : 'var(--color-ink)',
                    border: `1px solid ${a.coral ? 'var(--color-corallo)' : 'var(--color-ink-05)'}`,
                    borderRadius: 16, padding: '18px', cursor: 'pointer',
                    transition: 'all .2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = a.coral ? 'var(--color-corallo)' : 'var(--color-ink-15)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = a.coral ? 'var(--color-corallo)' : 'var(--color-ink-05)' }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, marginBottom: 10, fontSize: 18,
                    background: a.coral ? 'rgba(255,255,255,.22)' : 'var(--color-corallo-soft)',
                    display: 'grid', placeItems: 'center',
                  }}>{a.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em' }}>{a.title}</div>
                  <div style={{ fontSize: 11.5, marginTop: 3, color: a.coral ? 'rgba(255,255,255,.82)' : 'var(--color-ink-70)' }}>{a.sub}</div>
                </div>
              ))}
            </div>

            {/* Social buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <button
                onClick={() => window.open('https://instagram.com/chiamamibi', '_blank')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '14px 16px', borderRadius: 14, border: 0,
                  background: 'linear-gradient(135deg,#F09433,#E6683C 25%,#DC2743 50%,#CC2366 75%,#BC1888)',
                  color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >📷 Instagram</button>
              <button
                onClick={() => window.open('https://tiktok.com/@chiamamibi', '_blank')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '14px 16px', borderRadius: 14, border: 0,
                  background: 'var(--color-ink)', color: '#fff',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >🎵 TikTok</button>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              style={{
                marginTop: 14, width: '100%', padding: '14px 18px',
                background: '#fff', border: '1px solid var(--color-ink-15)', borderRadius: 14,
                color: 'var(--color-corallo-ink)', fontWeight: 800, fontSize: 13.5,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Esci dall'account</button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '30px 40px', borderTop: '1px solid var(--color-ink-05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: 'var(--color-ink-70)', flexWrap: 'wrap', gap: 18,
        maxWidth: 1280, margin: '60px auto 0',
      }}>
        <span style={{ fontFamily: 'var(--font-mark, "Alfa Slab One", serif)', color: 'var(--color-corallo)', fontSize: 16, letterSpacing: '.02em' }}>
          CHIAMAMI BI
        </span>
        <nav style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <Link to="/about" style={{ color: 'var(--color-ink-70)', textDecoration: 'none' }}>Chi è Bi</Link>
          <Link to="/deals" style={{ color: 'var(--color-ink-70)', textDecoration: 'none' }}>Sconti</Link>
          <Link to="/partner" style={{ color: 'var(--color-ink-70)', textDecoration: 'none' }}>Per i ristoratori</Link>
          <Link to="/privacy" style={{ color: 'var(--color-ink-70)', textDecoration: 'none' }}>Privacy</Link>
          <Link to="/terms" style={{ color: 'var(--color-ink-70)', textDecoration: 'none' }}>Termini</Link>
        </nav>
        <span>© 2026 · v1.0</span>
      </div>

      {showSuggest && <SuggestRestaurantSheet onClose={() => setShowSuggest(false)} />}
    </div>
  )
}
