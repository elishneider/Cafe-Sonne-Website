// Builds an outline of London fare Zone 1. TfL publishes no official fare-zone polygons —
// zones are defined by their stations — so, like other open datasets, we assign every point
// to the zone of its nearest zoned station (a Voronoi/Thiessen partition) and trace the edge.
import fs from "node:fs";

const TYPES = ["NaptanMetroStation", "NaptanRailStation"];
const stations = [];
for (const type of TYPES) {
  const cache = new URL(`./.cache/tfl-${type}.json`, import.meta.url);
  fs.mkdirSync(new URL("./.cache/", import.meta.url), { recursive: true });
  let data;
  if (fs.existsSync(cache)) data = JSON.parse(fs.readFileSync(cache, "utf8"));
  else {
    const res = await fetch(`https://api.tfl.gov.uk/StopPoint/Type/${type}`, { headers: { "User-Agent": "sonnencafe-research/0.1" } });
    data = await res.json();
    fs.writeFileSync(cache, JSON.stringify(data));
  }
  for (const s of data) {
    const zone = s.additionalProperties?.find((p) => p.key === "Zone")?.value;
    if (zone && s.lat > 51) stations.push({ name: s.commonName, lat: s.lat, lon: s.lon, zones: zone.split("+") });
  }
}
console.log(`${stations.length} zoned stations, ${stations.filter((s) => s.zones.includes("1")).length} in zone 1`);

const LAT0 = 51.51, M_LAT = 111320, M_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const CELL = 100; // metres
const toM = (lat, lon) => [(lon + 0.1) * M_LON, (lat - LAT0) * M_LAT];
const pts = stations.map((s) => ({ ...s, xy: toM(s.lat, s.lon) }));

const cells = new Set();
const [xMin, yMin] = toM(51.44, -0.26), [xMax, yMax] = toM(51.58, 0.06);
for (let x = Math.floor(xMin / CELL); x <= Math.ceil(xMax / CELL); x++) {
  for (let y = Math.floor(yMin / CELL); y <= Math.ceil(yMax / CELL); y++) {
    const cx = (x + 0.5) * CELL, cy = (y + 0.5) * CELL;
    let best = null, bd = Infinity;
    for (const p of pts) { const d = (p.xy[0] - cx) ** 2 + (p.xy[1] - cy) ** 2; if (d < bd) { bd = d; best = p; } }
    if (process.env.STRICT ? best.zones.length === 1 && best.zones[0] === "1" : best.zones.includes("1")) cells.add(`${x},${y}`);
  }
}
console.log(`${cells.size} cells of ${CELL}m => ~${((cells.size * CELL * CELL) / 1e6).toFixed(1)} km²`);

// Trace the outline: collect edges that border a non-zone-1 cell, then chain them into rings.
const edges = new Map();
const add = (a, b) => { const k = a; if (!edges.has(k)) edges.set(k, []); edges.get(k).push(b); };
for (const key of cells) {
  const [x, y] = key.split(",").map(Number);
  const has = (dx, dy) => cells.has(`${x + dx},${y + dy}`);
  if (!has(0, -1)) add(`${x},${y}`, `${x + 1},${y}`);
  if (!has(1, 0)) add(`${x + 1},${y}`, `${x + 1},${y + 1}`);
  if (!has(0, 1)) add(`${x + 1},${y + 1}`, `${x},${y + 1}`);
  if (!has(-1, 0)) add(`${x},${y + 1}`, `${x},${y}`);
}
const rings = [];
while (edges.size) {
  const start = edges.keys().next().value;
  const ring = [start];
  let cur = start;
  for (;;) {
    const next = edges.get(cur)?.pop();
    if (edges.get(cur)?.length === 0) edges.delete(cur);
    if (!next || next === start) break;
    ring.push(next); cur = next;
  }
  rings.push(ring);
}
rings.sort((a, b) => b.length - a.length);
const toLatLon = (k) => { const [x, y] = k.split(",").map(Number); const px = x * CELL, py = y * CELL; return [+(px / M_LON - 0.1).toFixed(5), +(py / M_LAT + LAT0).toFixed(5)]; };
const outer = rings[0].map(toLatLon);
outer.push(outer[0]);
fs.writeFileSync(new URL("./data/zone1.geojson", import.meta.url), JSON.stringify({ type: "Feature", properties: { name: "London fare Zone 1 (approximation)" }, geometry: { type: "Polygon", coordinates: [outer] } }));
console.log(`outline: ${outer.length} points; ${rings.length} ring(s) traced`);
