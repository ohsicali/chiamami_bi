import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRestaurants } from '../../lib/hooks/useRestaurants'
import { useAuth } from '../../lib/hooks/useAuth'
import { useSavedRestaurants } from '../../lib/hooks/useSavedRestaurants'
import { getCurrentMoment, isOpenForMoment } from '../../lib/hours'
import SponsorBanner from '../../components/Home/SponsorBanner'
import TimeContextHero from '../../components/Home/TimeContextHero'
import MomentTabs from '../../components/Home/MomentTabs'
import MomentResultsGrid from '../../components/Home/MomentResultsGrid'
import MapCta from '../../components/Home/MapCta'
import AskBiChat from '../../components/Home/AskBiChat'

function TopBar({ user }) {
  const initials = user
    ? (user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()
    : null
  return (
    <div
      className="hfv4-topbar"
      style={{
        padding: '12px 20px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Link
        to="/"
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          lineHeight: 0.92,
          textDecoration: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
            fontSize: 15,
            letterSpacing: '0.02em',
            color: 'var(--color-corallo)',
          }}
        >
          CHIAMAMI BI
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 8,
            letterSpacing: '0.15em',
            color: 'var(--color-ink-40, rgba(34,24,28,.4))',
            marginTop: 3,
            textTransform: 'uppercase',
          }}
        >
          la guida di bi
        </span>
      </Link>

      <div
        className="hfv4-city-pill"
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          padding: '10px 16px 10px 14px',
          background: 'var(--color-ink-05)',
          border: '1px solid var(--color-ink-15, rgba(34,24,28,.12))',
          borderRadius: 999,
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '-0.01em',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--color-corallo)',
            boxShadow: '0 0 0 3px rgba(232,69,60,.15)',
          }}
        />
        Torino
        <span style={{ fontSize: 10, color: 'var(--color-ink-40, rgba(34,24,28,.4))', marginLeft: 2 }}>▾</span>
      </div>

      {user ? (
        <Link
          to="/profile"
          aria-label="Profilo"
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-corallo) 0%, var(--color-corallo-ink, #C6372F) 100%)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
            fontSize: 16,
            boxShadow: '0 6px 14px rgba(232,69,60,.3)',
            border: '2px solid #fff',
            textDecoration: 'none',
          }}
        >
          {initials}
        </Link>
      ) : (
        <Link
          to="/login"
          style={{
            padding: '10px 16px',
            background: 'var(--color-ink)',
            color: '#fff',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Accedi
        </Link>
      )}
    </div>
  )
}

/**
 * CosaConsiglio · "Secondo Bi" editorial (blocco gradient oro preservato).
 * Mostra un ristorante featured con tip handwriting.
 */
function CosaConsiglio({ restaurant }) {
  const navigate = useNavigate()
  if (!restaurant) return null

  const tips = Array.isArray(restaurant.recommended_for) && restaurant.recommended_for.length > 0
    ? restaurant.recommended_for.slice(0, 3)
    : null

  return (
    <div className="hfv4-consiglio-wrap" style={{ padding: '14px 16px 24px' }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(140deg,#FEF6E4 0%,#F4E7CC 100%)',
          border: '1px solid rgba(176,137,84,.35)',
          borderRadius: 28,
          padding: '22px 20px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--color-ink)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mark, "Alfa Slab One", serif)',
              fontSize: 16,
            }}
          >
            B
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700 }}>
              Bi — dalla guida
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-ink-70)' }}>
              Secondo Bi
            </div>
          </div>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: 'var(--color-oro, #B08954)',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Settimana del {new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            marginBottom: 10,
          }}
        >
          Questa settimana passerei da {restaurant.name}.
        </div>
        <div
          style={{
            fontFamily: 'var(--font-hand, "Caveat", cursive)',
            fontSize: 18,
            fontWeight: 600,
            lineHeight: 1.35,
            color: 'var(--color-ink)',
            maxWidth: 280,
          }}
        >
          {restaurant.our_tip || restaurant.tagline || 'Uno dei posti di cui non mi stanco mai.'}
        </div>
        {tips && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
            {tips.map((t) => (
              <span
                key={t}
                style={{
                  padding: '4px 10px',
                  background: 'rgba(176,137,84,.18)',
                  color: 'var(--color-ink)',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate(`/restaurant/${restaurant.slug}`)}
          style={{
            marginTop: 16,
            padding: '10px 14px',
            background: 'var(--color-ink)',
            color: '#fff',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            border: 0,
            cursor: 'pointer',
          }}
        >
          Vai alla scheda →
        </button>
      </div>
    </div>
  )
}

function SuggestCard() {
  const navigate = useNavigate()
  return (
    <div className="hfv4-suggest-wrap" style={{ padding: '10px 16px 36px' }}>
      <div
        className="hfv4-suggest"
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--color-ink)',
          color: '#fff',
          borderRadius: 28,
          padding: 22,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 14,
          alignItems: 'center',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            background: 'radial-gradient(circle, rgba(232,69,60,.25), transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 900,
              fontSize: 18,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              marginBottom: 6,
              maxWidth: 220,
            }}
          >
            Conosci un posto che manca?
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.35, maxWidth: 240 }}>
            Scrivici nome + zona. Bi ci va a mangiare. Se è buono, entra.
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          style={{
            padding: '11px 14px',
            background: 'var(--color-corallo)',
            color: '#fff',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            position: 'relative',
            zIndex: 1,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Suggerisci →
        </button>
      </div>
    </div>
  )
}

