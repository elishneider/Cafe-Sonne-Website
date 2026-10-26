// How many candidate cafés already have an agreed answer from Google's flag and OpenStreetMap?
import fs from "node:fs";
const cands = JSON.parse(fs.readFileSync(new URL("./data/marylebone-soho-candidates.json", import.meta.url), "utf8"))
  .filter((p) => ["cafe", "coffee_shop"].includes(p.primaryType));
const bbox = "51.508,-0.170,51.5255,-0.124";
const q = `[out:json][timeout:60];nwr["amenity"~"cafe|restaurant|fast_food"]["outdoor_seating"](${bbox});out tags center;`;
const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "User-Agent": "sonnencafe-research/0.1", Accept: "*/*", "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q) });
const osm = (await res.json()).elements.map((e) => ({ lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, v: e.tags.outdoor_seating, name: (e.tags.name ?? "").toLowerCase() }));
const dist = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180));
const buckets = { "agree: outdoor yes": 0, "agree: outdoor no": 0, "conflict": 0, "only Google says yes": 0, "only Google says no": 0, "only OSM says yes": 0, "only OSM says no": 0, "no signal at all": 0 };
const uncertain = [];
for (const p of cands) {
  const loc = { lat: p.location.latitude, lon: p.location.longitude };
  const m = osm.filter((o) => dist(loc, o) < 30).sort((a, b) => dist(loc, a) - dist(loc, b))[0];
  const g = p.outdoorSeating, o = m?.v === "yes" ? true : m?.v === "no" ? false : undefined;
  let key;
  if (g !== undefined && o !== undefined) key = g === o ? (g ? "agree: outdoor yes" : "agree: outdoor no") : "conflict";
  else if (g !== undefined) key = g ? "only Google says yes" : "only Google says no";
  else if (o !== undefined) key = o ? "only OSM says yes" : "only OSM says no";
  else key = "no signal at all";
  buckets[key]++;
}
console.log("cafés + coffee shops:", cands.length);
console.log(buckets);
