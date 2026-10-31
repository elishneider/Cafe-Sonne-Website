// For every café we are confident has outdoor seating (Gemini says yes, Google doesn't disagree):
//   1. place a handful of seat points on the pavement in front of the café,
//   2. compute the skyline ("horizon profile") from each seat point twice, independently:
//      from the Environment Agency 1 m LIDAR surface model (buildings AND trees) and from
//      OpenStreetMap building outlines,
//   3. compare the two and give each café a confidence level.
// Output: scripts/data/skylines-marylebone-soho.json. Nothing here touches the app.
//
//   node scripts/compute-skylines.mjs            all cafés
//   node scripts/compute-skylines.mjs --limit 8  first 8 (plus the pilots), to test
import fs from "node:fs";
import proj4 from "proj4";
import { fromArrayBuffer } from "geotiff";
import * as SunCalcNS from "suncalc";
const SunCalc = SunCalcNS.default ?? SunCalcNS;

const BNG = "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs";
const toBng = (lon, lat) => proj4("EPSG:4326", BNG, [lon, lat]);
const DATASET = "9ba4d5ac-d596-445a-9056-dae3ddec0178";
const WINDOW_M = 260; // how far from each café we need LIDAR / OSM data
const EYE_M = 1.0;
const METRES_PER_LEVEL = 3.2, ROOF_M = 1.0, DEFAULT_LEVELS = 4;
const STEP_DEG = 5;
const CACHE = new URL("./.cache/", import.meta.url);
fs.mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };

// ---------------------------------------------------------------- which cafés
function loadCafes() {
  const cands = JSON.parse(fs.readFileSync(new URL("./data/marylebone-soho-candidates.json", import.meta.url), "utf8"))
    .filter((p) => ["cafe", "coffee_shop"].includes(p.primaryType));
  const out = [];
  for (const p of cands) {
    const f = new URL(`./.cache/classify/${p.id}.json`, import.meta.url);
    if (!fs.existsSync(f)) continue;
    const r = JSON.parse(fs.readFileSync(f, "utf8"));
    if (r.outdoorSeating !== "yes" || p.outdoorSeating === false) continue;
    out.push({
      id: p.id, name: p.displayName.text, address: p.formattedAddress, lat: p.location.latitude, lon: p.location.longitude,
      type: r.seatingType === "forecourt" ? "pavement" : r.seatingType, position: r.position, geminiConfidence: r.confidence,
    });
  }
  // Pilot cafés, as a sanity check: we know roughly where their seats are.
  out.push(
    { id: "pilot-d1", name: "D1 Coffee (pilot)", lat: 51.5247884, lon: -0.1761794, type: "pavement", position: "front of shop", pilot: true },
    { id: "pilot-gails", name: "GAIL's Clifton Rd (pilot)", lat: 51.5256672, lon: -0.1795886, type: "pavement", position: "front of shop", pilot: true },
    { id: "pilot-wm", name: "White Mulberries (pilot)", lat: 51.5206033, lon: -0.1530008, type: "courtyard", position: "rear of shop", pilot: true },
  );
  const limit = arg("--limit");
  if (limit) return [...out.filter((c) => !c.pilot).slice(0, Number(limit)), ...out.filter((c) => c.pilot)];
  return out;
}

