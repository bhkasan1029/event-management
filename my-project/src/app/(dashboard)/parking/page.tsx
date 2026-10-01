import { ParkingClient } from "./ParkingClient";
import { requireActiveEvent } from "@/lib/event";
import { prisma } from "@/lib/prisma";

export default async function ParkingPage() {
  const event = await requireActiveEvent();
  const zones = await prisma.zone.findMany({
    where: { eventId: event.id },
    select: { id: true, name: true, type: true, polygon: true },
    orderBy: { id: "asc" },
  });

  return (
    <ParkingClient
      center={{ lat: event.centerLat, lng: event.centerLng }}
      zones={zones.map((z) => ({
        id: z.id,
        name: z.name,
        type: z.type,
        polygon: (z.polygon as Array<{ lat: number; lng: number }> | null) ?? [],
      }))}
    />
  );
}
