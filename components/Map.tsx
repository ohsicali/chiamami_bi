"use client";

import { useEffect, useRef } from "react";
import { Restaurant } from "@/lib/data";

type LeafletMarker = import("leaflet").Marker;

interface MapProps {
  restaurants: Restaurant[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

// SVG marker: normal vs selected
const markerSVG = (active: boolean) => {
  const color = active ? "#ff5a1f" : "#ff8c5a";
  const size = active ? 44 : 36;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.2}" viewBox="0 0 44 54">
      <defs>
        <radialGradient id="mg" cx="40%" cy="28%" r="65%">
          <stop offset="0%" stop-color="${active ? "#ff8c5a" : "#ffb38a"}"/>
          <stop offset="100%" stop-color="${color}"/>
        </radialGradient>
        <filter id="mf" x="-40%" y="-30%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="${active ? 5 : 3}"
            flood-color="${active ? "rgba(255,90,31,0.55)" : "rgba(0,0,0,0.3)"}"/>
        </filter>
      </defs>
      <path d="M22 2C13.16 2 6 9.16 6 18c0 12.5 16 34 16 34S38 30.5 38 18C38 9.16 30.84 2 22 2z"
        fill="url(#mg)" filter="url(#mf)"/>
      <circle cx="22" cy="18" r="8" fill="rgba(255,255,255,0.95)"/>
      <circle cx="22" cy="18" r="${active ? 5 : 4}" fill="${color}"/>
    </svg>
  `;
};

// Liquid glass popup HTML
const popupHTML = (r: Restaurant) => `
  <div style="
    width:220px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
    overflow:hidden;
  ">
    <img src="${r.photos[0]}" alt="${r.name}"
      style="width:100%;height:110px;object-fit:cover;display:block;"/>
    <div style="padding:12px 14px;">
      <div style="font-weight:700;font-size:14px;color:#1a1a1a;margin-bottom:3px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div>
      <div style="font-size:11px;color:#888;margin-bottom:8px">${r.category} · ${r.cuisine}</div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="
            background:#00b37e;color:#fff;font-weight:700;font-size:12px;
            padding:2px 7px;border-radius:5px;display:inline-flex;align-items:center;gap:3px
          ">★ ${r.rating}</span>
          <span style="font-size:11px;color:#888">(${r.reviewCount})</span>
        </div>
        <span style="font-weight:700;color:#ff5a1f;font-size:14px">${r.priceRange}</span>
      </div>
      <div style="margin-top:8px;font-size:11px;color:#888;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        📍 ${r.address}
      </div>
    </div>
  </div>
`;

// Turin center
const TORINO = { lat: 45.0703, lng: 7.6869 };

export default function MapComponent({ restaurants, selectedId, onSelect }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Record<number, LeafletMarker>>({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Init map once
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    let mounted = true;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      if (!mounted || mapInstanceRef.current || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [TORINO.lat, TORINO.lng],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      // Light colorful Voyager tiles
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Attribution
      L.control.attribution({ position: "bottomleft", prefix: false })
        .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>')
        .addTo(map);

      // Zoom control liquid glass
      L.control.zoom({ position: "topright" }).addTo(map);

      mapInstanceRef.current = map;

      // Add markers
      restaurants.forEach((r) => {
        const icon = L.divIcon({
          html: markerSVG(false),
          className: "",
          iconSize: [36, 44],
          iconAnchor: [18, 44],
          popupAnchor: [0, -48],
        });

        const marker = L.marker([r.lat, r.lng], { icon })
          .addTo(map)
          .bindPopup(popupHTML(r), { maxWidth: 220, minWidth: 220, closeButton: true });

        marker.on("click", () => {
          onSelectRef.current(r.id);
        });

        markersRef.current[r.id] = marker;
      });
    };

    initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = {};
      }
    };
  }, []);

  // React to selectedId: update marker icons + pan + open popup
  useEffect(() => {
    const update = async () => {
      if (!mapInstanceRef.current) return;
      const L = (await import("leaflet")).default;

      // Update all marker icons
      Object.entries(markersRef.current).forEach(([id, marker]) => {
        const active = Number(id) === selectedId;
        marker.setIcon(
          L.divIcon({
            html: markerSVG(active),
            className: "",
            iconSize: active ? [44, 53] : [36, 44],
            iconAnchor: active ? [22, 53] : [18, 44],
            popupAnchor: [0, active ? -56 : -48],
          })
        );
        if (active) marker.setZIndexOffset(1000);
        else marker.setZIndexOffset(0);
      });

      // Pan + popup
      if (selectedId !== null) {
        const r = restaurants.find((x) => x.id === selectedId);
        if (r && mapInstanceRef.current) {
          mapInstanceRef.current.setView([r.lat, r.lng], 15, { animate: true });
          const marker = markersRef.current[selectedId];
          if (marker) {
            marker.openPopup();
          }
        }
      }
    };

    if (typeof window !== "undefined") update();
  }, [selectedId, restaurants]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: "400px" }} />

      {/* Liquid glass overlay: top-left label */}
      <div
        className="absolute top-3 left-3 z-[400] flex items-center gap-2 px-3 py-2 rounded-xl"
        style={{
          background: "rgba(255,255,255,0.62)",
          backdropFilter: "blur(18px) saturate(180%)",
          WebkitBackdropFilter: "blur(18px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.85)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
          fontSize: "13px",
          fontWeight: 600,
          color: "#1a1a1a",
        }}
      >
        <svg className="w-4 h-4" style={{ color: "#ff5a1f" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Torino
        <span
          className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {restaurants.length}
        </span>
      </div>
    </div>
  );
}
