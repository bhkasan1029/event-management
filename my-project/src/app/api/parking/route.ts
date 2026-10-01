import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveEvent } from "@/lib/event";

export async function GET() {
  const event = await requireActiveEvent();
  const spots = await prisma.parkingSpot.findMany({
    where: { eventId: event.id },
    orderBy: { label: "asc" },
  });

  const [activeVehicles, reservations] = await Promise.all([
    prisma.vehicle.findMany({
      where: { eventId: event.id, exitedAt: null },
    }),
    prisma.vipReservation.findMany({
      where: { eventId: event.id, status: "reserved" },
    }),
  ]);

  const vehicleBySpot = new Map(
    activeVehicles.filter((v) => v.spotId).map((v) => [v.spotId!, v]),
  );
  const reservationBySpot = new Map(
    reservations.filter((r) => r.spotId).map((r) => [r.spotId!, r]),
  );

  const items = spots.map((s) => {
    const vehicle = vehicleBySpot.get(s.id);
    const reservation = reservationBySpot.get(s.id);
    let status: "free" | "occupied" | "reserved_vip" = "free";
    if (vehicle) status = "occupied";
    else if (reservation) status = "reserved_vip";
    return {
      id: s.id,
      label: s.label,
      lot: s.lot,
      isVip: s.isVip ?? false,
      lat: s.lat,
      lng: s.lng,
      status,
      vehicleId: vehicle?.id ?? null,
      plate: vehicle?.plate ?? null,
      ownerName: vehicle?.ownerName ?? null,
      reservedFor: reservation?.guestName ?? null,
      reservedAt: reservation?.expectedArrival ?? null,
    };
  });

  const total = items.length;
  const occupied = items.filter((i) => i.status === "occupied").length;
  const reserved = items.filter((i) => i.status === "reserved_vip").length;
  const free = total - occupied - reserved;

  return NextResponse.json({
    counts: { total, occupied, reserved, free, vip: items.filter((i) => i.isVip).length },
    spots: items,
    reservations: reservations.map((r) => ({
      id: r.id,
      guestName: r.guestName,
      plate: r.plate,
      spotId: r.spotId,
      expectedArrival: r.expectedArrival,
      status: r.status,
    })),
  });
}
