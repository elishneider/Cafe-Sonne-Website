"use client";

import { CafeCard } from "@/components/CafeCard";
import { HeroSuns } from "@/components/HeroSuns";
import { CafeMapSection } from "@/components/CafeMapSection";
import { useCafeSummaries } from "@/components/useCafeSummaries";

export function AppHome() {
  const { summaries, loaded, error } = useCafeSummaries();

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
            {summaries.map((summary) => (
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