// ---------------------------------------------------------------- OpenStreetMap
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
async function overpass(query, cacheName) {
  const file = new URL(cacheName, CACHE);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  for (let attempt = 1; attempt <= 9; attempt++) {
    try {
      const res = await fetch(OVERPASS[(attempt - 1) % OVERPASS.length], {
        method: "POST",
        headers: { "User-Agent": "sonnencafe-research/0.1", Accept: "*/*", "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) { const j = (await res.json()).elements; fs.writeFileSync(file, JSON.stringify(j)); return j; }
      console.log(`  Overpass HTTP ${res.status}, retry ${attempt}/9`);
    } catch (e) { console.log(`  Overpass ${e.cause?.code ?? e.name}, retry ${attempt}/9`); }
    await sleep(2000 * attempt);
  }
  throw new Error("Overpass kept failing for " + cacheName);
}

const CELL_LAT = 0.0045, CELL_LON = 0.007;
async function loadBuildings(cafes) {
  const cells = new Set();
  const dLat = WINDOW_M / 111320;
  for (const c of cafes) {
    const dLon = WINDOW_M / (111320 * Math.cos((c.lat * Math.PI) / 180));
    for (let la = Math.floor((c.lat - dLat) / CELL_LAT); la <= Math.floor((c.lat + dLat) / CELL_LAT); la++)
      for (let lo = Math.floor((c.lon - dLon) / CELL_LON); lo <= Math.floor((c.lon + dLon) / CELL_LON); lo++) cells.add(`${la}_${lo}`);
  }
  console.log(`OSM buildings: ${cells.size} map cells`);
  const byId = new Map();
  let i = 0;
  for (const key of cells) {
    const [la, lo] = key.split("_").map(Number);
    const bb = `${(la * CELL_LAT).toFixed(5)},${(lo * CELL_LON).toFixed(5)},${((la + 1) * CELL_LAT).toFixed(5)},${((lo + 1) * CELL_LON).toFixed(5)}`;
    const file = `osmcell-${key}.json`;
    const cached = fs.existsSync(new URL(file, CACHE));
    const els = await overpass(`[out:json][timeout:90];way["building"](${bb});out geom tags;`, file);
    for (const e of els) if (e.geometry) byId.set(e.id, e);
    if (!cached) await sleep(1500);
    if (++i % 10 === 0) console.log(`  ${i}/${cells.size}`);
  }
  return [...byId.values()].map((e) => {
    const poly = e.geometry.map((p) => toBng(p.lon, p.lat));
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const t = e.tags ?? {};
    let h = parseFloat(t.height);
    if (Number.isNaN(h)) { const lv = parseFloat(t["building:levels"]); h = (Number.isNaN(lv) ? DEFAULT_LEVELS : lv) * METRES_PER_LEVEL + ROOF_M; }
    return { poly, h, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
}

// Streets, fetched cell by cell like the buildings (a little wider, as a long street can pass
// through a cell without having a node in it).
async function loadRoads(cafes) {
  const cells = new Set();
  const dLat = WINDOW_M / 111320;
  for (const c of cafes) {
    const dLon = WINDOW_M / (111320 * Math.cos((c.lat * Math.PI) / 180));
    for (let la = Math.floor((c.lat - dLat) / CELL_LAT); la <= Math.floor((c.lat + dLat) / CELL_LAT); la++)
      for (let lo = Math.floor((c.lon - dLon) / CELL_LON); lo <= Math.floor((c.lon + dLon) / CELL_LON); lo++) cells.add(`${la}_${lo}`);
  }
  console.log(`OSM roads: ${cells.size} map cells`);
  const byId = new Map();
  const m = 0.0006;
  for (const key of cells) {
    const [la, lo] = key.split("_").map(Number);
    const bb = `${(la * CELL_LAT - m).toFixed(5)},${(lo * CELL_LON - m).toFixed(5)},${((la + 1) * CELL_LAT + m).toFixed(5)},${((lo + 1) * CELL_LON + m).toFixed(5)}`;
    const file = `osmroads-${key}.json`;
    const cached = fs.existsSync(new URL(file, CACHE));
    const els = await overpass(
      `[out:json][timeout:60];way["highway"]["highway"!~"^(footway|path|steps|cycleway|corridor|elevator|proposed|construction|bridleway|track)$"](${bb});out geom;`,
      file,
    );
    for (const e of els) if (e.geometry) byId.set(e.id, e);
    if (!cached) await sleep(1500);
  }
  const segs = [];
  for (const e of byId.values()) {
    const pts = e.geometry.map((p) => toBng(p.lon, p.lat));
    for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
  }
  return segs;
}

// ---------------------------------------------------------------- LIDAR
const TILE = 500;
const tiles = new Map();
async function fetchTile(ti, tj) {
  const key = `${ti}_${tj}`;
  if (tiles.has(key)) return tiles.get(key);
  const file = new URL(`dsm-tile-${key}.tif`, CACHE);
  let buf = fs.existsSync(file) ? fs.readFileSync(file) : null;
  const x1 = ti * TILE, y1 = tj * TILE;
  if (!buf) {
    const url = `https://environment.data.gov.uk/geoservices/datasets/${DATASET}/wcs?service=WCS&version=2.0.1&request=GetCoverage&coverageId=${DATASET}__Lidar_Composite_Elevation_LZ_DSM_1m&subset=E(${x1},${x1 + TILE})&subset=N(${y1},${y1 + TILE})&format=image/tiff`;
    for (let attempt = 1; attempt <= 5 && !buf; attempt++) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "sonnencafe-research/0.1" }, signal: AbortSignal.timeout(90_000) });
        if (res.ok && (res.headers.get("content-type") ?? "").includes("tiff")) { buf = Buffer.from(await res.arrayBuffer()); fs.writeFileSync(file, buf); }
        else console.log(`  WCS ${res.status} for tile ${key}, retry ${attempt}/5`);
      } catch (e) { console.log(`  WCS ${e.cause?.code ?? e.name} for tile ${key}, retry ${attempt}/5`); }
      if (!buf) await sleep(3000 * attempt);
    }
    await sleep(800);
  }
  let g = null;
  if (buf) {
    const tiff = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const image = await tiff.getImage();
    const [x0, y0, xx1, yy1] = image.getBoundingBox();
    const w = image.getWidth(), h = image.getHeight();
    g = { x0, y1: yy1, w, h, resX: (xx1 - x0) / w, resY: (yy1 - y0) / h, data: (await image.readRasters())[0] };
  }
  tiles.set(key, g);
  return g;
}
async function ensureTiles(cafes) {
  const need = new Set();
  for (const c of cafes) {
    const [e, n] = toBng(c.lon, c.lat);
    for (let i = Math.floor((e - WINDOW_M) / TILE); i <= Math.floor((e + WINDOW_M) / TILE); i++)
      for (let j = Math.floor((n - WINDOW_M) / TILE); j <= Math.floor((n + WINDOW_M) / TILE); j++) need.add(`${i}_${j}`);
  }
  console.log(`LIDAR: ${need.size} tiles of ${TILE} m`);
  let k = 0;
  for (const key of need) { const [i, j] = key.split("_").map(Number); await fetchTile(i, j); if (++k % 10 === 0) console.log(`  ${k}/${need.size}`); }
}
const dsm = (e, n) => {
  const g = tiles.get(`${Math.floor(e / TILE)}_${Math.floor(n / TILE)}`);
  if (!g) return NaN;
  const col = Math.floor((e - g.x0) / g.resX), row = Math.floor((g.y1 - n) / g.resY);
  if (col < 0 || row < 0 || col >= g.w || row >= g.h) return NaN;
  const v = g.data[row * g.w + col];
  return v < -1000 || v > 1000 ? NaN : v;
};

// ---------------------------------------------------------------- geometry helpers
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inAnyBuilding = (x, y, bs) => bs.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && pointInPoly(x, y, b.poly));
function nearestOnSegments(px, py, segs, maxD) {
  let best = null;
  for (const [[ax, ay], [bx, by]] of segs) {
    if (Math.max(ax, bx) < px - maxD || Math.min(ax, bx) > px + maxD || Math.max(ay, by) < py - maxD || Math.min(ay, by) > py + maxD) continue;
    const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / l2)) : 0;
    const qx = ax + t * ex, qy = ay + t * ey, d = Math.hypot(qx - px, qy - py);
    if (!best || d < best.d) best = { d, x: qx, y: qy };
  }
  return best;
}

