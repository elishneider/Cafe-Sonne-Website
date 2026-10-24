import type { Cafe } from "./cafes";
import { getHoursForDate, type DayHours } from "./cafeHours";
import type { HourlyWeather } from "./googleWeather";
import {
  getTodaySunTimeline,
  getTomorrowSunTimeline,
  type DisplayStatus,
  type TimelineSegment,
} from "./sunTimeline";

export type CafeSunSummary = {
  cafe: Cafe;
  status: DisplayStatus;
  todayTimeline: TimelineSegment[];
  tomorrowTimeline: TimelineSegment[];
  todayHours: DayHours | null;
  tomorrowHours: DayHours | null;
};

export function getCafeSunSummary(cafe: Cafe, forecast: HourlyWeather[], now: Date): CafeSunSummary {
  const todayTimeline = getTodaySunTimeline(cafe, forecast, now);
  const tomorrowTimeline = getTomorrowSunTimeline(cafe, forecast, now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    cafe,
    status: todayTimeline[0].status,
    todayTimeline,
    tomorrowTimeline,
    todayHours: getHoursForDate(cafe, now),
    tomorrowHours: getHoursForDate(cafe, tomorrow),
  };
}

// What a café's seating is doing at a specific moment today or tomorrow, read from the
// timelines already calculated. Anything outside those timelines (e.g. before opening
// tomorrow) counts as closed.
export function getStatusAtTime(summary: CafeSunSummary, at: Date): DisplayStatus {
  const todayStart = summary.todayTimeline[0]?.start;
  const timeline =
    todayStart && at.toDateString() === todayStart.toDateString()
      ? summary.todayTimeline
      : summary.tomorrowTimeline;
  const segment = timeline.find((s) => at >= s.start && at < s.end);
  return segment?.status ?? "closed";
}

// Every status the café goes through while open tomorrow (for "Tomorrow, any time").
export function getTomorrowStatuses(summary: CafeSunSummary): DisplayStatus[] {
  return [...new Set(summary.tomorrowTimeline.map((s) => s.status))].filter((s) => s !== "closed");
}
