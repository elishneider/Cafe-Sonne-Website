export type PlacePhoto = {
  contentType: string;
  bytes: ArrayBuffer;
};

// Kept server-side only — never sent to the client. The proxy route below is what
// the browser actually talks to.
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function getPlacePhoto(placeId: string): Promise<PlacePhoto | null> {
  if (!API_KEY) return null;

  const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "photos.name",
    },
  });
  if (!detailsRes.ok) return null;

  const details = await detailsRes.json();
  const photoName = details.photos?.[0]?.name as string | undefined;
  if (!photoName) return null;

  const mediaRes = await fetch(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=640&key=${API_KEY}`,
  );
  if (!mediaRes.ok) return null;

  return {
    contentType: mediaRes.headers.get("content-type") ?? "image/jpeg",
    bytes: await mediaRes.arrayBuffer(),
  };
}
