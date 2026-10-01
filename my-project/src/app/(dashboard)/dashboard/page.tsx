import { getCurrentUser } from "@/lib/auth";
import { roleLabel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

type Activity = { when: Date; msg: string };

async function getRecentActivity(): Promise<Activity[]> {
  const [issues, evacs] = await Promise.all([
    prisma.issue.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        type: true,
        description: true,
        createdAt: true,
        acknowledgedAt: true,
        resolvedAt: true,
        escalationLevel: true,
        escalateAt: true,
      },
    }),
    prisma.evacuation.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, reason: true, createdAt: true, endedAt: true },
    }),
  ]);

  const items: Activity[] = [];
  for (const i of issues) {
    const label = i.description?.trim() || `${i.type} issue`;
    items.push({ when: i.createdAt, msg: `New ${i.type} issue #${i.id} — ${label}` });
    if (i.acknowledgedAt) items.push({ when: i.acknowledgedAt, msg: `Issue #${i.id} acknowledged` });
    if (i.resolvedAt) items.push({ when: i.resolvedAt, msg: `Issue #${i.id} resolved` });
    if (i.escalationLevel && i.escalationLevel >= 1 && !i.acknowledgedAt && i.escalateAt) {
      items.push({ when: i.escalateAt, msg: `Issue #${i.id} escalated to head coordinator` });
    }
  }
  for (const e of evacs) {
    items.push({ when: e.createdAt, msg: `Evacuation triggered: ${e.reason ?? "no reason given"}` });
    if (e.endedAt) items.push({ when: e.endedAt, msg: `Evacuation #${e.id} ended` });
  }

  return items.sort((a, b) => b.when.getTime() - a.when.getTime()).slice(0, 8);
}

function relTime(d: Date) {
  const diff = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

type Kpi = { label: string; value: string; delta?: string; tone?: "teal" | "amber" | "blue" | "rose" };

function kpisFor(role: string, sub?: string): Kpi[] {
  if (role === "organiser") {
    return [
      { label: "Active events", value: "3", delta: "+1 this week", tone: "teal" },
      { label: "Volunteers checked in", value: "42 / 56", delta: "75% rate", tone: "blue" },
      { label: "Open issues", value: "2", delta: "1 escalated", tone: "rose" },
      { label: "Low-stock items", value: "4", delta: "Urgency 7.1", tone: "amber" },
    ];
  }
  if (role === "volunteer") {
    return [
      { label: "Tasks today", value: "5", delta: "2 completed", tone: "teal" },
      { label: "Next shift", value: "11:30", delta: "First Aid · Zone B", tone: "blue" },
      { label: "Fairness score", value: "0.82", delta: "Balanced", tone: "teal" },
      ...(sub === "team_lead"
        ? [{ label: "Team on-shift", value: "6 / 8", delta: "2 pending", tone: "amber" as const }]
        : [{ label: "Hours this week", value: "6.5", tone: "blue" as const }]),
    ];
  }
  // attendee / participant
  return [
    { label: "Upcoming events", value: "2", delta: "Next: Sat 10am", tone: "teal" },
    { label: "Carpool matches", value: "3", delta: "2 near you", tone: "blue" },
    { label: "Lost items filed", value: "0", tone: "amber" },
    { label: "Event access", value: "Active", delta: "Pass #EV-7781", tone: "teal" },
  ];
}

const toneClasses: Record<NonNullable<Kpi["tone"]>, string> = {
  teal: "bg-emerald-50 text-emerald-700 border-emerald-100",
  amber: "bg-amber-50 text-amber-800 border-amber-100",
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  rose: "bg-rose-50 text-rose-700 border-rose-100",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const kpis = kpisFor(user.role, user.volunteerSubRole);
  const greeting = user.name.split(" ")[0];
  const activity = await getRecentActivity();

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">{roleLabel(user)}</p>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
          Welcome back, {greeting}.
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Here&apos;s what&apos;s happening across your workspace today.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-slate-500">{k.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{k.value}</p>
            {k.delta && (
              <span
                className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  toneClasses[k.tone ?? "teal"]
                }`}
              >
                {k.delta}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
            <span className="text-[11px] text-slate-400">
              {activity.length} event{activity.length === 1 ? "" : "s"}
            </span>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet. Reports, acknowledgements, and evacuations will show up here.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-[11px] font-mono text-slate-400 w-10 shrink-0 pt-0.5">
                    {relTime(a.when)}
                  </span>
                  <span className="text-slate-700">{a.msg}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
