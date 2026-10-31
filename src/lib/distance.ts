type Point = { latitude: number; longitude: number };

// Straight-line distance in metres — plenty accurate for ranking cafés by "nearest".
export function distanceMetres(a: Point, b: Point) {
  const dLat = (a.latitude - b.latitude) * 111_320;
  const dLon = (a.longitude - b.longitude) * 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}
