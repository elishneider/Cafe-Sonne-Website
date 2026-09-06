"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CafeSunSummary } from "@/lib/cafeSunSummary";
import { SUN_STATUS_BADGE_CLASS, SUN_STATUS_DOT_COLOR, SUN_STATUS_LABEL } from "@/lib/sunStatusPresentation";
import { describeCurrentSegment } from "@/lib/sunTimeline";

const LONDON_CENTER: [number, number] = [51.5225, -0.145];

function buildPopupHtml(summary: CafeSunSummary) {
  const { cafe, status, todayTimeline } = summary;
  const summaryLine = describeCurrentSegment(todayTimeline, todayTimeline[0]?.start ?? new Date());
  return `
    <div class="cafe-card-body">
      <div class="cafe-card-head">
        <h3>${cafe.name}</h3>
        <span class="badge ${SUN_STATUS_BADGE_CLASS[status]}">${SUN_STATUS_LABEL[status]}</span>
      </div>
      <p class="cafe-card-meta">${cafe.seatingNotes} · Open ${cafe.opens}–${cafe.closes}</p>
      ${summaryLine ? `<p class="sun-label">${summaryLine}</p>` : ""}
    </div>
  `;
}

export function CafeMapSection({ summaries }: { summaries: CafeSunSummary[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef<Map<string, Leaflet.Marker>>(new Map());
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current).setView(LONDON_CENTER, 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    summaries.forEach((summary) => {
      const icon = L.divIcon({
        className: "cafe-marker",
        html: `<span style="background:${SUN_STATUS_DOT_COLOR[summary.status]}"></span>`,
        iconSize: [18, 18],
      });
      const marker = L.marker([summary.cafe.latitude, summary.cafe.longitude], { icon })
        .addTo(map)
        .bindPopup(buildPopupHtml(summary));
      markersRef.current.set(summary.cafe.id, marker);
    });
  }, [ready, summaries]);

  function goToCafe(cafeId: string) {
    const map = mapRef.current;
    const marker = markersRef.current.get(cafeId);
    if (!map || !marker) return;
    map.setView(marker.getLatLng(), 16, { animate: true });
    marker.openPopup();
    setQuery("");
  }

  function useMyLocation() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition((position) => {
      mapRef.current?.setView([position.coords.latitude, position.coords.longitude], 15, {
        animate: true,
      });
    });
  }

  const matches = query.trim()
    ? summaries.filter((s) => s.cafe.name.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  return (
    <div className="map-panel">
      <div className="map-search">
        <input
          type="text"
          placeholder="Search for a café…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="btn btn-primary btn-small" onClick={useMyLocation}>
          📍 My location
        </button>
        {matches.length > 0 && (
          <ul className="map-search-results">
            {matches.map((summary) => (
              <li key={summary.cafe.id}>
                <button type="button" onClick={() => goToCafe(summary.cafe.id)}>
                  {summary.cafe.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div ref={containerRef} className="cafe-map" />
    </div>
  );
}
