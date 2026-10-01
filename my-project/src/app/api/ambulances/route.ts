import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveEvent } from "@/lib/event";

export async function GET() {
  const event = await requireActiveEvent();
  const ambulances = await prisma.ambulance.findMany({
    where: { eventId: event.id },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(
    ambulances.map((a) => ({
      id: a.id,
      label: a.label,
      lat: a.lat,
      lng: a.lng,
      status: a.status,
    })),
  );
}
