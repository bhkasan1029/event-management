import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveEvent } from "@/lib/event";
import { getCurrentUser } from "@/lib/auth";
import { nearestOf, distToSegmentMeters, LatLng } from "@/lib/geo";
import { getDirections } from "@/lib/google-directions";
import { ESCALATION_SECONDS } from "@/lib/escalation";
import { publish, TOPIC } from "@/lib/bus";

const CLEAR_PATH_BUFFER_M = 60;

export async function POST(req: NextRequest) {
  const event = await requireActiveEvent();
  const me = await getCurrentUser();
  const body = await req.json().catch(() => ({}));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const description = String(body.description ?? "").trim() || "Injury reported";
  const zoneId = body.zoneId ? Number(body.zoneId) : null;
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }
  const injury: LatLng = { lat, lng };

  // 1. Pick nearest available ambulance.
  const ambulances = await prisma.ambulance.findMany({
    where: { eventId: event.id, status: "available" },
  });
  const nearest = nearestOf(injury, ambulances, (a) => (a.lat && a.lng ? { lat: a.lat, lng: a.lng } : null));
  if (!nearest) {
    return NextResponse.json({ error: "no available ambulance" }, { status: 409 });
  }

  // 2. Ask Google Directions for a driving route.
  const amb = nearest.item;
  const route = await getDirections({ lat: amb.lat!, lng: amb.lng! }, injury, "driving");

  // 3. Find the volunteers along that route and queue "clear path" notifications.
  const liveLocations = await prisma.liveLocation.findMany({
    include: { user: { select: { id: true, name: true, role: true, volunteerSubRole: true } } },
  });
  const volunteersInBuffer = liveLocations.filter((loc) => {
    if (loc.user.role !== "volunteer") return false;
    for (let i = 0; i < route.path.length - 1; i++) {
      if (distToSegmentMeters({ lat: loc.lat, lng: loc.lng }, route.path[i], route.path[i + 1]) <= CLEAR_PATH_BUFFER_M) {
        return true;
      }
    }
    return false;
  });

  // 4. Pick the first-aid zone lead as the initial assignee so escalation can target the head coordinator.
  const firstAidZone = await prisma.zone.findFirst({
    where: { eventId: event.id, type: "first_aid" },
    select: { id: true, leadId: true },
  });
  const assignedToId = firstAidZone?.leadId ?? null;

  // 5. Create issue + mark ambulance dispatched + queue notifications in parallel.
  const [issue] = await Promise.all([
    prisma.issue.create({
      data: {
        eventId: event.id,
        type: "medical",
        description,
        lat,
        lng,
        zoneId: zoneId ?? firstAidZone?.id ?? null,
        reportedById: me?.id ?? null,
        assignedToId,
        ambulanceId: amb.id,
        escalationLevel: 0,
        escalateAt: new Date(Date.now() + ESCALATION_SECONDS * 1000),
        status: "open",
        route: {
          ambulanceLabel: amb.label,
          from: { lat: amb.lat, lng: amb.lng },
          to: injury,
          path: route.path,
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
          clearPathVolunteerIds: volunteersInBuffer.map((v) => v.userId),
        },
      },
    }),
    prisma.ambulance.update({ where: { id: amb.id }, data: { status: "dispatched" } }),
    prisma.notification.createMany({
      data: volunteersInBuffer.map((v) => ({
        userId: v.userId,
        type: "clear_path" as const,
        title: `Clear the path for ${amb.label}`,
        body: `Ambulance en route — step aside near your current location (~${Math.round(nearest.distance)}m away).`,
      })),
    }),
  ]);

  publish(TOPIC.issues, { kind: "medical-dispatch", id: issue.id, ambulanceId: amb.id });
  publish(TOPIC.ambulances, { kind: "dispatched", id: amb.id });

  return NextResponse.json({
    issueId: issue.id,
    ambulance: { id: amb.id, label: amb.label, lat: amb.lat, lng: amb.lng },
    route,
    volunteersAlerted: volunteersInBuffer.length,
  });
}
