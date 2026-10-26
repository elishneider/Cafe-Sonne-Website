// Runs the photo reading over every candidate café (skips ones already done, so it can be
// stopped and restarted). Usage: node scripts/run-classification.mjs
import fs from "node:fs";
import { classify } from "./classify-seating.mjs";

const cands = JSON.parse(fs.readFileSync(new URL("./data/marylebone-soho-candidates.json", import.meta.url), "utf8"))
  .filter((p) => ["cafe", "coffee_shop"].includes(p.primaryType) && p.outdoorSeating !== false);
console.log(`${cands.length} cafés to read`);
let done = 0, failed = 0;
for (const p of cands) {
  try {
    const r = await classify(p.id);
    done++;
    console.log(`[${done + failed}/${cands.length}] ${r.name}: ${r.outdoorSeating}/${r.seatingType}/${r.position} (${r.confidence}) google=${r.googleFlag}`);
  } catch (e) {
    failed++;
    console.log(`[${done + failed}/${cands.length}] ${p.displayName.text}: FAILED ${String(e.message).slice(0, 120)}`);
  }
  await new Promise((r) => setTimeout(r, 2500));
}
console.log(`finished: ${done} done, ${failed} failed`);
