import type { WeeklyHours } from "./cafeHours";

export type PlacePhoto = {
  contentType: string;
  bytes: ArrayBuffer;
};

// Kept server-side only — never sent to the client. The proxy routes are what
// the browser actually talks to.
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function getPlacePhotoNames(placeId: string, maxCount = 10): Promise<string[]> {
  if (!API_KEY) return [];

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "photos.name",
    },
  });
  if (!res.ok) return [];

  const details = await res.json();
  const names = ((details.photos ?? []) as { name: string }[]).map((p) => p.name);
  return names.slice(0, maxCount);
}

type PlacesPoint = { day: number; hour: number; minute: number };
type PlacesPeriod = { open: PlacesPoint; close?: PlacesPoint };

const pad = (n: number) => String(n).padStart(2, "0");

// Places days are 0 = Sunday, matching JS getDay(). Simplifications: split hours (e.g.
// a lunch break) collapse to earliest open / latest close, and a close past midnight is
// capped at 23:59 since the timeline only models a single calendar day.
export async function getPlaceWeeklyHours(placeId: string): Promise<WeeklyHours | null> {
  if (!API_KEY) return null;

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "regularOpeningHours.periods",
    },
  });
  if (!res.ok) return null;

  const details = await res.json();
  const periods = details.regularOpeningHours?.periods as PlacesPeriod[] | undefined;
  if (!periods || periods.length === 0) return null;

  const weekly: WeeklyHours = Array(7).fill(null);
  for (const { open, close } of periods) {
    const opens = `${pad(open.hour)}:${pad(open.minute)}`;
    const closes = !close || close.day !== open.day ? "23:59" : `${pad(close.hour)}:${pad(close.minute)}`;
    const existing = weekly[open.day];
    weekly[open.day] = existing
      ? {
          opens: opens < existing.opens ? opens : existing.opens,
          closes: closes > existing.closes ? closes : existing.closes,
        }
      : { opens, closes };
  }
  return weekly;
}

export async function getPlacePhotoMedia(photoName: string, maxWidthPx = 800): Promise<PlacePhoto | null> {
  if (!API_KEY) return null;

  const res = await fetch(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${API_KEY}`,
  );
  if (!res.ok) return null;

  return {
    contentType: res.headers.get("content-type") ?? "image/jpeg",
    bytes: await res.arrayBuffer(),
  };
}
