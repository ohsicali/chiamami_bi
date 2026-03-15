"use client";

import { Category, PriceRange, categories, priceRanges, cuisines } from "@/lib/data";

interface FiltersProps {
  selectedCategory: Category | null;
  selectedPrice: PriceRange | null;
  selectedCuisine: string | null;
  onCategoryChange: (c: Category | null) => void;
  onPriceChange: (p: PriceRange | null) => void;
  onCuisineChange: (c: string | null) => void;
  total: number;
  filtered: number;
}

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 border ${
        active
          ? color ?? "bg-orange-500 text-white border-orange-500 shadow"
          : "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-500"
      }`}
    >
      {label}
    </button>
  );
}

export default function Filters({
  selectedCategory,
  selectedPrice,
  selectedCuisine,
  onCategoryChange,
  onPriceChange,
  onCuisineChange,
  total,
  filtered,
}: FiltersProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Filtra i locali</h2>
        <span className="text-sm text-gray-500">
          {filtered} / {total} locali
        </span>
      </div>

      {/* Category */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">Categoria</p>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="Tutti"
            active={selectedCategory === null}
            onClick={() => onCategoryChange(null)}
          />
          {categories.map((cat) => (
            <FilterChip
              key={cat}
              label={cat}
              active={selectedCategory === cat}
              onClick={() => onCategoryChange(selectedCategory === cat ? null : cat)}
            />
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">Fascia di prezzo</p>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="Tutti"
            active={selectedPrice === null}
            onClick={() => onPriceChange(null)}
          />
          {priceRanges.map((p) => (
            <FilterChip
              key={p}
              label={p}
              active={selectedPrice === p}
              onClick={() => onPriceChange(selectedPrice === p ? null : p)}
            />
          ))}
        </div>
      </div>

      {/* Cuisine */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">Stile di cucina</p>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="Tutti"
            active={selectedCuisine === null}
            onClick={() => onCuisineChange(null)}
          />
          {cuisines.map((c) => (
            <FilterChip
              key={c}
              label={c}
              active={selectedCuisine === c}
              onClick={() => onCuisineChange(selectedCuisine === c ? null : c)}
            />
          ))}
        </div>
      </div>

      {/* Reset */}
      {(selectedCategory || selectedPrice || selectedCuisine) && (
        <button
          onClick={() => {
            onCategoryChange(null);
            onPriceChange(null);
            onCuisineChange(null);
          }}
          className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Rimuovi filtri
        </button>
      )}
    </div>
  );
}
