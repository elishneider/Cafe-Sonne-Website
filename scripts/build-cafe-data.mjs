// Bundles the cafés we are confident about (high/medium skyline confidence) into one file the
// app reads: src/data/zone1-cafes.json. Per café: where it is, what kind of seating, address,
// which photos to lead with, and the LIDAR skyline from each seat point (whole degrees, one bearing per 5°).
import fs from "node:fs";

const skylines = JSON.parse(fs.readFileSync(new URL("./data/skylines-marylebone-soho.json", import.meta.url), "utf8"))
  .filter((c) => !c.pilot && ["high", "medium"].includes(c.confidence));

const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const out = [];
for (const c of skylines) {
  const cls = JSON.parse(fs.readFileSync(new URL(`./.cache/classify/${c.id}.json`, import.meta.url), "utf8"));
  // Lead with the shop front (photo 0), then the photos Gemini used as evidence of the seating.
  const photoPriority = [0, ...(cls.evidencePhotos ?? []).filter((i) => i > 0)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
  out.push({
    id: `${slug(c.name)}-${c.id.slice(-6).toLowerCase()}`,
    name: c.name,
    placeId: c.id,
    latitude: c.lat,
    longitude: c.lon,
    seatingType: c.type,
    addressLine: c.address.split(",")[0],
    photoPriority,
    confidence: c.confidence,
    skyline: c.lidarProfiles.map((p) => p.map((v) => Math.round(v))),
  });
}
fs.mkdirSync(new URL("../src/data/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../src/data/zone1-cafes.json", import.meta.url), JSON.stringify(out));
console.log(`${out.length} cafés; ${(JSON.stringify(out).length / 1024).toFixed(0)} KB. Opening hours live in src/data/cafe-hours.json (npm run refresh:hours).`);
