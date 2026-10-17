"use client";

import { useEffect, useRef, useState } from "react";
import type { CafeSunSummary } from "@/lib/cafeSunSummary";
import { SUN_STATUS_BADGE_CLASS, SUN_STATUS_DOT_COLOR, SUN_STATUS_LABEL } from "@/lib/sunStatusPresentation";
import { formatHours } from "@/lib/cafeHours";
import { SEATING_TYPE_LABEL } from "@/lib/seatingTypePresentation";
import { describeCurrentSegment } from "@/lib/sunTimeline";

const LONDON_CENTER = { lat: 51.5225, lng: -0.145 };
const GOOGLE_MAPS_SCRIPT_ID = "google-maps-js-sdk";
const GOOGLE_MAPS_CALLBACK_NAME = "__cafeSonneGoogleMapsReady";

// Module-scoped so concurrent/duplicate effect runs (e.g. React Strict Mode's
// double-invoke in dev) share one script tag instead of racing to add their own.
// Uses the classic `callback=` query param rather than `loading=async` + importLibrary:
// the callback only fires once Google's *entire* API (Map, Marker, InfoWindow, ...) has
// finished loading, unlike a plain script "load" event which can fire before the real
// API classes are attached to window.google.maps.
let scriptLoadPromise: Promise<typeof google> | null = null;

function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (window.google?.maps?.Map) return Promise.resolve(window.google);
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    (window as unknown as Record<string, () => void>)[GOOGLE_MAPS_CALLBACK_NAME] = () => resolve(window.google);

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${GOOGLE_MAPS_CALLBACK_NAME}`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

function buildPopupHtml(summary: CafeSunSummary) {
  const { cafe, status, todayTimeline, todayHours } = summary;
  const summaryLine = describeCurrentSegment(todayTimeline, todayTimeline[0]?.start ?? new Date());
  return `
    <div class="cafe-card-body">
      <div class="cafe-card-head">
        <h3>${cafe.name}</h3>
        <span class="badge ${SUN_STATUS_BADGE_CLASS[status]}">${SUN_STATUS_LABEL[status]}</span>
      </div>
      <p class="cafe-card-meta">${SEATING_TYPE_LABEL[cafe.seatingType]}</p>
      <p class="cafe-card-meta">${cafe.addressLine} · ${formatHours(todayHours)}</p>
      ${summaryLine ? `<p class="sun-label">${summaryLine}</p>` : ""}
    </div>
  `;
}

export function CafeMapSection({ summaries }: { summaries: CafeSunSummary[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!apiKey) return;

    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new g.maps.Map(containerRef.current, {
          center: LONDON_CENTER,
          zoom: 13,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        infoWindowRef.current = new g.maps.InfoWindow();
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const g = window.google;
    if (!ready || !map || !g) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    summaries.forEach((summary) => {
      const marker = new g.maps.Marker({
        position: { lat: summary.cafe.latitude, lng: summary.cafe.longitude },
        map,
        title: summary.cafe.name,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: SUN_STATUS_DOT_COLOR[summary.status],
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(buildPopupHtml(summary));
        infoWindowRef.current?.open({ map, anchor: marker });
      });
      markersRef.current.set(summary.cafe.id, marker);
    });
  }, [ready, summaries]);

  function goToCafe(cafeId: string) {
    const map = mapRef.current;
    const marker = markersRef.current.get(cafeId);
    const summary = summaries.find((s) => s.cafe.id === cafeId);
    const position = marker?.getPosition();
    if (!map || !marker || !summary || !position) return;
    map.panTo(position);
    map.setZoom(16);
    infoWindowRef.current?.setContent(buildPopupHtml(summary));
    infoWindowRef.current?.open({ map, anchor: marker });
    setQuery("");
  }

  function useMyLocation() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition((position) => {
      mapRef.current?.panTo({ lat: position.coords.latitude, lng: position.coords.longitude });
      mapRef.current?.setZoom(15);
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
      {loadError || !apiKey ? (
        <div className="cafe-map cafe-map-error">Map unavailable — check the Google Maps API key.</div>
      ) : (
        <div ref={containerRef} className="cafe-map" />
      )}
    </div>
  );
}
