"use client";

import { useState } from "react";
import { Restaurant } from "@/lib/data";

interface RestaurantCardProps {
  restaurant: Restaurant;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

const categoryColors: Record<string, string> = {
  Ristorante: "rgba(96,165,250,0.15)",
  Trattoria: "rgba(74,222,128,0.15)",
  Pizzeria: "rgba(248,113,113,0.15)",
  Osteria: "rgba(251,191,36,0.15)",
  Bistrot: "rgba(192,132,252,0.15)",
  Sushi: "rgba(244,114,182,0.15)",
  Fusion: "rgba(251,146,60,0.15)",
};

const categoryTextColors: Record<string, string> = {
  Ristorante: "#60a5fa",
  Trattoria: "#4ade80",
  Pizzeria: "#f87171",
  Osteria: "#fbbf24",
  Bistrot: "#c084fc",
  Sushi: "#f472b6",
  Fusion: "#fb923c",
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((s) => (
          <svg
            key={s}
            className="w-3.5 h-3.5"
            style={{ color: s <= Math.round(rating) ? "#fbbf24" : "rgba(255,255,255,0.15)" }}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>{rating.toFixed(1)}</span>
    </div>
  );
}

export default function RestaurantCard({ restaurant, isSelected, onSelect }: RestaurantCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);

  const catColor = categoryColors[restaurant.category] ?? "rgba(255,255,255,0.08)";
  const catText = categoryTextColors[restaurant.category] ?? "rgba(255,255,255,0.7)";

  return (
    <div
      onClick={() => onSelect(restaurant.id)}
      className="card-hover glass rounded-2xl overflow-hidden cursor-pointer"
      style={
        isSelected
          ? {
              borderColor: "rgba(255,107,53,0.4)",
              boxShadow: "0 0 0 1px rgba(255,107,53,0.3), 0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(255,107,53,0.1)",
            }
          : {}
      }
    >
      {/* Photo */}
      <div className="relative h-44 overflow-hidden" style={{ background: "#111" }}>
        <img
          src={restaurant.photos[photoIndex]}
          alt={restaurant.name}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          style={{ opacity: 0.9 }}
        />

        {/* Gradient overlay bottom */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)",
          }}
        />

        {/* Category badge */}
        <div className="absolute top-3 left-3">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: catColor,
              color: catText,
              backdropFilter: "blur(8px)",
              border: `1px solid ${catText}30`,
            }}
          >
            {restaurant.category}
          </span>
        </div>

        {/* Price badge */}
        <div className="absolute top-3 right-3">
          <span
            className="text-sm font-bold px-2.5 py-1 rounded-full"
            style={{
              background: "rgba(0,0,0,0.6)",
              color: "#ff6b35",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,107,53,0.25)",
            }}
          >
            {restaurant.priceRange}
          </span>
        </div>

        {/* Photo dots */}
        {restaurant.photos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {restaurant.photos.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoIndex(i);
                }}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === photoIndex ? "16px" : "6px",
                  height: "6px",
                  background: i === photoIndex ? "#ff6b35" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold text-base leading-tight" style={{ color: "#f0f0f0" }}>
            {restaurant.name}
          </h3>
        </div>

        <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
          {restaurant.cuisine}
        </p>

        <Stars rating={restaurant.rating} />

        <p
          className="text-sm mt-3 line-clamp-2 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {restaurant.description}
        </p>

        {/* Divider */}
        <div className="my-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

        {/* Info rows */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{restaurant.address}</span>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{restaurant.openingHours}</span>
          </div>

          {/* Call button */}
          <a
            href={`tel:${restaurant.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 mt-1 px-3 py-2 rounded-xl btn-glow text-white text-sm font-semibold justify-center"
            style={{ background: "linear-gradient(135deg,#ff6b35,#ff3c6e)" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {restaurant.phone}
          </a>
        </div>
      </div>
    </div>
  );
}
