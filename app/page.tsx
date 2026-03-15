"use client";

import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { restaurants, Category, PriceRange } from "@/lib/data";
import RestaurantCard from "@/components/RestaurantCard";
import Filters from "@/components/Filters";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Home() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<PriceRange | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      if (selectedCategory && r.category !== selectedCategory) return false;
      if (selectedPrice && r.priceRange !== selectedPrice) return false;
      if (selectedCuisine && r.cuisine !== selectedCuisine) return false;
      if (
        search &&
        !r.name.toLowerCase().includes(search.toLowerCase()) &&
        !r.cuisine.toLowerCase().includes(search.toLowerCase()) &&
        !r.description.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [selectedCategory, selectedPrice, selectedCuisine, search]);

  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      {/* Ambient background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="orb w-96 h-96 top-[-80px] left-[-80px]"
          style={{ background: "rgba(255,107,53,0.12)" }}
        />
        <div
          className="orb w-80 h-80 bottom-[10%] right-[-60px]"
          style={{ background: "rgba(255,60,110,0.10)" }}
        />
        <div
          className="orb w-64 h-64 top-[40%] left-[30%]"
          style={{ background: "rgba(255,107,53,0.06)" }}
        />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(8,8,8,0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg btn-glow"
            >
              🍽️
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight gradient-text">chiamami.bi</span>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Ristoranti consigliati
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-sm w-full hidden sm:block">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "rgba(255,255,255,0.3)" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Cerca ristorante, cucina..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f0f0f0",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,107,53,0.4)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,107,53,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Live badge */}
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full glass"
            style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}
          >
            <span
              className="pulse-dot w-2 h-2 rounded-full"
              style={{ background: "#22c55e" }}
            />
            {filtered.length} locali
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 relative z-10">
        {/* Mobile search */}
        <div className="sm:hidden mb-4 relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "rgba(255,255,255,0.3)" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cerca ristorante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#f0f0f0",
            }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
          {/* Left: filters + cards */}
          <div className="space-y-4 min-w-0">
            <Filters
              selectedCategory={selectedCategory}
              selectedPrice={selectedPrice}
              selectedCuisine={selectedCuisine}
              onCategoryChange={setSelectedCategory}
              onPriceChange={setSelectedPrice}
              onCuisineChange={setSelectedCuisine}
              total={restaurants.length}
              filtered={filtered.length}
            />

            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div
                  className="glass rounded-2xl p-10 text-center fade-up"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  <div className="text-4xl mb-3 opacity-50">🔍</div>
                  <p className="font-medium text-white">Nessun risultato</p>
                  <p className="text-sm mt-1">Prova a modificare i filtri</p>
                </div>
              ) : (
                filtered.map((r, i) => (
                  <div
                    key={r.id}
                    className="fade-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <RestaurantCard
                      restaurant={r}
                      isSelected={selectedId === r.id}
                      onSelect={setSelectedId}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: map */}
          <div className="hidden lg:block">
            <div
              className="sticky top-24 rounded-2xl overflow-hidden"
              style={{
                height: "calc(100vh - 7rem)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 0 60px rgba(0,0,0,0.5)",
              }}
            >
              <Map restaurants={filtered} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </div>
        </div>

        {/* Mobile map toggle */}
        <div className="lg:hidden mt-5 rounded-2xl overflow-hidden" style={{ height: "50vh", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Map restaurants={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </main>
    </div>
  );
}