// True north is not quite grid north in British National Grid; bearings need that small turn.
function gridOffsetDeg(lon, lat) {
  const [e0, n0] = toBng(lon, lat), [e1, n1] = toBng(lon, lat + 0.001);
  return (Math.atan2(e1 - e0, n1 - n0) * 180) / Math.PI;
}

// Skyline angle at each true compass bearing, from OpenStreetMap buildings.
function osmProfile(bs, sx, sy, gOff) {
  const out = [];
  const near = bs.filter((b) => b.x1 > sx - 250 && b.x0 < sx + 250 && b.y1 > sy - 250 && b.y0 < sy + 250);
  for (let az = 0; az < 360; az += STEP_DEG) {
    const gb = ((az + gOff) * Math.PI) / 180, dx = Math.sin(gb), dy = Math.cos(gb);
    let best = 0;
    for (const b of near) {
      let nearest = Infinity;
      for (let i = 0; i < b.poly.length - 1; i++) {
        const [ax, ay] = b.poly[i], [bx, by] = b.poly[i + 1];
        const ex = bx - ax, ey = by - ay, denom = dx * ey - dy * ex;
        if (Math.abs(denom) < 1e-9) continue;
        const t = ((ax - sx) * ey - (ay - sy) * ex) / denom, u = ((ax - sx) * dy - (ay - sy) * dx) / denom;
        if (t > 0.2 && u >= 0 && u <= 1 && t < nearest) nearest = t;
      }
      if (nearest < Infinity) best = Math.max(best, (Math.atan2(b.h - EYE_M, nearest) * 180) / Math.PI);
    }
    out.push(best);
  }
  return out;
}

