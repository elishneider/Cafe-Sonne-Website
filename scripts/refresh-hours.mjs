// Refreshes the opening hours of every café from Google Places and saves them to
// src/data/cafe-hours.json, which the app reads instead of calling Google while it runs.
// Run it now and then (weekly is plenty):  npm run refresh:hours
//
// A café that Google returns no hours for keeps its previous entry, so one bad run can't
// wipe good data.
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.GOOGLE_PLACES_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");

const placeIds = [
  ...fs.readFileSync(new URL("../src/lib/cafes.ts", import.meta.url), "utf8").matchAll(/placeId: "([^"]+)"/g),
].map((m) => m[1]);
for (const c of JSON.parse(fs.readFileSync(new URL("../src/data/zone1-cafes.json", import.meta.url), "utf8"))) placeIds.push(c.placeId);
const unique = [...new Set(placeIds)];

const file = new URL("../src/data/cafe-hours.json", import.meta.url);
const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).hours : {};

// Places days are 0 = Sunday, matching JS getDay(). Split hours (a lunch break) collapse to
// earliest open / latest close, and a close past midnight is capped at 23:59 — the timeline
// only models a single calendar day.
function toWeekly(periods) {
  const weekly = Array(7).fill(null);
  for (const { open, close } of periods) {
    const opens = `${pad(open.hour)}:${pad(open.minute)}`;
    const closes = !close || close.day !== open.day ? "23:59" : `${pad(close.hour)}:${pad(close.minute)}`;
    const ex = weekly[open.day];
    weekly[open.day] = ex ? { opens: opens < ex.opens ? opens : ex.opens, closes: closes > ex.closes ? closes : ex.closes } : { opens, closes };
  }
  return weekly;
}

const hours = {};
let updated = 0, kept = 0, missing = 0;
for (const id of unique) {
  let periods;
  for (let attempt = 1; attempt <= 4 && periods === undefined; attempt++) {
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
        headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "regularOpeningHours.periods" }, signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      periods = (await res.json()).regularOpeningHours?.periods ?? null;
    } catch { await sleep(2000 * attempt); }
  }
  if (periods && periods.length) { hours[id] = toWeekly(periods); updated++; }
  else if (previous[id]) { hours[id] = previous[id]; kept++; }
  else { hours[id] = null; missing++; }
  await sleep(150);
}

fs.writeFileSync(file, JSON.stringify({ updatedAt: new Date().toISOString(), hours }));
console.log(`${unique.length} cafés: ${updated} updated, ${kept} kept from before, ${missing} with no hours`);
