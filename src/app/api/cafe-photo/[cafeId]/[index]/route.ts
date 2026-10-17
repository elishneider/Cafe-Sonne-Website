import { NextRequest, NextResponse } from "next/server";
import { getCafePhotoMedia } from "@/lib/cafePhotos";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedPhoto = { contentType: string; bytes: ArrayBuffer; cachedAt: number };
const cache = new Map<string, CachedPhoto>();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cafeId: string; index: string }> },
) {
  const { cafeId, index } = await params;
  const photoIndex = Number(index);
  if (!Number.isInteger(photoIndex) || photoIndex < 0) {
    return NextResponse.json({ error: "Invalid photo index" }, { status: 400 });
  }

  const cacheKey = `${cafeId}:${photoIndex}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return new NextResponse(cached.bytes, {
      headers: { "Content-Type": cached.contentType, "Cache-Control": "public, max-age=86400" },
    });
  }

  const photo = await getCafePhotoMedia(cafeId, photoIndex);
  if (!photo) {
    return NextResponse.json({ error: "No photo available" }, { status: 404 });
  }

  cache.set(cacheKey, { contentType: photo.contentType, bytes: photo.bytes, cachedAt: Date.now() });

  return new NextResponse(photo.bytes, {
    headers: { "Content-Type": photo.contentType, "Cache-Control": "public, max-age=86400" },
  });
}
