import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { supabase } from '../../lib/supabase'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import SuggestRestaurantSheet from '../../components/Restaurant/SuggestRestaurantSheet'

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { savedIds } = useSavedRestaurants(user?.id)
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ savedCount: 0, redemptionsCount: 0, reviewsCount: 0, totalSaved: 0 })
  const [showSuggest, setShowSuggest] = useState(false)

  useEffect(() => {
    if (!user?.id) return

    // Fetch profile
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data) })

    // Fetch stats in parallel
    Promise.all([
      supabase.from('discount_redemptions').select('id, discount:discounts(discount_value)', { count: 'exact' }).eq('user_id', user.id).eq('status', 'redeemed'),
      supabase.from('user_reviews').select('id', { count: 'exact' }).eq('user_id', user.id),
    ]).then(([redemptions, reviews]) => {
      const redeemed = redemptions.data || []
      const totalSaved = redeemed.reduce((sum, r) => {
        const val = r.discount?.discount_value
        return sum + (typeof val === 'number' ? val : 0)
      }, 0)
      setStats({
        savedCount: savedIds.size,
        redemptionsCount: redemptions.count || 0,
        reviewsCount: reviews.count || 0,
        totalSaved,
      })
    })
  }, [user?.id, savedIds.size])

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
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-bg)' }}>
      {/* ── HEADER GRADIENT ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-accent) 0%, #f07068 100%)',
        padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 22px 0',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circle */}
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 120, height: 120,
          borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
        }} />

        {/* Top row: avatar + name + settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
          {/* Avatar */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'TAN Songbird', serif", fontSize: 22, fontWeight: 700,
            color: 'var(--color-accent)',
          }}>
            {initial}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'TAN Songbird', serif", fontSize: 22, fontWeight: 700, color: '#fff' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{email}</div>
          </div>
          {/* Settings button */}
          <button onClick={() => navigate('/settings')} style={{
            width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        {/* ── BARRA "AMICO DI BI" ── */}
        <div style={{
          background: 'rgba(255,255,255,0.1)', borderRadius: '20px 20px 0 0',
          padding: '16px 18px', margin: '20px -22px 0', position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>
              ❤️
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Amico di Bi</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>da {memberSince}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: "'TAN Songbird', serif", fontSize: 28, fontWeight: 700, color: '#fff' }}>
              {stats.totalSaved}€
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>risparmiati con gli sconti di Bi</span>
          </div>
        </div>
      </div>

      {/* ── 3 STATS CARDS ── */}
      <div style={{ display: 'flex', gap: 10, padding: '18px 22px' }}>
        {[
          { value: stats.savedCount, label: 'Salvati', onClick: () => navigate('/saved') },
          { value: stats.redemptionsCount, label: 'Sconti usati', onClick: () => navigate('/deals', { state: { tab: 'mine' } }) },
          { value: stats.reviewsCount, label: 'Recensioni', onClick: () => {} },
        ].map((stat, i) => (
          <button key={i} onClick={stat.onClick} style={{
            flex: 1, background: '#fff', borderRadius: 16, padding: 16,
            textAlign: 'center', border: '1px solid var(--color-bordo)',
            cursor: 'pointer',
          }}>
            <div style={{ fontFamily: "'TAN Songbird', serif", fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-secondary)' }}>{stat.label}</div>
          </button>
        ))}
      </div>

      {/* ── CARD INVITA UN AMICO ── */}
      <div style={{
        background: 'var(--color-primary)', borderRadius: 20, padding: 18,
        margin: '0 22px 24px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -15, right: -15, width: 80, height: 80,
          borderRadius: '50%', background: 'rgba(232,69,60,0.15)',
        }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: '#C4A265', letterSpacing: 2, marginBottom: 8 }}>
          INVITA UN AMICO
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          Condividi La Guida di Bi
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14, lineHeight: 1.5 }}>
          Fai scoprire i migliori ristoranti di Torino ai tuoi amici
        </div>
        <button onClick={handleShare} style={{
          background: '#fff', color: 'var(--color-primary)', borderRadius: 12,
          padding: 11, fontSize: 13, fontWeight: 600, border: 'none',
          cursor: 'pointer', width: '100%',
        }}>
          Condividi link
        </button>
      </div>

      {/* ── GRIGLIA LINK 2x2 ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        padding: '0 22px 20px',
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
      <div style={{ display: 'flex', gap: 10, padding: '0 22px 20px' }}>
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

      {/* ── FOOTER MINIMAL ── */}
      <div style={{ flex: 1 }} />
      <div style={{ textAlign: 'center', padding: '20px 22px', paddingBottom: TAB_BAR_HEIGHT + 20 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
          <a href="/privacy" style={{ fontSize: 12, color: 'var(--color-secondary)', textDecoration: 'none' }}>Privacy</a>
          <span style={{ fontSize: 12, color: 'var(--color-bordo)' }}>·</span>
          <a href="/terms" style={{ fontSize: 12, color: 'var(--color-secondary)', textDecoration: 'none' }}>Termini</a>
          <span style={{ fontSize: 12, color: 'var(--color-bordo)' }}>·</span>
          <button onClick={handleLogout} style={{ fontSize: 12, color: 'var(--color-accent)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
            Esci
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-bordo)' }}>La Guida di Bi · v1.0</div>
      </div>

      {/* ── SUGGEST RESTAURANT SHEET ── */}
      {showSuggest && (
        <SuggestRestaurantSheet userId={user?.id} onClose={() => setShowSuggest(false)} />
      )}
    </div>
  )
}
