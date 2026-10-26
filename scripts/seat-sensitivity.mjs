// Experiment: compute each café's skyline from the Environment Agency 1m LIDAR surface model
// (buildings AND trees) and compare with the OpenStreetMap skyline and our hand-researched model.
import fs from "node:fs";
import proj4 from "proj4";
import { fromArrayBuffer } from "geotiff";
import * as SunCalcNS from "suncalc";
const SunCalc = SunCalcNS.default ?? SunCalcNS;

const BNG = "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs";
const DATASET = "9ba4d5ac-d596-445a-9056-dae3ddec0178";
const HALF = 220; // metres each side of the café
const EYE_M = 1.0;
const HAND = {
  "D1 Coffee": { type: "directional", facingDeg: 340, obstructionDeg: 18 },
  "GAIL's Clifton Rd": { type: "directional", facingDeg: 160, obstructionDeg: 12 },
  "White Mulberries": { type: "enclosed", minSunAltitudeDeg: 55 },
};
const seats = JSON.parse(fs.readFileSync(new URL("./seats.json", import.meta.url), "utf8"));
fs.mkdirSync(new URL("./.cache/", import.meta.url), { recursive: true });

async function fetchDsm(e, n, key) {
  const file = new URL(`./.cache/dsm-${key}.tif`, import.meta.url);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const x1 = Math.round(e - HALF), x2 = Math.round(e + HALF), y1 = Math.round(n - HALF), y2 = Math.round(n + HALF);
  const url = `https://environment.data.gov.uk/geoservices/datasets/${DATASET}/wcs?service=WCS&version=2.0.1&request=GetCoverage&coverageId=${DATASET}__Lidar_Composite_Elevation_LZ_DSM_1m&subset=E(${x1},${x2})&subset=N(${y1},${y2})&format=image/tiff`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "sonnencafe-research/0.1" } });
    if (res.ok && (res.headers.get("content-type") ?? "").includes("tiff")) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, buf);
      return buf;
    }
    console.log("WCS", res.status, (await res.text()).slice(0, 200));
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  throw new Error("WCS failed");
}

async function loadDsm(buf) {
  const tiff = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const image = await tiff.getImage();
  const [x0, y0, x1, y1] = image.getBoundingBox();
  const w = image.getWidth(), h = image.getHeight();
  const data = (await image.readRasters())[0];
  return { x0, y0, x1, y1, w, h, data, resX: (x1 - x0) / w, resY: (y1 - y0) / h };
}

const valueAt = (g, e, n) => {
  const col = Math.floor((e - g.x0) / g.resX), row = Math.floor((g.y1 - n) / g.resY);
  if (col < 0 || row < 0 || col >= g.w || row >= g.h) return NaN;
  const v = g.data[row * g.w + col];
  return v < -1000 || v > 1000 ? NaN : v;
};

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// How well the LIDAR height map lines up with OSM building outlines if shifted by (dE, dN).
function alignScore(g, e0, n0, polys, dE, dN) {
  let inside = [], outside = [];
  for (let x = -70; x <= 70; x += 3) for (let y = -70; y <= 70; y += 3) {
    const v = valueAt(g, e0 + dE + x, n0 + dN + y);
    if (Number.isNaN(v)) continue;
    (polys.some((p) => pointInPoly(x, y, p)) ? inside : outside).push(v);
  }
  if (inside.length < 20 || outside.length < 20) return -Infinity;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  return mean(inside) - mean(outside);
}

function horizonFromDsm(g, se, sn, step = 5) {
  // Ground height at the seat: lowest surface within 2.5 m (so an awning or tree overhead doesn't count).
  let ground = Infinity;
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
    const v = valueAt(g, se + dx, sn + dy); if (!Number.isNaN(v)) ground = Math.min(ground, v);
  }
  const profile = [];
  for (let az = 0; az < 360; az += step) {
    const dx = Math.sin((az * Math.PI) / 180), dy = Math.cos((az * Math.PI) / 180);
    let best = 0;
    for (let d = 1; d <= 200; d += 0.5) {
      const v = valueAt(g, se + dx * d, sn + dy * d);
      if (Number.isNaN(v)) continue;
      best = Math.max(best, (Math.atan2(v - ground - EYE_M, d) * 180) / Math.PI);
    }
    profile.push(best);
  }
  return { profile, ground };
}

const angleDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
function handStatus(hand, az, alt) {
  if (hand.type === "enclosed") return alt >= hand.minSunAltitudeDeg ? "sun" : alt >= hand.minSunAltitudeDeg - 10 ? "partial" : "shade";
  const diff = angleDiff(az, hand.facingDeg);
  if (diff > 100 || alt < hand.obstructionDeg) return "shade";
  if (diff > 80 || alt < hand.obstructionDeg + 5) return "partial";
  return "sun";
}
const DATES = [
  { label: "21 Jun", iso: "2026-06-21", tz: "+01:00" },
  { label: "22 Sep", iso: "2026-09-22", tz: "+01:00" },
  { label: "21 Dec", iso: "2026-12-21", tz: "+00:00" },
];
function dayHours(lat, lon, date, classify) {
  let min = 0, row = "";
  for (let h = 7; h <= 18; h++) {
    let sun = 0;
    for (let m = 0; m < 60; m += 10) {
      const when = new Date(`${date.iso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00${date.tz}`);
      const p = SunCalc.getPosition(when, lat, lon);
      const s = classify(p.azimuth, p.altitude);
      if (s === "sun") sun += 10; else if (s === "partial") sun += 5;
    }
    min += sun; row += sun >= 40 ? "S" : sun >= 15 ? "p" : ".";
  }
  return { row, hours: min / 60 };
}
const lookup = (profile, az) => profile[Math.round(az / 5) % profile.length];


const FACING = { "D1 Coffee": 340, "GAIL's Clifton Rd": 160 };
const SHIFTS = { "D1 Coffee": [-3, 0], "GAIL's Clifton Rd": [-2, 0] }; // map alignment found earlier
const OFFSETS = [
  ["on the spot", 0, 0],
  ["3 m along the street", 3, 0], ["-3 m along the street", -3, 0],
  ["5 m along the street", 5, 0], ["-5 m along the street", -5, 0],
  ["10 m along the street", 10, 0], ["-10 m along the street", -10, 0],
  ["2 m closer to the shop", 0, -2], ["2 m further into the street", 0, 2],
];
for (const name of Object.keys(FACING)) {
  const seat = seats[name];
  const [e0, n0] = proj4("EPSG:4326", BNG, [seat.lon, seat.lat]);
  const g = await loadDsm(await fetchDsm(e0, n0, `${seat.lat}-${seat.lon}`));
  const [dE, dN] = SHIFTS[name];
  const facing = (FACING[name] * Math.PI) / 180;
  const alongBearing = facing + Math.PI / 2; // along the street = across the facing direction
  console.log(`\n===== ${name}: sunny hours 07-18h [21 Jun, 22 Sep, 21 Dec] =====`);
  for (const [label, along, out] of OFFSETS) {
    const ox = Math.sin(alongBearing) * along + Math.sin(facing) * out;
    const oy = Math.cos(alongBearing) * along + Math.cos(facing) * out;
    const { profile } = horizonFromDsm(g, e0 + dE + seat.sx + ox, n0 + dN + seat.sy + oy);
    const hours = DATES.map((d) => dayHours(seat.lat, seat.lon, d, (az, alt) => (alt > lookup(profile, az) ? "sun" : "shade")).hours.toFixed(1));
    console.log(label.padEnd(28), hours.join("  "));
  }
}
