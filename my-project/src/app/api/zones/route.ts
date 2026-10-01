import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveEvent } from "@/lib/event";

export async function GET() {
  const event = await requireActiveEvent();
  const zones = await prisma.zone.findMany({
    where: { eventId: event.id },
    include: { lead: { select: { id: true, name: true, email: true } } },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(
    zones.map((z) => ({
      id: z.id,
      name: z.name,
      type: z.type,
      capacity: z.capacity,
      polygon: z.polygon ?? [],
      lead: z.lead,
    })),
  );
}
