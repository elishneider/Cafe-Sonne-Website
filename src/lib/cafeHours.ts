export type DayHours = { opens: string; closes: string };

// Indexed by JS weekday (0 = Sunday … 6 = Saturday); null = closed all day.
export type WeeklyHours = (DayHours | null)[];

type HoursSource = { opens: string; closes: string; weeklyHours?: WeeklyHours };

// Live hours from Google Places when we have them; otherwise the hand-entered
// weekday hours on the café itself.
export function getHoursForDate(cafe: HoursSource, date: Date): DayHours | null {
  if (cafe.weeklyHours) return cafe.weeklyHours[date.getDay()] ?? null;
  return { opens: cafe.opens, closes: cafe.closes };
}

export function formatHours(hours: DayHours | null): string {
  return hours ? `Open ${hours.opens}–${hours.closes}` : "Closed today";
}
