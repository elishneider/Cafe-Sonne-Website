// Compare Gemini's photo-based seating answer with Google's flag and OpenStreetMap, then pick
// a ~30 café sample for a manual check: the disagreements, the rarer seating types, the
// low-confidence answers, plus a few "everything agrees" controls to measure the baseline error.
import fs from "node:fs";

const cands = JSON.parse(fs.readFileSync(new URL("./data/marylebone-soho-candidates.json", import.meta.url), "utf8"))
  .filter((p) => ["cafe", "coffee_shop"].includes(p.primaryType));

const cacheDir = new URL("./.cache/", import.meta.url);
const osmCache = new URL("osm-outdoor-seating.json", cacheDir);
let osmRaw;
if (fs.existsSync(osmCache)) osmRaw = JSON.parse(fs.readFileSync(osmCache, "utf8"));
else {
  const bbox = "51.508,-0.170,51.5255,-0.124";
  const q = `[out:json][timeout:60];nwr["amenity"~"cafe|restaurant|fast_food"]["outdoor_seating"](${bbox});out tags center;`;
  for (let attempt = 1; !osmRaw; attempt++) {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "User-Agent": "sonnencafe-research/0.1", Accept: "*/*", "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q),
    });
    if (res.ok) osmRaw = (await res.json()).elements;
    else if (attempt >= 5) throw new Error(`Overpass HTTP ${res.status}`);
    else await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
  fs.writeFileSync(osmCache, JSON.stringify(osmRaw));
}
const osm = osmRaw.map((e) => ({ lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, v: e.tags.outdoor_seating }));
const dist = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180));

const rows = [];
for (const p of cands) {
  const file = new URL(`./.cache/classify/${p.id}.json`, import.meta.url);
  if (!fs.existsSync(file)) continue;
  const r = JSON.parse(fs.readFileSync(file, "utf8"));
  const loc = { lat: p.location.latitude, lon: p.location.longitude };
  const m = osm.filter((o) => dist(loc, o) < 30).sort((a, b) => dist(loc, a) - dist(loc, b))[0];
  const osmFlag = m?.v === "yes" ? true : m?.v === "no" ? false : null;
  const googleFlag = p.outdoorSeating ?? null;
  const type = r.seatingType === "forecourt" ? "pavement" : r.seatingType;
  rows.push({
    placeId: p.id,
    name: p.displayName.text,
    address: p.formattedAddress,
    mapsUrl: p.googleMapsUri,
    gemini: r.outdoorSeating,
    type,
    position: r.position,
    confidence: r.confidence,
    googleFlag,
    osmFlag,
    notes: r.notes,
  });
}

const geminiYes = (r) => r.gemini === "yes";
const external = (r) => [r.googleFlag, r.osmFlag].filter((v) => v !== null);
const conflicts = rows.filter((r) => {
  if (r.gemini === "unclear") return false;
  return external(r).some((v) => v !== geminiYes(r));
});

const picked = new Map();
const add = (list, reason, n) => {
  for (const r of list) {
    if (picked.size >= 30 || n <= 0) break;
    if (picked.has(r.placeId)) continue;
    picked.set(r.placeId, { ...r, reason });
    n--;
  }
};
const byConf = (a, b) => b.confidence - a.confidence;

add(rows.filter((r) => ["courtyard", "garden", "terrace"].includes(r.type)), "rarer seating type", 10);
add(rows.filter((r) => r.gemini === "unclear"), "Gemini unclear", 4);
add(conflicts.filter((r) => geminiYes(r)).sort(byConf), "Gemini yes, but Google/OSM say no", 6);
add(conflicts.filter((r) => !geminiYes(r)).sort(byConf), "Gemini no, but Google/OSM say yes", 6);
// Controls: Gemini yes + Google true (+ OSM not against), evenly spaced through the list.
const agreeYes = rows.filter((r) => geminiYes(r) && r.googleFlag === true && r.osmFlag !== false);
const step = Math.max(1, Math.floor(agreeYes.length / 4));
add(agreeYes.filter((_, i) => i % step === 0), "control: all signals agree yes", 4);
const agreeNo = rows.filter((r) => r.gemini === "no" && r.googleFlag !== true && r.osmFlag !== true && r.confidence >= 0.8);
add(agreeNo.filter((_, i) => i % Math.floor(agreeNo.length / 3) === 0), "control: Gemini no, nothing says yes", 3);

const sample = [...picked.values()];
fs.writeFileSync(new URL("./data/seating-review-sample.json", import.meta.url), JSON.stringify(sample, null, 1));

const tally = {};
for (const r of rows) {
  const k = `${r.gemini}${r.gemini === "yes" ? "/" + r.type : ""}`;
  tally[k] = (tally[k] ?? 0) + 1;
}
console.log("classified:", rows.length, tally);
console.log("conflicts with Google/OSM:", conflicts.length, `(Gemini yes: ${conflicts.filter(geminiYes).length}, Gemini no: ${conflicts.filter((r) => !geminiYes(r)).length})`);
console.log(`\nreview sample: ${sample.length}`);
for (const s of sample)
  console.log(`- [${s.reason}] ${s.name} — ${s.gemini}/${s.type} ${s.confidence} google=${s.googleFlag} osm=${s.osmFlag}`);
