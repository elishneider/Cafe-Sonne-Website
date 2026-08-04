import { NextResponse } from "next/server";
import { getCafes } from "@/lib/cafes";

export async function GET() {
  const cafes = await getCafes();
  return NextResponse.json({ cafes });
}
