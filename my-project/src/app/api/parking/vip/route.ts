import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveEvent } from "@/lib/event";
import { publish, TOPIC } from "@/lib/bus";

export async function POST(req: NextRequest) {
  const event = await requireActiveEvent();
  const body = await req.json().catch(() => ({}));
  const guestName = String(body.guestName ?? "").trim();
  const plate = String(body.plate ?? "").trim() || null;
  const expectedArrival = body.expectedArrival ? new Date(body.expectedArrival) : null;
  if (!guestName) return NextResponse.json({ error: "guestName required" }, { status: 400 });

  // Grab the next free VIP spot.
  const taken = await prisma.vipReservation.findMany({
    where: { eventId: event.id, status: "reserved" },
    select: { spotId: true },
  });
  const takenIds = new Set(taken.filter((r) => r.spotId).map((r) => r.spotId!));
  const spot = await prisma.parkingSpot.findFirst({
    where: { eventId: event.id, isVip: true, id: { notIn: Array.from(takenIds) } },
    orderBy: { label: "asc" },
  });
  if (!spot) return NextResponse.json({ error: "no free VIP spots" }, { status: 409 });

  const r = await prisma.vipReservation.create({
    data: {
      eventId: event.id,
      guestName,
      plate,
      expectedArrival,
      spotId: spot.id,
      status: "reserved",
    },
  });
  publish(TOPIC.parking, { kind: "vip-reserved", reservationId: r.id, spotId: spot.id });
  return NextResponse.json({ id: r.id, spotLabel: spot.label });
}
