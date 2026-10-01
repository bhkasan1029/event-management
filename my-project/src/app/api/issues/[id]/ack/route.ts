import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { publish, TOPIC } from "@/lib/bus";

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const issueId = Number(id);
  const issue = await prisma.issue.update({
    where: { id: issueId },
    data: { status: "acknowledged", acknowledgedAt: new Date(), assignedToId: me.id, escalateAt: null },
  });
  publish(TOPIC.issues, { kind: "ack", id: issue.id });
  return NextResponse.json({ ok: true });
}
