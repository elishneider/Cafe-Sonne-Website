export type PlacePhoto = {
  contentType: string;
  bytes: ArrayBuffer;
};

// Kept server-side only — never sent to the client. The proxy routes are what
// the browser actually talks to.
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function getPlacePhotoNames(placeId: string, maxCount = 10): Promise<string[]> {
  if (!API_KEY) return [];

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "photos.name",
    },
  });
  if (!res.ok) return [];

  const details = await res.json();
  const names = ((details.photos ?? []) as { name: string }[]).map((p) => p.name);
  return names.slice(0, maxCount);
}

export async function getPlacePhotoMedia(photoName: string, maxWidthPx = 1200): Promise<PlacePhoto | null> {
  if (!API_KEY) return null;

  const res = await fetch(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${API_KEY}`,
  );
  if (!res.ok) return null;

  return {
    contentType: res.headers.get("content-type") ?? "image/jpeg",
    bytes: await res.arrayBuffer(),
  };
}
