// Fetches reviews, description and photo list for chosen places (Places API New, Place Details).
// Usage: node scripts/fetch-place-details.mjs <placeId> [<placeId> ...]
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.GOOGLE_PLACES_API_KEY;
const FIELDS = "id,displayName,formattedAddress,location,primaryType,outdoorSeating,editorialSummary,generativeSummary,reviews,photos";
fs.mkdirSync(new URL("./.cache/details/", import.meta.url), { recursive: true });

const OUTDOOR = /\b(outside|outdoor|outdoors|terrace|patio|pavement|sidewalk|garden|courtyard|alfresco|al fresco|al-fresco|sit(?:ting)? out|tables? (?:out|outside)|heated|parasol|umbrella)\b/i;

export async function getDetails(id) {
  const file = new URL(`./.cache/details/${id}.json`, import.meta.url);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const res = await fetch(`https://places.googleapis.com/v1/places/${id}`, { headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": FIELDS } });
  if (!res.ok) throw new Error(`details ${id}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

if (process.argv[1].endsWith("fetch-place-details.mjs")) {
  for (const id of process.argv.slice(2)) {
    const d = await getDetails(id);
    const reviews = d.reviews ?? [];
    const hits = reviews.filter((r) => OUTDOOR.test(r.text?.text ?? r.originalText?.text ?? ""));
    console.log(`\n${d.displayName?.text} — outdoorSeating flag: ${d.outdoorSeating} | photos: ${d.photos?.length ?? 0} | reviews returned: ${reviews.length} | mention outdoors: ${hits.length}`);
    if (d.editorialSummary?.text) console.log("  summary:", d.editorialSummary.text);
    if (d.generativeSummary?.overview?.text) console.log("  AI summary:", d.generativeSummary.overview.text.slice(0, 220));
    for (const r of hits.slice(0, 2)) console.log("  review:", (r.text?.text ?? "").replace(/\s+/g, " ").slice(0, 200));
  }
}
