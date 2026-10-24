"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getStatusAtTime, getTomorrowStatuses, type CafeSunSummary } from "@/lib/cafeSunSummary";
import { MapFilterMenu } from "@/components/MapFilterMenu";
import { NOW, getWhenDate, isWhenSet, type MapWhen } from "@/lib/mapWhen";
import {
  SUN_STATUS_BADGE_CLASS,
  SUN_STATUS_DOT_COLOR,
  SUN_STATUS_ICON,
  SUN_STATUS_LABEL,
  SUN_STATUS_PIN_FILL,
} from "@/lib/sunStatusPresentation";
import { SEATING_TYPE_LABEL } from "@/lib/seatingTypePresentation";
import { formatHours } from "@/lib/cafeHours";
import type { SunStatus } from "@/lib/sunStatus";
import type { DisplayStatus } from "@/lib/sunTimeline";
import { CafeCard } from "@/components/CafeCard";

const LONDON_CENTER = { lat: 51.5225, lng: -0.145 };
const DEFAULT_ZOOM = 13;
const SEARCH_MAX_ZOOM = 12;
const CAFE_FOCUS_ZOOM = 14;
// Zoomed out further than this, pins are too small to make out — treat as lost.
const MIN_SEARCH_ZOOM = 9;
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

const PIN_SIZE_PX = 40;


// A circular pin with the status glyph inside, drawn as an SVG data URL so it works
// with the classic Marker (no Map ID needed).
function buildPinIcon(status: DisplayStatus): google.maps.Icon | google.maps.Symbol {
  if (status === "closed") {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: SUN_STATUS_DOT_COLOR.closed,
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 2,
    };
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_SIZE_PX}" height="${PIN_SIZE_PX}" viewBox="0 0 40 40">
    <circle cx="20" cy="21" r="16" fill="rgba(0,0,0,0.18)"/>
    <circle cx="20" cy="20" r="16" fill="${SUN_STATUS_PIN_FILL[status]}" stroke="${SUN_STATUS_DOT_COLOR[status]}" stroke-width="3"/>
    <text x="20" y="20" font-size="18" text-anchor="middle" dominant-baseline="central" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${SUN_STATUS_ICON[status]}</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(PIN_SIZE_PX, PIN_SIZE_PX),
    anchor: new google.maps.Point(PIN_SIZE_PX / 2, PIN_SIZE_PX / 2),
  };
}

