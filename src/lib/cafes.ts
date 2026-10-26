import type { WeeklyHours } from "./cafeHours";
import { getPlaceWeeklyHours } from "./googlePlaces";

export type Exposure =
  // A single street-facing frontage: open sky across the street up to obstructionDeg,
  // blocked by the café's own building behind it.
  | { type: "directional"; facingDeg: number; obstructionDeg: number }
  // Surrounded by buildings on all sides (courtyard/backland) — direction doesn't
  // matter, only whether the sun is high enough to clear the surrounding roofline.
  | { type: "enclosed"; minSunAltitudeDeg: number };

// Standardised outdoor-seating categories, shown to users instead of free-text notes.
// - pavement: tables right outside the front — on the public footway or on the café's own
//   paved space just in front of the shop (we don't tell these two apart).
// - terrace: a raised or clearly defined platform/decking area.
// - courtyard: enclosed on most/all sides by surrounding buildings.
// - garden: an informal, planted outdoor area.
export type SeatingType = "pavement" | "terrace" | "courtyard" | "garden";

export type Cafe = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  outdoorSeating: boolean;
  seatingType: SeatingType;
  addressLine: string;
  // Indices into this café's raw Google Places photo list, in the priority order to
  // display them (index 0 = shop frontage, index 1 = outdoor seating, when available).
  // Curated by hand by looking through each café's actual photos — Places has no
  // "this photo shows outdoor seating" signal to sort by automatically. Any photos not
  // listed here still show, appended afterward in Places' own order.
  photoPriority?: number[];
  // Hand-entered weekday hours — only the fallback when live Places hours are unavailable.
  opens: string;
  closes: string;
  // Live per-weekday hours from Google Places, filled in by getCafes().
  weeklyHours?: WeeklyHours;
  exposure: Exposure;
  placeId: string;
};

const CAFES: Cafe[] = [
  {
    id: "d1-coffee",
    name: "D1 Coffee",
    latitude: 51.5247884,
    longitude: -0.1761794,
    outdoorSeating: true,
    seatingType: "pavement",
    addressLine: "1D Aberdeen Pl",
    photoPriority: [7, 9],
    opens: "08:00",
    closes: "16:00",
    exposure: { type: "directional", facingDeg: 340, obstructionDeg: 18 },
    placeId: "ChIJbW7WArAadkgRTfIHUT9TifE",
  },
  {
    id: "gails-clifton-road",
    name: "GAIL's Bakery Clifton Road",
    latitude: 51.5256672,
    longitude: -0.1795886,
    outdoorSeating: true,
    seatingType: "pavement",
    addressLine: "20 Clifton Rd",
    photoPriority: [0, 7],
    opens: "06:30",
    closes: "18:30",
    exposure: { type: "directional", facingDeg: 160, obstructionDeg: 12 },
    placeId: "ChIJ3TgUwdIbdkgRqk9QCHtBuuc",
  },
  {
    id: "white-mulberries",
    name: "White Mulberries",
    latitude: 51.5206033,
    longitude: -0.1530008,
    outdoorSeating: true,
    seatingType: "courtyard",
    addressLine: "54 Paddington St",
    photoPriority: [0, 5],
    opens: "07:00",
    closes: "18:00",
    exposure: { type: "enclosed", minSunAltitudeDeg: 55 },
    placeId: "ChIJWZAsUgkbdkgRho3VniGxdBQ",
  },
];

const HOURS_TTL_MS = 24 * 60 * 60 * 1000;
const HOURS_FAILURE_TTL_MS = 10 * 60 * 1000;
const hoursCache = new Map<string, { hours: WeeklyHours | null; expiresAt: number }>();

async function getLiveHours(cafe: Cafe): Promise<WeeklyHours | null> {
  const cached = hoursCache.get(cafe.id);
  if (cached && cached.expiresAt > Date.now()) return cached.hours;

  const hours = await getPlaceWeeklyHours(cafe.placeId).catch(() => null);
  hoursCache.set(cafe.id, {
    hours,
    expiresAt: Date.now() + (hours ? HOURS_TTL_MS : HOURS_FAILURE_TTL_MS),
  });
  return hours;
}

export async function getCafes(): Promise<Cafe[]> {
  return Promise.all(
    CAFES.map(async (cafe) => {
      const weeklyHours = await getLiveHours(cafe);
      return weeklyHours ? { ...cafe, weeklyHours } : cafe;
    }),
  );
}
