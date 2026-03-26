import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/hooks/useAuth";
import LanguageSwitcher from "./LanguageSwitcher";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const POPULAR_CITIES = [
  { name: "Torino", lng: 7.6869, lat: 45.0703 },
  { name: "Milano", lng: 9.1900, lat: 45.4642 },
  { name: "Roma", lng: 12.4964, lat: 41.9028 },
  { name: "Napoli", lng: 14.2681, lat: 40.8518 },
  { name: "Firenze", lng: 11.2558, lat: 43.7696 },
  { name: "Bologna", lng: 11.3426, lat: 44.4949 },
];

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0.5, marginLeft: 2 }}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8680" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function countNearbyRestaurants(lat, lng, restaurants, radiusKm = 15) {
  if (!restaurants?.length) return 0;
  return restaurants.filter(r => {
    if (!r.latitude || !r.longitude) return false;
    return getDistance(lat, lng, r.latitude, r.longitude) <= radiusKm;
  }).length;
}

export default function Navbar({ view = "map", onToggleView, city = "Torino", onCityChange, restaurants = [] }) {
  const { user, profile } = useAuth();
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState(city);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const [viewportH, setViewportH] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);

  function handleCitySelect(name, lng, lat) {
    setSelectedCity(name);
    onCityChange?.({ name, lng, lat });
    setCityPickerOpen(false);
    setQuery("");
    setSuggestions([]);
  }

  const searchCities = useCallback(async (q) => {
    if (!q || q.length < 2 || !MAPBOX_TOKEN) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&country=it&types=place,locality&language=it&limit=6`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.features) {
        setSuggestions(data.features.map(f => ({
          name: f.text,
          fullName: f.place_name?.replace(', Italia', '').replace(', Italy', ''),
          lng: f.center[0],
          lat: f.center[1],
        })));
      }
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCities(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, searchCities]);

  useEffect(() => {
    if (cityPickerOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setSuggestions([]);
    }
  }, [cityPickerOpen]);

  // Track visual viewport height for keyboard avoidance
  useEffect(() => {
    if (!cityPickerOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setViewportH(vv.height);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [cityPickerOpen]);

  const showSuggestions = query.length >= 2 && suggestions.length > 0;
  const showPopular = query.length < 2;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40"
        style={{
          padding: '0 22px',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          paddingBottom: '10px',
          background: '#FAF7F2',
          borderBottom: '1px solid rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex items-center justify-between">
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

            <button
              onClick={() => setCityPickerOpen(true)}
              className="flex items-center gap-1.5"
              style={{
                fontSize: 12, color: '#555', fontWeight: 600,
                padding: '6px 12px', borderRadius: 20,
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            >
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

      <style>{`
        @keyframes cityPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>

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
                style={{
                  background: '#FAF7F2', borderRadius: '28px 28px 0 0',
                  paddingBottom: 'env(safe-area-inset-bottom, 20px)',
                  maxHeight: viewportH * 0.85, display: 'flex', flexDirection: 'column',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Handle */}
                <div style={{ width: 40, height: 4, background: 'rgba(0,0,0,0.12)', borderRadius: 2, margin: '10px auto 0', flexShrink: 0 }} />

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ flexShrink: 0 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>
                    Dove vuoi esplorare?
                  </h3>
                  <button onClick={() => setCityPickerOpen(false)} style={{ padding: 8, borderRadius: '50%', background: 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A8680" strokeWidth="2" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>

                {/* Search input */}
                <div className="px-5 pb-3" style={{ flexShrink: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#fff', borderRadius: 14,
                    border: '1.5px solid #E8E5DE', padding: '12px 14px',
                  }}>
                    <SearchIcon />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Cerca città, paese o comune..."
                      style={{
                        flex: 1, border: 'none', outline: 'none',
                        background: 'transparent', fontSize: 15, fontWeight: 500,
                        color: '#111', fontFamily: "'DM Sans', sans-serif",
                      }}
                    />
                    {query && (
                      <button onClick={() => { setQuery(""); setSuggestions([]); }} style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8680" strokeWidth="2" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Results */}
                <div className="px-5 pb-4" style={{ overflowY: 'auto', flex: 1 }}>
                  {/* Currently selected */}
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8A8680', textTransform: 'uppercase', letterSpacing: 1 }}>
                      Selezionata
                    </span>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px', borderRadius: 14, marginTop: 6,
                      background: '#111', border: '1.5px solid #111',
                    }}>
                      <div className="flex items-center gap-3">
                        <span style={{ position: 'relative', width: 8, height: 8 }}>
                          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ADE80' }} />
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#FAF7F2' }}>{selectedCity}</span>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                  </div>

                  {/* Search suggestions */}
                  {showSuggestions && (
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#8A8680', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Risultati
                      </span>
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {suggestions.map((s, i) => {
                          const count = countNearbyRestaurants(s.lat, s.lng, restaurants);
                          return (
                            <button
                              key={`${s.name}-${i}`}
                              onClick={() => handleCitySelect(s.name, s.lng, s.lat)}
                              className="flex items-center justify-between w-full"
                              style={{
                                padding: '12px 14px', borderRadius: 14,
                                background: '#fff', border: '1.5px solid #E8E5DE',
                                cursor: 'pointer', textAlign: 'left',
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{s.name}</div>
                                <div style={{ fontSize: 12, color: '#8A8680', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.fullName}</div>
                              </div>
                              {count > 0 && (
                                <span style={{
                                  fontSize: 11, fontWeight: 600, color: '#4ADE80',
                                  background: 'rgba(74,222,128,0.1)',
                                  padding: '3px 8px', borderRadius: 10, flexShrink: 0, marginLeft: 10,
                                }}>
                                  {count} locali
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Loading */}
                  {query.length >= 2 && searching && (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: '#8A8680', fontSize: 13 }}>
                      Cerco...
                    </div>
                  )}

                  {/* No results */}
                  {query.length >= 2 && !searching && suggestions.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: '#8A8680', fontSize: 13 }}>
                      Nessun risultato per "{query}"
                    </div>
                  )}

                  {/* Popular cities */}
                  {showPopular && (
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#8A8680', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Città popolari
                      </span>
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {POPULAR_CITIES.filter(c => c.name !== selectedCity).map((c) => {
                          const count = countNearbyRestaurants(c.lat, c.lng, restaurants);
                          return (
                            <button
                              key={c.name}
                              onClick={() => handleCitySelect(c.name, c.lng, c.lat)}
                              className="flex items-center justify-between w-full"
                              style={{
                                padding: '12px 14px', borderRadius: 14,
                                background: '#fff', border: '1.5px solid #E8E5DE',
                                cursor: 'pointer',
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ddd' }} />
                                <span style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{c.name}</span>
                              </div>
                              {count > 0 && (
                                <span style={{
                                  fontSize: 11, fontWeight: 600, color: '#4ADE80',
                                  background: 'rgba(74,222,128,0.1)',
                                  padding: '3px 8px', borderRadius: 10,
                                }}>
                                  {count} locali
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
