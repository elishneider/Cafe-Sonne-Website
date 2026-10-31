// Bundles the cafés we are confident about (high/medium skyline confidence) into one file the
// app reads: src/data/zone1-cafes.json. Per café: where it is, what kind of seating, address,
// which photos to lead with, and the LIDAR skyline from each seat point (whole degrees, one bearing per 5°).
import fs from "node:fs";

const skylines = JSON.parse(fs.readFileSync(new URL("./data/skylines-marylebone-soho.json", import.meta.url), "utf8"))
  .filter((c) => !c.pilot && ["high", "medium"].includes(c.confidence));

// Photos with a sharpness score under this are mostly close-ups of a coffee or cake (see
// scripts/rank-photo-sharpness.mjs). They are not wrong, just not useful, so they go last.
const CLOSE_UP_BELOW = 150;
const sharpness = JSON.parse(fs.readFileSync(new URL("./data/photo-sharpness.json", import.meta.url), "utf8"));

// Order for a café's 10 photos: a shot of the place first, then the photo showing the outdoor
// seating, then everything else in Google's order, with close-ups at the very end.
function orderPhotos(placeId, evidencePhotos) {
  const all = Array.from({ length: 10 }, (_, i) => i).filter((i) => sharpness[`${placeId}-${i}`] !== undefined);
  const closeUp = (i) => sharpness[`${placeId}-${i}`] < CLOSE_UP_BELOW;
  const lead = all.find((i) => !closeUp(i)) ?? all[0];
  const seating = evidencePhotos.find((i) => i !== lead && all.includes(i));
  const rest = all.filter((i) => i !== lead && i !== seating);
  return [lead, seating, ...rest.filter((i) => !closeUp(i)), ...rest.filter(closeUp)].filter((i) => i !== undefined);
}

const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const out = [];
for (const c of skylines) {
  const cls = JSON.parse(fs.readFileSync(new URL(`./.cache/classify/${c.id}.json`, import.meta.url), "utf8"));
  const photoPriority = orderPhotos(c.id, cls.evidencePhotos ?? []);
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
