export type Weather = {
  cloudCoverPct: number;
  precipitationMm: number;
  weatherCode: number;
  temperatureC: number;
  isRaining: boolean;
};

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Light showers",
  81: "Showers",
  82: "Violent showers",
  95: "Thunderstorm",
};

export function describeWeatherCode(code: number): string {
  return WEATHER_DESCRIPTIONS[code] ?? "Unknown";
}

export async function getWeather(latitude: number, longitude: number): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "cloud_cover,precipitation,weather_code,temperature_2m",
    timezone: "auto",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status}`);
  const data = await res.json();
  const current = data.current;

  return {
    cloudCoverPct: current.cloud_cover,
    precipitationMm: current.precipitation,
    weatherCode: current.weather_code,
    temperatureC: current.temperature_2m,
    isRaining: current.precipitation > 0,
  };
}
