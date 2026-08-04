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
  closes: string;
  exposure: Exposure;
};

const CAFES: Cafe[] = [
  {
    id: "d1-coffee",
    name: "D1 Coffee",
    latitude: 51.5247884,
    longitude: -0.1761794,
    outdoorSeating: true,
    seatingNotes: "Pavement tables on Aberdeen Place",
    closes: "17:00",
    exposure: { type: "directional", facingDeg: 340, obstructionDeg: 18 },
  },
  {
    id: "gails-clifton-road",
    name: "GAIL's Bakery Clifton Road",
    latitude: 51.5256672,
    longitude: -0.1795886,
    outdoorSeating: true,
    seatingNotes: "Forecourt tables on an open corner junction",
    closes: "18:30",
    exposure: { type: "directional", facingDeg: 160, obstructionDeg: 12 },
  },
  {
    id: "white-mulberries",
    name: "White Mulberries",
    latitude: 51.5206033,
    longitude: -0.1530008,
    outdoorSeating: true,
    seatingNotes: "Enclosed courtyard behind Paddington Street",
    closes: "17:00",
    exposure: { type: "enclosed", minSunAltitudeDeg: 55 },
  },
];

export async function getCafes(): Promise<Cafe[]> {
  return CAFES;
}