// Same, from the LIDAR surface model (sampled at the seat position shifted by the map alignment).
function lidarProfile(se, sn, gOff) {
  let ground = Infinity;
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) { const v = dsm(se + dx, sn + dy); if (!Number.isNaN(v)) ground = Math.min(ground, v); }
  if (!Number.isFinite(ground)) return null;
  const out = [];
  for (let az = 0; az < 360; az += STEP_DEG) {
    const gb = ((az + gOff) * Math.PI) / 180, dx = Math.sin(gb), dy = Math.cos(gb);
    let best = 0;
    for (let d = 1; d <= 200; d += 0.5) {
      const v = dsm(se + dx * d, sn + dy * d);
      if (!Number.isNaN(v)) best = Math.max(best, (Math.atan2(v - ground - EYE_M, d) * 180) / Math.PI);
    }
    out.push(best);
  }
  return out;
}

// How far the LIDAR map has to be shifted to line up with the OSM building outlines.
function alignLidar(e0, n0, bs) {
  const pts = [];
  for (let x = -70; x <= 70; x += 3) for (let y = -70; y <= 70; y += 3) pts.push([x, y, inAnyBuilding(e0 + x, n0 + y, bs)]);
  let best = { score: -Infinity, dE: 0, dN: 0 };
  for (let dE = -8; dE <= 8; dE++) for (let dN = -8; dN <= 8; dN++) {
    let si = 0, ni = 0, so = 0, no = 0;
    for (const [x, y, inside] of pts) {
      const v = dsm(e0 + dE + x, n0 + dN + y);
      if (Number.isNaN(v)) continue;
      if (inside) { si += v; ni++; } else { so += v; no++; }
    }
    if (ni < 20 || no < 20) continue;
    const score = si / ni - so / no;
    if (score > best.score) best = { score, dE, dN };
  }
  return best;
}

