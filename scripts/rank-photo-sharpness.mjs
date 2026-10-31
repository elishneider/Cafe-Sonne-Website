// Scores how sharp each saved café photo is (variance of the Laplacian: blurry photos have
// few strong edges, so a low score). Local only — no API calls.
// Output: scripts/data/photo-sharpness.json  { "<placeId>-<index>": score }
import fs from "node:fs";
import sharp from "sharp";

const cafes = JSON.parse(fs.readFileSync(new URL("../src/data/zone1-cafes.json", import.meta.url), "utf8"));
const scores = {};
const KERNEL = { width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] };

for (const c of cafes) {
  for (let i = 0; i < 10; i++) {
    const file = new URL(`./.cache/photos/${c.placeId}-${i}.jpg`, import.meta.url);
    if (!fs.existsSync(file)) continue;
    // Same size for every photo so scores are comparable.
    const { data } = await sharp(file.pathname).resize(640, 480, { fit: "inside" }).grayscale().convolve(KERNEL).raw().toBuffer({ resolveWithObject: true });
    let sum = 0, sumSq = 0;
    for (const v of data) { sum += v; sumSq += v * v; }
    const mean = sum / data.length;
    scores[`${c.placeId}-${i}`] = +(sumSq / data.length - mean * mean).toFixed(1);
  }
}
fs.writeFileSync(new URL("./data/photo-sharpness.json", import.meta.url), JSON.stringify(scores));
const vals = Object.values(scores).sort((a, b) => a - b);
const q = (p) => vals[Math.floor(p * vals.length)];
console.log(`${vals.length} photos scored. Percentiles 5/10/25/50/75:`, [0.05, 0.1, 0.25, 0.5, 0.75].map(q));
