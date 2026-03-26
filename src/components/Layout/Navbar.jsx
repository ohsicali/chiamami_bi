import { Link } from "react-router-dom";
import { useAuth } from "../../lib/hooks/useAuth";
import LanguageSwitcher from "./LanguageSwitcher";

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0.5, marginLeft: 2 }}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export default function Navbar({ view = "map", onToggleView, city = "Torino" }) {
  const { user, profile } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-40"
      style={{
        padding: '0 22px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        paddingBottom: '14px',
        background: 'linear-gradient(180deg, rgba(17,17,17,0.95) 0%, rgba(17,17,17,0.7) 70%, transparent 100%)',
      }}
    >
      <div className="flex items-center justify-between">
        {/* Logo — Editorial style */}
        <Link to="/" className="flex items-baseline gap-1">
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 13,
            color: '#8A8680',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}>la</span>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 600,
            fontSize: 20,
            color: '#FAF7F2',
          }}>Guida</span>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 13,
            color: '#8A8680',
          }}>di</span>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 700,
            fontSize: 20,
            color: '#E8453C',
          }}>Bi</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Language switcher — desktop only */}
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>

          {/* City selector */}
          <button
            className="flex items-center gap-1.5"
            style={{
              fontSize: 12,
              color: '#8A8680',
              fontWeight: 500,
              padding: '6px 12px',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#4ADE80',
              boxShadow: '0 0 6px rgba(74,222,128,0.5)',
              display: 'inline-block',
            }} />
            {city}
            <ChevronDown />
          </button>
        </div>
      </div>
    </nav>
  );
}
