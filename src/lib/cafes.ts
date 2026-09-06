export type Exposure =
  // A single street-facing frontage: open sky across the street up to obstructionDeg,
  // blocked by the café's own building behind it.
  | { type: "directional"; facingDeg: number; obstructionDeg: number }
  // Surrounded by buildings on all sides (courtyard/backland) — direction doesn't
  // matter, only whether the sun is high enough to clear the surrounding roofline.
  | { type: "enclosed"; minSunAltitudeDeg: number };

export type Cafe = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  outdoorSeating: boolean;
  seatingNotes: string;
  // Weekday hours (Mon–Fri) — a simplification; weekend hours can differ slightly.
  opens: string;
  closes: string;
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
    seatingNotes: "Pavement tables on Aberdeen Place",
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
    seatingNotes: "Forecourt tables on an open corner junction",
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
    seatingNotes: "Enclosed courtyard behind Paddington Street",
    opens: "07:00",
    closes: "18:00",
    exposure: { type: "enclosed", minSunAltitudeDeg: 55 },
    placeId: "ChIJWZAsUgkbdkgRho3VniGxdBQ",
  },
];

export async function getCafes(): Promise<Cafe[]> {
  return CAFES;
}
