// Bundles the cafés we are confident about (high/medium skyline confidence) into one file the
// app reads: src/data/zone1-cafes.json. Per café: where it is, what kind of seating, address,
// which photos to lead with, an opening-hours snapshot (fallback if live Places hours fail),
// and the LIDAR skyline from each seat point (whole degrees, one bearing per 5°).
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.GOOGLE_PLACES_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");
fs.mkdirSync(new URL("./.cache/hours/", import.meta.url), { recursive: true });

const skylines = JSON.parse(fs.readFileSync(new URL("./data/skylines-marylebone-soho.json", import.meta.url), "utf8"))
  .filter((c) => !c.pilot && ["high", "medium"].includes(c.confidence));

// Same simplification as src/lib/googlePlaces.ts getPlaceWeeklyHours.
async function weeklyHours(placeId) {
  const file = new URL(`./.cache/hours/${placeId}.json`, import.meta.url);
  let periods;
  if (fs.existsSync(file)) periods = JSON.parse(fs.readFileSync(file, "utf8"));
  else {
    for (let attempt = 1; attempt <= 4 && periods === undefined; attempt++) {
      try {
        const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
          headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "regularOpeningHours.periods" }, signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(String(res.status));
        periods = (await res.json()).regularOpeningHours?.periods ?? null;
        fs.writeFileSync(file, JSON.stringify(periods));
      } catch { await sleep(2000 * attempt); }
    }
    await sleep(200);
  }
  if (!periods || !periods.length) return null;
  const weekly = Array(7).fill(null);
  for (const { open, close } of periods) {
    const opens = `${pad(open.hour)}:${pad(open.minute)}`;
    const closes = !close || close.day !== open.day ? "23:59" : `${pad(close.hour)}:${pad(close.minute)}`;
    const ex = weekly[open.day];
    weekly[open.day] = ex ? { opens: opens < ex.opens ? opens : ex.opens, closes: closes > ex.closes ? closes : ex.closes } : { opens, closes };
  }
  return weekly;
}

const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const out = [];
for (const c of skylines) {
  const cls = JSON.parse(fs.readFileSync(new URL(`./.cache/classify/${c.id}.json`, import.meta.url), "utf8"));
  const hours = await weeklyHours(c.id);
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
    weeklyHours: hours,
    confidence: c.confidence,
    skyline: c.lidarProfiles.map((p) => p.map((v) => Math.round(v))),
  });
}
fs.mkdirSync(new URL("../src/data/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../src/data/zone1-cafes.json", import.meta.url), JSON.stringify(out));
console.log(`${out.length} cafés; ${out.filter((c) => !c.weeklyHours).length} without opening hours; ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
