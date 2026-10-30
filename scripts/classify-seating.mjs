// Reads a café's Google photos (+ any review text about outdoors) with Gemini and records
// whether it has outdoor seating, what type, and roughly where.
// Usage: node scripts/classify-seating.mjs <placeId> [<placeId> ...]
import fs from "node:fs";
import { getDetails } from "./fetch-place-details.mjs";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim();
}
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY, GEMINI_KEY = process.env.GOOGLE_STUDIO_API_KEY;
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
const MAX_PHOTOS = 10;
fs.mkdirSync(new URL("./.cache/classify/", import.meta.url), { recursive: true });
fs.mkdirSync(new URL("./.cache/photos/", import.meta.url), { recursive: true });

const OUTDOOR = /\b(outside|outdoor|outdoors|terrace|patio|pavement|sidewalk|garden|courtyard|alfresco|al fresco|sit(?:ting)? out|parasol|umbrella)\b/i;

const PROMPT = `You are checking photos of a café in London to find out whether it has OUTDOOR SEATING for customers, using photos taken by the public. Photos are numbered in the order given (starting at 0).

Seating types (choose the one that best fits the main outdoor seating):
- pavement: tables and chairs right outside the front of the café — on the public pavement or on the café's own paved space just in front of the shop (do not try to tell these apart).
- terrace: a raised or clearly defined platform / decked or railed area, often larger.
- courtyard: a space enclosed on most sides by surrounding buildings (often behind or beside the café).
- garden: an informal planted or grassy outdoor area.
- none: no outdoor seating is visible in any photo.
- unclear: some hint but not enough to decide.

Be careful: tables INSIDE the shop, even right next to a window, are not outdoor seating. Only count seating that is clearly outside. If photos show only food, drinks or interiors, answer "none" with LOW confidence rather than guessing; absence of evidence is not proof, so use "unclear" if the photos simply don't show the exterior.

Answer in JSON.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    outdoorSeating: { type: "STRING", enum: ["yes", "no", "unclear"] },
    seatingType: { type: "STRING", enum: ["pavement", "terrace", "courtyard", "garden", "none", "unclear"] },
    position: { type: "STRING", enum: ["front of shop", "side of shop", "rear of shop", "corner", "away from shop", "unclear"] },
    confidence: { type: "NUMBER" },
    evidencePhotos: { type: "ARRAY", items: { type: "INTEGER" } },
    notes: { type: "STRING" },
  },
  required: ["outdoorSeating", "seatingType", "position", "confidence", "evidencePhotos", "notes"],
};

async function getPhoto(name, idx, placeId) {
  const file = new URL(`./.cache/photos/${placeId}-${idx}.jpg`, import.meta.url);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  let buf;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=800&key=${PLACES_KEY}`, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`photo ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
      break;
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  fs.writeFileSync(file, buf);
  return buf;
}

export async function classify(placeId) {
  const cache = new URL(`./.cache/classify/${placeId}.json`, import.meta.url);
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, "utf8"));
  const d = await getDetails(placeId);
  const photos = (d.photos ?? []).slice(0, MAX_PHOTOS);
  const parts = [{ text: PROMPT }];
  for (let i = 0; i < photos.length; i++) {
    parts.push({ text: `Photo ${i}:` });
    parts.push({ inline_data: { mime_type: "image/jpeg", data: (await getPhoto(photos[i].name, i, placeId)).toString("base64") } });
  }
  const reviewBits = (d.reviews ?? []).map((r) => r.text?.text ?? "").filter((t) => OUTDOOR.test(t)).map((t) => t.replace(/\s+/g, " ").slice(0, 300));
  parts.push({ text: `Café name: ${d.displayName?.text}.\n` + (reviewBits.length ? `Reviews mentioning outdoors:\n- ${reviewBits.join("\n- ")}` : "No review mentions outdoor seating.") });

  for (let attempt = 1; attempt <= 5; attempt++) {
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      signal: AbortSignal.timeout(90_000),
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 } }),
      });
    } catch (e) {
      console.log(`  (attempt ${attempt} failed: ${e.name}) retrying…`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
      continue;
    }
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 8000 * attempt)); continue; }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const out = JSON.parse(data.candidates[0].content.parts[0].text);
    const result = { placeId, name: d.displayName?.text, googleFlag: d.outdoorSeating ?? null, photosUsed: photos.length, model: MODEL, ...out };
    fs.writeFileSync(cache, JSON.stringify(result, null, 1));
    return result;
  }
  throw new Error("Gemini kept failing");
}

if (process.argv[1].endsWith("classify-seating.mjs")) {
  for (const id of process.argv.slice(2)) {
    const r = await classify(id);
    console.log(`${r.name}  [Google flag: ${r.googleFlag}]\n  -> ${r.outdoorSeating} / ${r.seatingType} / ${r.position} (confidence ${r.confidence})  photos: ${r.evidencePhotos.join(",")}\n  ${r.notes}\n`);
    await new Promise((r) => setTimeout(r, 4000));
  }
}
