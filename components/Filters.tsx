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

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150"
      style={
        active
          ? {
              background: "linear-gradient(135deg,#ff6b35,#ff3c6e)",
              color: "#fff",
              border: "1px solid transparent",
              boxShadow: "0 0 12px rgba(255,107,53,0.35)",
            }
          : {
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(255,255,255,0.08)",
            }
      }
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
  const hasFilters = selectedCategory || selectedPrice || selectedCuisine;

  return (
    <div
      className="glass rounded-2xl p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
          Filtra
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            {filtered}/{total}
          </span>
          {hasFilters && (
            <button
              onClick={() => {
                onCategoryChange(null);
                onPriceChange(null);
                onCuisineChange(null);
              }}
              className="text-xs px-2 py-0.5 rounded-full transition-colors"
              style={{
                color: "#ff6b35",
                border: "1px solid rgba(255,107,53,0.25)",
                background: "rgba(255,107,53,0.08)",
              }}
            >
              reset
            </button>
          )}
        </div>
      </div>

      {/* Category */}
      <div>
        <p
          className="text-xs uppercase tracking-widest mb-2"
          style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}
        >
          Categoria
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip label="Tutti" active={!selectedCategory} onClick={() => onCategoryChange(null)} />
          {categories.map((c) => (
            <Chip
              key={c}
              label={c}
              active={selectedCategory === c}
              onClick={() => onCategoryChange(selectedCategory === c ? null : c)}
            />
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <p
          className="text-xs uppercase tracking-widest mb-2"
          style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}
        >
          Prezzo
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip label="Tutti" active={!selectedPrice} onClick={() => onPriceChange(null)} />
          {priceRanges.map((p) => (
            <Chip
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
        <p
          className="text-xs uppercase tracking-widest mb-2"
          style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}
        >
          Cucina
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip label="Tutti" active={!selectedCuisine} onClick={() => onCuisineChange(null)} />
          {cuisines.map((c) => (
            <Chip
              key={c}
              label={c}
              active={selectedCuisine === c}
              onClick={() => onCuisineChange(selectedCuisine === c ? null : c)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
