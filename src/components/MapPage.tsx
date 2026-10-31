"use client";

import { CafeMapSection } from "@/components/CafeMapSection";
import { useCafeSummaries } from "@/components/useCafeSummaries";

export function MapPage() {
  const { summaries, error, userLocation } = useCafeSummaries();

  return (
    <main>
      {error && <p className="form-note">{error}</p>}
      <CafeMapSection summaries={summaries} userLocation={userLocation} variant="page" />
    </main>
  );
}
