import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publish, TOPIC } from "@/lib/bus";

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const issueId = Number(id);
  const issue = await prisma.issue.update({
    where: { id: issueId },
    data: { status: "resolved", resolvedAt: new Date() },
    include: { ambulance: true },
  });

  // Free up the ambulance if one was dispatched for this issue.
  if (issue.ambulanceId) {
    await prisma.ambulance.update({
      where: { id: issue.ambulanceId },
      data: { status: "available" },
    });
    publish(TOPIC.ambulances, { kind: "available", id: issue.ambulanceId });
  }
  publish(TOPIC.issues, { kind: "resolved", id: issue.id });
  return NextResponse.json({ ok: true });
}
