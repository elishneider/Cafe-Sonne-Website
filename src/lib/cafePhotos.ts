import { getCafes } from "./cafes";
import { getPlacePhotoMedia, getPlacePhotoNames, type PlacePhoto } from "./googlePlaces";

const MAX_PHOTOS = 5;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedNames = { names: string[]; cachedAt: number };
const namesCache = new Map<string, CachedNames>();

async function getOrderedPhotoNames(cafeId: string): Promise<string[]> {
  const cached = namesCache.get(cafeId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.names;

  const cafes = await getCafes();
  const cafe = cafes.find((c) => c.id === cafeId);
  if (!cafe) return [];

  const rawNames = await getPlacePhotoNames(cafe.placeId, 10);
  const priority = (cafe.photoPriority ?? []).filter((i) => i < rawNames.length);
  const remaining = rawNames.map((_, i) => i).filter((i) => !priority.includes(i));
  const names = [...priority, ...remaining].slice(0, MAX_PHOTOS).map((i) => rawNames[i]);

  namesCache.set(cafeId, { names, cachedAt: Date.now() });
  return names;
}

export async function getCafePhotoCount(cafeId: string): Promise<number> {
  const names = await getOrderedPhotoNames(cafeId);
  return names.length;
}

export async function getCafePhotoMedia(cafeId: string, index: number): Promise<PlacePhoto | null> {
  const names = await getOrderedPhotoNames(cafeId);
  const name = names[index];
  if (!name) return null;
  return getPlacePhotoMedia(name);
}
