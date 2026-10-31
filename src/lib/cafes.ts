import type { WeeklyHours } from "./cafeHours";
import { getPlaceWeeklyHours } from "./googlePlaces";
import zone1Cafes from "../data/zone1-cafes.json";

export type Exposure =
  // A single street-facing frontage: open sky across the street up to obstructionDeg,
  // blocked by the café's own building behind it.
  | { type: "directional"; facingDeg: number; obstructionDeg: number }
  // Surrounded by buildings on all sides (courtyard/backland) — direction doesn't
  // matter, only whether the sun is high enough to clear the surrounding roofline.
  | { type: "enclosed"; minSunAltitudeDeg: number }
  // Worked out from LIDAR: for each seat point we sample around the tables, the skyline angle
  // (degrees above the horizon) at every 5° compass bearing starting from north. The sun
  // reaches a seat point when it is higher than the skyline in its direction.
  | { type: "skyline"; skylines: number[][] };

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

// Cafés found and measured automatically (see scripts/compute-skylines.mjs), as opposed to
// the three hand-researched ones above. Data is built by scripts/build-cafe-data.mjs.
type Zone1CafeRecord = {
  id: string;
  name: string;
  placeId: string;
  latitude: number;
  longitude: number;
  seatingType: SeatingType;
  addressLine: string;
  photoPriority: number[];
  weeklyHours: WeeklyHours | null;
  skyline: number[][];
};

const FALLBACK_HOURS = { opens: "08:00", closes: "17:00" };

const MEASURED_CAFES: Cafe[] = (zone1Cafes as Zone1CafeRecord[]).map((c) => {
  const typical = c.weeklyHours?.find((day) => day) ?? FALLBACK_HOURS;
  return {
    id: c.id,
    name: c.name,
    latitude: c.latitude,
    longitude: c.longitude,
    outdoorSeating: true,
    seatingType: c.seatingType,
    addressLine: c.addressLine,
    photoPriority: c.photoPriority,
    opens: typical.opens,
    closes: typical.closes,
    ...(c.weeklyHours ? { weeklyHours: c.weeklyHours } : {}),
    exposure: { type: "skyline", skylines: c.skyline },
    placeId: c.placeId,
  };
});

const ALL_CAFES: Cafe[] = [...CAFES, ...MEASURED_CAFES];

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

// Live hours for ~100 cafés: a few requests at a time rather than all at once.
const HOURS_CONCURRENCY = 8;

export async function getCafes(): Promise<Cafe[]> {
  const result: Cafe[] = new Array(ALL_CAFES.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: HOURS_CONCURRENCY }, async () => {
      while (next < ALL_CAFES.length) {
        const i = next++;
        const cafe = ALL_CAFES[i];
        const weeklyHours = await getLiveHours(cafe);
        result[i] = weeklyHours ? { ...cafe, weeklyHours } : cafe;
      }
    }),
  );
  return result;
}
