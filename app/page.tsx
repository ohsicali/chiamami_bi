"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { restaurants, Category, PriceRange } from "@/lib/data";
import RestaurantCard from "@/components/RestaurantCard";
import Filters from "@/components/Filters";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

type MobileView = "list" | "map";

export default function Home() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<PriceRange | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mobileView, setMobileView] = useState<MobileView>("list");

  // Refs for scrolling to card
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      if (selectedCategory && r.category !== selectedCategory) return false;
      if (selectedPrice && r.priceRange !== selectedPrice) return false;
      if (selectedNeighborhood && r.neighborhood !== selectedNeighborhood) return false;
      if (
        search &&
        !r.name.toLowerCase().includes(search.toLowerCase()) &&
        !r.cuisine.toLowerCase().includes(search.toLowerCase()) &&
        !r.neighborhood.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [selectedCategory, selectedPrice, selectedNeighborhood, search]);

  // When marker clicked on map → scroll card into view
  const handleSelect = useCallback((id: number) => {
    setSelectedId(id);
    // On mobile, switch to list view to show the card
    setMobileView("list");
    // Scroll to card after a short delay (allow render)
    setTimeout(() => {
      const el = cardRefs.current[id];
      if (el && listRef.current) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  }, []);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* ─── HEADER ─────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6">
          {/* Top row: logo + search */}
          <div className="flex items-center gap-4 py-3">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm btn-primary"
              >
                🍽️
              </div>
              <span className="font-bold text-lg tracking-tight gradient-text hidden sm:block">
                chiamami.bi
              </span>
            </a>

            {/* Search bar */}
            <div className="flex-1 relative max-w-lg mx-auto">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "var(--muted)" }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Ristorante, cucina, quartiere..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm focus:outline-none transition-all"
                style={{
                  background: "var(--bg)",
                  border: "1.5px solid var(--border)",
                  color: "var(--text)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
            </div>

            {/* Result count */}
            <span
              className="flex-shrink-0 text-sm font-medium hidden md:block"
              style={{ color: "var(--muted)" }}
            >
              {filtered.length} ristoranti
            </span>
          </div>

          {/* Filters row */}
          <div className="pb-3">
            <Filters
              selectedCategory={selectedCategory}
              selectedPrice={selectedPrice}
              selectedNeighborhood={selectedNeighborhood}
              onCategoryChange={setSelectedCategory}
              onPriceChange={setSelectedPrice}
              onNeighborhoodChange={setSelectedNeighborhood}
            />
          </div>
        </div>
      </header>

      {/* ─── MOBILE VIEW TOGGLE ─────────────────────────── */}
      <div
        className="lg:hidden sticky z-40 flex gap-1 p-1 mx-4 mt-3 mb-1 rounded-2xl"
        style={{ top: "120px", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <button
          onClick={() => setMobileView("list")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={
            mobileView === "list"
              ? { background: "var(--accent)", color: "#fff" }
              : { color: "var(--muted)" }
          }
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Lista ({filtered.length})
        </button>
        <button
          onClick={() => setMobileView("map")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={
            mobileView === "map"
              ? { background: "var(--accent)", color: "#fff" }
              : { color: "var(--muted)" }
          }
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Mappa
        </button>
      </div>

      {/* ─── MAIN CONTENT ───────────────────────────────── */}
      <main className="max-w-[1380px] mx-auto px-0 sm:px-4 lg:px-6 py-4">
        <div className="lg:grid lg:grid-cols-[420px_1fr] lg:gap-5 lg:items-start">

          {/* ── LIST (desktop always visible, mobile conditional) */}
          <div
            ref={listRef}
            className={`${mobileView === "list" ? "block" : "hidden"} lg:block lg:overflow-y-auto px-4 lg:px-0`}
            style={{ maxHeight: "calc(100vh - 140px)", overflowY: "auto" }}
          >
            {filtered.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-20 text-center rounded-2xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <span className="text-5xl mb-4">🔍</span>
                <p className="font-semibold text-lg">Nessun ristorante trovato</p>
                <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                  Prova a modificare i filtri di ricerca
                </p>
              </div>
            ) : (
              <div className="space-y-3 pb-6">
                {filtered.map((r, i) => (
                  <div
                    key={r.id}
                    ref={(el) => { cardRefs.current[r.id] = el; }}
                    className="slide-up"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <RestaurantCard
                      restaurant={r}
                      isSelected={selectedId === r.id}
                      onSelect={handleSelect}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── MAP (desktop always visible, mobile conditional) */}
          <div
            className={`${mobileView === "map" ? "block" : "hidden"} lg:block lg:sticky lg:top-[140px] rounded-2xl overflow-hidden mx-4 lg:mx-0`}
            style={{
              height: mobileView === "map" ? "calc(100vh - 170px)" : undefined,
              minHeight: "500px",
              maxHeight: "calc(100vh - 140px)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <Map
              restaurants={filtered}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
