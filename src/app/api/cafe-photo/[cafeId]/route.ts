import { NextRequest, NextResponse } from "next/server";
import { getCafes } from "@/lib/cafes";
import { getPlacePhoto } from "@/lib/googlePlaces";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedPhoto = { contentType: string; bytes: ArrayBuffer; cachedAt: number };
const cache = new Map<string, CachedPhoto>();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ cafeId: string }> }) {
  const { cafeId } = await params;

  const cached = cache.get(cafeId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return new NextResponse(cached.bytes, {
      headers: { "Content-Type": cached.contentType, "Cache-Control": "public, max-age=86400" },
    });
  }

  const cafes = await getCafes();
  const cafe = cafes.find((c) => c.id === cafeId);
  if (!cafe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const photo = await getPlacePhoto(cafe.placeId);
  if (!photo) {
    return NextResponse.json({ error: "No photo available" }, { status: 404 });
  }

  cache.set(cafeId, { contentType: photo.contentType, bytes: photo.bytes, cachedAt: Date.now() });

  return new NextResponse(photo.bytes, {
    headers: { "Content-Type": photo.contentType, "Cache-Control": "public, max-age=86400" },
  });
}
