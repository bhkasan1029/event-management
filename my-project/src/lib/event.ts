import { prisma } from "./prisma";

export const DEFAULT_CENTER = { lat: 18.9958, lng: 72.8375 };

export async function getActiveEvent() {
  const event = await prisma.event.findFirst({ orderBy: { id: "asc" } });
  if (!event) return null;
  return {
    id: event.id,
    name: event.name,
    venue: event.venue,
    centerLat: event.centerLat ?? DEFAULT_CENTER.lat,
    centerLng: event.centerLng ?? DEFAULT_CENTER.lng,
  };
}

export async function requireActiveEvent() {
  const e = await getActiveEvent();
  if (!e) throw new Error("No active event found. Run `npx prisma db seed`.");
  return e;
}
