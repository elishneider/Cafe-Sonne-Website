// Experiment: compute each café's skyline ("horizon profile") from OpenStreetMap buildings,
// then compare the sun hours it implies with our hand-researched facing/obstruction model.
// Nothing here touches the app.
import fs from "node:fs";
import * as SunCalcNS from "suncalc";
const SunCalc = SunCalcNS.default ?? SunCalcNS;

const CAFES = [
  { id: "D1 Coffee", lat: 51.5247884, lon: -0.1761794, hand: { type: "directional", facingDeg: 340, obstructionDeg: 18 } },
  { id: "GAIL's Clifton Rd", lat: 51.5256672, lon: -0.1795886, hand: { type: "directional", facingDeg: 160, obstructionDeg: 12 } },
  { id: "White Mulberries", lat: 51.5206033, lon: -0.1530008, hand: { type: "enclosed", minSunAltitudeDeg: 55 } },
];
const RADIUS_M = 250;
const EYE_M = 1.0;
const METRES_PER_LEVEL = 3.2;
const ROOF_M = 1.0;
const DEFAULTS_TO_TRY = [3, 4, 5];

async function fetchBuildings(lat, lon) {
  const cacheDir = new URL("./.cache/", import.meta.url);
  fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFile = new URL(`osm-${lat}-${lon}-${RADIUS_M}.json`, cacheDir);
  if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, "utf8"));

  const q = `[out:json][timeout:60];way["building"](around:${RADIUS_M},${lat},${lon});out geom tags;`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "User-Agent": "sonnencafe-research/0.1", Accept: "*/*", "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q),
    });
    if (res.ok) {
      const elements = (await res.json()).elements;
      fs.writeFileSync(cacheFile, JSON.stringify(elements));
      return elements;
    }
    console.log(`Overpass HTTP ${res.status}, retrying (${attempt}/5)…`);
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
  throw new Error("Overpass kept failing");
}

