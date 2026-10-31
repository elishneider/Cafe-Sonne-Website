import type { SunPosition } from "./sun";
import type { Cafe } from "./cafes";

export type SunStatus = "sun" | "partial" | "shade";

// Provider-agnostic — just the two fields the sun/shade calculation actually needs.
export type WeatherSnapshot = { cloudCoverPct: number; isRaining: boolean };

function angleDiff(a: number, b: number) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function getGeometrySunStatus(cafe: Cafe, sun: SunPosition): SunStatus {
  const { exposure } = cafe;

  if (exposure.type === "skyline") {
    // What share of the seat points can see the sun over the skyline right now.
    const bearing = ((sun.azimuthDeg % 360) + 360) % 360;
    const step = 360 / exposure.skylines[0].length;
    const i = Math.round(bearing / step) % exposure.skylines[0].length;
    const sunnyShare = exposure.skylines.filter((s) => sun.altitudeDeg > s[i]).length / exposure.skylines.length;
    if (sunnyShare >= 0.67) return "sun";
    if (sunnyShare >= 0.25) return "partial";
    return "shade";
  }

  if (exposure.type === "enclosed") {
    if (sun.altitudeDeg >= exposure.minSunAltitudeDeg) return "sun";
    if (sun.altitudeDeg >= exposure.minSunAltitudeDeg - 10) return "partial";
    return "shade";
  }

  // Sun must be roughly in front of the seating (within 100° of facingDeg) and
  // higher than whatever blocks the opposite side of the street.
  const diff = angleDiff(sun.azimuthDeg, exposure.facingDeg);
  if (diff > 100) return "shade";
  if (sun.altitudeDeg < exposure.obstructionDeg) return "shade";
  if (diff > 80 || sun.altitudeDeg < exposure.obstructionDeg + 5) return "partial";
  return "sun";
}

export function getCafeSunStatus(cafe: Cafe, sun: SunPosition, weather: WeatherSnapshot): SunStatus {
  if (!sun.isDaytime) return "shade";

  // Rain or a fully overcast sky means no direct sun anywhere, regardless of geometry.
  if (weather.isRaining || weather.cloudCoverPct >= 90) return "shade";

  const geometryStatus = getGeometrySunStatus(cafe, sun);

  // Broken/scattered cloud can't turn a shaded spot sunny, but it can knock a sunny spot
  // down to intermittent — the sun is there geometrically but not reliably visible.
  if (weather.cloudCoverPct >= 50 && geometryStatus === "sun") return "partial";

  return geometryStatus;
}