export function CafeMapSection({
  summaries,
  variant = "inline",
}: {
  summaries: CafeSunSummary[];
  // "page" = the dedicated /map page: always the full sidebar + map layout, under the
  // site header, with no expand/collapse button.
  variant?: "inline" | "page";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  // The InfoWindow's content is a plain div that React fills with the real CafeCard via a
  // portal, so the map popup is identical to the cards above (photos, timeline, toggle).
  const [popupEl, setPopupEl] = useState<HTMLDivElement | null>(null);
  // Same trick for the on-map "locate me" button: a div handed to Google's control layer
  // (so it stacks with the built-in controls) that React renders the button into.
  const [locateEl, setLocateEl] = useState<HTMLDivElement | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const [openCafeId, setOpenCafeId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<SunStatus[]>([]);
  const [when, setWhen] = useState<MapWhen>(NOW);
  // The big layout (sidebar list + large map) only exists on the /map page; on the home
  // page the small map links there.
  const isPage = variant === "page";
  const expanded = isPage;

  // Every status a café has at the chosen day/time: one for "Now" or a specific hour, or
  // all of tomorrow's open statuses when tomorrow is chosen without a time.
  const statusesAtWhen = (summary: CafeSunSummary, at: MapWhen): DisplayStatus[] => {
    if (at.day === "tomorrow" && at.hour === null) {
      const statuses = getTomorrowStatuses(summary);
      return statuses.length > 0 ? statuses : ["closed"];
    }
    const date = getWhenDate(at, new Date());
    return [date ? getStatusAtTime(summary, date) : summary.status];
  };
  // The status to show on the pin/badge: the best one among those matching the conditions.
  const STATUS_PREFERENCE: DisplayStatus[] = ["sun", "partial", "shade"];
  const displayStatus = (statuses: DisplayStatus[], filters: SunStatus[]): DisplayStatus => {
    const pool = filters.length > 0 ? statuses.filter((s) => s !== "closed" && filters.includes(s)) : statuses;
    return STATUS_PREFERENCE.find((s) => pool.includes(s)) ?? "closed";
  };
  const statusFor = (summary: CafeSunSummary) =>
    displayStatus(statusesAtWhen(summary, when), activeFilters);
  const hoursFor = (summary: CafeSunSummary) =>
    when.day === "tomorrow" ? summary.tomorrowHours : summary.todayHours;

  // With no filter applied every café is listed (closed ones as plain dots). Once a day/time
  // or condition is chosen, only cafés that are open then — and match the conditions — show.
  const isVisible = (
    summary: CafeSunSummary,
    filters: SunStatus[],
    text: string,
    at: MapWhen = when,
  ) => {
    const q = text.trim().toLowerCase();
    // The name must start with what's typed, so results narrow with every letter.
    const matchesText = !q || summary.cafe.name.toLowerCase().startsWith(q);
    const filtering = filters.length > 0 || isWhenSet(at);
    const matchesFilter =
      !filtering ||
      statusesAtWhen(summary, at).some(
        (status) => status !== "closed" && (filters.length === 0 || filters.includes(status)),
      );
    return matchesText && matchesFilter;
  };
  const visibleSummaries = summaries.filter((s) => isVisible(s, activeFilters, query));
  // One entry per café: its status at the chosen time and whether it's shown.
  const markerKey = summaries
    .map((s) => `${s.cafe.id}:${statusFor(s)}:${isVisible(s, activeFilters, query) ? 1 : 0}`)
    .join("|");

  useEffect(() => {
    if (!apiKey) return;

    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new g.maps.Map(containerRef.current, {
          center: LONDON_CENTER,
          zoom: DEFAULT_ZOOM,
          // Keep the map about our cafés: no clickable landmarks/businesses, and none of
          // Google's own POI pins or labels competing with our pins.
          clickableIcons: false,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            // Keep park shapes (not their pins) so the map still reads as London.
            { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }] },
          ],
          cameraControl: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        const el = document.createElement("div");
        const infoWindow = new g.maps.InfoWindow({ content: el, maxWidth: 300 });
        infoWindow.addListener("closeclick", () => setOpenCafeId(null));
        infoWindowRef.current = infoWindow;
        setPopupEl(el);

        const locate = document.createElement("div");
        mapRef.current.controls[g.maps.ControlPosition.RIGHT_BOTTOM].push(locate);
        setLocateEl(locate);
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
        icon: buildPinIcon(summary.status),
      });
      marker.addListener("click", () => {
        setOpenCafeId(summary.cafe.id);
        infoWindowRef.current?.open({ map, anchor: marker });
      });
      markersRef.current.set(summary.cafe.id, marker);
    });
  }, [ready, summaries]);

  // Search, filters and the chosen time only change the existing pins (icon + visibility) —
  // rebuilding them on every keystroke made the whole map flicker.
  useEffect(() => {
    if (!ready) return;
    markerKey.split("|").forEach((entry) => {
      const [id, status, visible] = entry.split(":");
      const marker = markersRef.current.get(id);
      if (!marker) return;
      marker.setIcon(buildPinIcon(status as DisplayStatus));
      marker.setVisible(visible === "1");
    });
  }, [ready, summaries, markerKey]);

  function goToCafe(cafeId: string) {
    const map = mapRef.current;
    const marker = markersRef.current.get(cafeId);
    const position = marker?.getPosition();
    if (!map || !marker || !position) return;
    map.panTo(position);
    map.setZoom(CAFE_FOCUS_ZOOM);
    setOpenCafeId(cafeId);
    infoWindowRef.current?.open({ map, anchor: marker });
  }

  // Typing narrows the map to the matching café(s) and moves the view to them.
  function handleQueryChange(value: string) {
    setQuery(value);
    setSuggestionsOpen(true);

    const matched = summaries.filter((s) => isVisible(s, activeFilters, value));
    if (openCafeId && !matched.some((s) => s.cafe.id === openCafeId)) {
      infoWindowRef.current?.close();
      setOpenCafeId(null);
    }

    // Leave the map alone while a matching pin is already on screen; only step in when
    // the user has wandered off (zoomed far into another area, or out to the world).
    const map = mapRef.current;
    if (!map || !value.trim() || matched.length === 0) return;
    const viewport = map.getBounds();
    const anyInView = matched.some((s) =>
      viewport?.contains({ lat: s.cafe.latitude, lng: s.cafe.longitude }),
    );
    if (anyInView && (map.getZoom() ?? 0) >= MIN_SEARCH_ZOOM) return;

    const bounds = new google.maps.LatLngBounds();
    matched.forEach((s) => bounds.extend({ lat: s.cafe.latitude, lng: s.cafe.longitude }));
    map.fitBounds(bounds, 80);
    google.maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 0) > SEARCH_MAX_ZOOM) map.setZoom(SEARCH_MAX_ZOOM);
    });
  }

  function closeOpenPopupIfHidden(filters: SunStatus[], nextWhen: MapWhen) {
    const open = openCafeId ? summaries.find((s) => s.cafe.id === openCafeId) : undefined;
    if (open && !isVisible(open, filters, "", nextWhen)) {
      infoWindowRef.current?.close();
      setOpenCafeId(null);
    }
  }

  function changeWhen(next: MapWhen) {
    setWhen(next);
    closeOpenPopupIfHidden(activeFilters, next);
  }

  function resetFilters() {
    setWhen(NOW);
    setActiveFilters([]);
  }

  function toggleFilter(status: SunStatus) {
    const next = activeFilters.includes(status)
      ? activeFilters.filter((f) => f !== status)
      : [...activeFilters, status];
    setActiveFilters(next);
    closeOpenPopupIfHidden(next, when);
  }

  function locateMe() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const map = mapRef.current;
      if (!map) return;
      const here = { lat: position.coords.latitude, lng: position.coords.longitude };
      map.panTo(here);
      map.setZoom(15);

      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = new google.maps.Marker({
        position: here,
        map,
        title: "You are here",
        zIndex: 1000,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4285f4",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 3,
        },
      });
    });
  }

  const openSummary = openCafeId ? summaries.find((s) => s.cafe.id === openCafeId) : undefined;

  return (
    <div className={`map-panel${expanded ? " map-panel--expanded" : ""}${isPage ? " map-panel--page" : ""}`}>
      <div className="map-toolbar">
        <div className="map-toolbar-top">
          <div className="map-search">
            <input
              type="text"
              placeholder="Search for a café…"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
            />
            {!expanded && suggestionsOpen && query.trim() && visibleSummaries.length > 0 && (
              <ul className="map-search-results">
                {visibleSummaries.map((summary) => (
                  <li key={summary.cafe.id}>
                    <button
                      type="button"
                      onClick={() => {
                        goToCafe(summary.cafe.id);
                        setQuery(summary.cafe.name);
                        setSuggestionsOpen(false);
                      }}
                    >
                      {summary.cafe.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href={isPage ? "/" : "/map"} className="map-expand">
            {isPage ? "Collapse map" : "Expand map"}
          </Link>
        </div>
        <MapFilterMenu
          when={when}
          onWhenChange={changeWhen}
          conditions={activeFilters}
          onToggleCondition={toggleFilter}
          onReset={resetFilters}
        />
      </div>
      {expanded && (
        <ul className="map-list" aria-label="Cafés">
          {visibleSummaries.length === 0 && <li className="map-list-empty">No open cafés match.</li>}
          {visibleSummaries.map((summary) => (
            <li key={summary.cafe.id}>
              <button
                type="button"
                className={`map-list-item${summary.cafe.id === openCafeId ? " map-list-item--active" : ""}`}
                onClick={() => goToCafe(summary.cafe.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/cafe-photo/${summary.cafe.id}`} alt="" className="map-list-photo" />
                <span className="map-list-body">
                  <span className="map-list-head">
                    <span className="map-list-name">{summary.cafe.name}</span>
                    <span className={`badge ${SUN_STATUS_BADGE_CLASS[statusFor(summary)]}`}>
                      {SUN_STATUS_LABEL[statusFor(summary)]}
                    </span>
                  </span>
                  <span className="cafe-card-meta">{SEATING_TYPE_LABEL[summary.cafe.seatingType]}</span>
                  <span className="cafe-card-meta">
                    {summary.cafe.addressLine} · {formatHours(hoursFor(summary))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {loadError || !apiKey ? (
        <div className="cafe-map cafe-map-error">Map unavailable — check the Google Maps API key.</div>
      ) : (
        <div ref={containerRef} className="cafe-map" />
      )}
      {locateEl &&
        createPortal(
          <button
            type="button"
            className="map-locate"
            onClick={locateMe}
            aria-label="Show my location"
            title="Show my location"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>,
          locateEl,
        )}
      {popupEl && openSummary && createPortal(<CafeCard key={openSummary.cafe.id} summary={openSummary} />, popupEl)}
    </div>
  );
}
