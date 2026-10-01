// src/services/stressTest.ts
import { prisma } from "@/lib/prisma";

const SOLVER_URL = process.env.SOLVER_URL ?? "http://localhost:8001";

export type ZoneFragility = {
  zoneId: number;
  zoneName: string;
  zoneType: string;
  fragility: number;
  totalUnfilled: number;
  totalTasks: number;
};

export type SkillShortage = {
  skill: string;
  shortageUnits: number;
  volunteersWithSkill: number;
  recommendation: string;
};

export type CriticalVolunteer = {
  userId: number;
  name: string;
  skills: string[];
  droppedCount: number;
  failedWhenDropped: number;
  failureRate: number;
};

export type ScenarioReport = {
  dropoutRate: number; // 0.10, 0.20, 0.30
  runs: number;
  runsWithShortage: number;
  overallFailureRate: number;
  totalUnfilledUnits: number;
  headline: string;
  zoneFragility: ZoneFragility[];
  skillShortage: SkillShortage[];
  criticalVolunteers: CriticalVolunteer[];
};

export type TriScenarioReport = {
  savedReportId: number;
  generatedAt: string;
  eventName: string;
  scenarios: ScenarioReport[];
};

type SolverPayload = {
  users: { id: number; skills: string[]; maxHours: number; slots: number[]; prefs: Record<number, number> }[];
  slots: { id: number; hours: number }[];
  tasks: { id: number; zoneId: number; slotId: number; skill: string | null; needed: number }[];
  adjacent: [number, number][];
};

type SolverRaw = {
  runs: number;
  runsWithShortage: number;
  totalUnfilledUnits: number;
  taskFailCount: Record<string, number>;
  zoneFailCount: Record<string, number>;
  skillShortageCount: Record<string, number>;
  userDroppedCount: Record<string, number>;
  userDroppedAndFailed: Record<string, number>;
};

async function loadInputs(eventId: number) {
  const [slots, tasks, volunteers, zones, availability, prefs] = await Promise.all([
    prisma.timeslot.findMany({ where: { eventId }, orderBy: { startsAt: "asc" } }),
    prisma.task.findMany({ where: { eventId } }),
    prisma.user.findMany({ where: { role: "volunteer" } }),
    prisma.zone.findMany({ where: { eventId } }),
    prisma.availability.findMany({ where: { timeslot: { eventId } } }),
    prisma.volunteerPreference.findMany({ where: { zone: { eventId } } }),
  ]);
  if (!slots.length || !tasks.length || !volunteers.length) {
    throw new Error(
      `Event ${eventId} is not simulatable: slots=${slots.length}, tasks=${tasks.length}, volunteers=${volunteers.length}`,
    );
  }

  const availByUser = new Map<number, number[]>();
  for (const a of availability) {
    if (!availByUser.has(a.userId)) availByUser.set(a.userId, []);
    availByUser.get(a.userId)!.push(a.timeslotId);
  }
  const prefsByUser = new Map<number, Record<number, number>>();
  for (const p of prefs) {
    if (!prefsByUser.has(p.userId)) prefsByUser.set(p.userId, {});
    prefsByUser.get(p.userId)![p.zoneId] = p.rank ?? 1;
  }

  const adjacent: [number, number][] = [];
  for (let i = 0; i < slots.length - 1; i++) {
    const gapMin = (slots[i + 1].startsAt.getTime() - slots[i].endsAt.getTime()) / 60000;
    if (gapMin <= 30) adjacent.push([slots[i].id, slots[i + 1].id]);
  }

  const eventSlotIds = new Set(slots.map((s) => s.id));
  const activeVolunteers = volunteers.filter((v) =>
    (availByUser.get(v.id) ?? []).some((sid) => eventSlotIds.has(sid)),
  );

  const payload: SolverPayload = {
    users: activeVolunteers.map((v) => ({
      id: v.id,
      skills: v.skills ?? [],
      maxHours: v.maxHours ?? 8,
      slots: (availByUser.get(v.id) ?? []).filter((sid) => eventSlotIds.has(sid)),
      prefs: prefsByUser.get(v.id) ?? {},
    })),
    slots: slots.map((s) => ({ id: s.id, hours: (s.endsAt.getTime() - s.startsAt.getTime()) / 3.6e6 })),
    tasks: tasks.map((t) => ({
      id: t.id,
      zoneId: t.zoneId!,
      slotId: t.timeslotId!,
      skill: t.requiredSkill,
      needed: t.needed,
    })),
    adjacent,
  };

  return { payload, zones, tasks, activeVolunteers };
}

