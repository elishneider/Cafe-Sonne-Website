import type { Cafe } from "./cafes";

// Google Maps "universal" URL: opens the Maps app on phones and maps.google.com on desktop.
// The place ID pins it to the exact café; the text query is the fallback.
export function getGoogleMapsUrl(cafe: Pick<Cafe, "name" | "addressLine" | "placeId">): string {
  const params = new URLSearchParams({
    api: "1",
    query: `${cafe.name}, ${cafe.addressLine}, London`,
    query_place_id: cafe.placeId,
  });
  return `https://www.google.com/maps/search/?${params}`;
}
