"use client";

import { useEffect, useRef } from "react";
import { Restaurant } from "@/lib/data";

type LeafletMarker = import("leaflet").Marker;

interface MapProps {
  restaurants: Restaurant[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function MapComponent({ restaurants, selectedId, onSelect }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Record<number, LeafletMarker>>({});

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;

      // Fix default marker icons
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      if (mapInstanceRef.current) return;

      const map = L.map(mapRef.current!, {
        center: [45.465, 9.19],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      mapInstanceRef.current = map;

      restaurants.forEach((r) => {
        const marker = L.marker([r.lat, r.lng])
          .addTo(map)
          .bindPopup(
            `<div style="min-width:160px">
              <strong style="font-size:14px">${r.name}</strong><br/>
              <span style="color:#666;font-size:12px">${r.category} • ${r.cuisine}</span><br/>
              <span style="color:#e67e22;font-weight:bold">${r.priceRange}</span>
            </div>`
          );

        marker.on("click", () => {
          onSelect(r.id);
        });

        markersRef.current[r.id] = marker;
      });
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = {};
      }
    };
  }, []);

  // Pan to selected restaurant
  useEffect(() => {
    if (!mapInstanceRef.current || selectedId === null) return;
    const restaurant = restaurants.find((r) => r.id === selectedId);
    if (!restaurant) return;
    mapInstanceRef.current.setView([restaurant.lat, restaurant.lng], 15, { animate: true });
    const marker = markersRef.current[selectedId];
    if (marker) marker.openPopup();
  }, [selectedId, restaurants]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-xl overflow-hidden shadow-lg"
      style={{ minHeight: "400px" }}
    />
  );
}