function toLocal(el, lat0, lon0) {
  const mLat = 111320, mLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return el.geometry.map((p) => [(p.lon - lon0) * mLon, (p.lat - lat0) * mLat]);
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function heightOf(tags, defaultLevels) {
  if (tags.height) { const h = parseFloat(tags.height); if (!Number.isNaN(h)) return h; }
  const levels = parseFloat(tags["building:levels"]);
  return (Number.isNaN(levels) ? defaultLevels : levels) * METRES_PER_LEVEL + ROOF_M;
}

// Skyline angle (degrees above horizontal) at each compass bearing, seen from (sx, sy).
function horizonProfile(buildings, sx, sy, step = 5) {
  const profile = [];
  for (let az = 0; az < 360; az += step) {
    const dx = Math.sin((az * Math.PI) / 180), dy = Math.cos((az * Math.PI) / 180);
    let best = 0;
    for (const b of buildings) {
      if (pointInPoly(sx, sy, b.poly)) continue;
      let nearest = Infinity;
      for (let i = 0; i < b.poly.length - 1; i++) {
        const [ax, ay] = b.poly[i], [bx, by] = b.poly[i + 1];
        const ex = bx - ax, ey = by - ay;
        const denom = dx * ey - dy * ex;
        if (Math.abs(denom) < 1e-9) continue;
        const t = ((ax - sx) * ey - (ay - sy) * ex) / denom;
        const u = ((ax - sx) * dy - (ay - sy) * dx) / denom;
        if (t > 0.2 && u >= 0 && u <= 1 && t < nearest) nearest = t;
      }
      if (nearest < Infinity) best = Math.max(best, (Math.atan2(b.height - EYE_M, nearest) * 180) / Math.PI);
    }
    profile.push(best);
  }
  return profile;
}

const angleDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// Our current hand-researched model (same rules as src/lib/sunStatus.ts).
function handStatus(hand, az, alt) {
  if (hand.type === "enclosed") return alt >= hand.minSunAltitudeDeg ? "sun" : alt >= hand.minSunAltitudeDeg - 10 ? "partial" : "shade";
  const diff = angleDiff(az, hand.facingDeg);
  if (diff > 100 || alt < hand.obstructionDeg) return "shade";
  if (diff > 80 || alt < hand.obstructionDeg + 5) return "partial";
  return "sun";
}

function osmSunny(profile, step, az, alt) {
  const i = Math.round(az / step) % profile.length;
  return alt > profile[i];
}

function pickSeat(cafe, buildings) {
  if (cafe.hand.type === "directional") {
    // Walk from the café's pin out through the front, in the facing direction, until we are
    // outside every building, then a little further onto the pavement.
    const dx = Math.sin((cafe.hand.facingDeg * Math.PI) / 180), dy = Math.cos((cafe.hand.facingDeg * Math.PI) / 180);
    let d = 0;
    while (d < 60 && buildings.some((b) => pointInPoly(dx * d, dy * d, b.poly))) d += 0.5;
    d += 1.5;
    return [dx * d, dy * d, `${d.toFixed(1)}m toward ${cafe.hand.facingDeg}°`];
  }
  // Enclosed courtyard: nearest open point whose skyline is high on (almost) every side.
  let best = null;
  for (let r = 0; r <= 45 && !best; r += 1.5) {
    for (let a = 0; a < 360; a += 20) {
      const x = r * Math.sin((a * Math.PI) / 180), y = r * Math.cos((a * Math.PI) / 180);
      if (buildings.some((b) => pointInPoly(x, y, b.poly))) continue;
      const prof = horizonProfile(buildings, x, y, 15);
      const mean = prof.reduce((s, v) => s + v, 0) / prof.length;
      if (mean > 35 && prof.filter((v) => v < 15).length <= 3) { best = [x, y, `courtyard ${r.toFixed(1)}m away`]; break; }
    }
  }
  return best ?? [0, 0, "no courtyard found (using pin)"];
}

const DATES = [
  { label: "21 Jun", iso: "2026-06-21", tz: "+01:00" },
  { label: "22 Sep", iso: "2026-09-22", tz: "+01:00" },
  { label: "21 Dec", iso: "2026-12-21", tz: "+00:00" },
];

function dayHours(cafe, date, classify) {
  let sunnyMin = 0, row = "";
  for (let h = 7; h <= 18; h++) {
    let sun = 0;
    for (let m = 0; m < 60; m += 10) {
      const when = new Date(`${date.iso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00${date.tz}`);
      const p = SunCalc.getPosition(when, cafe.lat, cafe.lon);
      const alt = p.altitude, az = p.azimuth;
      const s = classify(az, alt);
      if (s === "sun") sun += 10; else if (s === "partial") sun += 5;
    }
    sunnyMin += sun;
    row += sun >= 40 ? "S" : sun >= 15 ? "p" : ".";
  }
  return { row, hours: sunnyMin / 60 };
}

const summary = [];
const seatsOut = {};
for (const cafe of CAFES) {
  console.log(`\n===== ${cafe.id} =====`);
  const els = await fetchBuildings(cafe.lat, cafe.lon);
  console.log(`${els.length} buildings within ${RADIUS_M}m`);
  for (const defaultLevels of DEFAULTS_TO_TRY) {
    const buildings = els.map((e) => ({ poly: toLocal(e, cafe.lat, cafe.lon), height: heightOf(e.tags ?? {}, defaultLevels) }));
    const [sx, sy, how] = pickSeat(cafe, buildings);
    const profile = horizonProfile(buildings, sx, sy, 5);
    if (defaultLevels === 4) {
      seatsOut[cafe.id] = { lat: cafe.lat, lon: cafe.lon, sx, sy, how, osmProfile: profile };
      console.log(`seat: ${how}`);
      const line = (arr) => arr.filter((_, i) => i % 3 === 0).map((v) => String(Math.round(v)).padStart(3)).join("");
      console.log("bearing  " + Array.from({ length: 24 }, (_, i) => String(i * 15).padStart(3)).join(""));
      console.log("OSM °    " + line(profile));
      const handLine = Array.from({ length: 24 }, (_, i) => {
        const az = i * 15;
        const h = cafe.hand.type === "enclosed" ? 55 : angleDiff(az, cafe.hand.facingDeg) > 100 ? 90 : cafe.hand.obstructionDeg;
        return String(h).padStart(3);
      }).join("");
      console.log("hand °   " + handLine);
    }
    const osm = DATES.map((d) => dayHours(cafe, d, (az, alt) => (osmSunny(profile, 5, az, alt) ? "sun" : "shade")));
    const hand = DATES.map((d) => dayHours(cafe, d, (az, alt) => handStatus(cafe.hand, az, alt)));
    summary.push({ cafe: cafe.id, defaultLevels, osm: osm.map((o) => o.hours.toFixed(1)), hand: hand.map((o) => o.hours.toFixed(1)) });
    if (defaultLevels === 4) {
      DATES.forEach((d, i) => console.log(`${d.label}  07→18h   hand ${hand[i].row} (${hand[i].hours.toFixed(1)}h)   OSM ${osm[i].row} (${osm[i].hours.toFixed(1)}h)`));
    }
  }
  await new Promise((r) => setTimeout(r, 1500));
}
console.log("\n===== sunny hours 07–18h: [21 Jun, 22 Sep, 21 Dec] =====");
for (const s of summary) console.log(`${s.cafe.padEnd(18)} default ${s.defaultLevels} levels   OSM [${s.osm.join(", ")}]   hand [${s.hand.join(", ")}]`);

fs.writeFileSync(new URL("./seats.json", import.meta.url), JSON.stringify(seatsOut, null, 2));
