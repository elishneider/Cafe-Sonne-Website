"use client";

import { useEffect, useState } from "react";
import type { Cafe } from "@/lib/cafes";
import type { HourlyWeather } from "@/lib/googleWeather";
import { getCafeSunSummary, type CafeSunSummary } from "@/lib/cafeSunSummary";
import type { DisplayStatus } from "@/lib/sunTimeline";

export const STATUS_ORDER: Record<DisplayStatus, number> = { sun: 0, partial: 1, shade: 2, closed: 3 };

const DEFAULT_COORDS = { latitude: 51.5265, longitude: -0.0789 };

function useCoords() {
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  // False until the browser actually tells us where the visitor is (they may decline).
  const [located, setLocated] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocated(true);
      },
      () => {},
      { timeout: 5000 },
    );
  }, []);

  return { coords, located };
}

// Fetches the forecast and café list, and turns them into per-café sun summaries
// (sunniest first). Shared by every page that shows cafés.
export function useCafeSummaries() {
  const { coords, located } = useCoords();
  const [forecast, setForecast] = useState<HourlyWeather[] | null>(null);
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
        const hourly: HourlyWeather[] = weatherData.forecast.map(
          (h: { time: string; cloudCoverPct: number; isRaining: boolean }) => ({
            ...h,
            time: new Date(h.time),
          }),
        );
        setForecast(hourly);
        setCafes(cafesData.cafes);
      })
      .catch(() => setError("Couldn't reach the API routes."));
  }, [coords]);

  const summaries: CafeSunSummary[] =
    forecast && cafes
      ? cafes
          .map((cafe) => getCafeSunSummary(cafe, forecast, new Date()))
          .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
      : [];

  return { summaries, loaded: Boolean(forecast && cafes), error, coords, userLocation: located ? coords : null };
}
