import { useState } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/hooks/useAuth";
import LanguageSwitcher from "./LanguageSwitcher";

const CITIES = [
  { name: "Torino", active: true },
  { name: "Milano", active: false },
  { name: "Roma", active: false },
  { name: "Napoli", active: false },
  { name: "Firenze", active: false },
  { name: "Bologna", active: false },
];

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0.5, marginLeft: 2 }}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export default function Navbar({ view = "map", onToggleView, city = "Torino", onCityChange }) {
  const { user, profile } = useAuth();
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState(city);

  function handleCitySelect(cityName) {
    setSelectedCity(cityName);
    onCityChange?.(cityName);
    setCityPickerOpen(false);
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40"
        style={{
          padding: '0 22px',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
          paddingBottom: '14px',
          background: 'linear-gradient(180deg, rgba(17,17,17,0.95) 0%, rgba(17,17,17,0.7) 70%, transparent 100%)',
        }}
      >
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex flex-col items-start" style={{ gap: 1 }}>
            <img src="/logo-guida-bi.png" alt="La Guida di Bi" style={{ height: 22, width: 'auto' }} />
            <span style={{ fontSize: 9, color: '#8A8680', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>
              by Chiamami Bi
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>

            {/* City selector with pulsing dot */}
            <button
              onClick={() => setCityPickerOpen(true)}
              className="flex items-center gap-1.5"
              style={{
                fontSize: 12, color: '#8A8680', fontWeight: 500,
                padding: '6px 12px', borderRadius: 20,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Pulsing green dot */}
              <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}>
                <span style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%', background: '#4ADE80',
                }} />
                <span style={{
                  position: 'absolute', inset: -2,
                  borderRadius: '50%', background: '#4ADE80',
                  opacity: 0.4,
                  animation: 'cityPulse 2s ease-in-out infinite',
                }} />
              </span>
              {selectedCity}
              <ChevronDown />
            </button>
          </div>
        </div>
      </nav>

      {/* Pulse animation */}
      <style>{`
        @keyframes cityPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>

      {/* City picker modal */}
      {createPortal(
        <AnimatePresence>
          {cityPickerOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
              onClick={() => setCityPickerOpen(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                className="absolute bottom-0 left-0 right-0"
                style={{ background: '#FAF7F2', borderRadius: '28px 28px 0 0', paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Handle */}
                <div style={{ width: 40, height: 4, background: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '10px auto 0' }} />

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: '#111' }}>
                    Scegli la città
                  </h3>
                  <button onClick={() => setCityPickerOpen(false)} style={{ padding: 8, borderRadius: '50%', background: 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A8680" strokeWidth="2" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>

                {/* Cities */}
                <div className="px-5 pb-6">
                  {CITIES.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleCitySelect(c.name)}
                      className="flex items-center justify-between w-full"
                      style={{
                        padding: '14px 16px', borderRadius: 14, marginBottom: 6,
                        background: selectedCity === c.name ? '#111' : '#fff',
                        border: `1.5px solid ${selectedCity === c.name ? '#111' : '#E8E5DE'}`,
                        cursor: c.active ? 'pointer' : 'default',
                        opacity: c.active ? 1 : 0.5,
                      }}
                      disabled={!c.active}
                    >
                      <div className="flex items-center gap-3">
                        {c.active ? (
                          <span style={{ position: 'relative', width: 8, height: 8 }}>
                            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: selectedCity === c.name ? '#4ADE80' : '#ccc' }} />
                          </span>
                        ) : (
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ddd' }} />
                        )}
                        <span style={{
                          fontSize: 15, fontWeight: 600,
                          color: selectedCity === c.name ? '#FAF7F2' : '#111',
                        }}>
                          {c.name}
                        </span>
                      </div>
                      {selectedCity === c.name && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                      )}
                      {!c.active && (
                        <span style={{ fontSize: 11, color: '#8A8680', fontWeight: 500 }}>Presto disponibile</span>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
