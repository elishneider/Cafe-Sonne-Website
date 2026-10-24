// Finds cafés and coffee shops in an area using Places API (New) text search over a grid of
// small rectangles (each search is capped at 60 results, so small cells keep us under that).
// Usage: node scripts/discover-places.mjs  → writes scripts/data/marylebone-soho-candidates.json
import fs from "node:fs";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!KEY) throw new Error("GOOGLE_PLACES_API_KEY missing");

// Marylebone + Soho (+ a margin of Fitzrovia/Mayfair), as one rectangle.
const AREA = { south: 51.508, north: 51.5255, west: -0.170, east: -0.124 };
const CELL_LAT = 0.004, CELL_LON = 0.0065;
const TYPES = ["cafe", "coffee_shop"];
const FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.location", "places.primaryType",
  "places.types", "places.businessStatus", "places.outdoorSeating", "places.rating", "places.userRatingCount",
  "places.googleMapsUri", "nextPageToken",
].join(",");

const found = new Map();
let requests = 0, capped = 0;

async function search(type, rect) {
  let pageToken, pages = 0, total = 0;
  do {
    const body = {
      textQuery: type === "cafe" ? "cafe" : "coffee shop",
      includedType: type,
      strictTypeFiltering: true,
      pageSize: 20,
      locationRestriction: { rectangle: { low: { latitude: rect.south, longitude: rect.west }, high: { latitude: rect.north, longitude: rect.east } } },
      ...(pageToken ? { pageToken } : {}),
    };
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify(body),
    });
    requests++;
    if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    for (const p of data.places ?? []) { total++; if (!found.has(p.id)) found.set(p.id, { ...p, foundAs: [type] }); else if (!found.get(p.id).foundAs.includes(type)) found.get(p.id).foundAs.push(type); }
    pageToken = data.nextPageToken; pages++;
  } while (pageToken && pages < 3);
  if (total >= 60) capped++;
}

for (let lat = AREA.south; lat < AREA.north; lat += CELL_LAT) {
  for (let lon = AREA.west; lon < AREA.east; lon += CELL_LON) {
    const rect = { south: lat, north: Math.min(lat + CELL_LAT, AREA.north), west: lon, east: Math.min(lon + CELL_LON, AREA.east) };
    for (const type of TYPES) await search(type, rect);
  }
}

const all = [...found.values()];
// Text search rectangles can return places just outside; keep only those inside the area.
const inside = all.filter((p) => p.location.latitude >= AREA.south && p.location.latitude <= AREA.north && p.location.longitude >= AREA.west && p.location.longitude <= AREA.east);
fs.mkdirSync(new URL("./data/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("./data/marylebone-soho-candidates.json", import.meta.url), JSON.stringify(inside, null, 1));

const count = (f) => inside.filter(f).length;
console.log(`requests: ${requests}   cells hitting the 60-result cap: ${capped}`);
console.log(`places found: ${inside.length}  (operational ${count((p) => p.businessStatus === "OPERATIONAL")})`);
console.log(`outdoorSeating  true: ${count((p) => p.outdoorSeating === true)}  false: ${count((p) => p.outdoorSeating === false)}  not stated: ${count((p) => p.outdoorSeating === undefined)}`);
console.log(`primary type: ` + JSON.stringify(inside.reduce((a, p) => ((a[p.primaryType] = (a[p.primaryType] ?? 0) + 1), a), {})));
