"use client";

import { useRef } from "react";
import { Category, PriceRange, categories, priceRanges, neighborhoods } from "@/lib/data";

interface FiltersProps {
  selectedCategory: Category | null;
  selectedPrice: PriceRange | null;
  selectedNeighborhood: string | null;
  onCategoryChange: (c: Category | null) => void;
  onPriceChange: (p: PriceRange | null) => void;
  onNeighborhoodChange: (n: string | null) => void;
}

const categoryIcons: Record<string, string> = {
  Ristorante: "🍽️",
  Trattoria: "🫕",
  Pizzeria: "🍕",
  Osteria: "🍷",
  Bistrot: "☕",
  Sushi: "🍣",
  Fusion: "🌍",
};

export default function Filters({
  selectedCategory,
  selectedPrice,
  selectedNeighborhood,
  onCategoryChange,
  onPriceChange,
  onNeighborhoodChange,
}: FiltersProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasActive = selectedCategory || selectedPrice || selectedNeighborhood;

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-2 overflow-x-auto pb-1"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {/* Reset all */}
      {hasActive && (
        <button
          onClick={() => {
            onCategoryChange(null);
            onPriceChange(null);
            onNeighborhoodChange(null);
          }}
          className="chip flex-shrink-0"
          style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-light)" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Rimuovi filtri
        </button>
      )}

      {/* Separator */}
      {hasActive && <div className="w-px h-6 flex-shrink-0" style={{ background: "var(--border)" }} />}

      {/* Categories */}
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onCategoryChange(selectedCategory === c ? null : c)}
          className={`chip flex-shrink-0 ${selectedCategory === c ? "active" : ""}`}
        >
          <span>{categoryIcons[c]}</span>
          {c}
        </button>
      ))}

      <div className="w-px h-6 flex-shrink-0" style={{ background: "var(--border)" }} />

      {/* Price */}
      {priceRanges.map((p) => (
        <button
          key={p}
          onClick={() => onPriceChange(selectedPrice === p ? null : p)}
          className={`chip flex-shrink-0 ${selectedPrice === p ? "active" : ""}`}
        >
          {p}
        </button>
      ))}

      <div className="w-px h-6 flex-shrink-0" style={{ background: "var(--border)" }} />

      {/* Neighborhoods */}
      {neighborhoods.map((n) => (
        <button
          key={n}
          onClick={() => onNeighborhoodChange(selectedNeighborhood === n ? null : n)}
          className={`chip flex-shrink-0 ${selectedNeighborhood === n ? "active" : ""}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          {n}
        </button>
      ))}
    </div>
  );
}
