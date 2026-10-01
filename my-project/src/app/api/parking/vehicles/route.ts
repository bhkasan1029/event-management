import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveEvent } from "@/lib/event";
import { publish, TOPIC } from "@/lib/bus";

export async function POST(req: NextRequest) {
  const event = await requireActiveEvent();
  const body = await req.json().catch(() => ({}));
  const plate = String(body.plate ?? "").trim().toUpperCase();
  const ownerName = String(body.ownerName ?? "").trim() || null;
  const spotLabel = String(body.spotLabel ?? "").trim();
  if (!plate) return NextResponse.json({ error: "plate required" }, { status: 400 });

  let spotId: number | null = null;
  if (spotLabel) {
    const spot = await prisma.parkingSpot.findFirst({
      where: { eventId: event.id, label: spotLabel },
    });
    if (!spot) return NextResponse.json({ error: `unknown spot ${spotLabel}` }, { status: 404 });

    // One vehicle per spot at a time.
    const taken = await prisma.vehicle.findFirst({ where: { spotId: spot.id, exitedAt: null } });
    if (taken) return NextResponse.json({ error: `spot ${spotLabel} is occupied` }, { status: 409 });
    spotId = spot.id;
  } else {
    // Auto-assign to the next free non-VIP spot.
    const occupied = await prisma.vehicle.findMany({
      where: { eventId: event.id, exitedAt: null, spotId: { not: null } },
      select: { spotId: true },
    });
    const takenIds = new Set(occupied.map((v) => v.spotId!));
    const reserved = await prisma.vipReservation.findMany({
      where: { eventId: event.id, status: "reserved" },
      select: { spotId: true },
    });
    const reservedIds = new Set(reserved.filter((r) => r.spotId).map((r) => r.spotId!));
    const next = await prisma.parkingSpot.findFirst({
      where: {
        eventId: event.id,
        isVip: false,
        id: { notIn: Array.from(new Set([...takenIds, ...reservedIds])) },
      },
      orderBy: { label: "asc" },
    });
    if (!next) return NextResponse.json({ error: "no free non-VIP spots" }, { status: 409 });
    spotId = next.id;
  }

  const vehicle = await prisma.vehicle.create({
    data: { eventId: event.id, plate, ownerName, spotId, isVip: false },
    include: { spot: true },
  });

  publish(TOPIC.parking, { kind: "entered", vehicleId: vehicle.id, spotId });
  return NextResponse.json({
    id: vehicle.id,
    plate: vehicle.plate,
    ownerName: vehicle.ownerName,
    spotLabel: vehicle.spot?.label ?? null,
  });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const v = await prisma.vehicle.update({
    where: { id },
    data: { exitedAt: new Date() },
  });
  publish(TOPIC.parking, { kind: "exited", vehicleId: v.id, spotId: v.spotId });
  return NextResponse.json({ ok: true });
}