// ---------------------------------------------------------------- seat placement
function placeSeats(c, e0, n0, bs, roads, gOff) {
  const near = bs.filter((b) => b.x1 > e0 - 120 && b.x0 < e0 + 120 && b.y1 > n0 - 120 && b.y0 < n0 + 120);
  if (c.type === "courtyard") {
    // The nearest open spot whose skyline is high on (almost) every side, plus a little spread around it.
    for (let r = 0; r <= 45; r += 1.5) for (let a = 0; a < 360; a += 20) {
      const x = e0 + r * Math.sin((a * Math.PI) / 180), y = n0 + r * Math.cos((a * Math.PI) / 180);
      if (inAnyBuilding(x, y, near)) continue;
      const prof = osmProfile(near, x, y, gOff).filter((_, i) => i % 3 === 0);
      if (prof.reduce((s, v) => s + v, 0) / prof.length > 35 && prof.filter((v) => v < 15).length <= 3) {
        const pts = [[x, y]];
        for (const [dx, dy] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) if (!inAnyBuilding(x + dx, y + dy, near)) pts.push([x + dx, y + dy]);
        return { how: `courtyard ${r.toFixed(0)} m from pin`, points: pts, roadDist: null };
      }
    }
    return { how: "no courtyard found", points: [], roadDist: null };
  }
  if (c.type !== "pavement") return { how: `${c.type}: needs hand placement`, points: [], roadDist: null };

  const road = nearestOnSegments(e0, n0, roads, 80);
  if (!road || road.d < 0.5) return { how: "no road nearby", points: [], roadDist: null };
  if (road.d > 30) {
    // Pin in a park or on a big square: "toward the street" means nothing, so use a small cluster around the pin.
    if (inAnyBuilding(e0, n0, near)) return { how: `pin inside a building, street ${road.d.toFixed(0)} m away: needs hand placement`, points: [], roadDist: road.d };
    const pts = [];
    for (const dx of [-2, 0, 2]) for (const dy of [-2, 0, 2]) if (!inAnyBuilding(e0 + dx, n0 + dy, near)) pts.push([e0 + dx, n0 + dy]);
    return { how: `pin ${road.d.toFixed(0)} m from any street: cluster around the pin`, points: pts, roadDist: road.d, farFromStreet: true };
  }
  const ux = (road.x - e0) / road.d, uy = (road.y - n0) / road.d; // from the pin toward the street
  let exit = 0;
  while (exit < 40 && inAnyBuilding(e0 + ux * exit, n0 + uy * exit, near)) exit += 0.25;
  const wx = e0 + ux * exit, wy = n0 + uy * exit; // where the building front is
  const room = road.d - exit; // pavement between building front and the middle of the road
  const points = [];
  for (const s of [1, 2, 3]) for (const l of [-3, 0, 3]) {
    const ss = Math.min(s, Math.max(0.5, room - 1.5));
    const x = wx + ux * ss + -uy * l, y = wy + uy * ss + ux * l;
    if (!inAnyBuilding(x, y, near) && !points.some((p) => Math.hypot(p[0] - x, p[1] - y) < 0.4)) points.push([x, y]);
  }
  return { how: `pavement toward street ${road.d.toFixed(0)} m away, ${room.toFixed(1)} m of pavement`, points, roadDist: road.d, room, exit };
}

// ---------------------------------------------------------------- sun hours from a profile
const DATES = [
  { label: "21 Mar", iso: "2026-03-21", tz: "+00:00" },
  { label: "21 Jun", iso: "2026-06-21", tz: "+01:00" },
  { label: "22 Sep", iso: "2026-09-22", tz: "+01:00" },
  { label: "21 Dec", iso: "2026-12-21", tz: "+00:00" },
];
function sunHours(lat, lon, date, profiles) {
  // Average over the seat points: hours between 07:00 and 19:00 when the sun is above the skyline.
  let total = 0;
  for (let h = 7; h < 19; h++) for (let m = 0; m < 60; m += 10) {
    const p = SunCalc.getPosition(new Date(`${date.iso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00${date.tz}`), lat, lon);
    if (p.altitude <= 0) continue;
    const i = Math.round(((p.azimuth % 360) + 360) % 360 / STEP_DEG) % (360 / STEP_DEG);
    total += profiles.filter((pr) => p.altitude > pr[i]).length / profiles.length;
  }
  return total / 6; // ten-minute steps -> hours
}

// ---------------------------------------------------------------- main
const cafes = loadCafes();
console.log(`${cafes.length} cafés (${cafes.filter((c) => c.pilot).length} pilots)`);
const buildings = await loadBuildings(cafes);
console.log(`${buildings.length} OSM buildings`);
const roads = await loadRoads(cafes);
console.log(`${roads.length} road segments`);
await ensureTiles(cafes);

