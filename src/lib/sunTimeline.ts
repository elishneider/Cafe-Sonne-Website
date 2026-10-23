import { getSunPosition } from "./sun";
import { getCafeSunStatus, type SunStatus, type WeatherSnapshot } from "./sunStatus";
import type { Cafe } from "./cafes";
import { getHoursForDate } from "./cafeHours";
import type { HourlyWeather } from "./googleWeather";

export type DisplayStatus = SunStatus | "closed";

export type TimelineSegment = {
  status: DisplayStatus;
  start: Date;
  end: Date;
};

const STEP_MINUTES = 5;
const MIN_SEGMENT_MINUTES = 10;
const REFINE_TOLERANCE_MS = 15_000;

function parseTimeOfDay(time: string, referenceDate: Date): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(referenceDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function isOpenAt(cafe: Cafe, at: Date): boolean {
  const hours = getHoursForDate(cafe, at);
  if (!hours) return false;
  const opens = parseTimeOfDay(hours.opens, at);
  const closes = parseTimeOfDay(hours.closes, at);
  return at >= opens && at < closes;
}

// Forecast entries are hourly buckets — find the one covering `at`. Falls back to the
// closest edge (first/last) if `at` is outside the fetched horizon, since holding the
// nearest known conditions is a better guess than assuming a blank sky.
function getWeatherAt(forecast: HourlyWeather[], at: Date): WeatherSnapshot {
  if (forecast.length === 0) return { cloudCoverPct: 0, isRaining: false };

  let match = forecast[0];
  for (const hour of forecast) {
    if (hour.time.getTime() <= at.getTime()) {
      match = hour;
    } else {
      break;
    }
  }
  return { cloudCoverPct: match.cloudCoverPct, isRaining: match.isRaining };
}

function statusAt(cafe: Cafe, forecast: HourlyWeather[], at: Date): DisplayStatus {
  if (!isOpenAt(cafe, at)) return "closed";
  const sun = getSunPosition(cafe.latitude, cafe.longitude, at);
  return getCafeSunStatus(cafe, sun, getWeatherAt(forecast, at));
}

// The coarse step loop only proves a transition happened somewhere in a 5-minute
// window — binary search narrows that down to the real minute it happened in, which
// matters most for open/close times where we know the exact cutoff.
function refineBoundary(
  cafe: Cafe,
  forecast: HourlyWeather[],
  fromStatus: DisplayStatus,
  before: Date,
  after: Date,
): Date {
  let lo = before.getTime();
  let hi = after.getTime();
  while (hi - lo > REFINE_TOLERANCE_MS) {
    const mid = new Date(Math.floor((lo + hi) / 2));
    if (statusAt(cafe, forecast, mid) === fromStatus) {
      lo = mid.getTime();
    } else {
      hi = mid.getTime();
    }
  }
  return new Date(hi);
}

// Sun/shade status is projected forward using the actual hourly forecast (cloud cover,
// rain) for each point in time — not a single snapshot held constant.
function simulateSegments(
  cafe: Cafe,
  forecast: HourlyWeather[],
  from: Date,
  to: Date,
): TimelineSegment[] {
  const stepMs = STEP_MINUTES * 60 * 1000;

  const rawSegments: TimelineSegment[] = [];
  let segmentStart = new Date(from);
  let segmentStatus = statusAt(cafe, forecast, from);
  let cursor = new Date(from);

  while (cursor < to) {
    const next = new Date(Math.min(cursor.getTime() + stepMs, to.getTime()));
    const statusAtNext = statusAt(cafe, forecast, next);
    if (statusAtNext !== segmentStatus) {
      const boundary = refineBoundary(cafe, forecast, segmentStatus, cursor, next);
      rawSegments.push({ status: segmentStatus, start: segmentStart, end: boundary });
      segmentStart = boundary;
      // Re-check the status right at the boundary rather than reusing statusAtNext — a
      // second transition (e.g. a geometry change right before closing time) can hide
      // inside the same coarse window, and statusAtNext would skip straight past it.
      segmentStatus = statusAt(cafe, forecast, boundary);
      cursor = boundary;
    } else {
      cursor = next;
    }
  }
  rawSegments.push({ status: segmentStatus, start: segmentStart, end: to });

  // Fold segments shorter than the noise floor into their neighbour so the bar reads as
  // a handful of clean blocks, not a flicker of slivers near a threshold.
  const segments: TimelineSegment[] = [];
  for (const segment of rawSegments) {
    const minutes = (segment.end.getTime() - segment.start.getTime()) / 60_000;
    const previous = segments[segments.length - 1];
    if (previous && minutes < MIN_SEGMENT_MINUTES) {
      previous.end = segment.end;
    } else {
      segments.push({ ...segment });
    }
  }

  return segments;
}

// Today: "Now" through midnight. Closed hours are still real minutes underneath (used
// for accurate timestamps) — the presentation layer is what compresses their width.
export function getTodaySunTimeline(
  cafe: Cafe,
  forecast: HourlyWeather[],
  now: Date,
): TimelineSegment[] {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return simulateSegments(cafe, forecast, now, endOfToday);
}

// Tomorrow: the next calendar day's opening through its closing — no "now," no closed
// hours, just the full open window. A day the café is shut entirely is one closed block.
export function getTomorrowSunTimeline(
  cafe: Cafe,
  forecast: HourlyWeather[],
  now: Date,
): TimelineSegment[] {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const hours = getHoursForDate(cafe, tomorrow);
  if (!hours) {
    const start = new Date(tomorrow);
    start.setHours(0, 0, 0, 0);
    const end = new Date(tomorrow);
    end.setHours(23, 59, 59, 999);
    return [{ status: "closed", start, end }];
  }
  const opens = parseTimeOfDay(hours.opens, tomorrow);
  const closes = parseTimeOfDay(hours.closes, tomorrow);
  return simulateSegments(cafe, forecast, opens, closes);
}

export function formatSegmentTime(date: Date, from: Date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;
  return date.toDateString() !== from.toDateString() ? `tomorrow ${time}` : time;
}
