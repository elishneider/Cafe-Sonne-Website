import { NextRequest, NextResponse } from "next/server";
import { getHourlyForecast } from "@/lib/googleWeather";

const DEFAULT_LATITUDE = 51.5265;
const DEFAULT_LONGITUDE = -0.0789;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitude = Number(searchParams.get("lat") ?? DEFAULT_LATITUDE);
  const longitude = Number(searchParams.get("lon") ?? DEFAULT_LONGITUDE);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return NextResponse.json({ error: "lat and lon must be numbers" }, { status: 400 });
  }

  const forecast = await getHourlyForecast(latitude, longitude);
  return NextResponse.json({ forecast });
}