const results = [];
let n = 0;
for (const c of cafes) {
  n++;
  const [e0, n0] = toBng(c.lon, c.lat);
  const gOff = gridOffsetDeg(c.lon, c.lat);
  const near = buildings.filter((b) => b.x1 > e0 - 300 && b.x0 < e0 + 300 && b.y1 > n0 - 300 && b.y0 < n0 + 300);
  const align = alignLidar(e0, n0, near);
  const seats = placeSeats(c, e0, n0, near, roads, gOff);
  const row = { id: c.id, name: c.name, address: c.address, lat: c.lat, lon: c.lon, type: c.type, position: c.position, pilot: c.pilot ?? false, seatPlacement: seats.how, align: { dE: align.dE, dN: align.dN, score: Number.isFinite(align.score) ? +align.score.toFixed(1) : null } };
  const reasons = [];
  if (!seats.points.length) {
    Object.assign(row, { confidence: "needs-manual", reasons: [seats.how] });
    results.push(row);
    console.log(`[${n}/${cafes.length}] ${c.name}: ${seats.how}`);
    continue;
  }
  const lid = [], osm = [];
  for (const [x, y] of seats.points) {
    osm.push(osmProfile(near, x, y, gOff));
    const lp = lidarProfile(x + align.dE, y + align.dN, gOff);
    if (lp) lid.push(lp);
  }
  row.seatPoints = seats.points.length;
  row.osmProfiles = osm.map((p) => p.map((v) => +v.toFixed(1)));
  row.lidarProfiles = lid.map((p) => p.map((v) => +v.toFixed(1)));
  row.hours = {};
  let worstGap = 0, worstSpread = 0;
  for (const d of DATES) {
    const o = sunHours(c.lat, c.lon, d, osm);
    const l = lid.length ? sunHours(c.lat, c.lon, d, lid) : null;
    const perPoint = (lid.length ? lid : osm).map((p) => sunHours(c.lat, c.lon, d, [p]));
    const spread = Math.max(...perPoint) - Math.min(...perPoint);
    row.hours[d.label] = { osm: +o.toFixed(1), lidar: l === null ? null : +l.toFixed(1), spread: +spread.toFixed(1) };
    if (l !== null) worstGap = Math.max(worstGap, Math.abs(o - l));
    worstSpread = Math.max(worstSpread, spread);
  }
  if (!lid.length) reasons.push("no LIDAR here");
  if (lid.length && (align.score === null || align.score < 3)) reasons.push("LIDAR doesn't line up with OSM buildings");
  if (worstGap > 2) reasons.push(`LIDAR and OSM differ by ${worstGap.toFixed(1)} h`);
  else if (worstGap > 1) reasons.push(`LIDAR and OSM differ by ${worstGap.toFixed(1)} h (small)`);
  if (worstSpread > 3) reasons.push(`sun varies ${worstSpread.toFixed(1)} h across the seat area`);
  if (!/front/.test(c.position ?? "") && c.type === "pavement") reasons.push(`seats at the ${c.position}`);
  if (seats.room !== undefined && seats.room < 1.5) reasons.push("very little pavement");
  if (seats.farFromStreet) reasons.push("pin far from any street");
  // Cover that LIDAR sees but OpenStreetMap doesn't: trees, awnings, canopies.
  if (lid.length) {
    let covered = 0, total = 0;
    for (let k = 0; k < lid.length; k++) for (let i = 0; i < lid[k].length; i++) { total++; if (lid[k][i] > 70 && osm[k][i] < 45) covered++; }
    row.overheadCover = +(covered / total).toFixed(2);
    if (covered / total > 0.4) reasons.push("probably under trees or a canopy (LIDAR sees it, OSM doesn't)");
  }
  row.worstGapHours = +worstGap.toFixed(1);
  row.worstSpreadHours = +worstSpread.toFixed(1);
  const hard = !lid.length || (align.score === null || align.score < 3) || worstGap > 2 || worstSpread > 3;
  row.confidence = hard ? "low" : reasons.length ? "medium" : "high";
  row.reasons = reasons;
  results.push(row);
  const h = row.hours["21 Jun"];
  console.log(`[${n}/${cafes.length}] ${c.name}: ${row.confidence} — Jun OSM ${h.osm}h / LIDAR ${h.lidar}h (${seats.points.length} pts)${reasons.length ? " · " + reasons.join("; ") : ""}`);
}

const out = new URL("./data/skylines-marylebone-soho.json", import.meta.url);
fs.writeFileSync(out, JSON.stringify(results));
const tally = {};
for (const r of results) tally[r.confidence] = (tally[r.confidence] ?? 0) + 1;
console.log("\nconfidence:", tally);
