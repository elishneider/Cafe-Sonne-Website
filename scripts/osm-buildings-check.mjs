// Quick look at what OpenStreetMap knows about buildings around each café.
const CAFES = {
  "d1-coffee": [51.5247884, -0.1761794],
  "gails-clifton-road": [51.5256672, -0.1795886],
  "white-mulberries": [51.5206033, -0.1530008],
};
for (const [id, [lat, lon]] of Object.entries(CAFES)) {
  const q = `[out:json][timeout:30];way["building"](around:150,${lat},${lon});out tags;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "User-Agent": "sonnencafe-research/0.1", Accept: "*/*", "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q) });
  if (!res.ok) { console.log(id, "HTTP", res.status); continue; }
  const { elements } = await res.json();
  const withHeight = elements.filter((e) => e.tags?.height).length;
  const withLevels = elements.filter((e) => e.tags?.["building:levels"]).length;
  const neither = elements.filter((e) => !e.tags?.height && !e.tags?.["building:levels"]).length;
  console.log(id, { buildings: elements.length, withHeight, withLevels, neither });
}
