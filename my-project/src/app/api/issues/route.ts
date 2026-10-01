import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveEvent } from "@/lib/event";
import { getCurrentUser } from "@/lib/auth";
import { runEscalations, ESCALATION_SECONDS } from "@/lib/escalation";
import { publish, TOPIC } from "@/lib/bus";

export async function GET() {
  const event = await requireActiveEvent();
  await runEscalations(event.id);
  const issues = await prisma.issue.findMany({
    where: { eventId: event.id, status: { in: ["open", "acknowledged"] } },
    include: {
      zone: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, role: true } },
      ambulance: { select: { id: true, label: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    issues.map((i) => ({
      id: i.id,
      type: i.type,
      status: i.status,
      description: i.description,
      lat: i.lat,
      lng: i.lng,
      zone: i.zone,
      reportedBy: i.reportedBy,
      assignedTo: i.assignedTo,
      ambulance: i.ambulance,
      escalationLevel: i.escalationLevel,
      createdAt: i.createdAt,
      acknowledgedAt: i.acknowledgedAt,
      escalateAt: i.escalateAt,
      route: i.route,
    })),
  );
}

export async function POST(req: NextRequest) {
  const event = await requireActiveEvent();
  const me = await getCurrentUser();
  const body = await req.json().catch(() => ({}));
  const type = String(body.type ?? "other");
  const description = String(body.description ?? "").trim() || null;
  const zoneId = body.zoneId ? Number(body.zoneId) : null;
  const lat = typeof body.lat === "number" ? body.lat : null;
  const lng = typeof body.lng === "number" ? body.lng : null;

  if (!["medical", "crowd", "equipment", "other"].includes(type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  // Figure out who to route to first: zone lead if the zone has one, else head coordinator.
  let assignedToId: number | null = null;
  if (zoneId) {
    const zone = await prisma.zone.findUnique({ where: { id: zoneId }, select: { leadId: true } });
    assignedToId = zone?.leadId ?? null;
  }
  if (!assignedToId) {
    const head = await prisma.user.findFirst({ where: { role: "organiser" } });
    assignedToId = head?.id ?? null;
  }

  const escalateAt = new Date(Date.now() + ESCALATION_SECONDS * 1000);

  const issue = await prisma.issue.create({
    data: {
      eventId: event.id,
      type: type as "medical" | "crowd" | "equipment" | "other",
      description,
      zoneId,
      lat,
      lng,
      reportedById: me?.id ?? null,
      assignedToId,
      escalationLevel: 0,
      escalateAt,
      status: "open",
    },
  });

  if (assignedToId) {
    await prisma.notification.create({
      data: {
        userId: assignedToId,
        type: "general",
        title: `New ${type} issue in your zone`,
        body: description ?? `Issue #${issue.id}`,
      },
    });
  }

  publish(TOPIC.issues, { kind: "created", id: issue.id });
  return NextResponse.json({ id: issue.id, escalateAt: issue.escalateAt });
}
