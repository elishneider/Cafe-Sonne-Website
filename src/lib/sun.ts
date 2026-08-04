import * as SunCalc from "suncalc";

export type SunPosition = {
  date: string;
  latitude: number;
  longitude: number;
  altitudeDeg: number;
  azimuthDeg: number;
  isDaytime: boolean;
  sunrise: string | null;
  sunset: string | null;
  solarNoon: string;
};

export function getSunPosition(latitude: number, longitude: number, date = new Date()): SunPosition {
  const position = SunCalc.getPosition(date, latitude, longitude);
  const times = SunCalc.getTimes(date, latitude, longitude);

  return {
    date: date.toISOString(),
    latitude,
    longitude,
    altitudeDeg: position.altitude,
    azimuthDeg: position.azimuth,
    isDaytime: position.altitude > 0,
    sunrise: times.sunrise?.toISOString() ?? null,
    sunset: times.sunset?.toISOString() ?? null,
    solarNoon: times.solarNoon.toISOString(),
  };
}