export default function HomeFeedV4() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { restaurants, loading } = useRestaurants(null)
  const { isSaved, toggleSave } = useSavedRestaurants(user?.id)

  // Momento corrente (auto) + momento attivo (selezionato dall'utente)
  const { active: autoActive, next: autoNext } = getCurrentMoment()
  const initialMoment = autoActive || autoNext || 'aperitivo'
  const [activeMoment, setActiveMoment] = useState(initialMoment)

  // Featured per CosaConsiglio: ristorante featured o con più tip
  const featuredForEditorial = useMemo(() => {
    if (!Array.isArray(restaurants) || restaurants.length === 0) return null
    return restaurants.find((r) => r.featured)
      || restaurants.find((r) => (r.our_tip && r.our_tip.length > 30))
      || restaurants[0]
  }, [restaurants])

  // Count per MapCta
  const momentCount = useMemo(() => {
    if (!Array.isArray(restaurants)) return 0
    return restaurants.filter((r) => {
      if (r.is_published === false) return false
      return isOpenForMoment(r.hours_cache, activeMoment).match
    }).length
  }, [restaurants, activeMoment])

  const onCardClick = (r) => navigate(`/restaurant/${r.slug}`)

  return (
    <div
      className="hfv4-root"
      style={{
        background: 'var(--color-page)',
        minHeight: '100dvh',
        paddingBottom: 100,
      }}
    >
      <style>{`
        @keyframes hero-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.3); }
        }
        .hfv4-results-row::-webkit-scrollbar,
        .hfv4-moment-tabs::-webkit-scrollbar { display: none; }

        /* Grid layout: mobile single-column, desktop 2-col con chat sticky a destra */
        .hfv4-main {
          display: grid;
          grid-template-areas: "a" "b" "c";
          grid-template-columns: 1fr;
        }
        .hfv4-zone-a { grid-area: a; }
        .hfv4-zone-b { grid-area: b; }
        .hfv4-zone-c { grid-area: c; }

        @media (min-width: 1024px) {
          .hfv4-root { padding-bottom: 0; }
          .hfv4-topbar { display: none !important; }
          .hfv4-main {
            max-width: 1240px;
            margin: 0 auto;
            padding: 20px 40px 80px;
            grid-template-areas: "a b" "c b";
            grid-template-columns: 1fr 360px;
            column-gap: 40px;
            row-gap: 0;
            align-items: start;
          }
          .hfv4-zone-b {
            position: sticky;
            top: 100px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .hfv4-zone-b .hfv4-ai-divider { display: none; }
          .hfv4-zone-b .hfv4-ai-wrap { padding: 0 !important; }
          .hfv4-zone-b .hfv4-ai-output { padding: 0 !important; }

          .hfv4-spon-wrap { padding-left: 0 !important; padding-right: 0 !important; }
          .hfv4-timehero { padding-left: 0 !important; padding-right: 0 !important; }
          .hfv4-moment-tabs {
            overflow-x: visible !important;
            flex-wrap: wrap !important;
            padding-left: 0 !important; padding-right: 0 !important;
          }
          .hfv4-results-head { padding-left: 0 !important; padding-right: 0 !important; }
          .hfv4-results-row {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            overflow: visible !important;
            padding-left: 0 !important; padding-right: 0 !important;
            gap: 16px !important;
          }
          .hfv4-lcard, .hfv4-results-more { flex: unset !important; min-height: 0 !important; }
          .hfv4-mapcta-wrap, .hfv4-consiglio-wrap, .hfv4-suggest-wrap {
            padding-left: 0 !important; padding-right: 0 !important;
          }
          .hfv4-timehero-clock { font-size: 128px !important; }
          .hfv4-timehero-q { font-size: 32px !important; max-width: 480px !important; }
          .hfv4-spon-banner {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
          }
          .hfv4-spon-banner .spon-photo { height: auto !important; min-height: 320px !important; }
        }
      `}</style>

      <TopBar user={user} />

      <div className="hfv4-main">
        {/* Zone A: contenuto principale sopra la chat */}
        <div className="hfv4-zone-a">
          <SponsorBanner />

          <TimeContextHero activeMomentKey={activeMoment} />

          <MomentTabs activeKey={activeMoment} onChange={setActiveMoment} />

          {loading ? (
            <div style={{ padding: '20px', color: 'var(--color-ink-70)' }}>Caricamento…</div>
          ) : (
            <MomentResultsGrid
              restaurants={restaurants}
              activeMoment={activeMoment}
              onCardClick={onCardClick}
              isSaved={isSaved}
              toggleSave={toggleSave}
            />
          )}

          <MapCta activeMoment={activeMoment} count={momentCount} />
        </div>

        {/* Zone B: chat AI (inline su mobile, sticky right col su desktop via CSS grid-area) */}
        <div className="hfv4-zone-b">
          <AskBiChat currentMoment={activeMoment} />
        </div>

        {/* Zone C: Secondo Bi editorial + suggest (sotto chat su mobile, sotto zone-a su desktop) */}
        <div className="hfv4-zone-c">
          <CosaConsiglio restaurant={featuredForEditorial} />
          <SuggestCard />
        </div>
      </div>
    </div>
  )
}
