export type LatLng = { lat: number; lng: number };

const R = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function nearestOf<T>(from: LatLng, items: T[], getPos: (t: T) => LatLng | null) {
  let best: { item: T; distance: number } | null = null;
  for (const item of items) {
    const p = getPos(item);
    if (!p) continue;
    const d = haversineMeters(from, p);
    if (!best || d < best.distance) best = { item, distance: d };
  }
  return best;
}

// Distance from a point to a line segment, in meters (planar approximation —
// fine at venue scale).
export function distToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  // Convert degrees to meters at the local latitude so the geometry works.
  const latToM = 111_320;
  const lngToM = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const px = p.lng * lngToM;
  const py = p.lat * latToM;
  const ax = a.lng * lngToM;
  const ay = a.lat * latToM;
  const bx = b.lng * lngToM;
  const by = b.lat * latToM;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const sx = ax + t * dx;
  const sy = ay + t * dy;
  return Math.hypot(px - sx, py - sy);
}

// Decodes a Google Encoded Polyline string into [{lat, lng}].
// Spec: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
export function decodePolyline(encoded: string): LatLng[] {
  const result: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let r = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      r |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += r & 1 ? ~(r >> 1) : r >> 1;
    shift = 0;
    r = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      r |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += r & 1 ? ~(r >> 1) : r >> 1;
    result.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return result;
}
