"use client";

import { useState } from "react";
import { Restaurant } from "@/lib/data";

interface RestaurantCardProps {
  restaurant: Restaurant;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

const categoryColors: Record<string, string> = {
  Ristorante: "bg-blue-100 text-blue-700",
  Trattoria: "bg-green-100 text-green-700",
  Pizzeria: "bg-red-100 text-red-700",
  Osteria: "bg-yellow-100 text-yellow-700",
  Bistrot: "bg-purple-100 text-purple-700",
  Sushi: "bg-pink-100 text-pink-700",
  Fusion: "bg-orange-100 text-orange-700",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= Math.round(rating) ? "text-amber-400" : "text-gray-300"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-sm text-gray-600 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function RestaurantCard({ restaurant, isSelected, onSelect }: RestaurantCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);

  return (
    <div
      className={`bg-white rounded-2xl shadow-md overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${
        isSelected ? "ring-2 ring-orange-400 shadow-xl" : ""
      }`}
      onClick={() => onSelect(restaurant.id)}
    >
      {/* Photo */}
      <div className="relative h-48 overflow-hidden bg-gray-100">
        <img
          src={restaurant.photos[photoIndex]}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        {restaurant.photos.length > 1 && (
          <div className="absolute bottom-2 right-2 flex gap-1">
            {restaurant.photos.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoIndex(i);
                }}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === photoIndex ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              categoryColors[restaurant.category] ?? "bg-gray-100 text-gray-700"
            }`}
          >
            {restaurant.category}
          </span>
        </div>
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-gray-800 font-bold text-sm px-2 py-1 rounded-full">
          {restaurant.priceRange}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-gray-900 text-lg leading-tight">{restaurant.name}</h3>
        </div>

        <p className="text-sm text-gray-500 mb-2">{restaurant.cuisine}</p>
        <StarRating rating={restaurant.rating} />

        <p className="text-sm text-gray-600 mt-3 line-clamp-2">{restaurant.description}</p>

        <div className="mt-4 space-y-2 border-t pt-3">
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{restaurant.address}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{restaurant.openingHours}</span>
          </div>

          <a
            href={`tel:${restaurant.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {restaurant.phone}
          </a>
        </div>
      </div>
    </div>
  );
}
