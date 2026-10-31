"use client";

import { CafeCard } from "@/components/CafeCard";
import { HeroSuns } from "@/components/HeroSuns";
import { CafeMapSection } from "@/components/CafeMapSection";
import { useCafeSummaries, STATUS_ORDER } from "@/components/useCafeSummaries";

const NEARBY_COUNT = 8;

// Straight-line distance in metres — plenty accurate for ranking cafés by "nearest".
function distanceMetres(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const dLat = (a.latitude - b.latitude) * 111_320;
  const dLon = (a.longitude - b.longitude) * 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

export function AppHome() {
  const { summaries, loaded, error, coords } = useCafeSummaries();

  // The cards below the hero are just the cafés closest to you (sunniest first among them);
  // the map shows all of them.
  const nearby = [...summaries]
    .sort((a, b) => distanceMetres(coords, a.cafe) - distanceMetres(coords, b.cafe))
    .slice(0, NEARBY_COUNT)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <main className="container app-main">
      {error && <p className="form-note">{error}</p>}

      <section className="hero">
        <HeroSuns />
        <h1>
          Find London cafés that have outdoor seating and are catching the sun
        </h1>
        <p className="hero-sub">
          We find London cafés with outdoor seating and work out when their tables are in the sun, using the
          sun&apos;s position, each café&apos;s surroundings and the weather forecast
        </p>
      </section>

      <section className="sunny-now-section">
        <p className="eyebrow">Near you</p>
        <h2>Cafés near you that have outdoor seating</h2>
        <p className="section-sub">
          Check out which cafés with outdoor seating near you are catching the sun right now
        </p>
        {!loaded ? (
          <p className="section-sub">Loading…</p>
        ) : (
          <div className="card-grid">
            {nearby.map((summary) => (
              <CafeCard key={summary.cafe.id} summary={summary} />
            ))}
          </div>
        )}
      </section>

      <section className="map-section">
        <p className="eyebrow">Find a café</p>
        <h2>Find cafés that are in the sun</h2>
        <CafeMapSection summaries={summaries} />
      </section>
    </main>
  );
}
