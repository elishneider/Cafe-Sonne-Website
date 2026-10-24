export type MapDay = "today" | "tomorrow";

// hour null = no specific time: "Now" for today, the whole day for tomorrow.
export type MapWhen = { day: MapDay; hour: number | null };

export const FIRST_HOUR = 7;
export const LAST_HOUR = 18;

export const NOW: MapWhen = { day: "today", hour: null };

// Hourly choices between 07:00 and 18:00. Today starts at the next full hour.
export function getHourOptions(day: MapDay, now: Date): number[] {
  const first = day === "today" ? Math.max(FIRST_HOUR, now.getHours() + 1) : FIRST_HOUR;
  const hours: number[] = [];
  for (let h = first; h <= LAST_HOUR; h++) hours.push(h);
  return hours;
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

// The specific moment being looked at, or null when no time is chosen.
export function getWhenDate(when: MapWhen, now: Date): Date | null {
  if (when.hour === null) return null;
  const date = new Date(now);
  if (when.day === "tomorrow") date.setDate(date.getDate() + 1);
  date.setHours(when.hour, 0, 0, 0);
  return date;
}

// Whether the day/time differs from the default "Now".
export function isWhenSet(when: MapWhen): boolean {
  return when.day === "tomorrow" || when.hour !== null;
}

export function describeWhen(when: MapWhen): string | null {
  if (!isWhenSet(when)) return null;
  const day = when.day === "today" ? "Today" : "Tomorrow";
  return when.hour === null ? day : `${day} ${formatHour(when.hour)}`;
}
