import { IssuesClient } from "./IssuesClient";
import { requireActiveEvent } from "@/lib/event";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function IssuesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await requireActiveEvent();
  const zones = await prisma.zone.findMany({
    where: { eventId: event.id },
    select: { id: true, name: true, type: true, polygon: true },
    orderBy: { id: "asc" },
  });

  return (
    <IssuesClient
      center={{ lat: event.centerLat, lng: event.centerLng }}
      zones={zones.map((z) => ({
        id: z.id,
        name: z.name,
        type: z.type,
        polygon: (z.polygon as Array<{ lat: number; lng: number }> | null) ?? [],
      }))}
      currentUserId={user.id}
    />
  );
}
