import { NextRequest, NextResponse } from "next/server";
import { getCafePhotoMedia } from "@/lib/cafePhotos";

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

  const photo = await getCafePhotoMedia(cafeId, 0);
  if (!photo) {
    return NextResponse.json({ error: "No photo available" }, { status: 404 });
  }

  cache.set(cafeId, { contentType: photo.contentType, bytes: photo.bytes, cachedAt: Date.now() });

  return new NextResponse(photo.bytes, {
    headers: { "Content-Type": photo.contentType, "Cache-Control": "public, max-age=86400" },
  });
}
