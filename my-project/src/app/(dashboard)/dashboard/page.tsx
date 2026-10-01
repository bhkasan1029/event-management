import { getCurrentUser } from "@/lib/auth";
import { roleLabel } from "@/lib/auth";
import { redirect } from "next/navigation";

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
            <button className="text-xs text-teal-700 font-medium hover:underline">View all</button>
          </div>
          <ul className="space-y-3">
            {[
              { t: "2m", msg: "Zone A reports crowd above capacity" },
              { t: "14m", msg: "Water bottles below threshold (urgency 7.1)" },
              { t: "28m", msg: "3 volunteers reassigned from Food → Entry Gate" },
              { t: "1h", msg: "Issue #412 acknowledged by Zone B lead" },
            ].map((a) => (
              <li key={a.t} className="flex items-start gap-3 text-sm">
                <span className="text-[11px] font-mono text-slate-400 w-10 shrink-0 pt-0.5">{a.t}</span>
                <span className="text-slate-700">{a.msg}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Quick actions</h3>
          <div className="space-y-2">
            {(user.role === "organiser"
              ? ["Create event", "Add inventory item", "Open parking", "Broadcast message"]
              : user.role === "volunteer"
              ? ["Check in", "Report issue", "View my schedule", "Request break"]
              : ["Browse events", "Join carpool", "Report lost item", "View my pass"]
            ).map((label) => (
              <button
                key={label}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
