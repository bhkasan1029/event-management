import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveEvent } from "@/lib/event";
import { getCurrentUser } from "@/lib/auth";
import { computeEvacuationPlan } from "@/lib/evacuation-planner";
import { publish, TOPIC } from "@/lib/bus";

export async function GET() {
  const event = await requireActiveEvent();
  const [active, nodes, edges] = await Promise.all([
    prisma.evacuation.findFirst({
      where: { eventId: event.id, status: "active" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.venueNode.findMany({ where: { eventId: event.id } }),
    prisma.venueEdge.findMany({ where: { from: { eventId: event.id } } }),
  ]);
  return NextResponse.json({
    active,
    nodes: nodes.map((n) => ({
      id: n.id, name: n.name, lat: n.lat, lng: n.lng, isExit: n.isExit, zoneId: n.zoneId,
    })),
    edges: edges.map((e) => ({
      id: e.id, from: e.fromNode, to: e.toNode, lengthM: Number(e.lengthM), isBlocked: e.isBlocked,
    })),
  });
}

export async function POST(req: NextRequest) {
  const event = await requireActiveEvent();
  const me = await getCurrentUser();
  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason ?? "Evacuation drill").trim();
  const blockedEdgeIds: number[] = Array.isArray(body.blockedEdgeIds) ? body.blockedEdgeIds.map(Number) : [];

  const plan = await computeEvacuationPlan(event.id, blockedEdgeIds);

  const evacuation = await prisma.evacuation.create({
    data: {
      eventId: event.id,
      triggeredById: me?.id ?? null,
      reason,
      blockedEdgeIds,
      plan: plan as unknown as object,
      status: "active",
    },
  });

  // Notify every volunteer.
  const volunteers = await prisma.user.findMany({ where: { role: "volunteer" }, select: { id: true } });
  if (volunteers.length) {
    await prisma.notification.createMany({
      data: volunteers.map((v) => ({
        userId: v.id,
        type: "evacuation" as const,
        title: `EVACUATION: ${reason}`,
        body: "Follow the plan on the Evacuation map.",
      })),
    });
  }
  publish(TOPIC.evacuation, { kind: "triggered", id: evacuation.id });

  return NextResponse.json({ id: evacuation.id, plan });
}

export async function DELETE() {
  const event = await requireActiveEvent();
  await prisma.evacuation.updateMany({
    where: { eventId: event.id, status: "active" },
    data: { status: "ended", endedAt: new Date() },
  });
  publish(TOPIC.evacuation, { kind: "ended" });
  return NextResponse.json({ ok: true });
}
