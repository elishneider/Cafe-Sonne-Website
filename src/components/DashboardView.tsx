"use client";

import { useEffect, useState } from "react";
import type { SunPosition } from "@/lib/sun";
import type { Cafe } from "@/lib/cafes";
import { describeWeatherCode, type Weather } from "@/lib/weather";
import { getCafeSunStatus, type SunStatus } from "@/lib/sunStatus";

const SUN_STATUS_LABEL: Record<SunStatus, string> = {
  sun: "☀️ In the sun",
  partial: "⛅ Partial sun",
  shade: "🌥️ In shade",
};

const SUN_STATUS_BADGE_CLASS: Record<SunStatus, string> = {
  sun: "badge-sun",
  partial: "badge-partial",
  shade: "badge-shade",
};

function exposureDescription(cafe: Cafe) {
  return cafe.exposure.type === "directional"
    ? `Streetside · facing ${cafe.exposure.facingDeg}°`
    : "Enclosed courtyard";
}

const DEFAULT_COORDS = { latitude: 51.5265, longitude: -0.0789 };

function useCoords() {
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [coordsSource, setCoordsSource] = useState<"default" | "geolocation">("default");

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setCoordsSource("geolocation");
      },
      () => {},
      { timeout: 5000 },
    );
  }, []);

  return { coords, coordsSource };
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function DashboardView() {
  const { coords, coordsSource } = useCoords();
  const [sun, setSun] = useState<SunPosition | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [cafes, setCafes] = useState<Cafe[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      lat: String(coords.latitude),
      lon: String(coords.longitude),
    });

    Promise.all([
      fetch(`/api/sun-position?${params}`).then((res) => res.json()),
      fetch(`/api/weather?${params}`).then((res) => res.json()),
      fetch("/api/cafes").then((res) => res.json()),
    ])
      .then(([sunData, weatherData, cafesData]) => {
        setSun(sunData);
        setWeather(weatherData);
        setCafes(cafesData.cafes);
      })
      .catch(() => setError("Couldn't reach the API routes."));
  }, [coords]);

  return (
    <div className="container dashboard">
      <p className="eyebrow">Live from /api/sun-position, /api/weather and /api/cafes</p>
      <h1>Café Sonne dashboard</h1>
      <p className="section-sub">
        Coordinates: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}{" "}
        {coordsSource === "geolocation" ? "(from your browser)" : "(default — London)"}
      </p>

      {error && <p className="form-note">{error}</p>}

      <section className="dashboard-panel">
        <h2>Sun position</h2>
        {sun ? (
          <div className="dashboard-stats">
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Altitude</span>
              <span className="dashboard-stat-value">{sun.altitudeDeg.toFixed(1)}°</span>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Azimuth</span>
              <span className="dashboard-stat-value">{sun.azimuthDeg.toFixed(1)}°</span>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Status</span>
              <span className="badge badge-sun">{sun.isDaytime ? "☀️ Daytime" : "🌙 Night"}</span>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Sunrise</span>
              <span className="dashboard-stat-value">{formatTime(sun.sunrise)}</span>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Sunset</span>
              <span className="dashboard-stat-value">{formatTime(sun.sunset)}</span>
            </div>
          </div>
        ) : (
          <p>Loading sun position…</p>
        )}
      </section>

      <section className="dashboard-panel">
        <h2>Weather</h2>
        {weather ? (
          <div className="dashboard-stats">
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Conditions</span>
              <span className="dashboard-stat-value">{describeWeatherCode(weather.weatherCode)}</span>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Cloud cover</span>
              <span className="dashboard-stat-value">{weather.cloudCoverPct}%</span>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Temperature</span>
              <span className="dashboard-stat-value">{weather.temperatureC.toFixed(1)}°C</span>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-label">Rain</span>
              <span className="dashboard-stat-value">{weather.isRaining ? "Yes" : "No"}</span>
            </div>
          </div>
        ) : (
          <p>Loading weather…</p>
        )}
      </section>

      <section className="dashboard-panel">
        <h2>Cafés</h2>
        {cafes && sun && weather ? (
          <div className="card-grid">
            {cafes.map((cafe) => {
              const status = getCafeSunStatus(cafe, sun, weather);
              return (
                <article className="cafe-card" key={cafe.id}>
                  <div className="cafe-card-body">
                    <div className="cafe-card-head">
                      <h3>{cafe.name}</h3>
                      <span className={`badge ${SUN_STATUS_BADGE_CLASS[status]}`}>
                        {SUN_STATUS_LABEL[status]}
                      </span>
                    </div>
                    <p className="cafe-card-meta">
                      {cafe.seatingNotes} · Closes {cafe.closes}
                    </p>
                    <p className="sun-label">{exposureDescription(cafe)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p>Loading cafés…</p>
        )}
      </section>
    </div>
  );
}
