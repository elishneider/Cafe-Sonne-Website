"use client";

import { useEffect, useState } from "react";
import type { Cafe } from "@/lib/cafes";
import type { Weather } from "@/lib/weather";
import { getCafeSunSummary, type CafeSunSummary } from "@/lib/cafeSunSummary";
import type { DisplayStatus } from "@/lib/sunTimeline";
import { CafeCard } from "@/components/CafeCard";
import { CafeMapSection } from "@/components/CafeMapSection";

const STATUS_ORDER: Record<DisplayStatus, number> = { sun: 0, partial: 1, shade: 2, closed: 3 };

const DEFAULT_COORDS = { latitude: 51.5265, longitude: -0.0789 };

function useCoords() {
  const [coords, setCoords] = useState(DEFAULT_COORDS);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {},
      { timeout: 5000 },
    );
  }, []);

  return coords;
}

export function AppHome() {
  const coords = useCoords();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [cafes, setCafes] = useState<Cafe[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      lat: String(coords.latitude),
      lon: String(coords.longitude),
    });

    Promise.all([
      fetch(`/api/weather?${params}`).then((res) => res.json()),
      fetch("/api/cafes").then((res) => res.json()),
    ])
      .then(([weatherData, cafesData]) => {
        setWeather(weatherData);
        setCafes(cafesData.cafes);
      })
      .catch(() => setError("Couldn't reach the API routes."));
  }, [coords]);

  const summaries: CafeSunSummary[] =
    weather && cafes
      ? cafes
          .map((cafe) => getCafeSunSummary(cafe, weather, new Date()))
          .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
      : [];
  const anySunnyNow = summaries.some((s) => s.status === "sun" || s.status === "partial");
  const loaded = Boolean(weather && cafes);

  return (
    <main className="container app-main">
      {error && <p className="form-note">{error}</p>}

      <section className="sunny-now-section">
        <p className="eyebrow">Right now</p>
        <h2>Cafés catching the sun</h2>
        {!loaded ? (
          <p className="section-sub">Loading…</p>
        ) : (
          <>
            {!anySunnyNow && (
              <p className="section-sub">
                No cafés are catching the sun right now — here&apos;s when they&apos;ll next be sunny.
              </p>
            )}
            <div className="card-grid">
              {summaries.map((summary) => (
                <CafeCard key={summary.cafe.id} summary={summary} />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="map-section">
        <p className="eyebrow">Find a café</p>
        <h2>All cafés near you</h2>
        <CafeMapSection summaries={summaries} />
      </section>
    </main>
  );
}
