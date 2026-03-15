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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">🍽️</span>
            </div>
            <div>
              <h1 className="font-bold text-xl text-gray-900 leading-tight">chiamami.bi</h1>
              <p className="text-xs text-gray-400">I migliori ristoranti consigliati per te</p>
            </div>
          </div>
          {/* Search */}
          <div className="relative max-w-xs w-full hidden sm:block">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Cerca ristorante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-gray-50"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Mobile search */}
        <div className="sm:hidden mb-4 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Cerca ristorante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: filters + cards */}
          <div className="lg:col-span-1 space-y-4">
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

            <div className="space-y-4">
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="font-medium">Nessun ristorante trovato</p>
                  <p className="text-sm mt-1">Prova a cambiare i filtri</p>
                </div>
              ) : (
                filtered.map((r) => (
                  <RestaurantCard
                    key={r.id}
                    restaurant={r}
                    isSelected={selectedId === r.id}
                    onSelect={setSelectedId}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right column: map */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 h-[calc(100vh-7rem)] rounded-2xl overflow-hidden shadow-lg">
              <Map restaurants={filtered} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
