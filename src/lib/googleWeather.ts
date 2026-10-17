export type HourlyWeather = {
  time: Date;
  cloudCoverPct: number;
  isRaining: boolean;
};

// Kept server-side only — never sent to the client.
const API_KEY = process.env.GOOGLE_WEATHER_API_KEY;
const BASE_URL = "https://weather.googleapis.com/v1/forecast/hours:lookup";
const FORECAST_HOURS = 48;
const PAGE_SIZE = 24;

type ForecastHoursResponse = {
  forecastHours: Array<{
    interval: { startTime: string };
    cloudCover?: number;
    precipitation?: { qpf?: { quantity?: number } };
  }>;
  nextPageToken?: string;
};

async function fetchPage(
  latitude: number,
  longitude: number,
  pageToken?: string,
): Promise<ForecastHoursResponse> {
  const params = new URLSearchParams({
    key: API_KEY!,
    "location.latitude": String(latitude),
    "location.longitude": String(longitude),
    hours: String(FORECAST_HOURS),
    pageSize: String(PAGE_SIZE),
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Google Weather request failed: ${res.status}`);
  return res.json();
}

// Two pages of 24h each — the API caps a single page at 24 hours regardless of the
// `hours` param, so getting the full 48h horizon needs one follow-up page fetch.
export async function getHourlyForecast(latitude: number, longitude: number): Promise<HourlyWeather[]> {
  if (!API_KEY) return [];

  const first = await fetchPage(latitude, longitude);
  const pages = [first];
  if (first.nextPageToken) {
    pages.push(await fetchPage(latitude, longitude, first.nextPageToken));
  }

  return pages.flatMap((page) =>
    page.forecastHours.map((hour) => ({
      time: new Date(hour.interval.startTime),
      cloudCoverPct: hour.cloudCover ?? 0,
      isRaining: (hour.precipitation?.qpf?.quantity ?? 0) > 0,
    })),
  );
}
