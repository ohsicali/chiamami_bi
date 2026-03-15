"use client";

import { useState } from "react";
import { Restaurant } from "@/lib/data";

interface Props {
  restaurant: Restaurant;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

const categoryColors: Record<string, { bg: string; text: string }> = {
  Ristorante: { bg: "#EBF5FF", text: "#1D6FA4" },
  Trattoria:  { bg: "#E8F8EF", text: "#1A7A48" },
  Pizzeria:   { bg: "#FFF0EE", text: "#C8391A" },
  Osteria:    { bg: "#FFF8E6", text: "#9B6B00" },
  Bistrot:    { bg: "#F3EEFF", text: "#6B3FA0" },
  Sushi:      { bg: "#FEE8F4", text: "#A0286E" },
  Fusion:     { bg: "#FFF3E8", text: "#A0520A" },
};

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <svg key={s} className="w-3.5 h-3.5" viewBox="0 0 20 20"
          fill={s <= full ? "#FFBB00" : (s === full + 1 && half ? "url(#half)" : "#E0D8CF")}>
          <defs>
            <linearGradient id="half" x1="0" x2="100%" y1="0" y2="0">
              <stop offset="50%" stopColor="#FFBB00"/>
              <stop offset="50%" stopColor="#E0D8CF"/>
            </linearGradient>
          </defs>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

export default function RestaurantCard({ restaurant: r, isSelected, onSelect }: Props) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const cat = categoryColors[r.category] ?? { bg: "#F0EDED", text: "#555" };

  return (
    <div
      className={`card ${isSelected ? "selected" : ""}`}
      onClick={() => onSelect(r.id)}
    >
      <div className="flex gap-0">
        {/* ── Photo */}
        <div className="relative flex-shrink-0 w-[140px] sm:w-[160px]">
          <img
            src={r.photos[photoIdx]}
            alt={r.name}
            className="w-full h-full object-cover rounded-l-2xl"
            style={{ minHeight: "160px", maxHeight: "190px" }}
          />
          {/* Photo nav dots */}
          {r.photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {r.photos.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setPhotoIdx(i); }}
                  className="rounded-full transition-all"
                  style={{
                    width: i === photoIdx ? 14 : 6,
                    height: 6,
                    background: i === photoIdx ? "var(--accent)" : "rgba(255,255,255,0.7)",
                  }}
                />
              ))}
            </div>
          )}
          {/* Selected indicator */}
          {isSelected && (
            <div
              className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full"
              style={{ background: "var(--accent)", boxShadow: "0 0 0 3px rgba(255,90,31,0.25)" }}
            />
          )}
        </div>

        {/* ── Content */}
        <div className="flex-1 min-w-0 p-3.5 flex flex-col justify-between">
          {/* Top section */}
          <div>
            {/* Category + neighborhood */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: cat.bg, color: cat.text }}
              >
                {r.category}
              </span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {r.neighborhood}
              </span>
            </div>

            {/* Name */}
            <h3
              className="font-bold text-base leading-snug mb-1 truncate"
              style={{ color: "var(--text)" }}
            >
              {r.name}
            </h3>

            {/* Cuisine */}
            <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
              {r.cuisine}
            </p>

            {/* Rating + reviews */}
            <div className="flex items-center gap-2 mb-2">
              <div className="rating-badge">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {r.rating.toFixed(1)}
              </div>
              <Stars rating={r.rating} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                ({r.reviewCount})
              </span>
            </div>

            {/* Description */}
            <p
              className="text-xs leading-relaxed line-clamp-2 mb-2"
              style={{ color: "var(--muted)" }}
            >
              {r.description}
            </p>
          </div>

          {/* Bottom section */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Price range + avg */}
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-bold"
                style={{ color: "var(--accent)" }}
              >
                {r.priceRange}
              </span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                · ~€{r.avgPrice}/pers
              </span>
            </div>

            {/* Call button */}
            <a
              href={`tel:${r.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Chiama
            </a>
          </div>

          {/* Address + hours */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 flex-shrink-0" style={{ color: "var(--muted)" }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs truncate max-w-[140px]" style={{ color: "var(--muted)" }}>
                {r.address}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 flex-shrink-0" style={{ color: "var(--muted)" }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{r.openingHours}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
