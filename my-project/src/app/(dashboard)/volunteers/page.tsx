import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveEvent } from "@/lib/event";
import { RunAssignmentButton } from "./run-button";
import { ResetView } from "@/components/reset-view";

const ZONE_TYPE_LABELS: Record<string, string> = {
  gate: "Entry Gate",
  registration: "Registration",
  stage: "Stage",
  first_aid: "First Aid / Medical",
  parking: "Parking",
  food: "Food",
  other: "General",
};

const ZONE_TYPE_ORDER = ["first_aid", "parking", "gate", "registration", "stage", "food", "other"];

export default async function VolunteersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "organiser") redirect("/dashboard");

  const event = await getActiveEvent();

  const volunteers = await prisma.user.findMany({
    where: { role: "volunteer" },
    orderBy: { name: "asc" },
    include: {
      assignments: {
        where: { status: "assigned" },
        include: {
          task: {
            include: {
              zone: true,
              timeslot: true,
            },
          },
        },
      },
    },
  });

  // Group assignments by zone type; track unassigned volunteers separately
  const groups = new Map<
    string,
    { volunteerId: number; name: string; skills: string[]; task: string; zoneName: string; slot: string }[]
  >();
  const unassigned: { id: number; name: string; skills: string[] }[] = [];

  for (const v of volunteers) {
    if (v.assignments.length === 0) {
      unassigned.push({ id: v.id, name: v.name, skills: v.skills });
      continue;
    }
    for (const a of v.assignments) {
      const zt = a.task?.zone?.type ?? "other";
      const row = {
        volunteerId: v.id,
        name: v.name,
        skills: v.skills,
        task: a.task?.title ?? "—",
        zoneName: a.task?.zone?.name ?? "—",
        slot: a.task?.timeslot?.label ?? "—",
      };
      if (!groups.has(zt)) groups.set(zt, []);
      groups.get(zt)!.push(row);
    }
  }

  const totalAssigned = Array.from(groups.values()).reduce((n, g) => n + g.length, 0);

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Volunteers</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            {event ? event.name : "Roster"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {volunteers.length} volunteer{volunteers.length !== 1 ? "s" : ""} · {totalAssigned} assignment
            {totalAssigned !== 1 ? "s" : ""} · {unassigned.length} unassigned
          </p>
        </div>
        {event && <RunAssignmentButton eventId={event.id} />}
      </div>

      <ResetView>
        {totalAssigned === 0 && unassigned.length === volunteers.length ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
            No assignments yet. Click <span className="font-semibold">Run assignment</span> to let the solver
            allocate volunteers to tasks.
          </div>
        ) : (
          <div className="space-y-4">
          {ZONE_TYPE_ORDER.filter((zt) => groups.has(zt)).map((zt) => (
            <ZoneGroup key={zt} label={ZONE_TYPE_LABELS[zt]} rows={groups.get(zt)!} />
          ))}

            {unassigned.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Unassigned</h3>
                  <span className="text-xs font-mono text-slate-500">{unassigned.length}</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {unassigned.map((v) => (
                    <li key={v.id} className="flex items-center justify-between px-5 py-3">
                      <span className="font-medium text-slate-900 text-sm">{v.name}</span>
                      <SkillChips skills={v.skills} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </ResetView>
    </div>
  );
}

function ZoneGroup({
  label,
  rows,
}: {
  label: string;
  rows: { volunteerId: number; name: string; skills: string[]; task: string; zoneName: string; slot: string }[];
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-teal-50/60 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
        <span className="text-xs font-mono text-slate-500">{rows.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
            <th className="px-5 py-2">Volunteer</th>
            <th className="px-5 py-2">Skills</th>
            <th className="px-5 py-2">Task</th>
            <th className="px-5 py-2">Zone</th>
            <th className="px-5 py-2">Slot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.volunteerId}-${i}`} className="border-b border-slate-100 last:border-0">
              <td className="px-5 py-2.5 font-medium text-slate-900">{r.name}</td>
              <td className="px-5 py-2.5">
                <SkillChips skills={r.skills} />
              </td>
              <td className="px-5 py-2.5 text-slate-700">{r.task}</td>
              <td className="px-5 py-2.5 text-slate-600">{r.zoneName}</td>
              <td className="px-5 py-2.5 text-slate-600">{r.slot}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SkillChips({ skills }: { skills: string[] }) {
  if (!skills.length) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {skills.map((s) => (
        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
          {s.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}
