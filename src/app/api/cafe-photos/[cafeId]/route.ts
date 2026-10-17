import { NextRequest, NextResponse } from "next/server";
import { getCafePhotoCount } from "@/lib/cafePhotos";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ cafeId: string }> }) {
  const { cafeId } = await params;
  const count = await getCafePhotoCount(cafeId);
  return NextResponse.json({ count });
}
