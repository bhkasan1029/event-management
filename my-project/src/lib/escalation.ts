import { prisma } from "./prisma";
import { publish, TOPIC } from "./bus";

export const ESCALATION_SECONDS = 60;

/**
 * Any open issue whose escalateAt is in the past gets its escalationLevel
 * bumped and is reassigned to the head coordinator. Called lazily on every
 * read of the issues list so we don't need a background cron.
 */
export async function runEscalations(eventId: number) {
  const now = new Date();
  const stale = await prisma.issue.findMany({
    where: {
      eventId,
      status: "open",
      escalateAt: { lte: now, not: null },
      escalationLevel: 0,
    },
  });
  if (!stale.length) return 0;

  const head = await prisma.user.findFirst({ where: { role: "organiser" } });

  for (const issue of stale) {
    await prisma.issue.update({
      where: { id: issue.id },
      data: {
        escalationLevel: 1,
        assignedToId: head?.id ?? issue.assignedToId,
      },
    });
    if (head) {
      await prisma.notification.create({
        data: {
          userId: head.id,
          type: "escalation",
          title: `Issue #${issue.id} escalated to you`,
          body: issue.description ?? `${issue.type} issue not acknowledged in ${ESCALATION_SECONDS}s`,
        },
      });
    }
  }
  publish(TOPIC.issues, { kind: "escalated", count: stale.length });
  return stale.length;
}