async function callSolver(payload: SolverPayload, dropoutRate: number, runs: number, innerTimeLimit: number): Promise<SolverRaw> {
  const res = await fetch(`${SOLVER_URL}/stress-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      runs,
      dropoutMin: dropoutRate,
      dropoutMax: dropoutRate,
      innerTimeLimit,
      seed: Math.floor(Math.random() * 1_000_000),
    }),
  });
  if (!res.ok) throw new Error(`Solver returned ${res.status}: ${await res.text()}`);
  return (await res.json()) as SolverRaw;
}

function hydrate(
  raw: SolverRaw,
  dropoutRate: number,
  zones: Awaited<ReturnType<typeof loadInputs>>["zones"],
  tasks: Awaited<ReturnType<typeof loadInputs>>["tasks"],
  activeVolunteers: Awaited<ReturnType<typeof loadInputs>>["activeVolunteers"],
): ScenarioReport {
  const zonesById = new Map(zones.map((z) => [z.id, z]));
  const tasksByZone = new Map<number, typeof tasks>();
  for (const t of tasks) {
    const z = t.zoneId!;
    if (!tasksByZone.has(z)) tasksByZone.set(z, []);
    tasksByZone.get(z)!.push(t);
  }
  const volunteersById = new Map(activeVolunteers.map((v) => [v.id, v]));

  const zoneFragility: ZoneFragility[] = Object.entries(raw.zoneFailCount)
    .map(([zidStr, count]) => {
      const zoneId = Number(zidStr);
      const zone = zonesById.get(zoneId);
      const zoneTasks = tasksByZone.get(zoneId) ?? [];
      const totalUnfilled = zoneTasks.reduce((s, t) => s + (raw.taskFailCount[String(t.id)] ?? 0), 0);
      return {
        zoneId,
        zoneName: zone?.name ?? `Zone ${zoneId}`,
        zoneType: zone?.type ?? "other",
        fragility: raw.runs > 0 ? count / raw.runs : 0,
        totalUnfilled,
        totalTasks: zoneTasks.length,
      };
    })
    .sort((a, b) => b.fragility - a.fragility);

  const skillCounts = new Map<string, number>();
  for (const v of activeVolunteers) for (const s of v.skills ?? []) {
    skillCounts.set(s, (skillCounts.get(s) ?? 0) + 1);
  }
  const skillShortage: SkillShortage[] = Object.entries(raw.skillShortageCount)
    .map(([skill, units]) => {
      const have = skillCounts.get(skill) ?? 0;
      const needed = Math.max(1, Math.ceil(units / raw.runs));
      return {
        skill,
        shortageUnits: units,
        volunteersWithSkill: have,
        recommendation: `Recruit ${needed}+ more with '${skill}' (${have} currently).`,
      };
    })
    .sort((a, b) => b.shortageUnits - a.shortageUnits);

  const criticalVolunteers: CriticalVolunteer[] = Object.entries(raw.userDroppedCount)
    .map(([uidStr, dropped]) => {
      const uid = Number(uidStr);
      const failed = raw.userDroppedAndFailed[uidStr] ?? 0;
      const v = volunteersById.get(uid);
      return {
        userId: uid,
        name: v?.name ?? `User ${uid}`,
        skills: v?.skills ?? [],
        droppedCount: dropped,
        failedWhenDropped: failed,
        failureRate: dropped > 0 ? failed / dropped : 0,
      };
    })
    .filter((v) => v.droppedCount >= 3)
    .sort((a, b) => b.failureRate - a.failureRate)
    .slice(0, 5);

  const worst = zoneFragility[0];
  const headline = worst
    ? `${worst.zoneName} fails in ${Math.round(worst.fragility * 100)}% of ${raw.runs} scenarios`
    : `All zones held up across ${raw.runs} scenarios`;

  return {
    dropoutRate,
    runs: raw.runs,
    runsWithShortage: raw.runsWithShortage,
    overallFailureRate: raw.runs > 0 ? raw.runsWithShortage / raw.runs : 0,
    totalUnfilledUnits: raw.totalUnfilledUnits,
    headline,
    zoneFragility,
    skillShortage,
    criticalVolunteers,
  };
}

export async function runTriScenario(eventId: number): Promise<TriScenarioReport> {
  const inputs = await loadInputs(eventId);
  const event = await prisma.event.findUnique({ where: { id: eventId } });

  const rates = [0.1, 0.2, 0.3];
  const runs = 100;
  const innerTimeLimit = 0.5;

  // Run all three scenarios in parallel against the Python solver
  const raws = await Promise.all(rates.map((r) => callSolver(inputs.payload, r, runs, innerTimeLimit)));
  const scenarios = raws.map((r, i) => hydrate(r, rates[i], inputs.zones, inputs.tasks, inputs.activeVolunteers));

  const saved = await prisma.riskReport.create({
    data: {
      eventId,
      runs: runs * rates.length,
      results: { scenarios, generatedAt: new Date().toISOString() } as object,
    },
  });

  return {
    savedReportId: saved.id,
    generatedAt: new Date().toISOString(),
    eventName: event?.name ?? "Event",
    scenarios,
  };
}

export async function latestReport(eventId: number): Promise<TriScenarioReport | null> {
  const row = await prisma.riskReport.findFirst({ where: { eventId }, orderBy: { createdAt: "desc" } });
  if (!row) return null;
  const stored = row.results as { scenarios?: ScenarioReport[]; generatedAt?: string };
  if (!stored.scenarios) return null; // old single-scenario rows — ignore, re-run will overwrite
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  return {
    savedReportId: row.id,
    generatedAt: stored.generatedAt ?? row.createdAt.toISOString(),
    eventName: event?.name ?? "Event",
    scenarios: stored.scenarios,
  };
}
