import { decodePolyline, LatLng } from "./geo";

type DirectionsResult = {
  path: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
};

/**
 * Server-side wrapper around the Directions API. Falls back to a straight
 * line between the two points if the key is missing or the request fails,
 * so the UI always has something to draw.
 */
export async function getDirections(from: LatLng, to: LatLng, mode: "driving" | "walking" = "driving"): Promise<DirectionsResult> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const fallback: DirectionsResult = {
    path: [from, to],
    distanceMeters: haversine(from, to),
    durationSeconds: Math.round((haversine(from, to) / (mode === "driving" ? 8.3 : 1.4))),
  };
  if (!key) return fallback;

  const url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${from.lat},${from.lng}` +
    `&destination=${to.lat},${to.lng}&mode=${mode}&key=${key}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.status !== "OK" || !data.routes?.length) return fallback;
    const route = data.routes[0];
    const leg = route.legs[0];
    const encoded = route.overview_polyline?.points;
    return {
      path: encoded ? decodePolyline(encoded) : [from, to],
      distanceMeters: leg.distance?.value ?? fallback.distanceMeters,
      durationSeconds: leg.duration?.value ?? fallback.durationSeconds,
    };
  } catch {
    return fallback;
  }
}

function haversine(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
