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
