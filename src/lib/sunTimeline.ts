import { getSunPosition } from "./sun";
import { getCafeSunStatus, type SunStatus } from "./sunStatus";
import type { Cafe } from "./cafes";
import type { Weather } from "./weather";

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
  const opens = parseTimeOfDay(cafe.opens, at);
  const closes = parseTimeOfDay(cafe.closes, at);
  return at >= opens && at < closes;
}

function statusAt(cafe: Cafe, weather: Weather, at: Date): DisplayStatus {
  if (!isOpenAt(cafe, at)) return "closed";
  const sun = getSunPosition(cafe.latitude, cafe.longitude, at);
  return getCafeSunStatus(cafe, sun, weather);
}

// The coarse step loop only proves a transition happened somewhere in a 5-minute
// window — binary search narrows that down to the real minute it happened in, which
// matters most for open/close times where we know the exact cutoff.
function refineBoundary(
  cafe: Cafe,
  weather: Weather,
  fromStatus: DisplayStatus,
  before: Date,
  after: Date,
): Date {
  let lo = before.getTime();
  let hi = after.getTime();
  while (hi - lo > REFINE_TOLERANCE_MS) {
    const mid = new Date(Math.floor((lo + hi) / 2));
    if (statusAt(cafe, weather, mid) === fromStatus) {
      lo = mid.getTime();
    } else {
      hi = mid.getTime();
    }
  }
  return new Date(hi);
}

// Sun/shade status is projected forward assuming today's current weather (cloud cover,
// rain) holds for the whole window — there's no hourly cloud forecast wired up, so this
// is "if the sky stays like this," not a real weather forecast.
function simulateSegments(cafe: Cafe, weather: Weather, from: Date, to: Date): TimelineSegment[] {
  const stepMs = STEP_MINUTES * 60 * 1000;

  const rawSegments: TimelineSegment[] = [];
  let segmentStart = new Date(from);
  let segmentStatus = statusAt(cafe, weather, from);
  let cursor = new Date(from);

  while (cursor < to) {
    const next = new Date(Math.min(cursor.getTime() + stepMs, to.getTime()));
    const statusAtNext = statusAt(cafe, weather, next);
    if (statusAtNext !== segmentStatus) {
      const boundary = refineBoundary(cafe, weather, segmentStatus, cursor, next);
      rawSegments.push({ status: segmentStatus, start: segmentStart, end: boundary });
      segmentStart = boundary;
      // Re-check the status right at the boundary rather than reusing statusAtNext — a
      // second transition (e.g. a geometry change right before closing time) can hide
      // inside the same coarse window, and statusAtNext would skip straight past it.
      segmentStatus = statusAt(cafe, weather, boundary);
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
export function getTodaySunTimeline(cafe: Cafe, weather: Weather, now: Date): TimelineSegment[] {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return simulateSegments(cafe, weather, now, endOfToday);
}

// Tomorrow: the next calendar day's opening through its closing — no "now," no closed
// hours, just the full open window.
export function getTomorrowSunTimeline(cafe: Cafe, weather: Weather, now: Date): TimelineSegment[] {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const opens = parseTimeOfDay(cafe.opens, tomorrow);
  const closes = parseTimeOfDay(cafe.closes, tomorrow);
  return simulateSegments(cafe, weather, opens, closes);
}

export function formatSegmentTime(date: Date, from: Date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;
  return date.toDateString() !== from.toDateString() ? `tomorrow ${time}` : time;
}

// A short one-line summary of today's current segment, for compact spots (map popups)
// that don't have room for the full graphical timeline.
export function describeCurrentSegment(timeline: TimelineSegment[], now: Date): string | null {
  const current = timeline[0];
  if (!current) return null;

  if (current.status === "closed") {
    return `Closed until ${formatSegmentTime(current.end, now)}`;
  }
  if (current.status === "sun" || current.status === "partial") {
    return `Sunny until ${formatSegmentTime(current.end, now)}`;
  }

  const nextSunny = timeline.find((s) => s.status === "sun" || s.status === "partial");
  return nextSunny ? `Back in the sun ${formatSegmentTime(nextSunny.start, now)}` : null;
}
