"use client";

import { useEffect, useRef } from "react";
import { Restaurant } from "@/lib/data";

type LeafletMarker = import("leaflet").Marker;

interface MapProps {
  restaurants: Restaurant[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

const MARKER_SVG = (active: boolean) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <defs>
      <radialGradient id="g${active ? "a" : "b"}" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stop-color="${active ? "#ff8c5a" : "#ff6b35"}"/>
        <stop offset="100%" stop-color="${active ? "#ff3c6e" : "#cc4422"}"/>
      </radialGradient>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${active ? "rgba(255,60,110,0.6)" : "rgba(255,107,53,0.4)"}"/>
      </filter>
    </defs>
    <ellipse cx="18" cy="40" rx="6" ry="3" fill="rgba(0,0,0,0.3)"/>
    <path
      d="M18 2C10.27 2 4 8.27 4 16c0 10.5 14 26 14 26S32 26.5 32 16C32 8.27 25.73 2 18 2z"
      fill="url(#g${active ? "a" : "b"})"
      filter="url(#shadow)"
    />
    <circle cx="18" cy="16" r="6" fill="rgba(255,255,255,0.9)"/>
    <circle cx="18" cy="16" r="3" fill="${active ? "#ff3c6e" : "#ff6b35"}"/>
  </svg>
`;

export default function MapComponent({ restaurants, selectedId, onSelect }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Record<number, LeafletMarker>>({});

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;

      if (mapInstanceRef.current) return;

      const map = L.map(mapRef.current!, {
        center: [45.465, 9.19],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      // Dark tile layer — CartoDB Dark Matter
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Subtle attribution bottom-right
      L.control.attribution({ position: "bottomright", prefix: false })
        .addAttribution('© <a href="https://carto.com/" style="color:rgba(255,255,255,0.3)">CARTO</a>')
        .addTo(map);

      // Custom zoom control (top-right)
      L.control.zoom({ position: "topright" }).addTo(map);

      mapInstanceRef.current = map;

      restaurants.forEach((r) => {
        const icon = L.divIcon({
          html: MARKER_SVG(false),
          className: "",
          iconSize: [36, 44],
          iconAnchor: [18, 44],
          popupAnchor: [0, -46],
        });

        const marker = L.marker([r.lat, r.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="min-width:180px;font-family:system-ui,sans-serif">
              <div style="font-weight:700;font-size:14px;color:#f0f0f0;margin-bottom:4px">${r.name}</div>
              <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-bottom:6px">${r.category} · ${r.cuisine}</div>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="color:#ff6b35;font-weight:700;font-size:14px">${r.priceRange}</span>
                <span style="color:#fbbf24;font-size:12px">★ ${r.rating}</span>
              </div>
            </div>`,
            { maxWidth: 220 }
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

  // Update marker icons + pan on selection
  useEffect(() => {
    const updateMarkers = async () => {
      const L = (await import("leaflet")).default;

      Object.entries(markersRef.current).forEach(([id, marker]) => {
        const isActive = Number(id) === selectedId;
        marker.setIcon(
          L.divIcon({
            html: MARKER_SVG(isActive),
            className: "",
            iconSize: isActive ? [42, 52] : [36, 44],
            iconAnchor: isActive ? [21, 52] : [18, 44],
            popupAnchor: [0, isActive ? -54 : -46],
          })
        );
      });

      if (mapInstanceRef.current && selectedId !== null) {
        const restaurant = restaurants.find((r) => r.id === selectedId);
        if (restaurant) {
          mapInstanceRef.current.setView([restaurant.lat, restaurant.lng], 15, { animate: true });
          const marker = markersRef.current[selectedId];
          if (marker) marker.openPopup();
        }
      }
    };

    if (typeof window !== "undefined") updateMarkers();
  }, [selectedId, restaurants]);

  return (
    <div ref={mapRef} className="w-full h-full" style={{ minHeight: "400px" }} />
  );
}
