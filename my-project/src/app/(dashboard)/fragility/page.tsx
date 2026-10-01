import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { latestReport, type ScenarioReport } from "@/services/stressTest";
import { RunButton } from "./run-button";
import { ResetView } from "@/components/reset-view";

function tone(pct: number) {
  if (pct >= 0.5) return { bar: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", label: "Critical" };
  if (pct >= 0.25) return { bar: "bg-amber-500", text: "text-amber-800", bg: "bg-amber-50", label: "At risk" };
  if (pct > 0) return { bar: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", label: "Monitor" };
  return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Stable" };
}

function headerToneByRate(rate: number) {
  if (rate >= 0.3) return "bg-rose-50 text-rose-700 border-rose-200";
  if (rate >= 0.2) return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

export default async function FragilityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "organiser") redirect("/dashboard");

  const event = await prisma.event.findFirst({
    where: { OR: [{ createdById: user.id }, { headCoordinatorId: user.id }] },
    orderBy: { startsAt: "desc" },
  });

  if (!event) {
    return (
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Fragility Analysis</h2>
        <p className="mt-2 text-sm text-slate-500">
          Monte Carlo stress test across three dropout scenarios (10%, 20%, 30%).
        </p>
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
          You don&apos;t have an event yet. Create one to run a fragility simulation.
        </div>
      </div>
    );
  }

  const report = await latestReport(event.id);

  return (
    <div className="max-w-[1400px]">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Fragility Analysis</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">{event.name}</h2>
          <p className="text-sm text-slate-500 mt-1">
            Monte Carlo: 100 scenarios each at 10%, 20% and 30% random volunteer dropouts.
          </p>
        </div>
        <RunButton eventId={event.id} />
      </div>

      <ResetView>
      {!report ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            No simulation has been run yet. Click <span className="font-semibold">Run simulation</span> to generate a fragility report across three dropout scenarios.
          </p>
          <p className="mt-1 text-xs text-slate-400">Takes ~30–90 seconds (runs 3 × 100 = 300 solves in parallel).</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {report.scenarios.map((s) => (
              <ScenarioCard key={s.dropoutRate} s={s} />
            ))}
          </div>
          <p className="mt-4 text-[11px] text-slate-400 text-right">
            Generated {new Date(report.generatedAt).toLocaleString()} · Report #{report.savedReportId}
          </p>
        </>
      )}
      </ResetView>
    </div>
  );
}

function ScenarioCard({ s }: { s: ScenarioReport }) {
  const pct = Math.round(s.dropoutRate * 100);
  const headCls = headerToneByRate(s.dropoutRate);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className={`px-5 py-4 border-b ${headCls}`}>
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Scenario</span>
          <span className="text-3xl font-bold tracking-tight">{pct}%</span>
        </div>
        <p className="text-[11px] opacity-80 mt-0.5">dropout rate</p>
      </div>

      {/* Headline */}
      <div className="px-5 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Finding</p>
        <h3 className="text-sm font-bold text-slate-900 mt-1 leading-snug">{s.headline}</h3>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Mini label="Runs" value={s.runs.toString()} />
          <Mini label="Fail %" value={`${Math.round(s.overallFailureRate * 100)}%`} />
          <Mini label="Unfilled" value={s.totalUnfilledUnits.toString()} />
        </div>
      </div>

      {/* Zones */}
      <div className="px-5 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Zone fragility</p>
        {s.zoneFragility.length === 0 ? (
          <p className="text-xs text-slate-500">All zones covered.</p>
        ) : (
          <ul className="space-y-2">
            {s.zoneFragility.map((z) => {
              const t = tone(z.fragility);
              const p = Math.round(z.fragility * 100);
              return (
                <li key={z.zoneId}>
                  <div className="flex items-center justify-between mb-0.5 text-xs">
                    <span className="font-medium text-slate-900 truncate">{z.zoneName}</span>
                    <span className="font-mono font-semibold text-slate-900">{p}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full ${t.bar}`} style={{ width: `${Math.max(2, p)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Skills */}
      <div className="px-5 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Skill bottlenecks</p>
        {s.skillShortage.length === 0 ? (
          <p className="text-xs text-slate-500">None.</p>
        ) : (
          <ul className="space-y-1.5">
            {s.skillShortage.slice(0, 4).map((sk) => (
              <li key={sk.skill} className="border-l-2 border-amber-400 pl-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-slate-900">{sk.skill.replace("_", " ")}</span>
                  <span className="text-[10px] text-slate-500">{sk.volunteersWithSkill} have it</span>
                </div>
                <p className="text-[11px] text-slate-600">{sk.recommendation}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Critical volunteers */}
      <div className="px-5 pt-4 pb-5 mt-auto">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Critical volunteers</p>
        {s.criticalVolunteers.length === 0 ? (
          <p className="text-xs text-slate-500">None stand out.</p>
        ) : (
          <ul className="space-y-1.5">
            {s.criticalVolunteers.slice(0, 4).map((v) => {
              const t = tone(v.failureRate);
              return (
                <li key={v.userId} className="flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <span className="font-medium text-slate-900 truncate block">{v.name}</span>
                    <span className="text-[10px] text-slate-500">{v.skills.join(", ") || "—"}</span>
                  </div>
                  <span className={`font-mono font-semibold ${t.text} whitespace-nowrap pl-2`}>
                    {Math.round(v.failureRate * 100)}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-bold text-slate-900 tracking-tight">{value}</p>
    </div>
  );
}
