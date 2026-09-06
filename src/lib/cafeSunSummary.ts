import type { Cafe } from "./cafes";
import type { Weather } from "./weather";
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
};

export function getCafeSunSummary(cafe: Cafe, weather: Weather, now: Date): CafeSunSummary {
  const todayTimeline = getTodaySunTimeline(cafe, weather, now);
  const tomorrowTimeline = getTomorrowSunTimeline(cafe, weather, now);
  return { cafe, status: todayTimeline[0].status, todayTimeline, tomorrowTimeline };
}
